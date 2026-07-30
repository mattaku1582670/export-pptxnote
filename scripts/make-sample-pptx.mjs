/*
 * 手動確認用のサンプル .pptx を生成する開発用スクリプト。
 * 実際の PowerPoint を用意しなくても、以下のエッジケースを含むファイルで
 * 端到端の動作を確認できる。
 *
 *  - スライドの表示順 (p:sldIdLst) がファイル番号順と一致しない（並べ替え済み）
 *  - notesSlide1.xml が「スライド1のノート」ではない
 *  - ノートなしのスライドが混ざる
 *  - ノート内にスライド番号・フッター・日付のプレースホルダーが混入している
 *  - 複数段落・段落内改行・箇条書き・絵文字・HTML 風文字列を含むノート
 *  - Relationship Target に .. が含まれる
 *  - 日本語ファイル名
 *
 * 使い方: node scripts/make-sample-pptx.mjs
 * 出力先: tmp/サンプル研修資料.pptx
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import JSZip from 'jszip'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(projectRoot, 'tmp')
const outPath = path.join(outDir, 'サンプル研修資料.pptx')

const SLIDE_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide'
const NOTES_REL =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide'

const rels = (items) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${items.map((i) => `  <Relationship Id="${i.id}" Type="${i.type}" Target="${i.target}"/>`).join('\n')}
</Relationships>`

// XML のテキストノードとして安全に埋め込む。実際の PowerPoint も < > & はエスケープして保存する。
const esc = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const slide = (title) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
       xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree>
    <p:sp>
      <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
      <p:txBody><a:p><a:r><a:t>${esc(title)}</a:t></a:r></a:p></p:txBody>
    </p:sp>
  </p:spTree></p:cSld>
</p:sld>`

// body 以外のプレースホルダー（スライド番号・フッター・日付）を意図的に混入させる
const notes = (paragraphs, { bullets = false } = {}) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:notes xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
         xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree>
    <p:sp>
      <p:nvSpPr><p:cNvPr id="2" name="SlideImage"/><p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr>
      <p:txBody><a:p><a:r><a:t>スライド画像プレースホルダー</a:t></a:r></a:p></p:txBody>
    </p:sp>
    <p:sp>
      <p:nvSpPr><p:cNvPr id="3" name="Notes"/><p:nvPr><p:ph type="body"/></p:nvPr></p:nvSpPr>
      <p:txBody>
${paragraphs
  .map((text) => {
    const pPr = bullets ? '<a:pPr><a:buChar char="•"/></a:pPr>' : ''
    if (text === '') return `        <a:p>${pPr}</a:p>`
    const runs = text
      .split('\n')
      .map((line) => `<a:r><a:t>${esc(line)}</a:t></a:r>`)
      .join('<a:br/>')
    return `        <a:p>${pPr}${runs}</a:p>`
  })
  .join('\n')}
      </p:txBody>
    </p:sp>
    <p:sp>
      <p:nvSpPr><p:cNvPr id="4" name="SlideNumber"/><p:nvPr><p:ph type="sldNum"/></p:nvPr></p:nvSpPr>
      <p:txBody><a:p><a:r><a:t>99</a:t></a:r></a:p></p:txBody>
    </p:sp>
    <p:sp>
      <p:nvSpPr><p:cNvPr id="5" name="Footer"/><p:nvPr><p:ph type="ftr"/></p:nvPr></p:nvSpPr>
      <p:txBody><a:p><a:r><a:t>社外秘フッター</a:t></a:r></a:p></p:txBody>
    </p:sp>
    <p:sp>
      <p:nvSpPr><p:cNvPr id="6" name="Date"/><p:nvPr><p:ph type="dt"/></p:nvPr></p:nvSpPr>
      <p:txBody><a:p><a:r><a:t>2026/07/30</a:t></a:r></a:p></p:txBody>
    </p:sp>
  </p:spTree></p:cSld>
</p:notes>`

const zip = new JSZip()

zip.file(
  '[Content_Types].xml',
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
</Types>`,
)

// 表示順は slide3 → slide1 → slide2（並べ替え済みのプレゼンを再現）
zip.file(
  'ppt/presentation.xml',
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
                xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldIdLst>
    <p:sldId id="258" r:id="rId3"/>
    <p:sldId id="256" r:id="rId1"/>
    <p:sldId id="257" r:id="rId2"/>
  </p:sldIdLst>
</p:presentation>`,
)

zip.file(
  'ppt/_rels/presentation.xml.rels',
  rels([
    { id: 'rId1', type: SLIDE_REL, target: 'slides/slide1.xml' },
    { id: 'rId2', type: SLIDE_REL, target: 'slides/slide2.xml' },
    { id: 'rId3', type: SLIDE_REL, target: 'slides/slide3.xml' },
  ]),
)

zip.file('ppt/slides/slide1.xml', slide('背景と課題'))
zip.file('ppt/slides/slide2.xml', slide('まとめ'))
zip.file('ppt/slides/slide3.xml', slide('はじめに'))

// slide3(表示1枚目) は notesSlide2 を、slide1(表示2枚目) は notesSlide1 を参照する。
// notesSlide1.xml = スライド1 という思い込みだと必ず間違う構成。
zip.file(
  'ppt/slides/_rels/slide3.xml.rels',
  rels([{ id: 'rId1', type: NOTES_REL, target: '../notesSlides/notesSlide2.xml' }]),
)
zip.file(
  'ppt/slides/_rels/slide1.xml.rels',
  rels([
    // Target に .. と . を混ぜて正規化を確かめる
    { id: 'rId1', type: NOTES_REL, target: '../notesSlides/./sub/../notesSlide1.xml' },
  ]),
)
// slide2(表示3枚目) は rels ファイル自体が無い → ノートなし扱いになるべき

zip.file(
  'ppt/notesSlides/notesSlide2.xml',
  notes([
    '本日は発表者ノート抽出について説明します 🎉',
    '',
    '一行目\n二行目（段落内改行）',
    '',
    '',
    'HTML風の文字列もそのまま表示されるべき: <script>alert(1)</script>',
  ]),
)
zip.file(
  'ppt/notesSlides/notesSlide1.xml',
  notes(['市場環境が変化しています', '既存手法では対応できません'], { bullets: true }),
)

mkdirSync(outDir, { recursive: true })
const buffer = await zip.generateAsync({ type: 'nodebuffer' })
writeFileSync(outPath, buffer)
console.log(`生成しました: ${outPath} (${buffer.length} bytes)`)
console.log('期待される抽出結果:')
console.log('  スライド 1：はじめに      → ノートあり（絵文字・段落内改行・HTML風文字列）')
console.log('  スライド 2：背景と課題    → ノートあり（箇条書き ・付き）')
console.log('  スライド 3：まとめ        → ノートなし（rels ファイルなし）')
console.log('  いずれのノートにも 99 / 社外秘フッター / 2026/07/30 が混入しないこと')
