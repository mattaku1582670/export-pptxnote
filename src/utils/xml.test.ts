import { describe, expect, it } from 'vitest'
import { PptxError } from '../types'
import {
  getAttrByLocalName,
  getElementsByLocalName,
  getPlaceholderType,
  isNotesSlideRelType,
  isSlideRelType,
  parseRelationships,
  parseXml,
} from './xml'

const officeRelationshipBase =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

describe('parseXml', () => {
  it('不正なXMLでPptxErrorを投げる', () => {
    expect(() => parseXml('<root><broken></root>', 'テストXML')).toThrow(
      PptxError,
    )
    expect(() => parseXml('<root><broken></root>', 'テストXML')).toThrow(
      /テストXML/,
    )
  })

  it('空文字列でPptxErrorを投げる', () => {
    expect(() => parseXml('', '空のXML')).toThrow(PptxError)
  })
})

describe('parseRelationships', () => {
  it('RelationshipのIdからTargetを取得できる', () => {
    const relationships = parseRelationships(`
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId7" Type="${officeRelationshipBase}/slide"
          Target="slides/slide7.xml"/>
      </Relationships>
    `)

    expect(relationships.get('rId7')?.target).toBe('slides/slide7.xml')
  })

  it('要素の接頭辞がrelでも属性を取得できる', () => {
    const relationships = parseRelationships(`
      <rel:Relationships xmlns:rel="http://schemas.openxmlformats.org/package/2006/relationships">
        <rel:Relationship Id="custom" Type="${officeRelationshipBase}/notesSlide"
          Target="../notesSlides/notesSlide2.xml" TargetMode="Internal"/>
      </rel:Relationships>
    `)

    expect(relationships.get('custom')).toEqual({
      id: 'custom',
      type: `${officeRelationshipBase}/notesSlide`,
      target: '../notesSlides/notesSlide2.xml',
      targetMode: 'Internal',
    })
  })
})

describe('Relationship種別の判定', () => {
  it.each([
    [`${officeRelationshipBase}/slide`, true],
    [`${officeRelationshipBase}/slideLayout`, false],
    [`${officeRelationshipBase}/slideMaster`, false],
    [`${officeRelationshipBase}/slideUpdateInfo`, false],
    [`${officeRelationshipBase}/notesSlide`, false],
    ['https://example.test/custom/slide', true],
  ])('isSlideRelType(%s) は %s', (type, expected) => {
    expect(isSlideRelType(type)).toBe(expected)
  })

  it.each([
    [`${officeRelationshipBase}/notesSlide`, true],
    [`${officeRelationshipBase}/slide`, false],
    [`${officeRelationshipBase}/notesMaster`, false],
    ['https://example.test/custom/notesSlide', true],
  ])('isNotesSlideRelType(%s) は %s', (type, expected) => {
    expect(isNotesSlideRelType(type)).toBe(expected)
  })
})

describe('ローカル名ベースの検索', () => {
  it('r:idをidとして取得できる', () => {
    const document = parseXml(
      '<p:sldId xmlns:p="urn:p" xmlns:r="urn:r" r:id="rId1"/>',
      '属性XML',
    )

    expect(getAttrByLocalName(document.documentElement, 'id')).toBe('rId1')
  })

  it('接頭辞が異なるt要素を両方取得できる', () => {
    const document = parseXml(
      '<root xmlns:a="urn:a" xmlns:x="urn:x"><a:t>A</a:t><x:t>B</x:t></root>',
      'テキストXML',
    )

    expect(
      getElementsByLocalName(document, 't').map((element) => element.textContent),
    ).toEqual(['A', 'B'])
  })
})

describe('getPlaceholderType', () => {
  it.each(['body', 'sldNum', 'title'])('%sを返す', (type) => {
    const document = parseXml(
      `<p:sp xmlns:p="urn:p"><p:nvSpPr><p:nvPr><p:ph type="${type}"/></p:nvPr></p:nvSpPr></p:sp>`,
      'シェイプXML',
    )

    expect(getPlaceholderType(document.documentElement)).toBe(type)
  })

  it('type属性が省略されたphでは空文字を返す', () => {
    const document = parseXml(
      '<p:sp xmlns:p="urn:p"><p:nvSpPr><p:nvPr><p:ph/></p:nvPr></p:nvSpPr></p:sp>',
      'シェイプXML',
    )

    expect(getPlaceholderType(document.documentElement)).toBe('')
  })

  it('phが無ければnullを返す', () => {
    const document = parseXml(
      '<p:sp xmlns:p="urn:p"><p:nvSpPr><p:nvPr/></p:nvSpPr></p:sp>',
      'シェイプXML',
    )

    expect(getPlaceholderType(document.documentElement)).toBeNull()
  })
})
