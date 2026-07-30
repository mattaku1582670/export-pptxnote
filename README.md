# 発表者ノート抽出

## アプリの概要

`.pptx` ファイルから発表者ノートを抽出する Web アプリです。PowerPoint ファイルをアップロードせず、ブラウザ内だけでノートを取り出し、画面上で編集してから TXT や Word（DOCX）として再利用できます。

## 主な機能

- ファイル選択またはドラッグ＆ドロップによる `.pptx` の読み込み
- 発表者ノートとスライドタイトルの抽出
- 抽出したノートの画面上での編集と、スライド単位での元に戻す操作
- ノートあり／ノートなしフィルター
- スライド番号、タイトル、ノート本文を対象にした検索
- 全文コピーとスライド単位のコピー
- UTF-8 の TXT 出力
- Word（DOCX）出力
  - ノートのないスライドも出力する
  - スライドごとに改ページする
  - スライドタイトルを出力する
  - 文書の先頭に集計情報を出力する
- 別のファイルを読み込むためのリセット

## `file://` で使う（オフライン利用）

このアプリの主要な利用方法です。

1. `npm run build` を実行します。
2. 生成された **`dist` フォルダをまるごとコピー**します。
3. コピー先の `dist/index.html` をブラウザでダブルクリックして開きます。

`dist` の中身は `assets/` を含め、すべて一緒に持ち運んでください。`index.html` だけを取り出すと JavaScript と CSS を読み込めず動作しません。

HTTP サーバーもネットワーク接続も不要です。`npm run verify:dist` を実行すると、現在の `dist` が `file://` で動くための条件を満たしているか自動検証できます。先に `npm run build` で `dist` を生成してください。

## 対応形式

対応形式は `.pptx` のみです。

## 非対応形式

次のファイルには対応していません。問題が起きた場合は、原因が分かる日本語のエラーメッセージを画面に表示します。

| ファイル | 画面に表示されるエラーの例 |
| --- | --- |
| `.ppt`（旧形式） | 「古い形式（.ppt）には対応していません。PowerPointで.pptx形式に変換してから読み込んでください。」 |
| `.pptm`（マクロ有効） | 「対応しているファイル形式は.pptxです。」 |
| パスワード保護されたファイル | 「PowerPointファイルを読み取れませんでした。ファイルが破損しているか、パスワードで保護されている可能性があります。」 |
| 破損ファイル | 「PowerPointファイルを読み取れませんでした。ファイルが破損しているか、パスワードで保護されている可能性があります。」 |
| PowerPoint 以外のファイル | 拡張子が異なる場合は「対応しているファイル形式は.pptxです。」、中身が PowerPoint でない場合はプレゼンテーション情報が見つからないことを日本語で表示します。 |

## ブラウザ内処理であること

ファイルの展開、XML の解析、ノートの編集、コピー、TXT／DOCX の生成はすべてブラウザ内で行います。PowerPoint ファイルも抽出したノートも一切サーバーへ送信しません。

外部 CDN、外部 API、外部変換サービスは使用していないため、ネットワーク接続がなくても動作します。PowerPoint、Office、LibreOffice のインストールも不要です。

## セットアップ方法

```bash
npm install
```

## 開発サーバー起動方法

```bash
npm run dev
```

## ビルド方法

```bash
npm run build
```

型チェック後に Vite の本番ビルドを実行し、`dist/` を生成します。

## テスト方法

```bash
npm run test
```

テストは Vitest で実行します。現在のテスト数は 133 件です。

ウォッチモードで実行する場合は `npm run test:watch` を使用します。

### `package.json` の scripts

| コマンド | 実行内容 |
| --- | --- |
| `npm run dev` | `vite` |
| `npm run build` | `tsc -b && vite build` |
| `npm run lint` | `oxlint` |
| `npm run preview` | `vite preview` |
| `npm run test` | `vitest run` |
| `npm run test:watch` | `vitest` |
| `npm run verify:dist` | `node scripts/verify-dist.mjs` |
| `npm run verify` | `npm run build && npm run verify:dist && npm run test` |

## 技術構成

バージョンは `package.json` の指定値です。

| 技術 | バージョン | 用途 |
| --- | --- | --- |
| Vite | `^8.1.1` | 開発サーバーとビルド |
| React | `^19.2.7` | UI |
| TypeScript | `~6.0.2` | 型安全な実装 |
| HeroUI v3 (`@heroui/react`) | `^3.2.2` | UI コンポーネント |
| Tailwind CSS v4 | `^4.3.3` | スタイリング |
| JSZip | `^3.10.1` | PPTX（ZIP）の展開 |
| docx | `^9.7.1` | Word 文書の生成 |
| Vitest | `^4.1.10` | テスト |

## PPTX 解析の概要

### 解析方式

解析方式は次のとおりです。

