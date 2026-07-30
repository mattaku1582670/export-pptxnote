import { describe, expect, it } from 'vitest'
import { dirName, relsPathFor, resolveZipPath } from './zipPath'

describe('resolveZipPath', () => {
  it.each([
    [
      'ppt/slides/',
      '../notesSlides/notesSlide1.xml',
      'ppt/notesSlides/notesSlide1.xml',
    ],
    [
      'ppt/slides',
      '../notesSlides/notesSlide1.xml',
      'ppt/notesSlides/notesSlide1.xml',
    ],
    ['ppt/', 'slides/slide1.xml', 'ppt/slides/slide1.xml'],
    ['ppt/slides/', './slide1.xml', 'ppt/slides/slide1.xml'],
    ['ppt/slides/', 'slide1.xml', 'ppt/slides/slide1.xml'],
    ['ppt/a/b/c/', '../../../x.xml', 'ppt/x.xml'],
    [
      'ppt/slides/',
      '../../ppt/./notesSlides/notesSlide2.xml',
      'ppt/notesSlides/notesSlide2.xml',
    ],
    [
      'ppt/slides/',
      '/ppt/notesSlides/notesSlide3.xml',
      'ppt/notesSlides/notesSlide3.xml',
    ],
    ['ppt/', '../../../../etc/passwd', 'etc/passwd'],
    [
      'ppt/slides/',
      '..\\notesSlides\\notesSlide1.xml',
      'ppt/notesSlides/notesSlide1.xml',
    ],
  ])('%s と %s を解決する', (baseDir, target, expected) => {
    expect(resolveZipPath(baseDir, target)).toBe(expected)
  })
})

describe('dirName', () => {
  it('ZIPパスのディレクトリ部分を返す', () => {
    expect(dirName('ppt/slides/slide1.xml')).toBe('ppt/slides')
  })

  it('ルート直下なら空文字を返す', () => {
    expect(dirName('slide1.xml')).toBe('')
  })
})

describe('relsPathFor', () => {
  it.each([
    [
      'ppt/slides/slide1.xml',
      'ppt/slides/_rels/slide1.xml.rels',
    ],
    ['ppt/presentation.xml', 'ppt/_rels/presentation.xml.rels'],
  ])('%s に対応するrelsパスを返す', (input, expected) => {
    expect(relsPathFor(input)).toBe(expected)
  })
})
