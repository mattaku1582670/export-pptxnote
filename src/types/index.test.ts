import { describe, expect, it } from 'vitest'
import {
  filterSlides,
  hasAnyEdits,
  revertAllSlides,
  slideIsEdited,
  slideNumbersWithoutNotes,
  withRecalculatedCounts,
  type ExtractedSlide,
  type ExtractionResult,
} from './index'

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

function slidesForFiltering(): ExtractedSlide[] {
  return [
    {
      slideNumber: 1,
      slidePath: 'ppt/slides/slide1.xml',
      title: 'Opening ALPHA',
      originalNotes: '最初のノート',
      editedNotes: '最初のノート',
      hasNotes: true,
    },
    {
      slideNumber: 2,
      slidePath: 'ppt/slides/slide2.xml',
      title: 'Second slide',
      originalNotes: '',
      editedNotes: '追加した Beta ノート',
      hasNotes: true,
    },
    {
      slideNumber: 30,
      slidePath: 'ppt/slides/slide30.xml',
      title: 'Closing',
      originalNotes: '検索対象外の元ノート',
      editedNotes: '',
      hasNotes: false,
    },
  ]
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

describe('編集状態', () => {
  it('editedNotesとoriginalNotesが違うスライドを編集済みと判定する', () => {
    const slide = slidesForFiltering()[1]

    expect(slideIsEdited(slide)).toBe(true)
  })

  it('editedNotesとoriginalNotesが同じスライドを未編集と判定する', () => {
    const slide = slidesForFiltering()[0]

    expect(slideIsEdited(slide)).toBe(false)
  })

  it('編集済みスライドが1枚でもあればhasAnyEditsがtrueを返す', () => {
    const result = {
      ...resultWithEmptySlide(),
      slides: slidesForFiltering(),
    }

    expect(hasAnyEdits(result)).toBe(true)
  })

  it('編集済みスライドがなければhasAnyEditsがfalseを返す', () => {
    expect(hasAnyEdits(resultWithEmptySlide())).toBe(false)
  })
})

describe('revertAllSlides', () => {
  it('全スライドのeditedNotesをoriginalNotesに戻す', () => {
    const input = {
      ...resultWithEmptySlide(),
      slides: slidesForFiltering(),
    }

    const reverted = revertAllSlides(input)

    expect(reverted.slides.map((slide) => slide.editedNotes)).toEqual(
      reverted.slides.map((slide) => slide.originalNotes),
    )
  })

  it('引数のresult・slides・各slideを破壊しない', () => {
    const input = {
      ...resultWithEmptySlide(),
      slides: slidesForFiltering(),
    }
    const originalSlides = input.slides
    const originalSlideReferences = [...input.slides]
    const originalEditedNotes = input.slides.map(
      (slide) => slide.editedNotes,
    )

    const reverted = revertAllSlides(input)

    expect(input.slides).toBe(originalSlides)
    expect(input.slides).toEqual(originalSlideReferences)
    expect(input.slides.map((slide) => slide.editedNotes)).toEqual(
      originalEditedNotes,
    )
    expect(reverted).not.toBe(input)
    expect(reverted.slides).not.toBe(input.slides)
    reverted.slides.forEach((slide, index) => {
      expect(slide).not.toBe(input.slides[index])
    })
  })

  it('hasNotesと件数を抽出直後の状態に戻す', () => {
    const original = resultWithEmptySlide()
    const edited = withRecalculatedCounts({
      ...original,
      slides: original.slides.map((slide) =>
        slide.slideNumber === 2
          ? { ...slide, editedNotes: '追加したノート' }
          : slide,
      ),
    })

    expect(edited.slidesWithNotes).toBe(2)
    expect(edited.slidesWithoutNotes).toBe(0)

    const reverted = revertAllSlides(edited)

    expect(reverted.slides.map((slide) => slide.hasNotes)).toEqual([
      true,
      false,
    ])
    expect(reverted.slidesWithNotes).toBe(1)
    expect(reverted.slidesWithoutNotes).toBe(1)
  })
})

describe('filterSlides', () => {
  it('allで全件を返す', () => {
    const slides = slidesForFiltering()

    expect(filterSlides(slides, 'all', '')).toEqual(slides)
  })

  it('withNotesとwithoutNotesをhasNotesで分ける', () => {
    const slides = slidesForFiltering()

    expect(
      filterSlides(slides, 'withNotes', '').map(
        (slide) => slide.slideNumber,
      ),
    ).toEqual([1, 2])
    expect(
      filterSlides(slides, 'withoutNotes', '').map(
        (slide) => slide.slideNumber,
      ),
    ).toEqual([30])
  })

  it('editedで編集済みのものだけを返す', () => {
    expect(
      filterSlides(slidesForFiltering(), 'edited', '').map(
        (slide) => slide.slideNumber,
      ),
    ).toEqual([2, 30])
  })

  it('検索がスライド番号に一致する', () => {
    expect(
      filterSlides(slidesForFiltering(), 'all', '30').map(
        (slide) => slide.slideNumber,
      ),
    ).toEqual([30])
  })

  it('検索がタイトルに大文字小文字を区別せず一致する', () => {
    expect(
      filterSlides(slidesForFiltering(), 'all', 'alpha').map(
        (slide) => slide.slideNumber,
      ),
    ).toEqual([1])
  })

  it('検索はoriginalNotesではなくeditedNotesに一致する', () => {
    const slides = slidesForFiltering()

    expect(
      filterSlides(slides, 'all', 'beta').map(
        (slide) => slide.slideNumber,
      ),
    ).toEqual([2])
    expect(filterSlides(slides, 'all', '検索対象外')).toEqual([])
  })

  it('フィルターと検索を同時に適用する', () => {
    expect(
      filterSlides(slidesForFiltering(), 'edited', 'beta').map(
        (slide) => slide.slideNumber,
      ),
    ).toEqual([2])
  })
})

describe('slideNumbersWithoutNotes', () => {
  it('hasNotesがfalseのスライド番号だけを昇順で返す', () => {
    const slides = slidesForFiltering()
    const input = {
      ...resultWithEmptySlide(),
      slides: [
        slides[2],
        { ...slides[0], slideNumber: 7, hasNotes: false },
        slides[1],
      ],
    }

    expect(slideNumbersWithoutNotes(input)).toEqual([7, 30])
  })

  it('全スライドにノートがある場合は空配列を返す', () => {
    const input = withRecalculatedCounts({
      ...resultWithEmptySlide(),
      slides: resultWithEmptySlide().slides.map((slide) => ({
        ...slide,
        editedNotes: 'ノートあり',
      })),
    })

    expect(slideNumbersWithoutNotes(input)).toEqual([])
  })

  it('編集でノートを入れて再集計すると番号が一覧から消える', () => {
    const original = resultWithEmptySlide()
    expect(slideNumbersWithoutNotes(original)).toEqual([2])

    const edited = withRecalculatedCounts({
      ...original,
      slides: original.slides.map((slide) =>
        slide.slideNumber === 2
          ? { ...slide, editedNotes: '追加したノート' }
          : slide,
      ),
    })

    expect(slideNumbersWithoutNotes(edited)).toEqual([])
  })
})
