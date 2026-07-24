import { describe, it, expect } from 'vitest'
import {
  sniffMimeType,
  mimeMatches,
  kindForMime,
  limitForMime,
  uploadIntentSchema,
  assetPatchSchema,
  assetListQuerySchema,
  LIMITS,
  ALL_ALLOWED_MIME,
} from './assets.js'

function bytes(...values: number[]): Uint8Array {
  const out = new Uint8Array(32)
  out.set(values)
  return out
}

const SIGNATURES = {
  png: bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
  jpeg: bytes(0xff, 0xd8, 0xff, 0xe0),
  gif: bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61),
  pdf: bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31),
  webp: bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50),
  mp4: bytes(0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d),
  avif: bytes(0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66),
  webm: bytes(0x1a, 0x45, 0xdf, 0xa3),
}

describe('sniffMimeType', () => {
  it.each([
    ['png', SIGNATURES.png, 'image/png'],
    ['jpeg', SIGNATURES.jpeg, 'image/jpeg'],
    ['gif', SIGNATURES.gif, 'image/gif'],
    ['pdf', SIGNATURES.pdf, 'application/pdf'],
    ['webp', SIGNATURES.webp, 'image/webp'],
    ['mp4', SIGNATURES.mp4, 'video/mp4'],
    ['avif', SIGNATURES.avif, 'image/avif'],
    ['webm', SIGNATURES.webm, 'video/webm'],
  ])('辨識 %s', (_name, input, expected) => {
    expect(sniffMimeType(input)).toBe(expected)
  })

  /**
   * 這是這支函式存在的理由：
   * 把可執行檔改名成 .png 並宣稱 image/png 是最基本的攻擊。
   */
  it('無法辨識的內容回 null（會被拒絕）', () => {
    expect(sniffMimeType(bytes(0x4d, 0x5a))).toBeNull() // Windows PE
    expect(sniffMimeType(bytes(0x7f, 0x45, 0x4c, 0x46))).toBeNull() // ELF
    expect(sniffMimeType(bytes(0x50, 0x4b, 0x03, 0x04))).toBeNull() // ZIP
    expect(sniffMimeType(bytes(0x3c, 0x3f, 0x70, 0x68, 0x70))).toBeNull() // PHP
  })

  it('空輸入回 null', () => {
    expect(sniffMimeType(new Uint8Array(0))).toBeNull()
  })

  it('RIFF 但不是 WEBP 時不誤判', () => {
    // RIFF....WAVE
    const wav = bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45)
    expect(sniffMimeType(wav)).toBeNull()
  })

  it('ftyp 但非 avif 的 brand 判為 mp4', () => {
    const mp4v2 = bytes(0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32)
    expect(sniffMimeType(mp4v2)).toBe('video/mp4')
  })
})

describe('mimeMatches', () => {
  it('完全相同時通過', () => {
    expect(mimeMatches('image/png', 'image/png')).toBe(true)
  })

  it('jpeg 的兩種寫法互通', () => {
    expect(mimeMatches('image/jpg', 'image/jpeg')).toBe(true)
    expect(mimeMatches('image/jpeg', 'image/jpg')).toBe(true)
  })

  it('不同類型不通過', () => {
    expect(mimeMatches('video/mp4', 'image/png')).toBe(false)
    expect(mimeMatches('image/png', 'image/webp')).toBe(false)
  })
})

describe('kindForMime', () => {
  it.each([
    ['image/png', 'image'],
    ['image/avif', 'image'],
    ['video/mp4', 'video'],
    ['video/webm', 'video'],
    ['application/pdf', 'pdf'],
  ] as const)('%s → %s', (mime, kind) => {
    expect(kindForMime(mime)).toBe(kind)
  })

  it('不在白名單的回 null', () => {
    expect(kindForMime('application/x-msdownload')).toBeNull()
    expect(kindForMime('text/html')).toBeNull()
    expect(kindForMime('image/svg+xml')).toBeNull() // SVG 可含 script，刻意不支援
  })
})

describe('limitForMime', () => {
  it('各類型的上限符合 ADR-022', () => {
    expect(limitForMime('image/png')).toBe(LIMITS.image)
    expect(limitForMime('video/mp4')).toBe(LIMITS.video)
    expect(limitForMime('application/pdf')).toBe(LIMITS.pdf)
  })

  it('未知類型回 null', () => {
    expect(limitForMime('text/plain')).toBeNull()
  })
})

