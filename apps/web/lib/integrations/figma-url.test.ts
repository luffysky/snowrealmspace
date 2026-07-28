import { describe, it, expect } from 'vitest'
import { extractFigmaKeys } from './figma-url'

describe('extractFigmaKeys', () => {
  it('從 /file/ 網址擷取 key', () => {
    expect(extractFigmaKeys('https://www.figma.com/file/abcd1234EFGH5678/My-Design')).toEqual([
      'abcd1234EFGH5678',
    ])
  })

  it('從 /design/ 網址擷取 key', () => {
    expect(extractFigmaKeys('https://www.figma.com/design/KEY1234567890abc/Some-File?node-id=1-2')).toEqual([
      'KEY1234567890abc',
    ])
  })

  it('從 FigJam /board/ 與原型 /proto/ 網址擷取 key', () => {
    expect(extractFigmaKeys('https://www.figma.com/board/boardKEY1234567/Jam')).toEqual([
      'boardKEY1234567',
    ])
    expect(extractFigmaKeys('https://www.figma.com/proto/protoKEY1234567/Proto')).toEqual([
      'protoKEY1234567',
    ])
  })

  it('接受直接貼上的裸 key', () => {
    expect(extractFigmaKeys('abcdefghij123456')).toEqual(['abcdefghij123456'])
  })

  it('接受無協定 / 無 www 的網址', () => {
    expect(extractFigmaKeys('figma.com/file/nowwwKEY1234567/x')).toEqual(['nowwwKEY1234567'])
  })

  it('一次多筆（換行 / 逗號 / 空白），並去重', () => {
    const input = `
      https://www.figma.com/file/keyAAAAAAAAAAAA1/One
      https://www.figma.com/design/keyBBBBBBBBBBBB2/Two, keyCCCCCCCCCCCC3
      https://www.figma.com/file/keyAAAAAAAAAAAA1/One-again
    `
    expect(extractFigmaKeys(input)).toEqual([
      'keyAAAAAAAAAAAA1',
      'keyBBBBBBBBBBBB2',
      'keyCCCCCCCCCCCC3',
    ])
  })

  it('雜訊 / 非 Figma 網址 / 過短字串 → 空陣列', () => {
    expect(extractFigmaKeys('隨便打的字 hello https://example.com/file/foo short')).toEqual([])
    expect(extractFigmaKeys('')).toEqual([])
    expect(extractFigmaKeys('   \n  ')).toEqual([])
    // @ts-expect-error 非字串輸入也不應拋錯
    expect(extractFigmaKeys(null)).toEqual([])
  })

  it('混合有效與雜訊：只留有效的', () => {
    const input = '垃圾 https://www.figma.com/file/validKEY1234567/Ok 又是垃圾 tooShort'
    expect(extractFigmaKeys(input)).toEqual(['validKEY1234567'])
  })
})
