import JSZip from 'jszip'
import { describe, expect, it, vi } from 'vitest'
import { PptxError } from '../types'
import {
  extractNotes,
  isLargeFile,
  LARGE_FILE_WARNING_BYTES,
  validatePptxFile,
} from './pptxParser'

const slideRelationshipType =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide'
const notesRelationshipType =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide'
const officeDocumentRelationshipType =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument'

interface TestRelationship {
  id: string
  type: string
  target: string
  targetMode?: string
}

async function buildPptx(
  files: Record<string, string>,
  name = 'test.pptx',
): Promise<File> {
  const zip = new JSZip()

  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content)
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  return new File([blob], name, {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  })
}

function presentationXml(relationshipIds: string[]): string {
  return `
    <p:presentation xmlns:p="urn:p" xmlns:r="urn:r">
      <p:sldIdLst>
        ${relationshipIds
          .map((id, index) => `<p:sldId id="${256 + index}" r:id="${id}"/>`)
          .join('')}
      </p:sldIdLst>
    </p:presentation>
  `
}

function relationshipsXml(relationships: TestRelationship[]): string {
  return `
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      ${relationships
        .map(
          ({ id, type, target, targetMode }) =>
            `<Relationship Id="${id}" Type="${type}" Target="${target}"${
              targetMode === undefined ? '' : ` TargetMode="${targetMode}"`
            }/>`,
        )
        .join('')}
    </Relationships>
  `
}

function slideXml(title: string): string {
  return `
    <p:sld xmlns:p="urn:p" xmlns:a="urn:a">
      <p:cSld><p:spTree><p:sp>
        <p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
        <p:txBody><a:p><a:r><a:t>${title}</a:t></a:r></a:p></p:txBody>
      </p:sp></p:spTree></p:cSld>
    </p:sld>
  `
}

function notesXml(notes: string): string {
  return `
    <p:notes xmlns:p="urn:p" xmlns:a="urn:a">
      <p:cSld><p:spTree><p:sp>
        <p:nvSpPr><p:nvPr><p:ph type="body"/></p:nvPr></p:nvSpPr>
        <p:txBody><a:p><a:r><a:t>${notes}</a:t></a:r></a:p></p:txBody>
      </p:sp></p:spTree></p:cSld>
    </p:notes>
  `
}

function twoSlideBase(
  order = ['rId1', 'rId2'],
): Record<string, string> {
  return {
    'ppt/presentation.xml': presentationXml(order),
    'ppt/_rels/presentation.xml.rels': relationshipsXml([
      {
        id: 'rId1',
        type: slideRelationshipType,
        target: 'slides/slide1.xml',
      },
      {
        id: 'rId2',
        type: slideRelationshipType,
        target: 'slides/slide2.xml',
      },
    ]),
    'ppt/slides/slide1.xml': slideXml('タイトル1'),
    'ppt/slides/slide2.xml': slideXml('タイトル2'),
  }
}

function slideNotesRels(target: string, targetMode?: string): string {
  return relationshipsXml([
    {
      id: 'notes',
      type: notesRelationshipType,
      target,
      ...(targetMode === undefined ? {} : { targetMode }),
    },
  ])
}

