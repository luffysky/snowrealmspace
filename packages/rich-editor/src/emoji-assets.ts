/**
 * 動態 emoji 素材網址（移植自 AI 島）。純 CDN 網址，不打包任何資產。
 *  - Noto Animated Emoji（動態 WebP，會動、超輕）
 *  - Microsoft Fluent Emoji 3D（靜態立體，Noto 沒動畫時的 fallback）
 */

export const NOTO_BASE = 'https://fonts.gstatic.com/s/e/notoemoji/latest'
export const FLUENT_BASE = 'https://cdn.jsdelivr.net/gh/bignutty/fluent-emoji@main/static'

/** Noto 路徑 code：各 codepoint 十六進位，用 "_" 接。😂→"1f602"、❤️→"2764_fe0f"。 */
export function emojiToNotoCode(emoji: string): string {
  return Array.from(emoji)
    .map((ch) => (ch.codePointAt(0) ?? 0).toString(16))
    .join('_')
}

/** Fluent 版：同 codepoints、用 "-" 接。 */
export function emojiToFluentCode(emoji: string): string {
  return Array.from(emoji)
    .map((ch) => (ch.codePointAt(0) ?? 0).toString(16))
    .join('-')
}

export function notoWebp(code: string): string {
  return `${NOTO_BASE}/${code}/512.webp`
}

export function fluentPng(emoji: string): string {
  return `${FLUENT_BASE}/${emojiToFluentCode(emoji)}.png`
}
