import { describe, expect, it } from 'vitest'
import { DEFAULT_EXPORT_OPTIONS } from './index'

describe('DEFAULT_EXPORT_OPTIONS', () => {
  it('仕様どおりの初期値を持つ', () => {
    expect(DEFAULT_EXPORT_OPTIONS).toEqual({
      includeEmptySlides: false,
      pageBreakPerSlide: false,
      includeSlideTitles: true,
      includeSummary: true,
    })
  })
})
