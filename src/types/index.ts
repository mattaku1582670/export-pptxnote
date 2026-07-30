export interface ExtractedSlide {
  slideNumber: number
  slidePath: string
  title: string
  originalNotes: string
  editedNotes: string
  hasNotes: boolean
  /** そのスライドの解析に失敗した場合のみ設定される。他スライドの表示は継続する */
  parseError?: string
}

export interface ExtractionResult {
  fileName: string
  slideCount: number
  slidesWithNotes: number
  slidesWithoutNotes: number
  slides: ExtractedSlide[]
}

/** ノートが実質的に存在するか。編集後の内容から都度判定する */
export function slideHasNotes(slide: ExtractedSlide): boolean {
  return slide.editedNotes.trim().length > 0
}

/** slides から集計値を再計算し、整合した ExtractionResult を返す */
export function withRecalculatedCounts(
  result: ExtractionResult,
): ExtractionResult {
  const slides = result.slides.map((slide) => ({
    ...slide,
    hasNotes: slideHasNotes(slide),
  }))
  const slidesWithNotes = slides.filter(slideHasNotes).length

  return {
    ...result,
    slideCount: slides.length,
    slidesWithNotes,
    slidesWithoutNotes: slides.length - slidesWithNotes,
    slides,
  }
}

export interface ExportOptions {
  includeEmptySlides: boolean
  pageBreakPerSlide: boolean
  includeSlideTitles: boolean
  includeSummary: boolean
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  includeEmptySlides: false,
  pageBreakPerSlide: false,
  includeSlideTitles: true,
  includeSummary: true,
}

/** 解析の進捗フェーズ */
export type ParsePhase = 'reading' | 'parsing' | 'exporting'

export interface ParseProgress {
  phase: ParsePhase
  /** 解析済みスライド数。phase が parsing のときのみ意味を持つ */
  current: number
  /** 総スライド数。不明なうちは 0 */
  total: number
  /** 画面にそのまま出せる日本語メッセージ */
  message: string
}

/** 表示フィルター */
export type SlideFilter = 'all' | 'withNotes' | 'withoutNotes'

/** アプリの処理状態 */
export type AppStatus =
  | 'idle'
  | 'reading'
  | 'parsing'
  | 'success'
  | 'error'
  | 'exporting'

/** ユーザーに提示可能な日本語メッセージを持つエラー */
export class PptxError extends Error {
  /** 画面表示用の日本語メッセージ */
  readonly userMessage: string

  constructor(userMessage: string, cause?: unknown) {
    super(userMessage, { cause })
    this.name = 'PptxError'
    this.userMessage = userMessage
    Object.setPrototypeOf(this, PptxError.prototype)
  }
}
