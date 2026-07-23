/**
 * 色彩運算。全部是純函式，不依賴瀏覽器。
 * 見 docs/spec/05-theme-tokens.md §3。
 */

export type Rgb = { r: number; g: number; b: number }
export type Rgba = Rgb & { a: number }
export type Lab = { l: number; a: number; b: number }

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const RGBA_RE = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/i

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}

/**
 * 解析顏色字串。支援 #rgb / #rrggbb / #rrggbbaa / rgb() / rgba()。
 * 解析失敗回 null —— 呼叫端必須處理，不可假設一定成功。
 */
export function parseColor(input: string): Rgba | null {
  const value = input.trim()

  const hexMatch = HEX_RE.exec(value)
  if (hexMatch?.[1]) {
    let hex = hexMatch[1]
    if (hex.length === 3) {
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('')
    }
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1
    return { r, g, b, a }
  }

  const rgbaMatch = RGBA_RE.exec(value)
  if (rgbaMatch) {
    const [, rs, gs, bs, as] = rgbaMatch
    const alphaRaw = as ?? '1'
    const a = alphaRaw.endsWith('%') ? parseFloat(alphaRaw) / 100 : parseFloat(alphaRaw)
    return {
      r: clamp(Math.round(parseFloat(rs!)), 0, 255),
      g: clamp(Math.round(parseFloat(gs!)), 0, 255),
      b: clamp(Math.round(parseFloat(bs!)), 0, 255),
      a: clamp(Number.isFinite(a) ? a : 1, 0, 1),
    }
  }

  return null
}

export function toHex({ r, g, b }: Rgb): string {
  const h = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

export function toRgbaString({ r, g, b, a }: Rgba): string {
  const round = (n: number) => clamp(Math.round(n), 0, 255)
  return `rgba(${round(r)}, ${round(g)}, ${round(b)}, ${Number(a.toFixed(3))})`
}

/**
 * 半透明色疊在背景上的實際顏色。
 *
 * 這一步不可省略：直接拿 rgba 算對比會得到錯的結果，
 * 因為人眼看到的是合成後的顏色，不是那個半透明值本身。
 */
export function compositeOver(fg: Rgba, bg: Rgb): Rgb {
  const a = clamp(fg.a, 0, 1)
  return {
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
  }
}

/** WCAG 2.2 相對亮度。 */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (v: number) => {
    const s = clamp(v, 0, 255) / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/**
 * WCAG 對比比值（1–21）。
 * 半透明的前景會先與背景合成 —— 見 compositeOver 的說明。
 */
export function contrastRatio(fg: string, bg: string): number {
  const fgColor = parseColor(fg)
  const bgColor = parseColor(bg)
  if (!fgColor || !bgColor) return 1

  // 背景本身若半透明，視為疊在白色上（頁面底色的保守假設）
  const solidBg = bgColor.a < 1 ? compositeOver(bgColor, { r: 255, g: 255, b: 255 }) : bgColor
  const solidFg = fgColor.a < 1 ? compositeOver(fgColor, solidBg) : fgColor

  const l1 = relativeLuminance(solidFg)
  const l2 = relativeLuminance(solidBg)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

// ── HSL（用於產生 hover / active 等衍生色）────────────────

export type Hsl = { h: number; s: number; l: number }

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const delta = max - min
  const l = (max + min) / 2

  if (delta === 0) return { h: 0, s: 0, l }

  const s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min)
  let h: number
  if (max === rn) h = ((gn - bn) / delta + (gn < bn ? 6 : 0)) / 6
  else if (max === gn) h = ((bn - rn) / delta + 2) / 6
  else h = ((rn - gn) / delta + 4) / 6

  return { h: h * 360, s, l }
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const hn = (((h % 360) + 360) % 360) / 360
  if (s === 0) {
    const v = l * 255
    return { r: v, g: v, b: v }
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const toChannel = (t: number) => {
    let tt = t
    if (tt < 0) tt += 1
    if (tt > 1) tt -= 1
    if (tt < 1 / 6) return p + (q - p) * 6 * tt
    if (tt < 1 / 2) return q
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
    return p
  }
  return {
    r: toChannel(hn + 1 / 3) * 255,
    g: toChannel(hn) * 255,
    b: toChannel(hn - 1 / 3) * 255,
  }
}

/** 調整明度。amount 為正變亮、為負變暗（單位是 L 的絕對量）。 */
export function adjustLightness(color: string, amount: number): string {
  const rgba = parseColor(color)
  if (!rgba) return color
  const hsl = rgbToHsl(rgba)
  const next = hslToRgb({ ...hsl, l: clamp(hsl.l + amount, 0, 1) })
  return rgba.a < 1 ? toRgbaString({ ...next, a: rgba.a }) : toHex(next)
}

/**
 * 在指定背景上，選出對比較佳的前景色（黑或白）。
 * 用於 --sr-on-primary 這類「疊在色塊上的文字」。
 */
export function pickReadableForeground(bg: string, light = '#ffffff', dark = '#1a1a1a'): string {
  return contrastRatio(light, bg) >= contrastRatio(dark, bg) ? light : dark
}

/**
 * 調整前景明度直到對比達標。
 *
 * 用於 from_image 取色：抽出來的顏色不保證可讀，
 * 但直接換掉會失去圖片的色彩特徵，所以只動明度、保留色相與飽和度。
 * 達不到目標時回傳最接近的結果，不拋錯 —— 呼叫端會在 A11yReport 中看到實際比值。
 */
export function ensureContrast(fg: string, bg: string, target: number): string {
  if (contrastRatio(fg, bg) >= target) return fg

  const fgRgba = parseColor(fg)
  const bgRgba = parseColor(bg)
  if (!fgRgba || !bgRgba) return fg

  const bgLum = relativeLuminance(bgRgba.a < 1 ? compositeOver(bgRgba, { r: 255, g: 255, b: 255 }) : bgRgba)
  const hsl = rgbToHsl(fgRgba)
  // 背景亮就把前景變暗，反之亦然
  const direction = bgLum > 0.5 ? -1 : 1

  let best = fg
  let bestRatio = contrastRatio(fg, bg)

  for (let step = 1; step <= 100; step++) {
    const l = clamp(hsl.l + direction * step * 0.01, 0, 1)
    const candidate = toHex(hslToRgb({ ...hsl, l }))
    const ratio = contrastRatio(candidate, bg)
    if (ratio > bestRatio) {
      best = candidate
      bestRatio = ratio
    }
    if (ratio >= target) return candidate
    if (l === 0 || l === 1) break
  }

  return best
}
