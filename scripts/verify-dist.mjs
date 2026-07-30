/*
 * dist/ の成果物が file:// で動く条件を満たしているかを検証するスクリプト。
 *
 * このアプリは dist フォルダをコピーして index.html を直接ダブルクリックして使う
 * （file:// スキーム）ことを前提にしている。file:// では外部の module script が
 * CORS で読めない、動的 import が使えない、外部 CDN が引けない、といった制約があり、
 * ビルド設定を少し変えるだけで「ビルドは成功するのに開くと真っ白 / 無スタイル」に
 * なる。実際に開発中、build.rolldownOptions.output.format:'iife' を指定したせいで
 * CSS が 1 バイトも emit されないという不具合が起きた（ビルドは成功していた）。
 *
 * それを二度と見逃さないため、静的検査に加えて jsdom で実際にスクリプトを評価し、
 * React が #root を描画するところまで確認する。
 * さらに JS / CSS の実ファイルを検査し、外部通信や file:// 非対応 API、
 * classic script として解釈できない構文が成果物へ混入していないことも保証する。
 *
 * 使い方: npm run build && npm run verify:dist
 */
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { JSDOM, VirtualConsole } from 'jsdom'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distDir = path.join(projectRoot, 'dist')
const htmlPath = path.join(distDir, 'index.html')

let html
try {
  html = readFileSync(htmlPath, 'utf8')
} catch {
  console.error('dist/index.html がありません。先に npm run build を実行してください。')
  process.exit(1)
}

const checks = []
const check = (name, ok, detail = '') => checks.push({ name, ok, detail })

const collectArtifactPaths = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)
    return entry.isDirectory() ? collectArtifactPaths(entryPath) : [entryPath]
  })

// --- 静的検査: file:// で壊れる書き方が混ざっていないか ---
check('script タグに type="module" が無い', !/<script[^>]*type\s*=\s*["']?module/i.test(html))
check('crossorigin 属性が無い', !/crossorigin/i.test(html))
check('modulepreload が無い', !/modulepreload/i.test(html))
check('stylesheet の link がある', /<link[^>]*rel\s*=\s*["']?stylesheet/i.test(html))

const absoluteRefs = [...html.matchAll(/(?:src|href)\s*=\s*"(\/[^"]*)"/g)].map((m) => m[1])
check('絶対パス参照が無い', absoluteRefs.length === 0, absoluteRefs.join(', '))
check('http(s) の外部参照が無い', !/(?:src|href)\s*=\s*["']https?:/i.test(html))

const scriptSrc = html.match(/<script[^>]*src="([^"]+)"/i)?.[1]
const cssHref = html.match(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/i)?.[1]
check('script の src を抽出できた', Boolean(scriptSrc), String(scriptSrc))
check('CSS の href を抽出できた', Boolean(cssHref), String(cssHref))

if (!scriptSrc || !cssHref) {
  for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}`)
  process.exit(1)
}

const jsCode = readFileSync(path.join(distDir, scriptSrc.replace(/^\.\//, '')), 'utf8')
const cssCode = readFileSync(path.join(distDir, cssHref.replace(/^\.\//, '')), 'utf8')
const artifactSources = collectArtifactPaths(distDir)
  .filter((filePath) => ['.js', '.css'].includes(path.extname(filePath)))
  .map((filePath) => ({
    fileName: path.relative(distDir, filePath).replaceAll(path.sep, '/'),
    code: readFileSync(filePath, 'utf8'),
  }))
const jsArtifacts = artifactSources.filter(({ fileName }) => fileName.endsWith('.js'))
const cssArtifacts = artifactSources.filter(({ fileName }) => fileName.endsWith('.css'))

check('JS が IIFE でラップされている', jsCode.startsWith('(function(){"use strict";'))
check('JS が })(); で終わる', jsCode.trimEnd().endsWith('})();'))
check('JS に import.meta が無い', !jsCode.includes('import.meta'))
check('CSS が 100kB 以上ある', cssCode.length > 100_000, `${Math.round(cssCode.length / 1024)} kB`)
check('CSS に HeroUI のテーマ変数がある', /--surface|--background|--accent/.test(cssCode))
check('CSS に Tailwind のユーティリティがある', /\.mx-auto|\.font-bold|\.flex/.test(cssCode))

const externalCssUrls = cssArtifacts.flatMap(({ fileName, code }) =>
  [...code.matchAll(/url\(\s*["']?https?:\/\/[^)]*\)/gi)].map(
    ([match]) => `${fileName}: ${match}`,
  ),
)
check(
  'CSS に外部 URL 参照が無い',
  externalCssUrls.length === 0,
  externalCssUrls.join(' | '),
)

const workerUsages = jsArtifacts.flatMap(({ fileName, code }) =>
  [
    ...code.matchAll(
      /\bnew\s+(?:Worker|SharedWorker)\s*\(|\bnavigator\.serviceWorker\b/g,
    ),
  ].map(([match]) => `${fileName}: ${match}`),
)
check(
  'JS に Web Worker 生成が無い',
  workerUsages.length === 0,
  workerUsages.join(' | '),
)

const storageUsages = jsArtifacts.flatMap(({ fileName, code }) =>
  [...code.matchAll(/\b(?:localStorage|sessionStorage)\b/g)].map(
    ([match]) => `${fileName}: ${match}`,
  ),
)
check(
  'JS にブラウザストレージ利用が無い',
  storageUsages.length === 0,
  storageUsages.join(' | '),
)

const dynamicImports = jsArtifacts.flatMap(({ fileName, code }) =>
  [...code.matchAll(/(?<![\w.$])import\s*\(/g)].map(
    ([match]) => `${fileName}: ${match}`,
  ),
)
check(
  'JS に動的 import が無い',
  dynamicImports.length === 0,
  dynamicImports.join(' | '),
)

const allowedUrlDomains = [
  'schemas.openxmlformats.org',
  'schemas.microsoft.com',
  'purl.org',
  'www.w3.org',
]
const externalHttpUrls = jsArtifacts.flatMap(({ fileName, code }) =>
  [...code.matchAll(/https?:\/\/[^\s"'`\\<>{}\])]+/gi)]
    .map(([url]) => url)
    .filter((url) => !allowedUrlDomains.some((domain) => url.includes(domain)))
    .map((url) => `${fileName}: ${url}`),
)
check(
  'JS に許可されていない http(s) URL が無い',
  externalHttpUrls.length === 0,
  externalHttpUrls.join(' | '),
)

