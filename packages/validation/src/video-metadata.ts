/**
 * 從容器標頭讀出影片時長。ADR-019。
 *
 * ## 為什麼不用 ffmpeg
 *
 * 只是要一個數字。ffmpeg 會讓 worker 映像檔多 80 MB，
 * 而 MP4 與 WebM 的時長都放在檔案開頭的固定結構裡，
 * 讀前幾百 KB 就夠。poster frame 才真的需要 ffmpeg。
 *
 * ## 為什麼伺服器端一定要自己算
 *
 * 客戶端會先用 `<video>` 量一次給即時回饋，但那個值是**使用者可以改的**。
 * 直接相信它等於沒有限制 —— 送一個 durationMs: 1000 的請求就能傳 10 分鐘的影片。
 * 這裡是權威來源。
 */

export type VideoMetadata = {
  durationMs: number
  /** 容器格式。解析失敗時為 null。 */
  container: 'mp4' | 'webm' | null
}

/** 解析不出來時回 null —— **不是**回 0。0 會通過所有上限檢查。 */
export function parseVideoDuration(buffer: Uint8Array): VideoMetadata | null {
  return parseMp4(buffer) ?? parseWebm(buffer) ?? null
}

// ── MP4 / ISO BMFF ──────────────────────────────────────────
//
// 時長在 moov > mvhd。box 結構是 [4 bytes 長度][4 bytes 型別][內容]。
// mvhd 的 version 0 是 32 位元時間值，version 1 是 64 位元。

const MP4_BRANDS = ['ftyp', 'moov', 'mdat', 'free', 'skip', 'wide']

function parseMp4(buffer: Uint8Array): VideoMetadata | null {
  if (buffer.length < 16) return null

  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)

  // 先確認這真的是 MP4：第一個 box 的型別要在已知清單裡
  const firstType = readType(buffer, 4)
  if (!MP4_BRANDS.includes(firstType)) return null

  const moov = findBox(buffer, view, 0, buffer.length, 'moov')
  if (!moov) return null

  const mvhd = findBox(buffer, view, moov.contentStart, moov.end, 'mvhd')
  if (!mvhd) return null

  const p = mvhd.contentStart
  if (p + 4 > buffer.length) return null

  const version = buffer[p]!

  try {
    if (version === 1) {
      // version(1) + flags(3) + created(8) + modified(8) + timescale(4) + duration(8)
      if (p + 32 > buffer.length) return null
      const timescale = view.getUint32(p + 20)
      const duration = Number(view.getBigUint64(p + 24))
      return finish(duration, timescale, 'mp4')
    }

    // version(1) + flags(3) + created(4) + modified(4) + timescale(4) + duration(4)
    if (p + 20 > buffer.length) return null
    const timescale = view.getUint32(p + 12)
    const duration = view.getUint32(p + 16)
    return finish(duration, timescale, 'mp4')
  } catch {
    return null
  }
}

function finish(duration: number, timescale: number, container: 'mp4'): VideoMetadata | null {
  // timescale 為 0 會除以零；duration 為 0xFFFFFFFF 是「未知」的慣用值
  if (!timescale || !duration || duration === 0xffffffff) return null
  return { durationMs: Math.round((duration / timescale) * 1000), container }
}

type Box = { type: string; contentStart: number; end: number }

/** 在 [start, limit) 範圍內逐個 box 掃描，找出指定型別。 */
function findBox(
  buffer: Uint8Array,
  view: DataView,
  start: number,
  limit: number,
  wanted: string,
): Box | null {
  let offset = start

  while (offset + 8 <= limit) {
    let size = view.getUint32(offset)
    let headerSize = 8

    if (size === 1) {
      // 64 位元長度
      if (offset + 16 > limit) return null
      size = Number(view.getBigUint64(offset + 8))
      headerSize = 16
    } else if (size === 0) {
      // 延伸到檔案結尾
      size = limit - offset
    }

    // 長度不合理就停止 —— 繼續掃只會讀到垃圾
    if (size < headerSize || offset + size > limit) return null

    const type = readType(buffer, offset + 4)
    if (type === wanted) {
      return { type, contentStart: offset + headerSize, end: offset + size }
    }

    offset += size
  }

  return null
}

function readType(buffer: Uint8Array, offset: number): string {
  if (offset + 4 > buffer.length) return ''
  return String.fromCharCode(
    buffer[offset]!,
    buffer[offset + 1]!,
    buffer[offset + 2]!,
    buffer[offset + 3]!,
  )
}

// ── WebM / Matroska ─────────────────────────────────────────
//
// EBML 結構。時長在 Segment > Info > Duration（float，單位是 TimecodeScale）。
// 完整的 EBML parser 很大，這裡只做「找到那兩個 element」所需的最小實作。

const EBML_MAGIC = [0x1a, 0x45, 0xdf, 0xa3]
const ID_TIMECODE_SCALE = 0x2ad7b1
const ID_DURATION = 0x4489

function parseWebm(buffer: Uint8Array): VideoMetadata | null {
  if (buffer.length < 4) return null
  if (!EBML_MAGIC.every((b, i) => buffer[i] === b)) return null

  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)

  // 預設 1 000 000 ns = 1 ms，絕大多數檔案都用這個值
  let timecodeScale = 1_000_000
  let duration: number | null = null

  // 不建完整的樹，直接線性掃描找那兩個 id。
  // Duration 一定在檔案前段的 Info element 裡，掃 2 MB 綽綽有餘。
  const limit = Math.min(buffer.length, 2 * 1024 * 1024)

  for (let i = 0; i + 2 < limit; i++) {
    const id2 = (buffer[i]! << 8) | buffer[i + 1]!
    const id3 = (buffer[i]! << 16) | (buffer[i + 1]! << 8) | buffer[i + 2]!

    if (id3 === ID_TIMECODE_SCALE) {
      const value = readUintElement(buffer, i + 3)
      if (value !== null && value > 0) timecodeScale = value
      continue
    }

    if (id2 === ID_DURATION) {
      const value = readFloatElement(view, buffer, i + 2)
      if (value !== null && value > 0) {
        duration = value
        break
      }
    }
  }

  if (duration === null) return null
  return { durationMs: Math.round((duration * timecodeScale) / 1_000_000), container: 'webm' }
}

/** EBML 的長度前綴：第一個 1 的位置決定總位元組數。 */
function readSize(buffer: Uint8Array, offset: number): { size: number; bytes: number } | null {
  if (offset >= buffer.length) return null
  const first = buffer[offset]!
  if (first === 0) return null

  let length = 1
  let mask = 0x80
  while (length <= 8 && (first & mask) === 0) {
    mask >>= 1
    length++
  }
  if (length > 8 || offset + length > buffer.length) return null

  let size = first & (mask - 1)
  for (let i = 1; i < length; i++) size = size * 256 + buffer[offset + i]!
  return { size, bytes: length }
}

function readUintElement(buffer: Uint8Array, offset: number): number | null {
  const header = readSize(buffer, offset)
  if (!header || header.size > 8) return null

  const start = offset + header.bytes
  if (start + header.size > buffer.length) return null

  let value = 0
  for (let i = 0; i < header.size; i++) value = value * 256 + buffer[start + i]!
  return value
}

function readFloatElement(view: DataView, buffer: Uint8Array, offset: number): number | null {
  const header = readSize(buffer, offset)
  if (!header) return null

  const start = offset + header.bytes
  if (start + header.size > buffer.length) return null

  // EBML 的 float 只可能是 4 或 8 bytes
  if (header.size === 4) return view.getFloat32(start)
  if (header.size === 8) return view.getFloat64(start)
  return null
}