describe('uploadIntentSchema', () => {
  const valid = {
    filename: 'photo.png',
    mimeType: 'image/png',
    bytes: 1024,
    checksum: 'a'.repeat(64),
  }

  it('接受合法輸入', () => {
    expect(uploadIntentSchema.safeParse(valid).success).toBe(true)
  })

  it('拒絕不在白名單的 MIME', () => {
    expect(
      uploadIntentSchema.safeParse({ ...valid, mimeType: 'application/x-msdownload' }).success,
    ).toBe(false)
  })

  it('拒絕格式錯誤的 checksum', () => {
    expect(uploadIntentSchema.safeParse({ ...valid, checksum: 'short' }).success).toBe(false)
    expect(
      uploadIntentSchema.safeParse({ ...valid, checksum: 'A'.repeat(64) }).success,
      '必須是小寫 hex',
    ).toBe(false)
  })

  it('拒絕超過該類型上限的大小', () => {
    expect(
      uploadIntentSchema.safeParse({ ...valid, bytes: LIMITS.image + 1 }).success,
    ).toBe(false)
    // 影片上限比圖片小，同樣的大小對影片不合法
    expect(
      uploadIntentSchema.safeParse({
        ...valid,
        mimeType: 'video/mp4',
        bytes: LIMITS.video + 1,
      }).success,
    ).toBe(false)
  })

  it('拒絕零或負數大小', () => {
    expect(uploadIntentSchema.safeParse({ ...valid, bytes: 0 }).success).toBe(false)
    expect(uploadIntentSchema.safeParse({ ...valid, bytes: -1 }).success).toBe(false)
  })

  it('拒絕多餘欄位（strict）', () => {
    expect(uploadIntentSchema.safeParse({ ...valid, evil: 'x' }).success).toBe(false)
  })

  it('錯誤訊息指出是哪個欄位', () => {
    const result = uploadIntentSchema.safeParse({ ...valid, bytes: LIMITS.image + 1 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain('bytes')
    }
  })
})

describe('白名單本身', () => {
  it('不含任何可執行或可含 script 的格式', () => {
    for (const mime of ALL_ALLOWED_MIME) {
      expect(mime).not.toContain('svg')
      expect(mime).not.toContain('html')
      expect(mime).not.toContain('javascript')
    }
  })

  it('每個白名單項目都能對應到 kind 與上限', () => {
    for (const mime of ALL_ALLOWED_MIME) {
      expect(kindForMime(mime), mime).not.toBeNull()
      expect(limitForMime(mime), mime).not.toBeNull()
    }
  })
})

describe('assetPatchSchema（整理 metadata）', () => {
  it('接受單一欄位：收藏', () => {
    expect(assetPatchSchema.parse({ isFavorite: true }).isFavorite).toBe(true)
  })

  it('空 patch 被拒', () => {
    expect(assetPatchSchema.safeParse({}).success).toBe(false)
  })

  it('標籤轉小寫並去重', () => {
    expect(assetPatchSchema.parse({ tags: ['A', 'a', 'B'] }).tags).toEqual(['a', 'b'])
  })

  it('封存旗標可為 boolean', () => {
    expect(assetPatchSchema.parse({ archived: true }).archived).toBe(true)
  })

  it('拒絕多餘欄位（strict，防改到位元組事實）', () => {
    expect(assetPatchSchema.safeParse({ isFavorite: true, bytes: 999 }).success).toBe(false)
    expect(assetPatchSchema.safeParse({ storage_key: 'x' }).success).toBe(false)
  })
})

describe('assetListQuerySchema（篩選）', () => {
  it('archived 預設排除', () => {
    expect(assetListQuerySchema.parse({}).archived).toBe('exclude')
  })

  it('favorite 由字串轉 boolean', () => {
    expect(assetListQuerySchema.parse({ favorite: 'true' }).favorite).toBe(true)
    expect(assetListQuerySchema.parse({ favorite: 'false' }).favorite).toBe(false)
    expect(assetListQuerySchema.parse({}).favorite).toBeUndefined()
  })

  it('tag 轉小寫', () => {
    expect(assetListQuerySchema.parse({ tag: 'Poster' }).tag).toBe('poster')
  })

  it('projectId 必須是 uuid', () => {
    expect(assetListQuerySchema.safeParse({ projectId: 'nope' }).success).toBe(false)
  })
})