1. `.pptx` を JSZip で ZIP として展開します。PowerPoint、Office、LibreOffice、外部変換サービスは一切使いません。
2. `ppt/presentation.xml` の `p:sldIdLst` に並ぶ `p:sldId` の**出現順**をスライドの表示順とします。
3. 各 `p:sldId` の `r:id` を `ppt/_rels/presentation.xml.rels` で解決し、対応するスライド XML を特定します。
4. 各スライドの `_rels` から `notesSlide` Relationship を辿り、ノート XML を特定します。**`notesSlide1.xml` を「スライド 1 のノート」と決めつけません。**
5. Relationship の `Target` は `..` や `.` を含む相対パスのため、`src/utils/zipPath.ts` の `resolveZipPath` で正規化します。
6. ノート本文は `p:ph type="body"` のシェイプを優先して抽出し、スライド番号（`sldNum`）、日付（`dt`）、フッター（`ftr`）、ヘッダー（`hdr`）、スライド画像（`sldImg`）を除外します。
7. XML 名前空間の接頭辞に依存せず、`getElementsByTagNameNS('*', localName)` で解析します。
8. `TargetMode="External"` の参照は辿りません。PowerPoint 内部の外部リンクへアクセスすることはありません。

## 動作確認用サンプルの生成

次のコマンドで `tmp/サンプル研修資料.pptx` を生成できます。

```bash
node scripts/make-sample-pptx.mjs
```

このサンプルには、スライドの並べ替え、`notesSlide1.xml` がスライド 1 のノートではない構成、`_rels` がないスライド、ノートへのスライド番号・フッター・日付の混入、段落内改行、箇条書き、絵文字、日本語ファイル名が含まれます。さらに、連続する空段落、HTML 風文字列、`..` と `.` を含む Relationship Target も確認できます。

期待される抽出結果は次のとおりです。

| 表示順 | タイトル | ノート | 期待される内容 |
| --- | --- | --- | --- |
| スライド 1 | はじめに | あり（`notesSlide2.xml`） | 絵文字、段落内改行、HTML 風文字列を文字列のまま抽出する |
| スライド 2 | 背景と課題 | あり（`notesSlide1.xml`） | 「・市場環境が変化しています」「・既存手法では対応できません」と箇条書きで抽出する |
| スライド 3 | まとめ | なし | `_rels` ファイルがなくてもエラーにせず、ノートなしとして扱う |

いずれのノートにも、混入させたスライド番号 `99`、フッター「社外秘フッター」、日付 `2026/07/30` は含まれないことが期待値です。

## `file://` 対応のためのビルド設定（変更時の注意）

`file://` では外部の `<script type="module">` を CORS 制約により読み込めません。そのため `vite.config.ts` のプラグインで生成 HTML から `type="module"` を除去し、エントリチャンクを IIFE でラップして classic script として実行できるようにしています。

**`build.rolldownOptions.output.format` に `'iife'` を指定してはいけません。** Vite 8（Rolldown）ではこれを指定すると CSS が 1 バイトも emit されず、ビルドは成功するのにブラウザで開くと完全に無スタイルになります。開発中に実測で確認された挙動です。現在は出力形式を指定せず、専用プラグインでエントリだけを IIFE にしています。

コード分割は `codeSplitting: false` で無効にしています。`file://` では追加チャンクを読み込めないためです。同じ理由で、`file://` から生成できない Web Worker は使用していません。また、`file://` ではページ間で共有される範囲が不安定なため、ブラウザの永続ストレージへ状態を保存していません。

ビルド設定を変更した場合は、必ずビルド後に次の検証を通してください。

```bash
npm run verify:dist
```

この検証では参照パスや script／CSS の形を静的に確認するだけでなく、jsdom で classic script を評価し、React が `#root` を描画するところまで確認します。

## 既知の制限

- `.ppt`（旧形式）と `.pptm`（マクロ有効）は非対応です。
- パスワード保護された `.pptx` は解析できません。
- スライド画像やサムネイルは表示しません。
- 箇条書きは `・` とインデントによる簡易表現のみです。フォント、文字色、太字などの書式は再現しません。
- 表、数式、SmartArt 内のテキストは完全には再現しません。
- 複数ファイルの一括処理、PDF 出力、AI による要約は非対応です。
- 解析はメインスレッドで行うため、非常に大きなファイルでは一時的に操作しにくくなる場合があります。100 MB 超では警告を表示しますが、処理は拒否しません。
- `file://` で開いた場合、ブラウザによっては Clipboard API が使えないことがあります。その場合は `document.execCommand` でコピーを試み、それも失敗した場合は手動コピー用ダイアログに切り替わります。

## 静的ホスティング方法

`npm run build` で生成した `dist/` を、次のような静的ホスティングへ配置できます。バックエンドは不要です。

- GitHub Pages
- Vercel
- Netlify
- 一般的な静的 Web サーバー

`vite.config.ts` の `base` は現在 `'./'` で、相対パスによる `file://` 利用と静的配布に対応しています。配置先のパス構成に合わせて、この `base` を変更しやすい構成です。変更した場合は `npm run build` の後に `npm run verify:dist` も実行してください。
