import { describe, expect, it } from 'vitest'
import { withRecalculatedCounts, type ExtractionResult } from './index'

function resultWithEmptySlide(): ExtractionResult {
  return {
    fileName: 'test.pptx',
    slideCount: 2,
    slidesWithNotes: 1,
    slidesWithoutNotes: 1,
    slides: [
      {
        slideNumber: 1,
        slidePath: 'ppt/slides/slide1.xml',
        title: '',
        originalNotes: '既存ノート',
        editedNotes: '既存ノート',
        hasNotes: true,
      },
      {
        slideNumber: 2,
        slidePath: 'ppt/slides/slide2.xml',
        title: '',
        originalNotes: '',
        editedNotes: '',
        hasNotes: false,
      },
    ],
  }
}

describe('withRecalculatedCounts', () => {
  it('editedNotesからhasNotesと集計値を再計算する', () => {
    const input = resultWithEmptySlide()
    const secondSlide = input.slides[1]

    if (secondSlide === undefined) {
      throw new Error('テスト用スライドが不足しています')
    }

    input.slides[1] = {
      ...secondSlide,
      editedNotes: '手入力したノート',
    }

    const recalculated = withRecalculatedCounts(input)

    expect(recalculated.slides[1]?.hasNotes).toBe(true)
    expect(recalculated.slidesWithNotes).toBe(2)
    expect(recalculated.slidesWithoutNotes).toBe(0)
    expect(recalculated.slideCount).toBe(2)
  })

  it('引数のresultとslidesを破壊しない', () => {
    const original = resultWithEmptySlide()
    const input = {
      ...original,
      slides: original.slides.map((slide, index) =>
        index === 1 ? { ...slide, editedNotes: '追記' } : slide,
      ),
    }
    const originalSlides = input.slides
    const originalSecondSlide = input.slides[1]
    const recalculated = withRecalculatedCounts(input)

    expect(input).toMatchObject({
      slideCount: 2,
      slidesWithNotes: 1,
      slidesWithoutNotes: 1,
    })
    expect(input.slides[1]).toMatchObject({
      editedNotes: '追記',
      hasNotes: false,
    })
    expect(input.slides).toBe(originalSlides)
    expect(input.slides[1]).toBe(originalSecondSlide)
    expect(recalculated).not.toBe(input)
    expect(recalculated.slides).not.toBe(input.slides)
  })
})
