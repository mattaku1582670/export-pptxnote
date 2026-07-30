import { describe, expect, it } from 'vitest'
import {
  buildExportFileName,
  NOTES_FILE_SUFFIX,
  sanitizeFileName,
  stripExtension,
} from './fileName'

describe('buildExportFileName', () => {
  it('日本語の元ファイル名からDOCXとTXTの名前を作る', () => {
    expect(buildExportFileName('研修資料.pptx', 'docx')).toBe(
      '研修資料_発表者ノート.docx',
    )
    expect(buildExportFileName('研修資料.pptx', 'txt')).toBe(
      '研修資料_発表者ノート.txt',
    )
  })

  it('複数のピリオドがある名前では最後の拡張子だけを落とす', () => {
    expect(buildExportFileName('資料.v2.pptx', 'docx')).toBe(
      '資料.v2_発表者ノート.docx',
    )
  })

  it('禁止文字をアンダースコアに置換する', () => {
    expect(buildExportFileName('a/b:c*.pptx', 'docx')).toBe(
      'a_b_c_発表者ノート.docx',
    )
  })

  it('日本語と絵文字を保持する', () => {
    expect(buildExportFileName('会議🎉.pptx', 'txt')).toBe(
      '会議🎉_発表者ノート.txt',
    )
  })

  it('元の名前が禁止文字だけでもnotesを使う', () => {
    expect(buildExportFileName('<>:"/\\|?*.pptx', 'docx')).toBe(
      'notes_発表者ノート.docx',
    )
  })
})

describe('sanitizeFileName', () => {
  it('制御文字を置換し、連続するアンダースコアを畳む', () => {
    expect(sanitizeFileName('会\u0000\u0001議\u007f')).toBe('会_議_')
  })

  it('先頭と末尾の空白・ピリオドを除去する', () => {
    expect(sanitizeFileName(' .. 資料.  ')).toBe('資料')
  })

  it('空になった場合はnotesを返し、サフィックス定数を公開する', () => {
    expect(sanitizeFileName(' ... ')).toBe('notes')
    expect(NOTES_FILE_SUFFIX).toBe('_発表者ノート')
  })
})

describe('stripExtension', () => {
  it.each([
    ['研修資料.pptx', '研修資料'],
    ['資料.v2.pptx', '資料.v2'],
    ['.pptx', '.pptx'],
    ['拡張子なし', '拡張子なし'],
  ])('%sから最後の拡張子だけを除く', (input, expected) => {
    expect(stripExtension(input)).toBe(expected)
  })
})
