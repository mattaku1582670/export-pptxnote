import JSZip, { type JSZipObject } from 'jszip'
import type {
  ExtractedSlide,
  ExtractionResult,
  ParseProgress,
} from '../types'
import { PptxError } from '../types'
import { dirName, relsPathFor, resolveZipPath } from '../utils/zipPath'
import {
  getAttrByLocalName,
  getElementsByLocalName,
  getFirstByLocalName,
  isExternalRelationship,
  isNotesSlideRelType,
  isSlideRelType,
  parseRelationships,
  parseXml,
  type Relationship,
} from '../utils/xml'
import { yieldToBrowser } from '../utils/yieldToBrowser'
import {
  extractNotesText,
  extractSlideTitleFromDocument,
} from './notesText'

export const LARGE_FILE_WARNING_BYTES = 100 * 1024 * 1024

const CORRUPT_FILE_MESSAGE =
  'PowerPointファイルを読み取れませんでした。ファイルが破損しているか、パスワードで保護されている可能性があります。'
const MISSING_PRESENTATION_MESSAGE =
  'このファイルにはPowerPointのプレゼンテーション情報が見つかりませんでした。'
const SLIDE_PARSE_ERROR_MESSAGE = 'このスライドは解析できませんでした。'

interface OrderedSlide {
  path: string | null
}

export function validatePptxFile(file: File): void {
  const lowerName = file.name.toLocaleLowerCase()

  if (lowerName.endsWith('.ppt')) {
    throw new PptxError(
      '古い形式（.ppt）には対応していません。PowerPointで.pptx形式に変換してから読み込んでください。',
    )
  }

  if (!lowerName.endsWith('.pptx')) {
    throw new PptxError('対応しているファイル形式は.pptxです。')
  }

  if (file.size === 0) {
    throw new PptxError(
      'ファイルの中身が空です。別のファイルを選択してください。',
    )
  }
}

export function isLargeFile(file: File): boolean {
  return file.size > LARGE_FILE_WARNING_BYTES
}

async function readZipText(entry: JSZipObject): Promise<string> {
  return entry.async('string')
}

function getOrderedSlides(
  presentationXml: string,
  relationships: Map<string, Relationship>,
  presentationDir: string,
): OrderedSlide[] {
  const document = parseXml(presentationXml, 'PowerPointのプレゼンテーション情報')
  const slideIdList = getFirstByLocalName(document, 'sldIdLst')

  if (slideIdList === null) {
    return []
  }

  const slides: OrderedSlide[] = []

  for (const slideId of getElementsByLocalName(slideIdList, 'sldId')) {
    const relationshipId = getAttrByLocalName(slideId, 'id')
    const relationship =
      relationshipId === null ? undefined : relationships.get(relationshipId)

    if (
      relationship === undefined ||
      !isSlideRelType(relationship.type) ||
      isExternalRelationship(relationship)
    ) {
      slides.push({ path: null })
      continue
    }

    slides.push({
      path: resolveZipPath(presentationDir, relationship.target),
    })
  }

  return slides
}

function emptySlide(
  slideNumber: number,
  slidePath: string,
  parseError?: string,
): ExtractedSlide {
  return {
    slideNumber,
    slidePath,
    title: '',
    originalNotes: '',
    editedNotes: '',
    hasNotes: false,
    ...(parseError === undefined ? {} : { parseError }),
  }
}

