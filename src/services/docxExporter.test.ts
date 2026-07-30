import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import type {
  ExportOptions,
  ExtractedSlide,
  ExtractionResult,
} from '../types'
import { buildDocxBlob } from './docxExporter'

function slide(
  slideNumber: number,
  overrides: Partial<ExtractedSlide> = {},
): ExtractedSlide {
  return {
    slideNumber,
    slidePath: `ppt/slides/slide${slideNumber}.xml`,
    title: `タイトル${slideNumber}`,
    originalNotes: `ORIGINAL_${slideNumber}`,
    editedNotes: `EDITED_${slideNumber}`,
    hasNotes: true,
    ...overrides,
  }
}

function extraction(slides: ExtractedSlide[]): ExtractionResult {
  const slidesWithNotes = slides.filter((item) => item.hasNotes).length
  return {
    fileName: '研修資料.pptx',
    slideCount: slides.length,
    slidesWithNotes,
    slidesWithoutNotes: slides.length - slidesWithNotes,
    slides,
  }
}

function options(overrides: Partial<ExportOptions> = {}): ExportOptions {
  return {
    includeEmptySlides: false,
    pageBreakPerSlide: false,
    includeSlideTitles: true,
    includeSummary: false,
    ...overrides,
  }
}

async function documentXmlOf(
  result: ExtractionResult,
  exportOptions: ExportOptions,
  now?: Date,
): Promise<string> {
  const blob = await buildDocxBlob(result, exportOptions, now)
  const zip = await JSZip.loadAsync(blob)
  const documentEntry = zip.file('word/document.xml')

  expect(documentEntry).not.toBeNull()
  return documentEntry?.async('string') ?? ''
}

function paragraphTexts(xml: string): string[] {
  const document = new DOMParser().parseFromString(xml, 'application/xml')
  return Array.from(document.getElementsByTagNameNS('*', 'p')).map(
    (paragraph) => paragraph.textContent ?? '',
  )
}

describe('buildDocxBlob', () => {
  it('originalNotesではなくeditedNotesをDOCXへ反映する', async () => {
    const xml = await documentXmlOf(extraction([slide(1)]), options())

    expect(xml).toContain('EDITED_1')
    expect(xml).not.toContain('ORIGINAL_1')
  })

  it('includeEmptySlides=falseでは空スライドの見出しを出さない', async () => {
    const empty = slide(2, {
      originalNotes: '',
      editedNotes: '',
      hasNotes: false,
    })
    const xml = await documentXmlOf(
      extraction([slide(1), empty]),
      options(),
    )

    expect(xml).not.toContain('スライド 2')
  })

  it('includeEmptySlides=trueではノートなしを出力する', async () => {
    const empty = slide(1, {
      originalNotes: '',
      editedNotes: '',
      hasNotes: false,
    })
    const xml = await documentXmlOf(
      extraction([empty]),
      options({ includeEmptySlides: true }),
    )

    expect(xml).toContain('スライド 1')
    expect(xml).toContain('ノートなし')
  })

  it('pageBreakPerSlide=trueでは2枚目以降だけ改ページする', async () => {
    const xml = await documentXmlOf(
      extraction([slide(1), slide(2), slide(3)]),
      options({ pageBreakPerSlide: true }),
    )
    const pageBreaks = xml.match(/<w:pageBreakBefore\/>/g) ?? []

    expect(pageBreaks).toHaveLength(2)
  })

  it('pageBreakPerSlide=falseでは改ページを出力しない', async () => {
    const xml = await documentXmlOf(
      extraction([slide(1), slide(2)]),
      options({ pageBreakPerSlide: false }),
    )

    expect(xml).not.toContain('w:pageBreakBefore')
  })

  it('includeSlideTitles=falseではタイトル文字列を出さない', async () => {
    const xml = await documentXmlOf(
      extraction([slide(1)]),
      options({ includeSlideTitles: false }),
    )

    expect(xml).toContain('スライド 1')
    expect(xml).not.toContain('タイトル1')
  })

  it('includeSummary=falseでは集計を出さない', async () => {
    const xml = await documentXmlOf(extraction([slide(1)]), options())

    expect(xml).not.toContain('総スライド数')
  })

  it('includeSummary=trueでは固定日時と件数を出す', async () => {
    const xml = await documentXmlOf(
      extraction([slide(1), slide(2)]),
      options({ includeSummary: true }),
      new Date(2026, 6, 30, 20, 45),
    )

    expect(xml).toContain('作成日時: 2026-07-30 20:45')
    expect(xml).toContain('総スライド数: 2')
    expect(xml).toContain('ノートありのスライド数: 2')
  })

  it('集計は保存済み件数ではなくeditedNotesから数える', async () => {
    const edited = slide(1, {
      originalNotes: '',
      editedNotes: '手入力したノート',
      hasNotes: false,
    })
    const staleResult = extraction([edited])

    expect(staleResult.slidesWithNotes).toBe(0)
    expect(
      await documentXmlOf(
        staleResult,
        options({ includeSummary: true }),
        new Date(2026, 6, 30, 20, 45),
      ),
    ).toContain('ノートありのスライド数: 1')
  })

  it('parseErrorがありeditedNotesが空なら出力設定に従う', async () => {
    const broken = slide(1, {
      originalNotes: '',
      editedNotes: '',
      hasNotes: false,
      parseError: 'このスライドは解析できませんでした。',
    })
    const includedXml = await documentXmlOf(
      extraction([broken]),
      options({ includeEmptySlides: true }),
    )
    const excludedXml = await documentXmlOf(
      extraction([broken]),
      options({ includeEmptySlides: false }),
    )

    expect(includedXml).toContain('（このスライドは解析できませんでした）')
    expect(excludedXml).not.toContain('スライド 1')
  })

  it('parseErrorがあってもeditedNotesの手入力を優先して出力する', async () => {
    const repaired = slide(1, {
      originalNotes: '',
      editedNotes: 'ユーザーが補完したノート',
      hasNotes: false,
      parseError: 'このスライドは解析できませんでした。',
    })
    const xml = await documentXmlOf(extraction([repaired]), options())

    expect(xml).toContain('ユーザーが補完したノート')
    expect(xml).not.toContain('（このスライドは解析できませんでした）')
  })

  it('ノート内の改行を複数段落に分割する', async () => {
    const xml = await documentXmlOf(
      extraction([slide(1, { editedNotes: '1行目\n2行目' })]),
      options(),
    )
    const texts = paragraphTexts(xml)

    expect(texts.filter((text) => text === '1行目')).toHaveLength(1)
    expect(texts.filter((text) => text === '2行目')).toHaveLength(1)
  })

  it('日本語と絵文字を壊さず出力する', async () => {
    const xml = await documentXmlOf(
      extraction([slide(1, { editedNotes: '会議🎉のメモ' })]),
      options(),
    )

    expect(xml).toContain('会議🎉のメモ')
  })

  it('0バイトでないZIPシグネチャ付きBlobを返す', async () => {
    const blob = await buildDocxBlob(extraction([slide(1)]), options())
    const signature = new Uint8Array(await blob.slice(0, 2).arrayBuffer())

    expect(blob.size).toBeGreaterThan(0)
    expect(Array.from(signature)).toEqual([0x50, 0x4b])
  })
})
