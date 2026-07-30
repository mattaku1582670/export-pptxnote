import { describe, expect, it } from 'vitest'
import { extractNotesText, extractSlideTitle } from './notesText'

function notesXml(shapes: string, prefixes = { presentation: 'p', drawing: 'a' }): string {
  return `
    <${prefixes.presentation}:notes
      xmlns:${prefixes.presentation}="urn:presentation"
      xmlns:${prefixes.drawing}="urn:drawing">
      <${prefixes.presentation}:cSld>
        <${prefixes.presentation}:spTree>${shapes}</${prefixes.presentation}:spTree>
      </${prefixes.presentation}:cSld>
    </${prefixes.presentation}:notes>
  `
}

function shape(
  paragraphs: string,
  placeholder: string | null = 'body',
  prefixes = { presentation: 'p', drawing: 'a' },
): string {
  const placeholderXml =
    placeholder === null
      ? ''
      : `<${prefixes.presentation}:ph${placeholder === '' ? '' : ` type="${placeholder}"`}/>`

  return `
    <${prefixes.presentation}:sp>
      <${prefixes.presentation}:nvSpPr>
        <${prefixes.presentation}:nvPr>${placeholderXml}</${prefixes.presentation}:nvPr>
      </${prefixes.presentation}:nvSpPr>
      <${prefixes.presentation}:txBody>${paragraphs}</${prefixes.presentation}:txBody>
    </${prefixes.presentation}:sp>
  `
}

function paragraph(
  content: string,
  properties = '',
  prefixes = { drawing: 'a' },
): string {
  return `<${prefixes.drawing}:p>${properties}${content}</${prefixes.drawing}:p>`
}

function run(text: string, prefix = 'a'): string {
  return `<${prefix}:r><${prefix}:t>${text}</${prefix}:t></${prefix}:r>`
}