const classicScriptSyntaxErrors = jsArtifacts.flatMap(({ fileName, code }) => {
  try {
    new Function(code)
    return []
  } catch (error) {
    const detail =
      error instanceof Error ? `${error.name}: ${error.message}` : String(error)
    return [`${fileName}: ${detail}`]
  }
})
check(
  'JS を classic script として構文解析できる',
  classicScriptSyntaxErrors.length === 0,
  classicScriptSyntaxErrors.join(' | '),
)

// --- 実行検査: classic script として評価され、React が描画されるか ---
const runtimeErrors = []
const virtualConsole = new VirtualConsole()
virtualConsole.on('jsdomError', (e) => runtimeErrors.push(`jsdomError: ${e.message}`))
virtualConsole.on('error', (...args) => runtimeErrors.push(`console.error: ${args.join(' ')}`))

const dom = new JSDOM(html, {
  url: pathToFileURL(htmlPath).href,
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  virtualConsole,
})

await new Promise((resolve) => setTimeout(resolve, 200))
// jsdom は file:// の外部スクリプトを取得しないので、明示的に評価する
if ((dom.window.document.getElementById('root')?.innerHTML ?? '') === '') {
  dom.window.eval(jsCode)
  await new Promise((resolve) => setTimeout(resolve, 200))
}

const rootHtml = dom.window.document.getElementById('root')?.innerHTML ?? ''
const buttonCount = dom.window.document.querySelectorAll('button').length
check('#root に DOM が描画された', rootHtml.length > 0, `${rootHtml.length} 文字`)
check('button が描画された', buttonCount > 0, `${buttonCount} 個`)
check('実行時エラーが無い', runtimeErrors.length === 0, runtimeErrors.slice(0, 3).join(' | '))

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? `  [${c.detail}]` : ''}`)
}
console.log(`\n${checks.length - failed.length} / ${checks.length} passed`)

if (failed.length > 0) {
  console.error('\nfile:// で動く条件を満たしていません。上記 FAIL を修正してください。')
  process.exit(1)
}
