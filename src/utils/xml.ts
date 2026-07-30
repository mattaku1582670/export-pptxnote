import { PptxError } from '../types'

export interface Relationship {
  id: string
  type: string
  target: string
  targetMode: string | null
}

const SLIDE_RELATIONSHIP_TYPE =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide'
const NOTES_SLIDE_RELATIONSHIP_TYPE =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide'

export function parseXml(xmlText: string, whatFailed: string): Document {
  const document = new DOMParser().parseFromString(xmlText, 'application/xml')
  const parserErrors = document.getElementsByTagNameNS('*', 'parsererror')

  if (parserErrors.length > 0 || document.documentElement === null) {
    throw new PptxError(
      `${whatFailed}を読み取れませんでした。ファイルが破損している可能性があります。`,
    )
  }

  return document
}

export function getElementsByLocalName(
  scope: Document | Element,
  localName: string,
): Element[] {
  return Array.from(scope.getElementsByTagNameNS('*', localName))
}

function hasFallbackAncestor(element: Element): boolean {
  let ancestor = element.parentElement

  while (ancestor !== null) {
    if (ancestor.localName === 'Fallback') {
      return true
    }
    ancestor = ancestor.parentElement
  }

  return false
}

export function getElementsByLocalNameExcludingFallback(
  scope: Document | Element,
  localName: string,
): Element[] {
  return getElementsByLocalName(scope, localName).filter(
    (element) => !hasFallbackAncestor(element),
  )
}

export function getFirstByLocalName(
  scope: Document | Element,
  localName: string,
): Element | null {
  return scope.getElementsByTagNameNS('*', localName).item(0)
}

export function getAttrByLocalName(element: Element, localName: string): string | null {
  let unqualifiedValue: string | null = null

  for (const attribute of Array.from(element.attributes)) {
    if (attribute.localName === localName) {
      if (attribute.namespaceURI !== null) {
        return attribute.value
      }
      unqualifiedValue = attribute.value
    }
  }

  return unqualifiedValue ?? element.getAttribute(localName)
}

export function parseRelationships(relsXml: string): Map<string, Relationship> {
  const document = parseXml(relsXml, 'PowerPointの関連情報')
  const relationships = new Map<string, Relationship>()

  for (const element of getElementsByLocalName(document, 'Relationship')) {
    const id = getAttrByLocalName(element, 'Id')
    const type = getAttrByLocalName(element, 'Type')
    const target = getAttrByLocalName(element, 'Target')

    if (id === null || type === null || target === null) {
      continue
    }

    relationships.set(id, {
      id,
      type,
      target,
      targetMode: getAttrByLocalName(element, 'TargetMode'),
    })
  }

  return relationships
}

export function isSlideRelType(type: string): boolean {
  return type === SLIDE_RELATIONSHIP_TYPE || type.endsWith('/slide')
}

export function isNotesSlideRelType(type: string): boolean {
  return (
    type === NOTES_SLIDE_RELATIONSHIP_TYPE || type.endsWith('/notesSlide')
  )
}

export function isExternalRelationship(
  relationship: Relationship,
): boolean {
  return relationship.targetMode?.toLocaleLowerCase() === 'external'
}

export function getPlaceholderType(shape: Element): string | null {
  const nonVisualShapeProperties = getFirstByLocalName(shape, 'nvSpPr')

  if (nonVisualShapeProperties === null) {
    return null
  }

  const placeholder = getFirstByLocalName(nonVisualShapeProperties, 'ph')

  if (placeholder === null) {
    return null
  }

  return getAttrByLocalName(placeholder, 'type') ?? ''
}