describe('extractNotesText', () => {
  it('bodyプレースホルダーだけを抽出する', () => {
    const xml = notesXml(
      shape(paragraph(run('本文'))) +
        shape(paragraph(run('タイトル')), 'title'),
    )

    expect(extractNotesText(xml)).toBe('本文')
  })

  it('sldNumを混入させない', () => {
    const xml = notesXml(
      shape(paragraph(run('本文'))) + shape(paragraph(run('3')), 'sldNum'),
    )

    expect(extractNotesText(xml)).toBe('本文')
    expect(extractNotesText(xml)).not.toContain('3')
  })

  it('ftrとdtを混入させない', () => {
    const xml = notesXml(
      shape(paragraph(run('本文'))) +
        shape(paragraph(run('社外秘')), 'ftr') +
        shape(paragraph(run('2026-07-30')), 'dt'),
    )

    expect(extractNotesText(xml)).toBe('本文')
  })

  it('複数段落を改行で区切る', () => {
    const xml = notesXml(
      shape(paragraph(run('第一段落')) + paragraph(run('第二段落'))),
    )

    expect(extractNotesText(xml)).toBe('第一段落\n第二段落')
  })

  it('同一段落内の複数tを連結する', () => {
    const xml = notesXml(shape(paragraph(run('今日は') + run('晴れ'))))

    expect(extractNotesText(xml)).toBe('今日は晴れ')
  })

  it('t、br、tの文書順を維持する', () => {
    const xml = notesXml(
      shape(paragraph(`${run('一行目')}<a:br/>${run('二行目')}`)),
    )

    expect(extractNotesText(xml)).toBe('一行目\n二行目')
  })

  it('連続する空段落を1つの空行に畳む', () => {
    const xml = notesXml(
      shape(
        paragraph(run('最初')) +
          paragraph('') +
          paragraph('') +
          paragraph(run('最後')),
      ),
    )

    expect(extractNotesText(xml)).toBe('最初\n\n最後')
  })

  it('全体の前後の空白と空行をtrimする', () => {
    const xml = notesXml(
      shape(paragraph('') + paragraph(run('  本文  ')) + paragraph('')),
    )

    expect(extractNotesText(xml)).toBe('本文')
  })

  it('日本語と英数字の混在を保持する', () => {
    const xml = notesXml(shape(paragraph(run('研修Part 2：API入門2026'))))

    expect(extractNotesText(xml)).toBe('研修Part 2：API入門2026')
  })

  it('絵文字と特殊記号を保持する', () => {
    const xml = notesXml(shape(paragraph(run('完成🎉 ①→※'))))

    expect(extractNotesText(xml)).toBe('完成🎉 ①→※')
  })

  it('bodyが無ければph無しテキストシェイプを抽出する', () => {
    const xml = notesXml(shape(paragraph(run('自由テキスト')), null))

    expect(extractNotesText(xml)).toBe('自由テキスト')
  })

  it('フォールバック時にもsldNum、ftr、dtを除外する', () => {
    const xml = notesXml(
      shape(paragraph(run('自由テキスト')), null) +
        shape(paragraph(run('8')), 'sldNum') +
        shape(paragraph(run('フッター')), 'ftr') +
        shape(paragraph(run('日付')), 'dt'),
    )

    expect(extractNotesText(xml)).toBe('自由テキスト')
  })

  it('テキストが無ければ空文字を返す', () => {
    expect(extractNotesText(notesXml(shape(paragraph(''))))).toBe('')
  })

  it('type属性の無いphをbodyとして扱う', () => {
    const xml = notesXml(shape(paragraph(run('既定の本文')), ''))

    expect(extractNotesText(xml)).toBe('既定の本文')
  })

  it('buCharがある段落に中黒を付ける', () => {
    const xml = notesXml(
      shape(paragraph(run('項目'), '<a:pPr><a:buChar char="•"/></a:pPr>')),
    )

    expect(extractNotesText(xml)).toBe('・項目')
  })

  it('本文が空のbuChar段落を中黒なしの空行として扱う', () => {
    const xml = notesXml(
      shape(
        paragraph(run('前')) +
          paragraph('', '<a:pPr><a:buChar char="•"/></a:pPr>') +
          paragraph(run('後')),
      ),
    )

    expect(extractNotesText(xml)).toBe('前\n\n後')
    expect(extractNotesText(xml)).not.toContain('・')
  })

  it('空の箇条書き段落だけなら空文字を返す', () => {
    const xml = notesXml(
      shape(paragraph('', '<a:pPr lvl="1"><a:buChar char="•"/></a:pPr>')),
    )

    expect(extractNotesText(xml)).toBe('')
  })

  it('buAutoNumがある段落にも中黒を付ける', () => {
    const xml = notesXml(
      shape(
        paragraph(
          run('自動番号'),
          '<a:pPr><a:buAutoNum type="arabicPeriod"/></a:pPr>',
        ),
      ),
    )

    expect(extractNotesText(xml)).toBe('・自動番号')
  })

  it('buNoneがある段落には中黒を付けない', () => {
    const xml = notesXml(
      shape(
        paragraph(
          run('通常'),
          '<a:pPr><a:buChar char="•"/><a:buNone/></a:pPr>',
        ),
      ),
    )

    expect(extractNotesText(xml)).toBe('通常')
  })

  it('lvl=1を全角スペース1つでインデントする', () => {
    const xml = notesXml(
      shape(
        paragraph(
          run('下位項目'),
          '<a:pPr lvl="1"><a:buChar char="•"/></a:pPr>',
        ),
      ),
    )

    expect(extractNotesText(xml)).toBe('　・下位項目')
  })

  it('pとa以外の接頭辞でも抽出する', () => {
    const prefixes = { presentation: 'pp', drawing: 'aa' }
    const xml = notesXml(
      shape(
        paragraph(run('別接頭辞', 'aa'), '', { drawing: 'aa' }),
        'body',
        prefixes,
      ),
      prefixes,
    )

    expect(extractNotesText(xml)).toBe('別接頭辞')
  })

  it('HTML風文字列を文字として返す', () => {
    const xml = notesXml(
      shape(paragraph(run('&lt;script&gt;alert(1)&lt;/script&gt;'))),
    )

    expect(extractNotesText(xml)).toBe('<script>alert(1)</script>')
  })

  it('AlternateContentではFallbackのbodyシェイプを除外する', () => {
    const bodyShape = shape(paragraph(run('重複しない本文')))
    const xml = notesXml(`
      <mc:AlternateContent xmlns:mc="urn:mc">
        <mc:Choice Requires="p">${bodyShape}</mc:Choice>
        <mc:Fallback>${bodyShape}</mc:Fallback>
      </mc:AlternateContent>
    `)

    expect(extractNotesText(xml)).toBe('重複しない本文')
  })
})

describe('extractSlideTitle', () => {
  it.each(['title', 'ctrTitle'])('%sプレースホルダーから取得する', (type) => {
    const xml = notesXml(shape(paragraph(run('スライド題名')), type))

    expect(extractSlideTitle(xml)).toBe('スライド題名')
  })

  it('タイトルが無ければ空文字を返す', () => {
    const xml = notesXml(shape(paragraph(run('本文')), 'body'))

    expect(extractSlideTitle(xml)).toBe('')
  })

  it('複数行タイトルを1行に整形する', () => {
    const xml = notesXml(
      shape(
        paragraph(`${run('複数')}<a:br/>${run('行')}`) +
          paragraph(run('\tタイトル')),
        'title',
      ),
    )

    expect(extractSlideTitle(xml)).toBe('複数 行 タイトル')
  })

  it('不正XMLでは例外を投げず空文字を返す', () => {
    expect(extractSlideTitle('<broken>')).toBe('')
  })

  it('AlternateContentではFallbackのタイトルを除外する', () => {
    const xml = notesXml(`
      <mc:AlternateContent xmlns:mc="urn:mc">
        <mc:Choice Requires="p">
          ${shape(paragraph(run('Choiceタイトル')), 'title')}
        </mc:Choice>
        <mc:Fallback>
          ${shape(paragraph(run('Fallbackタイトル')), 'title')}
        </mc:Fallback>
      </mc:AlternateContent>
    `)

    expect(extractSlideTitle(xml)).toBe('Choiceタイトル')
  })
})
