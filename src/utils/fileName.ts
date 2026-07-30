export const NOTES_FILE_SUFFIX = '_発表者ノート'

const INVALID_FILE_NAME_CHARACTERS = new Set(['\\', '/', ':', '*', '?', '"', '<', '>', '|'])
const LEADING_OR_TRAILING_WINDOWS_UNSAFE_CHARACTERS = /^[ .]+|[ .]+$/g
const REPEATED_UNDERSCORES = /_+/g

export function sanitizeFileName(name: string): string {
  const replaced = Array.from(name, (character) => {
    const codePoint = character.codePointAt(0)
    const isControlCharacter =
      codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f)

    return INVALID_FILE_NAME_CHARACTERS.has(character) || isControlCharacter
      ? '_'
      : character
  }).join('')
  const sanitized = replaced
    .replace(LEADING_OR_TRAILING_WINDOWS_UNSAFE_CHARACTERS, '')
    .replace(REPEATED_UNDERSCORES, '_')

  return sanitized.length === 0 ? 'notes' : sanitized
}

export function stripExtension(fileName: string): string {
  const lastPeriod = fileName.lastIndexOf('.')

  return lastPeriod <= 0 ? fileName : fileName.slice(0, lastPeriod)
}

export function buildExportFileName(
  sourceFileName: string,
  extension: 'docx' | 'txt',
): string {
  const sanitizedStem = sanitizeFileName(stripExtension(sourceFileName))
  const safeStem = /^_+$/.test(sanitizedStem) ? 'notes' : sanitizedStem
  const baseName = sanitizeFileName(`${safeStem}${NOTES_FILE_SUFFIX}`)

  return `${baseName}.${extension}`
}
