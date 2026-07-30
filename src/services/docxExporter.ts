import {
  Document as DocxDocument,
  HeadingLevel,
  Packer,
  Paragraph,
} from 'docx'
import type { ExportOptions, ExtractionResult } from '../types'
import {
  buildSlideBody,
  buildSlideHeading,
  countSlidesWithNotes,
  formatLocalDateTime,
  shouldExportSlide,
} from './textExporter'

function collapseEmptyLines(text: string): string[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const collapsed: string[] = []
  let previousWasEmpty = false

  for (const line of lines) {
    const isEmpty = line.trim().length === 0

    if (!isEmpty || !previousWasEmpty) {
      collapsed.push(line)
    }

    previousWasEmpty = isEmpty
  }

  return collapsed
}

export function buildDocxDocument(
  result: ExtractionResult,
  options: ExportOptions,
  now: Date = new Date(),
): DocxDocument {
  const children: Paragraph[] = [
    new Paragraph({
      text: `${result.fileName} 発表者ノート`,
      heading: HeadingLevel.TITLE,
    }),
  ]

  if (options.includeSummary) {
    children.push(
      new Paragraph({ text: `作成日時: ${formatLocalDateTime(now)}` }),
      new Paragraph({ text: `総スライド数: ${result.slideCount}` }),
      new Paragraph({
        text: `ノートありのスライド数: ${countSlidesWithNotes(result)}`,
      }),
    )
  }

  const exportedSlides = result.slides.filter((slide) =>
    shouldExportSlide(slide, options),
  )

  for (const [index, slide] of exportedSlides.entries()) {
    children.push(
      new Paragraph({
        text: buildSlideHeading(slide, options),
        heading: HeadingLevel.HEADING_2,
        pageBreakBefore: options.pageBreakPerSlide && index > 0,
      }),
    )

    for (const line of collapseEmptyLines(buildSlideBody(slide))) {
      children.push(new Paragraph({ text: line }))
    }
  }

  return new DocxDocument({
    styles: {
      default: {
        document: {
          run: {
            font: {
              ascii: 'Yu Gothic',
              eastAsia: 'Yu Gothic',
              hAnsi: 'Yu Gothic',
              cs: 'Yu Gothic',
            },
            size: 21,
          },
        },
      },
    },
    sections: [{ children }],
  })
}

export async function buildDocxBlob(
  result: ExtractionResult,
  options: ExportOptions,
  now: Date = new Date(),
): Promise<Blob> {
  return Packer.toBlob(buildDocxDocument(result, options, now))
}
