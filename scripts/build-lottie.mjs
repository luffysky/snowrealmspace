// 產生內建 Lottie 背景動畫（本專案自製 → CC0 / 專案自有）。
//
// 為什麼用生成而非手打 / 外部下載：
//  - 手打大型 Lottie JSON 極易出結構錯，生成能保證欄位齊全、keyframe 首尾接合（無縫循環）。
//  - 外部「免費」Lottie 多為 Lottie Simple License 而非 CC0，授權無法在此可靠核實；
//    自製則授權明確（見各檔 meta.source）。
//
// 只用最可靠的 Lottie 子集：shape layer + transform keyframe（無 path/mask/expression）。
// 輸出到 apps/web/lib/lottie/*.json，再由 lib/lottie-scenes.ts 動態載入。

import { writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'apps', 'web', 'lib', 'lottie')

const W = 800
const H = 600
const FR = 30

/** 正規化色（0-255 → 0-1）+ alpha。 */
const rgb = (r, g, b, a = 1) => [r / 255, g / 255, b / 255, a]

/**
 * 動畫屬性（keyframe 陣列）。frames: [{t, s}]。
 * lottie 的 KeyframedValueProperty.interpolateValue 會讀每個 keyframe 的 i/o
 * 貝茲把手（.x/.y）——缺了會在 renderFrame 期間丟 "reading 'x'"。
 * 因此每個「非最後」keyframe 都補上 ease-in-out 把手；最後一個只留 t/s（hold）。
 */
const EASE_O = { x: [0.33], y: [0] }
const EASE_I = { x: [0.67], y: [1] }
const anim = (frames) => ({
  a: 1,
  k: frames.map((f, idx) =>
    idx === frames.length - 1 ? { t: f.t, s: f.s } : { t: f.t, s: f.s, o: EASE_O, i: EASE_I },
  ),
})
/** 靜態屬性。 */
const stat = (k) => ({ a: 0, k })

/** 橢圓 shape group（自身位置 p、大小 size、填色 color、群組不透明 go）。 */
function ellipse({ p = [0, 0], size, color, go = 100 }) {
  return {
    ty: 'gr',
    it: [
      { ty: 'el', d: 1, s: stat(size), p: stat([0, 0]), nm: 'e' },
      { ty: 'fl', c: stat(color.slice(0, 3).concat(1)), o: stat(color[3] * 100), r: 1, nm: 'f' },
      {
        ty: 'tr',
        p: stat(p),
        a: stat([0, 0]),
        s: stat([100, 100]),
        r: stat(0),
        o: stat(go),
        nm: 't',
      },
    ],
    nm: 'g',
  }
}

/** 組一個 shape layer。ks 為 transform（o/r/p/a/s），op 為總長。 */
function layer(ind, name, ks, shapes, op) {
  return {
    ddd: 0,
    ind,
    ty: 4,
    nm: name,
    sr: 1,
    ks: {
      o: ks.o ?? stat(100),
      r: ks.r ?? stat(0),
      p: ks.p ?? stat([W / 2, H / 2, 0]),
      a: ks.a ?? stat([0, 0, 0]),
      s: ks.s ?? stat([100, 100, 100]),
    },
    ao: 0,
    shapes,
    ip: 0,
    op,
    st: 0,
    bm: 0,
  }
}

function doc(nm, op, layers, bg) {
  return {
    v: '5.7.4',
    fr: FR,
    ip: 0,
    op,
    w: W,
    h: H,
    nm,
    ddd: 0,
    assets: [],
    layers,
    meta: {
      g: 'SnowRealm Space (generated)',
      source: 'in-house / project-owned, CC0',
    },
    _bg: bg ?? null,
  }
}

