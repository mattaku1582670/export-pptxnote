import {
  getAttrByLocalName,
  getElementsByLocalName,
  getElementsByLocalNameExcludingFallback,
  getFirstByLocalName,
  getPlaceholderType,
  parseXml,
} from '../utils/xml'

const FALLBACK_EXCLUDED_PLACEHOLDERS = new Set([
  'sldNum',
  'dt',
  'ftr',
  'hdr',
  'sldImg',
  'pic',
])

interface ExtractedParagraph {
  content: string
  prefix: string
}

function collectParagraphContent(element: Element): string {
  let text = ''

  for (const child of Array.from(element.children)) {
    if (child.localName === 't') {
      text += child.textContent ?? ''
    } else if (child.localName === 'br') {
      text += '\n'
    } else {
      text += collectParagraphContent(child)
    }
  }

  return text
}

function extractParagraph(paragraph: Element): ExtractedParagraph {
  const paragraphProperties = getFirstByLocalName(paragraph, 'pPr')
  let prefix = ''

  if (paragraphProperties !== null) {
    const levelText = getAttrByLocalName(paragraphProperties, 'lvl')
    const parsedLevel = levelText === null ? 0 : Number.parseInt(levelText, 10)
    const level = Number.isFinite(parsedLevel) && parsedLevel > 0 ? parsedLevel : 0
    const hasBullet =
      getFirstByLocalName(paragraphProperties, 'buNone') === null &&
      (getFirstByLocalName(paragraphProperties, 'buChar') !== null ||
        getFirstByLocalName(paragraphProperties, 'buAutoNum') !== null)

    prefix = `${'　'.repeat(level)}${hasBullet ? '・' : ''}`
  }

  return {
    content: collectParagraphContent(paragraph),
    prefix,
  }
}

function extractShapeParagraphs(shape: Element): ExtractedParagraph[] {
  return getElementsByLocalName(shape, 'p').map(extractParagraph)
}

function isEmptyParagraph(paragraph: ExtractedParagraph): boolean {
  return paragraph.content.trim().length === 0
}

function collapseEmptyParagraphs(
  paragraphs: ExtractedParagraph[],
): ExtractedParagraph[] {
  const collapsed: ExtractedParagraph[] = []
  let previousWasEmpty = false

  for (const paragraph of paragraphs) {
    const isEmpty = isEmptyParagraph(paragraph)

    if (!isEmpty || !previousWasEmpty) {
      collapsed.push(paragraph)
    }

    previousWasEmpty = isEmpty
  }

  return collapsed
}

function joinAndTrimParagraphs(paragraphs: ExtractedParagraph[]): string {
  const trimmedParagraphs = [...paragraphs]

  while (
    trimmedParagraphs.length > 0 &&
    isEmptyParagraph(trimmedParagraphs[0])
  ) {
    trimmedParagraphs.shift()
  }
  while (
    trimmedParagraphs.length > 0 &&
    isEmptyParagraph(trimmedParagraphs[trimmedParagraphs.length - 1])
  ) {
    trimmedParagraphs.pop()
  }

  if (trimmedParagraphs.length === 0) {
    return ''
  }

  const first = trimmedParagraphs[0]
  const last = trimmedParagraphs[trimmedParagraphs.length - 1]
  first.content = first.content.trimStart()
  last.content = last.content.trimEnd()

  return trimmedParagraphs
    .map((paragraph) =>
      isEmptyParagraph(paragraph)
        ? ''
        : `${paragraph.prefix}${paragraph.content}`,
    )
    .join('\n')
}

function shapeHasText(shape: Element): boolean {
  return getElementsByLocalName(shape, 't').length > 0
}

export function extractNotesTextFromDocument(document: Document): string {
  const shapes = getElementsByLocalNameExcludingFallback(document, 'sp')
  const bodyShapes = shapes.filter((shape) => {
    const placeholderType = getPlaceholderType(shape)
    return placeholderType === 'body' || placeholderType === ''
  })
  const targetShapes =
    bodyShapes.length > 0
      ? bodyShapes
      : shapes.filter((shape) => {
          const placeholderType = getPlaceholderType(shape)
          return (
            shapeHasText(shape) &&
            (placeholderType === null ||
              !FALLBACK_EXCLUDED_PLACEHOLDERS.has(placeholderType))
          )
        })
  const paragraphs = targetShapes.flatMap(extractShapeParagraphs)

  return joinAndTrimParagraphs(collapseEmptyParagraphs(paragraphs))
}

export function extractNotesText(notesSlideXml: string): string {
  const document = parseXml(notesSlideXml, 'PowerPointのノート')
  return extractNotesTextFromDocument(document)
}

export function extractSlideTitleFromDocument(document: Document): string {
  const titleShape = getElementsByLocalNameExcludingFallback(
    document,
    'sp',
  ).find((shape) => {
    const placeholderType = getPlaceholderType(shape)
    return placeholderType === 'title' || placeholderType === 'ctrTitle'
  })

  if (titleShape === undefined) {
    return ''
  }

  return getElementsByLocalName(titleShape, 'p')
    .map(collectParagraphContent)
    .join(' ')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function extractSlideTitle(slideXml: string): string {
  try {
    const document = parseXml(slideXml, 'PowerPointのスライド')
    return extractSlideTitleFromDocument(document)
  } catch {
    return ''
  }
}
