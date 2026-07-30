import {
  slideHasNotes,
  type ExportOptions,
  type ExtractedSlide,
  type ExtractionResult,
} from '../types'

export const SLIDE_SEPARATOR = '------------------------------'
export const EMPTY_NOTES_TEXT = 'ノートなし'
export const PARSE_ERROR_TEXT = '（このスライドは解析できませんでした）'

function padDatePart(value: number): string {
  return value.toString().padStart(2, '0')
}

export function formatLocalDateTime(date: Date): string {
  return [
    date.getFullYear(),
    '-',
    padDatePart(date.getMonth() + 1),
    '-',
    padDatePart(date.getDate()),
    ' ',
    padDatePart(date.getHours()),
    ':',
    padDatePart(date.getMinutes()),
  ].join('')
}

export function buildSlideHeading(
  slide: ExtractedSlide,
  options: ExportOptions,
): string {
  const baseHeading = `スライド ${slide.slideNumber}`

  return options.includeSlideTitles && slide.title.length > 0
    ? `${baseHeading}：${slide.title}`
    : baseHeading
}

export function shouldExportSlide(
  slide: ExtractedSlide,
  options: ExportOptions,
): boolean {
  return slideHasNotes(slide) || options.includeEmptySlides
}

export function buildSlideBody(slide: ExtractedSlide): string {
  if (slideHasNotes(slide)) {
    return slide.editedNotes
  }

  if (slide.parseError !== undefined) {
    return PARSE_ERROR_TEXT
  }

  return EMPTY_NOTES_TEXT
}

export function countSlidesWithNotes(result: ExtractionResult): number {
  return result.slides.filter(slideHasNotes).length
}

function buildSummary(result: ExtractionResult, now: Date): string {
  return [
    `${result.fileName} 発表者ノート`,
    '',
    `作成日時: ${formatLocalDateTime(now)}`,
    `総スライド数: ${result.slideCount}`,
    `ノートありのスライド数: ${countSlidesWithNotes(result)}`,
  ].join('\n')
}

export function buildPlainText(
  result: ExtractionResult,
  options: ExportOptions,
  now: Date = new Date(),
): string {
  // TXT には改ページの概念がないため、pageBreakPerSlide は意図的に使用しない。
  const slideBlocks = result.slides
    .filter((slide) => shouldExportSlide(slide, options))
    .map((slide) =>
      [buildSlideHeading(slide, options), '', buildSlideBody(slide)].join('\n'),
    )

  const sections: string[] = []

  if (options.includeSummary) {
    sections.push(buildSummary(result, now))
  }

  if (slideBlocks.length > 0) {
    sections.push(slideBlocks.join(`\n\n${SLIDE_SEPARATOR}\n\n`))
  }

  const text = sections.join('\n\n').trimEnd()
  return `${text}\n`
}
