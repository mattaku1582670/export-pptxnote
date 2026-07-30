import { describe, expect, it } from 'vitest'
import type {
  ExportOptions,
  ExtractedSlide,
  ExtractionResult,
} from '../types'
import { buildPlainText, SLIDE_SEPARATOR } from './textExporter'

function slide(
  slideNumber: number,
  overrides: Partial<ExtractedSlide> = {},
): ExtractedSlide {
  return {
    slideNumber,
    slidePath: `ppt/slides/slide${slideNumber}.xml`,
    title: `タイトル${slideNumber}`,
    originalNotes: `元ノート${slideNumber}`,
    editedNotes: `編集ノート${slideNumber}`,
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

describe('buildPlainText', () => {
  it('originalNotesではなくeditedNotesを出力する', () => {
    const text = buildPlainText(extraction([slide(1)]), options())

    expect(text).toContain('編集ノート1')
    expect(text).not.toContain('元ノート1')
  })

  it('includeSummary=falseでは集計を出力しない', () => {
    const text = buildPlainText(extraction([slide(1)]), options())

    expect(text).not.toContain('作成日時:')
    expect(text).not.toContain('総スライド数:')
  })

  it('固定日時で集計を出力する', () => {
    const text = buildPlainText(
      extraction([slide(1)]),
      options({ includeSummary: true }),
      new Date(2026, 6, 30, 20, 45),
    )

    expect(text).toContain('研修資料.pptx 発表者ノート')
    expect(text).toContain('作成日時: 2026-07-30 20:45')
    expect(text).toContain('総スライド数: 1')
    expect(text).toContain('ノートありのスライド数: 1')
  })

  it('集計は保存済み件数ではなくeditedNotesから数える', () => {
    const edited = slide(1, {
      originalNotes: '',
      editedNotes: '手入力したノート',
      hasNotes: false,
    })
    const staleResult = extraction([edited])

    expect(staleResult.slidesWithNotes).toBe(0)
    expect(
      buildPlainText(
        staleResult,
        options({ includeSummary: true }),
        new Date(2026, 6, 30, 20, 45),
      ),
    ).toContain('ノートありのスライド数: 1')
  })

  it('includeSlideTitles=falseではタイトルを出力しない', () => {
    const text = buildPlainText(
      extraction([slide(1)]),
      options({ includeSlideTitles: false }),
    )

    expect(text).toContain('スライド 1\n')
    expect(text).not.toContain('タイトル1')
  })

  it('空タイトルでは見出しをスライド番号だけにする', () => {
    const text = buildPlainText(
      extraction([slide(2, { title: '' })]),
      options({ includeSlideTitles: true }),
    )

    expect(text).toContain('スライド 2\n\n')
    expect(text).not.toContain('スライド 2：')
  })

  it('includeEmptySlides=falseではノートなしスライドを省く', () => {
    const empty = slide(2, {
      originalNotes: '',
      editedNotes: '',
      hasNotes: false,
    })
    const text = buildPlainText(extraction([slide(1), empty]), options())

    expect(text).not.toContain('スライド 2')
  })

  it('includeEmptySlides=trueではノートなしと出力する', () => {
    const empty = slide(2, {
      originalNotes: '',
      editedNotes: '',
      hasNotes: false,
    })
    const text = buildPlainText(
      extraction([empty]),
      options({ includeEmptySlides: true }),
    )

    expect(text).toContain('スライド 2')
    expect(text).toContain('ノートなし')
  })

  it('1枚では区切り線を出さず、2枚では1本だけ出す', () => {
    const oneSlideText = buildPlainText(extraction([slide(1)]), options())
    const twoSlideText = buildPlainText(
      extraction([slide(1), slide(2)]),
      options(),
    )

    expect(oneSlideText).not.toContain(SLIDE_SEPARATOR)
    expect(twoSlideText.split(SLIDE_SEPARATOR)).toHaveLength(2)
  })

  it('parseErrorがありeditedNotesが空なら専用メッセージで出力する', () => {
    const broken = slide(1, {
      originalNotes: '',
      editedNotes: '',
      hasNotes: false,
      parseError: 'このスライドは解析できませんでした。',
    })
    const text = buildPlainText(
      extraction([broken]),
      options({ includeEmptySlides: true }),
    )
    const excludedText = buildPlainText(extraction([broken]), options())

    expect(text).toContain('（このスライドは解析できませんでした）')
    expect(excludedText).toBe('\n')
  })

  it('parseErrorがあってもeditedNotesの手入力を優先して出力する', () => {
    const repaired = slide(1, {
      originalNotes: '',
      editedNotes: 'ユーザーが補完したノート',
      hasNotes: false,
      parseError: 'このスライドは解析できませんでした。',
    })
    const text = buildPlainText(extraction([repaired]), options())

    expect(text).toContain('ユーザーが補完したノート')
    expect(text).not.toContain('（このスライドは解析できませんでした）')
  })

  it('ノートの複数行を保持し、末尾を改行1つにする', () => {
    const text = buildPlainText(
      extraction([slide(1, { editedNotes: '1行目\n2行目' })]),
      options(),
    )

    expect(text).toContain('1行目\n2行目')
    expect(text.endsWith('\n')).toBe(true)
    expect(text.endsWith('\n\n')).toBe(false)
  })

  it('日本語と絵文字を保持する', () => {
    const text = buildPlainText(
      extraction([slide(1, { editedNotes: '会議🎉のメモ' })]),
      options(),
    )

    expect(text).toContain('会議🎉のメモ')
  })
})