async function parseSlide(
  zip: JSZip,
  orderedSlide: OrderedSlide,
  slideNumber: number,
): Promise<ExtractedSlide> {
  if (orderedSlide.path === null) {
    return emptySlide(slideNumber, '', SLIDE_PARSE_ERROR_MESSAGE)
  }

  const slideEntry = zip.file(orderedSlide.path)

  if (slideEntry === null) {
    throw new Error('Slide XML is missing')
  }

  const slideXml = await readZipText(slideEntry)
  const slideDocument = parseXml(slideXml, 'PowerPointのスライド')
  const title = extractSlideTitleFromDocument(slideDocument)
  const slideRelationshipsEntry = zip.file(relsPathFor(orderedSlide.path))
  let notes = ''

  if (slideRelationshipsEntry !== null) {
    const slideRelationships = parseRelationships(
      await readZipText(slideRelationshipsEntry),
    )
    const notesRelationship = Array.from(slideRelationships.values()).find(
      (relationship) =>
        isNotesSlideRelType(relationship.type) &&
        !isExternalRelationship(relationship),
    )

    if (notesRelationship !== undefined) {
      const notesPath = resolveZipPath(
        dirName(orderedSlide.path),
        notesRelationship.target,
      )
      const notesEntry = zip.file(notesPath)

      if (notesEntry === null) {
        throw new Error('Notes XML is missing')
      }

      notes = extractNotesText(await readZipText(notesEntry))
    }
  }

  return {
    slideNumber,
    slidePath: orderedSlide.path,
    title,
    originalNotes: notes,
    editedNotes: notes,
    hasNotes: notes.trim().length > 0,
  }
}

export async function extractNotes(
  file: File,
  onProgress?: (progress: ParseProgress) => void,
): Promise<ExtractionResult> {
  validatePptxFile(file)
  onProgress?.({
    phase: 'reading',
    current: 0,
    total: 0,
    message: 'PowerPointを読み込んでいます…',
  })

  let zip: JSZip

  try {
    zip = await JSZip.loadAsync(file)
  } catch (error: unknown) {
    throw new PptxError(CORRUPT_FILE_MESSAGE, error)
  }

  let presentationPath = 'ppt/presentation.xml'
  let presentationEntry = zip.file(presentationPath)

  if (presentationEntry === null) {
    const rootRelationshipsEntry = zip.file('_rels/.rels')

    if (rootRelationshipsEntry !== null) {
      const rootRelationships = parseRelationships(
        await readZipText(rootRelationshipsEntry),
      )
      const officeDocumentRelationship = Array.from(
        rootRelationships.values(),
      ).find((relationship) => relationship.type.endsWith('/officeDocument'))

      if (officeDocumentRelationship !== undefined) {
        presentationPath = resolveZipPath(
          '',
          officeDocumentRelationship.target,
        )
        presentationEntry = zip.file(presentationPath)
      }
    }
  }

  const presentationRelationshipsEntry = zip.file(
    relsPathFor(presentationPath),
  )

  if (presentationEntry === null || presentationRelationshipsEntry === null) {
    throw new PptxError(MISSING_PRESENTATION_MESSAGE)
  }

  let orderedSlides: OrderedSlide[]

  try {
    const [presentationXml, presentationRelationshipsXml] = await Promise.all([
      readZipText(presentationEntry),
      readZipText(presentationRelationshipsEntry),
    ])
    orderedSlides = getOrderedSlides(
      presentationXml,
      parseRelationships(presentationRelationshipsXml),
      dirName(presentationPath),
    )
  } catch (error: unknown) {
    if (error instanceof PptxError) {
      throw error
    }
    throw new PptxError(CORRUPT_FILE_MESSAGE, error)
  }

  const total = orderedSlides.length
  onProgress?.({
    phase: 'parsing',
    current: 0,
    total,
    message: `スライド 0 / ${total} を解析しています…`,
  })

  const slides: ExtractedSlide[] = []

  for (let index = 0; index < orderedSlides.length; index += 1) {
    const orderedSlide = orderedSlides[index]
    const slideNumber = index + 1

    try {
      slides.push(await parseSlide(zip, orderedSlide, slideNumber))
    } catch {
      slides.push(
        emptySlide(
          slideNumber,
          orderedSlide.path ?? '',
          SLIDE_PARSE_ERROR_MESSAGE,
        ),
      )
    }

    if (slideNumber % 10 === 0 || slideNumber === total) {
      onProgress?.({
        phase: 'parsing',
        current: slideNumber,
        total,
        message: `スライド ${slideNumber} / ${total} を解析しています…`,
      })
      await yieldToBrowser()
    }
  }

  const slidesWithNotes = slides.filter((slide) => slide.hasNotes).length

  return {
    fileName: file.name,
    slideCount: slides.length,
    slidesWithNotes,
    slidesWithoutNotes: slides.length - slidesWithNotes,
    slides,
  }
}
