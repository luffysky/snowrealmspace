import { describe, it, expect } from 'vitest'
import { storageKeys } from './adapter.js'

/**
 * 物件鍵是刪除流程的基礎（03-database.md §13）：
 * 帳號刪除時必須先蒐集所有 storage_key 才能清 R2。
 * 鍵的格式一旦不一致，就會留下永遠找不回來的孤兒檔案。
 */
describe('storageKeys', () => {
  const userId = 'u1'
  const spaceId = 's1'
  const assetId = 'a1'

  it('原始檔與衍生檔共用同一個 asset 前綴', () => {
    const original = storageKeys.assetOriginal(userId, spaceId, assetId)
    const thumb = storageKeys.assetRendition(userId, spaceId, assetId, 'thumbnail')
    const prefix = `users/${userId}/spaces/${spaceId}/assets/${assetId}/`

    expect(original.startsWith(prefix)).toBe(true)
    expect(thumb.startsWith(prefix)).toBe(true)
  })

  it('space 前綴涵蓋該 space 的所有 asset —— 刪除 space 時可一次列舉', () => {
    const spacePrefix = storageKeys.spacePrefix(userId, spaceId)
    expect(storageKeys.assetOriginal(userId, spaceId, assetId).startsWith(spacePrefix)).toBe(true)
    expect(
      storageKeys.assetRendition(userId, spaceId, assetId, 'preview').startsWith(spacePrefix),
    ).toBe(true)
  })

  it('不同 asset 的鍵不會互相碰撞', () => {
    expect(storageKeys.assetOriginal(userId, spaceId, 'a1')).not.toBe(
      storageKeys.assetOriginal(userId, spaceId, 'a2'),
    )
  })

  it('不同 space 的鍵不會互相碰撞', () => {
    expect(storageKeys.assetOriginal(userId, 's1', assetId)).not.toBe(
      storageKeys.assetOriginal(userId, 's2', assetId),
    )
  })

  it('字體不放在使用者路徑下（是全域參考資料）', () => {
    expect(storageKeys.font('inter', '400', 'latin').startsWith('fonts/')).toBe(true)
  })

  it('provider 匯出檔按 provider/connection/file/snapshot 分層', () => {
    const key = storageKeys.providerExport('figma', 'conn1', 'file1', 'snap1')
    expect(key).toBe('providers/figma/conn1/file1/snap1')
    // 斷開連線時要能一次列舉該 connection 的所有匯出檔並刪除
    expect(key.startsWith('providers/figma/conn1/')).toBe(true)
  })

  it('provider 匯出檔不落在使用者的 space 前綴下', () => {
    // 這是刻意的：provider 派生資料的生命週期綁在 connection 上，
    // 斷開連線時要能獨立清除，不受 space 刪除流程牽動。
    const providerKey = storageKeys.providerExport('figma', 'c1', 'f1', 's1')
    expect(providerKey.startsWith(storageKeys.spacePrefix(userId, spaceId))).toBe(false)
  })

  it('不同 connection 的匯出檔不會互相碰撞', () => {
    expect(storageKeys.providerExport('figma', 'c1', 'f1', 's1')).not.toBe(
      storageKeys.providerExport('figma', 'c2', 'f1', 's1'),
    )
  })
})
