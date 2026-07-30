function normalizeSeparators(value: string): string {
  return value.replaceAll('\\', '/')
}

function normalizeSegments(path: string): string {
  const segments: string[] = []

  for (const segment of normalizeSeparators(path).split('/')) {
    if (segment === '' || segment === '.') {
      continue
    }

    if (segment === '..') {
      segments.pop()
      continue
    }

    segments.push(segment)
  }

  return segments.join('/')
}

export function resolveZipPath(baseDir: string, target: string): string {
  const normalizedTarget = normalizeSeparators(target)
  const combined = normalizedTarget.startsWith('/')
    ? normalizedTarget
    : `${normalizeSeparators(baseDir).replace(/\/+$/, '')}/${normalizedTarget}`

  return normalizeSegments(combined)
}

export function dirName(zipPath: string): string {
  const normalized = normalizeSeparators(zipPath).replace(/\/+$/, '')
  const lastSeparator = normalized.lastIndexOf('/')

  return lastSeparator === -1 ? '' : normalized.slice(0, lastSeparator)
}

export function relsPathFor(zipPath: string): string {
  const normalized = normalizeSeparators(zipPath).replace(/^\/+/, '')
  const directory = dirName(normalized)
  const fileName = normalized.slice(directory.length === 0 ? 0 : directory.length + 1)

  return directory === ''
    ? `_rels/${fileName}.rels`
    : `${directory}/_rels/${fileName}.rels`
}
