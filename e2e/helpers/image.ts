import sharp from 'sharp'

/**
 * 產生測試用 PNG。
 *
 * 不放固定的 fixture 檔案：那會讓 repo 帶二進位檔，
 * 且每次改測試條件（尺寸、顏色數）都要重新產生一張圖再 commit。
 * 程式產生可以精確控制取色會抽到什麼。
 *
 * **需要兩張不同的圖時一定要給不同的 seed。**
 * 相同位元組會觸發 checksum 去重（02-domain-model.md §3.1），
 * 第二次上傳只會回傳既有的 asset，不會出現「完成」訊息。
 */
export async function makeTestPng(
  options: { width?: number; height?: number; seed?: number } = {},
) {
  const width = options.width ?? 400
  const height = options.height ?? 300
  const seed = options.seed ?? 0

  // 用 seed 微調顏色與位置，確保不同 seed 產生不同 checksum
  const base = {
    r: (243 + seed * 7) % 256,
    g: (167 + seed * 13) % 256,
    b: (195 + seed * 5) % 256,
  }
  const accent = {
    r: (40 + seed * 11) % 256,
    g: (30 + seed * 3) % 256,
    b: (60 + seed * 17) % 256,
  }

  const block = await sharp({
    create: {
      width: Math.round(width * 0.4),
      height: Math.round(height * 0.4),
      channels: 3,
      background: accent,
    },
  })
    .png()
    .toBuffer()

  return sharp({
    create: { width, height, channels: 3, background: base },
  })
    .composite([{ input: block, top: 20 + (seed % 10), left: 30 }])
    .png()
    .toBuffer()
}
