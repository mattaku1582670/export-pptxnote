const graphemeSegmenter =
  typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter('ja', { granularity: 'grapheme' })
    : undefined

export function countCharacters(text: string): number {
  return graphemeSegmenter === undefined
    ? [...text].length
    : [...graphemeSegmenter.segment(text)].length
}