// 每個項目回傳 { id, doc }。首尾 keyframe 值一致 → 無縫循環。
const BUILDERS = {
  // 柔和極光：三顆大橢圓左右緩慢漂移、明暗呼吸
  'soft-aurora': () => {
    const op = 180
    const blobs = [
      { c: rgb(120, 170, 255, 0.5), y: 200, size: [520, 360], phase: 0 },
      { c: rgb(170, 130, 255, 0.45), y: 360, size: [560, 320], phase: 60 },
      { c: rgb(120, 220, 210, 0.4), y: 300, size: [480, 300], phase: 120 },
    ]
    const layers = blobs.map((b, i) => {
      const x0 = W / 2 + (i % 2 === 0 ? -120 : 120)
      const x1 = W / 2 + (i % 2 === 0 ? 120 : -120)
      return layer(
        i + 1,
        `aurora-${i}`,
        {
          p: anim([
            { t: 0, s: [x0, b.y, 0] },
            { t: op / 2, s: [x1, b.y - 40, 0] },
            { t: op, s: [x0, b.y, 0] },
          ]),
          o: anim([
            { t: 0, s: [55] },
            { t: op / 3, s: [90] },
            { t: (op * 2) / 3, s: [60] },
            { t: op, s: [55] },
          ]),
        },
        [ellipse({ size: b.size, color: b.c })],
        op,
      )
    })
    return doc('soft-aurora', op, layers, rgb(18, 22, 40, 1))
  },

  // 上升氣泡：多顆小圓由下往上、邊升邊淡
  'rising-bubbles': () => {
    const op = 150
    const N = 9
    const layers = Array.from({ length: N }, (_, i) => {
      const x = ((i + 0.5) / N) * W
      const r = 14 + (i % 4) * 8
      const delay = (i / N) * op
      const t = (f) => Math.round((delay + f) % op)
      // 三段：進場、上升、出場，循環錯位
      const frames = [
        { t: 0, y: H + 40 - ((op - delay) / op) * (H + 80) },
      ]
      return layer(
        i + 1,
        `bubble-${i}`,
        {
          p: anim([
            { t: 0, s: [x, H + 40, 0] },
            { t: op, s: [x, -60, 0] },
          ]),
          o: anim([
            { t: 0, s: [0] },
            { t: op * 0.15, s: [70] },
            { t: op * 0.8, s: [50] },
            { t: op, s: [0] },
          ]),
          s: stat([100, 100, 100]),
        },
        [ellipse({ size: [r * 2, r * 2], color: rgb(180, 210, 255, 0.55) })],
        op,
      )
    })
    // 用不同起始相位錯開：以 layer st 位移
    layers.forEach((l, i) => {
      l.st = -Math.round((i / N) * op)
      l.ip = l.st
    })
    return doc('rising-bubbles', op, layers, rgb(14, 20, 34, 1))
  },

  // 脈動光環：同心圓向外放大並淡出
  'pulse-rings': () => {
    const op = 120
    const N = 4
    const layers = Array.from({ length: N }, (_, i) => {
      const st = -Math.round((i / N) * op)
      const l = layer(
        i + 1,
        `ring-${i}`,
        {
          s: anim([
            { t: 0, s: [10, 10, 100] },
            { t: op, s: [140, 140, 100] },
          ]),
          o: anim([
            { t: 0, s: [0] },
            { t: op * 0.2, s: [70] },
            { t: op, s: [0] },
          ]),
          p: stat([W / 2, H / 2, 0]),
        },
        [ellipse({ size: [300, 300], color: rgb(150, 200, 255, 0.0), go: 0 })],
        op,
      )
      // 環：用描邊而非填色 → 改 shape 為 el + st(stroke)
      l.shapes = [
        {
          ty: 'gr',
          it: [
            { ty: 'el', d: 1, s: stat([300, 300]), p: stat([0, 0]), nm: 'e' },
            {
              ty: 'st',
              c: stat(rgb(160, 205, 255, 1).slice(0, 3).concat(1)),
              o: stat(80),
              w: stat(6),
              lc: 2,
              lj: 1,
              nm: 's',
            },
            {
              ty: 'tr',
              p: stat([0, 0]),
              a: stat([0, 0]),
              s: stat([100, 100]),
              r: stat(0),
              o: stat(100),
              nm: 't',
            },
          ],
          nm: 'g',
        },
      ]
      l.st = st
      l.ip = st
      return l
    })
    return doc('pulse-rings', op, layers, rgb(16, 18, 30, 1))
  },

  // 飄落花瓣：小橢圓下落 + 左右擺 + 旋轉
  'drifting-petals': () => {
    const op = 200
    const N = 14
    const layers = Array.from({ length: N }, (_, i) => {
      const x = ((i + 0.5) / N) * W
      const sway = 60 + (i % 3) * 20
      const r = 10 + (i % 3) * 5
      const l = layer(
        i + 1,
        `petal-${i}`,
        {
          p: anim([
            { t: 0, s: [x, -40, 0] },
            { t: op * 0.5, s: [x + (i % 2 ? sway : -sway), H / 2, 0] },
            { t: op, s: [x, H + 40, 0] },
          ]),
          r: anim([
            { t: 0, s: [0] },
            { t: op, s: [i % 2 ? 220 : -220] },
          ]),
          o: anim([
            { t: 0, s: [0] },
            { t: op * 0.1, s: [85] },
            { t: op * 0.9, s: [70] },
            { t: op, s: [0] },
          ]),
        },
        [ellipse({ size: [r * 2.2, r * 1.3], color: rgb(255, 200, 220, 0.85) })],
        op,
      )
      l.st = -Math.round((i / N) * op)
      l.ip = l.st
      return l
    })
    return doc('drifting-petals', op, layers, rgb(28, 20, 30, 1))
  },

  // 星塵閃爍：小圓點錯相位明暗（靜態位置，僅 opacity 動）
  'starfield-twinkle': () => {
    const op = 120
    const N = 40
    // 以固定 pseudo-random（避免每次生成不同 → 可重現）
    const rand = (seed) => {
      const x = Math.sin(seed * 12.9898) * 43758.5453
      return x - Math.floor(x)
    }
    const layers = Array.from({ length: N }, (_, i) => {
      const x = rand(i + 1) * W
      const y = rand(i + 100) * H
      const r = 1.5 + rand(i + 50) * 2.5
      const phase = Math.round(rand(i + 7) * op)
      const l = layer(
        i + 1,
        `star-${i}`,
        {
          p: stat([x, y, 0]),
          o: anim([
            { t: 0, s: [10] },
            { t: op / 2, s: [90] },
            { t: op, s: [10] },
          ]),
        },
        [ellipse({ size: [r * 2, r * 2], color: rgb(255, 255, 240, 0.95) })],
        op,
      )
      l.st = -phase
      l.ip = -phase
      return l
    })
    return doc('starfield-twinkle', op, layers, rgb(8, 10, 22, 1))
  },
}