describe('extractNotes', () => {
  it('sldIdLstの並び順を表示順として使う', async () => {
    const file = await buildPptx(twoSlideBase(['rId2', 'rId1']))
    const result = await extractNotes(file)

    expect(result.slides.map(({ slideNumber, title }) => ({ slideNumber, title }))).toEqual([
      { slideNumber: 1, title: 'タイトル2' },
      { slideNumber: 2, title: 'タイトル1' },
    ])
  })

  it('スライドごとのrelsに従ってnotesSlideを対応付ける', async () => {
    const files = {
      ...twoSlideBase(),
      'ppt/slides/_rels/slide1.xml.rels': slideNotesRels(
        '../notesSlides/notesSlide2.xml',
      ),
      'ppt/slides/_rels/slide2.xml.rels': slideNotesRels(
        '../notesSlides/notesSlide1.xml',
      ),
      'ppt/notesSlides/notesSlide1.xml': notesXml('ノートA'),
      'ppt/notesSlides/notesSlide2.xml': notesXml('ノートB'),
    }
    const result = await extractNotes(await buildPptx(files))

    expect(result.slides.map((slide) => slide.originalNotes)).toEqual([
      'ノートB',
      'ノートA',
    ])
  })

  it('一部だけノートがある場合の集計が正しい', async () => {
    const files = {
      ...twoSlideBase(),
      'ppt/slides/_rels/slide1.xml.rels': slideNotesRels(
        '../notesSlides/notesSlide1.xml',
      ),
      'ppt/notesSlides/notesSlide1.xml': notesXml('ノートあり'),
    }
    const result = await extractNotes(await buildPptx(files))

    expect(result.slidesWithNotes).toBe(1)
    expect(result.slidesWithoutNotes).toBe(1)
    expect(result.slideCount).toBe(2)
  })

  it('ノートが1件も無ければslidesWithNotesは0になる', async () => {
    const result = await extractNotes(await buildPptx(twoSlideBase()))

    expect(result.slidesWithNotes).toBe(0)
    expect(result.slidesWithoutNotes).toBe(2)
  })

  it('スライドrelsが存在しなくてもノートなしとして扱う', async () => {
    const result = await extractNotes(await buildPptx(twoSlideBase()))

    expect(result.slides[0]).toMatchObject({
      hasNotes: false,
      originalNotes: '',
    })
    expect(result.slides[0]?.parseError).toBeUndefined()
  })

  it('参照先ノートXMLが無いスライドだけparseErrorにする', async () => {
    const files = {
      ...twoSlideBase(),
      'ppt/slides/_rels/slide1.xml.rels': slideNotesRels(
        '../notesSlides/missing.xml',
      ),
    }
    const result = await extractNotes(await buildPptx(files))

    expect(result.slides[0]).toMatchObject({
      hasNotes: false,
      originalNotes: '',
      parseError: 'このスライドは解析できませんでした。',
    })
    expect(result.slides[1]).toMatchObject({
      slideNumber: 2,
      title: 'タイトル2',
      hasNotes: false,
    })
    expect(result.slides[1]?.parseError).toBeUndefined()
  })

  it('Target内の..を解決する', async () => {
    const files = {
      'ppt/presentation.xml': presentationXml(['slide']),
      'ppt/_rels/presentation.xml.rels': relationshipsXml([
        {
          id: 'slide',
          type: slideRelationshipType,
          target: 'slides/sub/../slide1.xml',
        },
      ]),
      'ppt/slides/slide1.xml': slideXml('相対パス'),
      'ppt/slides/_rels/slide1.xml.rels': slideNotesRels(
        '../notesSlides/sub/../notesSlide1.xml',
      ),
      'ppt/notesSlides/notesSlide1.xml': notesXml('解決済み'),
    }
    const result = await extractNotes(await buildPptx(files))

    expect(result.slides[0]?.originalNotes).toBe('解決済み')
  })

  it('同じnotesSlideを参照する複製スライドの両方にノートを入れる', async () => {
    const files = {
      ...twoSlideBase(),
      'ppt/slides/_rels/slide1.xml.rels': slideNotesRels(
        '../notesSlides/shared.xml',
      ),
      'ppt/slides/_rels/slide2.xml.rels': slideNotesRels(
        '../notesSlides/shared.xml',
      ),
      'ppt/notesSlides/shared.xml': notesXml('共有ノート'),
    }
    const result = await extractNotes(await buildPptx(files))

    expect(result.slides.map((slide) => slide.originalNotes)).toEqual([
      '共有ノート',
      '共有ノート',
    ])
  })

  it('TargetMode=Externalのノート参照を無視する', async () => {
    const files = {
      ...twoSlideBase(),
      'ppt/slides/_rels/slide1.xml.rels': slideNotesRels(
        'https://example.test/notes.xml',
        'External',
      ),
    }
    const result = await extractNotes(await buildPptx(files))

    expect(result.slides[0]?.hasNotes).toBe(false)
    expect(result.slides[0]?.parseError).toBeUndefined()
  })

  it('TargetMode=ExternalのスライドをparseError付きで残して番号を保つ', async () => {
    const files = {
      'ppt/presentation.xml': presentationXml(['rId1', 'rId2']),
      'ppt/_rels/presentation.xml.rels': relationshipsXml([
        {
          id: 'rId1',
          type: slideRelationshipType,
          target: 'https://example.test/slide1.xml',
          targetMode: 'eXtErNaL',
        },
        {
          id: 'rId2',
          type: slideRelationshipType,
          target: 'slides/slide2.xml',
        },
      ]),
      'ppt/slides/slide2.xml': slideXml('2枚目'),
    }
    const result = await extractNotes(await buildPptx(files))

    expect(result.slides).toHaveLength(2)
    expect(result.slides[0]).toMatchObject({
      slideNumber: 1,
      slidePath: '',
      parseError: 'このスライドは解析できませんでした。',
    })
    expect(result.slides[1]).toMatchObject({
      slideNumber: 2,
      title: '2枚目',
    })
  })

  it('ルートrelsから非標準パスのメインパートを解決する', async () => {
    const files = {
      '_rels/.rels': relationshipsXml([
        {
          id: 'officeDocument',
          type: officeDocumentRelationshipType,
          target: 'presentation2/main.xml',
        },
      ]),
      'presentation2/main.xml': presentationXml(['slide']),
      'presentation2/_rels/main.xml.rels': relationshipsXml([
        {
          id: 'slide',
          type: slideRelationshipType,
          target: 'slides/slide1.xml',
        },
      ]),
      'presentation2/slides/slide1.xml': slideXml('非標準配置'),
      'presentation2/slides/_rels/slide1.xml.rels': slideNotesRels(
        '../notesSlides/notesSlide1.xml',
      ),
      'presentation2/notesSlides/notesSlide1.xml': notesXml(
        '非標準配置のノート',
      ),
    }
    const result = await extractNotes(await buildPptx(files))

    expect(result.slides[0]).toMatchObject({
      slidePath: 'presentation2/slides/slide1.xml',
      title: '非標準配置',
      originalNotes: '非標準配置のノート',
      hasNotes: true,
    })
  })

  it('presentation.xmlが無いZIPでは専用エラーを投げる', async () => {
    const file = await buildPptx({ 'dummy.txt': 'ZIPではある' })

    await expect(extractNotes(file)).rejects.toMatchObject({
      name: 'PptxError',
      userMessage:
        'このファイルにはPowerPointのプレゼンテーション情報が見つかりませんでした。',
    })
  })

  it('壊れたZIPでは読み取りエラーを投げる', async () => {
    const file = new File(['not a zip'], 'broken.pptx')

    await expect(extractNotes(file)).rejects.toSatisfy((error: unknown) => {
      return (
        error instanceof PptxError &&
        error.userMessage.startsWith(
          'PowerPointファイルを読み取れませんでした。',
        )
      )
    })
  })

  it('日本語ファイル名を結果に保持する', async () => {
    const file = await buildPptx(twoSlideBase(), '研修資料.pptx')
    const result = await extractNotes(file)

    expect(result.fileName).toBe('研修資料.pptx')
  })

  it('sldIdLstが無ければスライド0枚を正常に返す', async () => {
    const file = await buildPptx({
      'ppt/presentation.xml':
        '<p:presentation xmlns:p="urn:p" xmlns:r="urn:r"/>',
      'ppt/_rels/presentation.xml.rels': relationshipsXml([]),
    })
    const result = await extractNotes(file)

    expect(result).toMatchObject({
      slideCount: 0,
      slidesWithNotes: 0,
      slidesWithoutNotes: 0,
      slides: [],
    })
  })

  it('壊れたスライドだけparseErrorにして後続を処理する', async () => {
    const files = {
      ...twoSlideBase(),
      'ppt/slides/slide1.xml': '<p:sld xmlns:p="urn:p"><broken></p:sld>',
      'ppt/slides/_rels/slide2.xml.rels': slideNotesRels(
        '../notesSlides/notesSlide2.xml',
      ),
      'ppt/notesSlides/notesSlide2.xml': notesXml('正常なノート'),
    }
    const result = await extractNotes(await buildPptx(files))

    expect(result.slides[0]).toMatchObject({
      slideNumber: 1,
      title: '',
      originalNotes: '',
      editedNotes: '',
      hasNotes: false,
      parseError: 'このスライドは解析できませんでした。',
    })
    expect(result.slides[1]?.originalNotes).toBe('正常なノート')
  })

  it('Relationshipがないスライドを残して後続の番号をずらさない', async () => {
    const files = {
      'ppt/presentation.xml': presentationXml(['rId1', 'missing', 'rId3']),
      'ppt/_rels/presentation.xml.rels': relationshipsXml([
        {
          id: 'rId1',
          type: slideRelationshipType,
          target: 'slides/slide1.xml',
        },
        {
          id: 'rId3',
          type: slideRelationshipType,
          target: 'slides/slide3.xml',
        },
      ]),
      'ppt/slides/slide1.xml': slideXml('1枚目'),
      'ppt/slides/slide3.xml': slideXml('3枚目のタイトル'),
      'ppt/slides/_rels/slide3.xml.rels': slideNotesRels(
        '../notesSlides/notesSlide3.xml',
      ),
      'ppt/notesSlides/notesSlide3.xml': notesXml('3枚目のノート'),
    }
    const result = await extractNotes(await buildPptx(files))

    expect(result.slides).toHaveLength(3)
    expect(result.slides.map((slide) => slide.slideNumber)).toEqual([1, 2, 3])
    expect(result.slides[1]).toMatchObject({
      slideNumber: 2,
      slidePath: '',
      parseError: 'このスライドは解析できませんでした。',
    })
    expect(result.slides[2]).toMatchObject({
      slideNumber: 3,
      title: '3枚目のタイトル',
      originalNotes: '3枚目のノート',
    })
  })

  it('slide以外のRelationship型でもスライドをparseError付きで残す', async () => {
    const slideLayoutRelationshipType =
      'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout'
    const files = {
      'ppt/presentation.xml': presentationXml(['rId1', 'rId2', 'rId3']),
      'ppt/_rels/presentation.xml.rels': relationshipsXml([
        {
          id: 'rId1',
          type: slideRelationshipType,
          target: 'slides/slide1.xml',
        },
        {
          id: 'rId2',
          type: slideLayoutRelationshipType,
          target: 'slideLayouts/slideLayout1.xml',
        },
        {
          id: 'rId3',
          type: slideRelationshipType,
          target: 'slides/slide3.xml',
        },
      ]),
      'ppt/slides/slide1.xml': slideXml('1枚目'),
      'ppt/slides/slide3.xml': slideXml('3枚目'),
    }
    const result = await extractNotes(await buildPptx(files))

    expect(result.slides).toHaveLength(3)
    expect(result.slides.map((slide) => slide.slideNumber)).toEqual([1, 2, 3])
    expect(result.slides[1]).toMatchObject({
      slidePath: '',
      parseError: 'このスライドは解析できませんでした。',
    })
    expect(result.slides[2]?.title).toBe('3枚目')
  })

  it('readingとparsingの進捗を通知する', async () => {
    const onProgress = vi.fn()

    await extractNotes(await buildPptx(twoSlideBase()), onProgress)

    expect(onProgress).toHaveBeenCalledWith({
      phase: 'reading',
      current: 0,
      total: 0,
      message: 'PowerPointを読み込んでいます…',
    })
    expect(onProgress).toHaveBeenCalledWith({
      phase: 'parsing',
      current: 0,
      total: 2,
      message: 'スライド 0 / 2 を解析しています…',
    })
    expect(onProgress).toHaveBeenLastCalledWith({
      phase: 'parsing',
      current: 2,
      total: 2,
      message: 'スライド 2 / 2 を解析しています…',
    })
  })

  it('editedNotesの初期値をoriginalNotesと同じにする', async () => {
    const files = {
      ...twoSlideBase(),
      'ppt/slides/_rels/slide1.xml.rels': slideNotesRels(
        '../notesSlides/notesSlide1.xml',
      ),
      'ppt/notesSlides/notesSlide1.xml': notesXml('編集前ノート'),
    }
    const result = await extractNotes(await buildPptx(files))

    expect(result.slides[0]?.editedNotes).toBe(
      result.slides[0]?.originalNotes,
    )
  })
})

