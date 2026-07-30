import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

function disableDocxBrowserStoragePlugin(): Plugin {
  return {
    name: 'disable-docx-browser-storage',
    apply: 'build',
    transform(code, id) {
      if (!id.replaceAll('\\', '/').endsWith('/node_modules/docx/dist/index.mjs')) {
        return
      }

      /*
       * docx 内の非推奨警告設定は localStorage のフラグを読むが、このアプリでは
       * ブラウザストレージを使わないため、常に既定の警告動作へ固定する。
       */
      const transformedCode = code.replace(
        /function config\(name\) \{\s*try \{\s*if \(!global\.localStorage\) return false;\s*\} catch \(_\) \{\s*return false;\s*\}\s*var val = global\.localStorage\[name\];\s*if \(null == val\) return false;\s*return String\(val\)\.toLowerCase\(\) === "true";\s*\}/,
        'function config() {\n\t\treturn false;\n\t}',
      )

      if (transformedCode === code) {
        this.error('docx のブラウザストレージ参照を除去できませんでした。')
      }

      return transformedCode
    },
  }
}

function wrapEntryInIifePlugin(): Plugin {
  return {
    name: 'wrap-entry-in-iife',
    apply: 'build',
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk' || !output.isEntry) {
          continue
        }

        /*
         * 依存ライブラリのエラー文に含まれるヘルプ URL は実行時の通信先ではないため、
         * オフライン成果物ではスキームを外し、外部エンドポイント文字列を残さない。
         */
        const externalHelpUrls = [
          'https://answers.microsoft.com/en-us/msoffice/forum/all/does-word-support-more-than-9-list-levels/d130fdcd-1781-446d-8c84-c6c79124e4d7',
          'https://react.dev/errors/',
          'https://rolldown.rs/in-depth/bundling-cjs#require-external-modules',
          'https://stuk.github.io/jszip/documentation/howto/read_zip.html',
        ]
        for (const url of externalHelpUrls) {
          output.code = output.code.replaceAll(url, url.replace('https://', ''))
        }

        const hasImportMeta = /import\.meta/.test(output.code)

        if (hasImportMeta) {
          this.error(
            `エントリチャンク "${output.fileName}" に classic script では実行できない import.meta が残っています。`,
          )
        }

        /*
         * 圧縮後の空白のない import / export も確実に検出するため、ラップ前のコードを
         * new Function で classic script として構文解析する。生成した関数は呼び出さない。
         */
        try {
          new Function(output.code)
        } catch (error) {
          if (error instanceof SyntaxError) {
            this.error(
              `エントリチャンク "${output.fileName}" を classic script として解釈できません（file:// で起動しなくなります）。元の構文エラー: ${error.message}`,
            )
          }
          throw error
        }

        /*
         * type="module" を外して classic script 化すると module スコープが失われ、
         * トップレベル変数がグローバルを汚染する。IIFE でスコープを閉じ、
         * strict mode も維持する。
         */
        output.code = `(function(){"use strict";\n${output.code}\n})();`
      }
    },
  }
}

function fileProtocolHtmlPlugin(): Plugin {
  return {
    name: 'file-protocol-html',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        /*
         * file:// では外部の module script と crossorigin 付きリソースが
         * CORS 制約で読み込めない。ここを削除すると配布した index.html が
         * ダブルクリックで起動しなくなるため、classic script に変換している。
         */
        const transformedHtml = html
          .replace(
            /^[ \t]*<link\b(?=[^>]*\brel\s*=\s*(?:"modulepreload"|'modulepreload'|modulepreload))[^>]*>\s*(?:\r?\n)?/gim,
            '',
          )
          .replace(/<script\b([^>]*)>/gi, (_tag, attributes: string) => {
            const withoutModuleType = attributes.replace(
              /\s+type\s*=\s*(?:"module"|'module'|module)(?=\s|$)/gi,
              '',
            )
            const withDefer = /\sdefer(?:\s|=|$)/i.test(withoutModuleType)
              ? withoutModuleType
              : `${withoutModuleType} defer`

            return `<script${withDefer}>`
          })
          .replace(/<[^>]+>/g, (tag) =>
            tag.replace(
              /\s+crossorigin(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/gi,
              '',
            ),
          )

        if (
          /<script\b[^>]*\btype\s*=\s*(?:"module"|'module'|module)(?=\s|>)/i.test(
            transformedHtml,
          )
        ) {
          this.error('生成された HTML の script タグに type="module" が残っています。')
        }

        if (
          !/<link\b(?=[^>]*\brel\s*=\s*(?:"stylesheet"|'stylesheet'|stylesheet)(?=\s|>))[^>]*>/i.test(
            transformedHtml,
          )
        ) {
          this.error('生成された HTML に rel="stylesheet" の link タグがありません。')
        }

        return transformedHtml
      },
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    disableDocxBrowserStoragePlugin(),
    wrapEntryInIifePlugin(),
    fileProtocolHtmlPlugin(),
  ],
  build: {
    modulePreload: false,
    assetsInlineLimit: 1024 * 1024,
    target: 'es2022',
    // 単一チャンクにするため必然的に大きくなるので、500 kB 超の警告を抑止する。
    chunkSizeWarningLimit: 2000,
    rolldownOptions: {
      output: {
        // format は指定しない。iife を指定すると CSS が emit されず完全に消えるため。
        codeSplitting: false,
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    globals: false,
  },
})