// 清單 meta（label / 建議底色 / 氛圍）。底色是動畫內容的一部分（動畫底透明），
// 放進 manifest.json 這個「資料檔」而非 .ts —— 顏色是內容不是元件樣式。
const META = {
  'soft-aurora': { label: '柔和極光', bg: '#12162a', mood: '大色塊緩慢漂移、明暗呼吸' },
  'rising-bubbles': { label: '上升氣泡', bg: '#0e1422', mood: '小圓由下往上、邊升邊淡' },
  'pulse-rings': { label: '脈動光環', bg: '#10121e', mood: '同心圓向外放大並淡出' },
  'drifting-petals': { label: '飄落花瓣', bg: '#1c141e', mood: '花瓣下落、左右擺、旋轉' },
  'starfield-twinkle': { label: '星塵閃爍', bg: '#080a16', mood: '星點錯相位明暗' },
}

await mkdir(OUT, { recursive: true })
const built = []
const manifest = []
for (const [id, build] of Object.entries(BUILDERS)) {
  const d = build()
  await writeFile(join(OUT, `${id}.json`), JSON.stringify(d))
  built.push({ id, layers: d.layers.length, op: d.op })
  const m = META[id] ?? { label: id, bg: '#101010', mood: '' }
  manifest.push({ id, ...m })
}
await writeFile(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log('已生成 Lottie 背景：')
for (const b of built) console.log(`  ${b.id}  layers=${b.layers}  frames=${b.op}`)
console.log(`清單：${join(OUT, 'manifest.json')}（${manifest.length} 項）`)