describe('validatePptxFile', () => {
  it('.pptには古い形式専用のエラーを出す', () => {
    expect(() => validatePptxFile(new File(['x'], 'legacy.ppt'))).toThrow(
      '古い形式（.ppt）には対応していません。PowerPointで.pptx形式に変換してから読み込んでください。',
    )
  })

  it('.txtには対応形式エラーを出す', () => {
    expect(() => validatePptxFile(new File(['x'], 'notes.txt'))).toThrow(
      '対応しているファイル形式は.pptxです。',
    )
  })

  it('.pptmも対応形式エラーにする', () => {
    expect(() => validatePptxFile(new File(['x'], 'macro.pptm'))).toThrow(
      '対応しているファイル形式は.pptxです。',
    )
  })

  it('サイズ0には空ファイル専用エラーを出す', () => {
    expect(() => validatePptxFile(new File([], 'empty.pptx'))).toThrow(
      'ファイルの中身が空です。別のファイルを選択してください。',
    )
  })

  it('複数ピリオドを含む.pptxを受け付ける', () => {
    expect(() =>
      validatePptxFile(new File(['x'], '資料.v2.pptx')),
    ).not.toThrow()
  })

  it('拡張子の大文字小文字を無視する', () => {
    expect(() =>
      validatePptxFile(new File(['x'], '資料.PPTX')),
    ).not.toThrow()
  })
})

describe('isLargeFile', () => {
  it('100 MiBを超える場合だけtrueを返す', () => {
    const atLimit = { size: LARGE_FILE_WARNING_BYTES } as File
    const overLimit = { size: LARGE_FILE_WARNING_BYTES + 1 } as File

    expect(isLargeFile(atLimit)).toBe(false)
    expect(isLargeFile(overLimit)).toBe(true)
  })
})
