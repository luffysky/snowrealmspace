/**
 * 平台內建「場景」——canvas 粒子系統即時生成（免素材授權、可配合 reduced-motion）。
 *
 * 兩種用法：
 *   1. 疊加在任何背景上（scene_id + scene_density 存在 background_item）。
 *   2. 當成獨立的動態背景（procedural type，base 當底色 + 粒子）。
 *
 * 資料驅動：一組 behavior（掉落/雨/花瓣/閃爍/漫遊/上升）× 形狀 × 配色 × 密度 × 速度，
 * 組出約 50 個場景。渲染器只看這些參數，不寫死每個場景。
 */
export type SceneKind = 'dynamic' | 'static'
export type SceneBehavior = 'fall' | 'rain' | 'petal' | 'twinkle' | 'wander' | 'rise'
export type SceneShape = 'circle' | 'streak' | 'petal' | 'square' | 'heart' | 'star' | 'ring'

export type SceneDef = {
  id: string
  label: string
  kind: SceneKind
  /** 獨立動態背景時的底色；當疊加場景用時忽略（透明）。 */
  base: string
  behavior?: SceneBehavior
  shape?: SceneShape
  /** 粒子顏色（"r,g,b"，alpha 由粒子自帶）。多色時隨機挑。 */
  colors?: string[]
  /** 相對密度（1 = 預設）。實際還會乘上 background_item 的 scene_density。 */
  density?: number
  /** 相對速度（1 = 預設）。 */
  speed?: number
  sizeMin?: number
  sizeMax?: number
}

// 幾組常用底色（獨立動態背景用）
const DARK = 'linear-gradient(180deg,#20242e,#12151c)'
const NIGHT = 'radial-gradient(circle at 50% 18%,#1d2748,#070a12)'
const DUSK = 'linear-gradient(180deg,#2a2140,#151022)'
const OCEAN = 'linear-gradient(180deg,#123a4c,#08171f)'
const FOREST = 'linear-gradient(180deg,#14231a,#0a120d)'
const WARM = 'linear-gradient(180deg,#2a1a16,#160d0a)'
const BLUSH = 'linear-gradient(180deg,#ffe6f0,#ffd2e3)'

function s(def: SceneDef): SceneDef {
  return def
}

export const SCENES: SceneDef[] = [
  // ── 雪 ──
  s({ id: 'snow-soft', label: '細雪', kind: 'dynamic', base: DARK, behavior: 'fall', shape: 'circle', colors: ['255,255,255'], density: 0.8, speed: 0.7, sizeMin: 1, sizeMax: 2.6 }),
  s({ id: 'snow-heavy', label: '大雪', kind: 'dynamic', base: DARK, behavior: 'fall', shape: 'circle', colors: ['255,255,255'], density: 1.6, speed: 1, sizeMin: 1.2, sizeMax: 3.4 }),
  s({ id: 'snow-storm', label: '暴風雪', kind: 'dynamic', base: 'linear-gradient(180deg,#3a4250,#181d26)', behavior: 'fall', shape: 'circle', colors: ['255,255,255'], density: 2.4, speed: 1.7, sizeMin: 1, sizeMax: 3 }),
  s({ id: 'snow-gold', label: '金雪', kind: 'dynamic', base: DUSK, behavior: 'fall', shape: 'circle', colors: ['255,224,150', '255,240,210'], density: 1, speed: 0.6, sizeMin: 1, sizeMax: 2.4 }),
  s({ id: 'snow-blue', label: '藍雪', kind: 'dynamic', base: NIGHT, behavior: 'fall', shape: 'circle', colors: ['200,225,255'], density: 1.1, speed: 0.7, sizeMin: 1, sizeMax: 2.8 }),

  // ── 雨 ──
  s({ id: 'rain-soft', label: '細雨', kind: 'dynamic', base: DARK, behavior: 'rain', shape: 'streak', colors: ['190,210,235'], density: 0.9, speed: 0.8, sizeMin: 6, sizeMax: 12 }),
  s({ id: 'rain-heavy', label: '大雨', kind: 'dynamic', base: 'linear-gradient(180deg,#2a3a49,#141c26)', behavior: 'rain', shape: 'streak', colors: ['190,210,235'], density: 1.8, speed: 1.3, sizeMin: 8, sizeMax: 16 }),
  s({ id: 'rain-storm', label: '暴雨', kind: 'dynamic', base: 'linear-gradient(180deg,#20303c,#0c141a)', behavior: 'rain', shape: 'streak', colors: ['170,195,225'], density: 2.6, speed: 1.8, sizeMin: 10, sizeMax: 20 }),
  s({ id: 'rain-blue', label: '藍雨', kind: 'dynamic', base: OCEAN, behavior: 'rain', shape: 'streak', colors: ['150,210,255'], density: 1.3, speed: 1.1, sizeMin: 7, sizeMax: 14 }),
  s({ id: 'rain-neon', label: '霓虹雨', kind: 'dynamic', base: 'linear-gradient(180deg,#1a1030,#0a0618)', behavior: 'rain', shape: 'streak', colors: ['120,220,255', '220,120,255'], density: 1.4, speed: 1.4, sizeMin: 8, sizeMax: 16 }),

  // ── 花瓣 / 落葉 ──
  s({ id: 'sakura', label: '櫻花', kind: 'dynamic', base: BLUSH, behavior: 'petal', shape: 'petal', colors: ['255,180,205', '255,200,220'], density: 1, speed: 0.9, sizeMin: 4, sizeMax: 8 }),
  s({ id: 'sakura-white', label: '白櫻', kind: 'dynamic', base: 'linear-gradient(180deg,#f2f4ff,#e6ecff)', behavior: 'petal', shape: 'petal', colors: ['255,255,255', '240,240,255'], density: 1, speed: 0.9, sizeMin: 4, sizeMax: 8 }),
  s({ id: 'sakura-heavy', label: '櫻吹雪', kind: 'dynamic', base: BLUSH, behavior: 'petal', shape: 'petal', colors: ['255,175,205', '255,205,225'], density: 2, speed: 1.2, sizeMin: 4, sizeMax: 9 }),
  s({ id: 'maple', label: '楓紅', kind: 'dynamic', base: WARM, behavior: 'petal', shape: 'petal', colors: ['235,90,40', '220,140,50'], density: 1, speed: 0.8, sizeMin: 5, sizeMax: 10 }),
  s({ id: 'autumn', label: '秋葉', kind: 'dynamic', base: 'linear-gradient(180deg,#2c2114,#160f08)', behavior: 'petal', shape: 'petal', colors: ['210,150,60', '180,110,40', '160,80,30'], density: 1.1, speed: 0.8, sizeMin: 5, sizeMax: 10 }),
  s({ id: 'leaves-green', label: '綠葉', kind: 'dynamic', base: FOREST, behavior: 'petal', shape: 'petal', colors: ['120,200,120', '90,170,90'], density: 1, speed: 0.8, sizeMin: 5, sizeMax: 10 }),
  s({ id: 'feather', label: '羽毛', kind: 'dynamic', base: 'linear-gradient(180deg,#e8eef5,#d6e0ec)', behavior: 'petal', shape: 'petal', colors: ['255,255,255'], density: 0.7, speed: 0.5, sizeMin: 5, sizeMax: 11 }),

  // ── 星空 / 閃爍 ──
  s({ id: 'stars', label: '星空', kind: 'dynamic', base: NIGHT, behavior: 'twinkle', shape: 'circle', colors: ['255,255,255'], density: 1, sizeMin: 0.6, sizeMax: 1.8 }),
  s({ id: 'stars-dense', label: '繁星', kind: 'dynamic', base: NIGHT, behavior: 'twinkle', shape: 'circle', colors: ['255,255,255', '200,220,255'], density: 2.2, sizeMin: 0.5, sizeMax: 1.6 }),
  s({ id: 'stars-star', label: '星芒', kind: 'dynamic', base: 'radial-gradient(circle at 50% 20%,#241a3a,#0a0714)', behavior: 'twinkle', shape: 'star', colors: ['255,244,200'], density: 0.7, sizeMin: 1.5, sizeMax: 3.5 }),
  s({ id: 'stars-blue', label: '藍星', kind: 'dynamic', base: 'radial-gradient(circle at 50% 20%,#16233f,#05080f)', behavior: 'twinkle', shape: 'circle', colors: ['160,200,255'], density: 1.4, sizeMin: 0.6, sizeMax: 1.8 }),
  s({ id: 'galaxy', label: '銀河', kind: 'dynamic', base: 'radial-gradient(circle at 50% 40%,#2a1e46,#07060f)', behavior: 'twinkle', shape: 'circle', colors: ['255,255,255', '210,180,255', '180,210,255'], density: 2.8, sizeMin: 0.5, sizeMax: 1.6 }),

  // ── 漫遊光點 ──
  s({ id: 'fireflies', label: '螢火蟲', kind: 'dynamic', base: FOREST, behavior: 'wander', shape: 'circle', colors: ['220,255,140'], density: 0.7, speed: 0.8, sizeMin: 1.2, sizeMax: 2.6 }),
  s({ id: 'fireflies-blue', label: '藍螢', kind: 'dynamic', base: 'linear-gradient(180deg,#0e1a26,#060d13)', behavior: 'wander', shape: 'circle', colors: ['150,220,255'], density: 0.8, speed: 0.7, sizeMin: 1.2, sizeMax: 2.6 }),
  s({ id: 'dust-gold', label: '金塵', kind: 'dynamic', base: DUSK, behavior: 'wander', shape: 'circle', colors: ['255,220,150'], density: 1.4, speed: 0.4, sizeMin: 0.8, sizeMax: 2 }),
  s({ id: 'dust-motes', label: '塵光', kind: 'dynamic', base: WARM, behavior: 'wander', shape: 'circle', colors: ['255,240,210'], density: 1.6, speed: 0.35, sizeMin: 0.8, sizeMax: 2.2 }),
  s({ id: 'plankton', label: '浮游光', kind: 'dynamic', base: OCEAN, behavior: 'wander', shape: 'circle', colors: ['120,255,220'], density: 1.2, speed: 0.5, sizeMin: 1, sizeMax: 2.4 }),
  s({ id: 'spirits', label: '靈光', kind: 'dynamic', base: 'linear-gradient(180deg,#141830,#080a16)', behavior: 'wander', shape: 'circle', colors: ['180,220,255', '220,200,255'], density: 0.9, speed: 0.5, sizeMin: 1.4, sizeMax: 3 }),

  // ── 上升 ──
  s({ id: 'bubbles', label: '氣泡', kind: 'dynamic', base: OCEAN, behavior: 'rise', shape: 'ring', colors: ['220,240,255'], density: 1, speed: 0.9, sizeMin: 3, sizeMax: 12 }),
  s({ id: 'bubbles-dense', label: '泡泡', kind: 'dynamic', base: 'linear-gradient(180deg,#0e3648,#06141c)', behavior: 'rise', shape: 'ring', colors: ['200,235,255'], density: 2, speed: 1.1, sizeMin: 2, sizeMax: 9 }),
  s({ id: 'embers', label: '餘燼', kind: 'dynamic', base: WARM, behavior: 'rise', shape: 'circle', colors: ['255,150,60', '255,90,40'], density: 1.2, speed: 1, sizeMin: 1, sizeMax: 3 }),
  s({ id: 'sparks', label: '火花', kind: 'dynamic', base: 'linear-gradient(180deg,#1a0f0a,#0a0605)', behavior: 'rise', shape: 'circle', colors: ['255,210,120', '255,140,60'], density: 1.6, speed: 1.5, sizeMin: 0.8, sizeMax: 2.2 }),
  s({ id: 'rise-light', label: '上升光點', kind: 'dynamic', base: 'linear-gradient(180deg,#101828,#070b13)', behavior: 'rise', shape: 'circle', colors: ['200,220,255'], density: 1, speed: 0.7, sizeMin: 1, sizeMax: 3 }),
  s({ id: 'rise-pink', label: '粉光上升', kind: 'dynamic', base: 'linear-gradient(180deg,#2a1424,#140912)', behavior: 'rise', shape: 'circle', colors: ['255,170,210'], density: 1, speed: 0.7, sizeMin: 1, sizeMax: 3 }),

  // ── 掉落雜項 ──
  s({ id: 'confetti', label: '彩紙', kind: 'dynamic', base: 'linear-gradient(180deg,#1a1e2a,#101320)', behavior: 'fall', shape: 'square', colors: ['255,90,120', '90,200,255', '255,220,90', '120,230,150', '200,120,255'], density: 1.4, speed: 1.2, sizeMin: 3, sizeMax: 6 }),
  s({ id: 'confetti-gold', label: '金彩', kind: 'dynamic', base: DUSK, behavior: 'fall', shape: 'square', colors: ['255,215,120', '255,235,180'], density: 1.3, speed: 1, sizeMin: 3, sizeMax: 6 }),
  s({ id: 'hearts', label: '愛心', kind: 'dynamic', base: 'linear-gradient(180deg,#2a1420,#160a12)', behavior: 'fall', shape: 'heart', colors: ['255,120,150', '255,160,190'], density: 0.9, speed: 0.8, sizeMin: 5, sizeMax: 10 }),
  s({ id: 'hearts-rise', label: '愛心上升', kind: 'dynamic', base: 'linear-gradient(180deg,#2a1420,#160a12)', behavior: 'rise', shape: 'heart', colors: ['255,120,150'], density: 0.9, speed: 0.8, sizeMin: 5, sizeMax: 10 }),
  s({ id: 'stardrop', label: '流星塵', kind: 'dynamic', base: NIGHT, behavior: 'fall', shape: 'star', colors: ['255,244,210'], density: 0.8, speed: 1.1, sizeMin: 2, sizeMax: 4 }),
  s({ id: 'petals-up', label: '花瓣上升', kind: 'dynamic', base: BLUSH, behavior: 'rise', shape: 'petal', colors: ['255,180,205'], density: 1, speed: 0.7, sizeMin: 4, sizeMax: 8 }),
  s({ id: 'ash', label: '飄灰', kind: 'dynamic', base: 'linear-gradient(180deg,#22252b,#111318)', behavior: 'fall', shape: 'circle', colors: ['180,180,185'], density: 1.2, speed: 0.5, sizeMin: 1, sizeMax: 2.4 }),
  s({ id: 'pollen', label: '花粉', kind: 'dynamic', base: 'linear-gradient(180deg,#26301a,#141a0d)', behavior: 'wander', shape: 'circle', colors: ['235,230,120'], density: 1.6, speed: 0.4, sizeMin: 0.8, sizeMax: 2 }),
  s({ id: 'snow-pink', label: '粉雪', kind: 'dynamic', base: 'linear-gradient(180deg,#2a2030,#161018)', behavior: 'fall', shape: 'circle', colors: ['255,210,230'], density: 1.1, speed: 0.7, sizeMin: 1, sizeMax: 2.8 }),
  s({ id: 'rain-pink', label: '粉雨', kind: 'dynamic', base: 'linear-gradient(180deg,#2a1a24,#140b12)', behavior: 'rain', shape: 'streak', colors: ['255,180,210'], density: 1.2, speed: 1, sizeMin: 7, sizeMax: 14 }),
  s({ id: 'meteor', label: '流星雨', kind: 'dynamic', base: NIGHT, behavior: 'rain', shape: 'streak', colors: ['255,244,210'], density: 0.4, speed: 2.2, sizeMin: 16, sizeMax: 30 }),
  s({ id: 'glitter', label: '閃粉', kind: 'dynamic', base: DUSK, behavior: 'twinkle', shape: 'circle', colors: ['255,215,150', '255,255,255'], density: 2.4, sizeMin: 0.6, sizeMax: 1.6 }),

  // ── 靜態（純 CSS） ──
  { id: 'aurora', label: '極光', kind: 'static', base: 'linear-gradient(180deg,#0a1024,#0a1024), radial-gradient(60% 40% at 30% 30%,rgba(80,220,180,.35),transparent 70%), radial-gradient(55% 45% at 70% 40%,rgba(120,140,255,.30),transparent 70%), radial-gradient(50% 40% at 50% 70%,rgba(200,120,220,.25),transparent 70%)' },
  { id: 'dots', label: '圓點', kind: 'static', base: 'radial-gradient(rgba(255,255,255,.16) 1.5px, transparent 1.6px) 0 0/22px 22px, linear-gradient(180deg,#20242e,#171a22)' },
  { id: 'grid', label: '格線', kind: 'static', base: 'linear-gradient(rgba(255,255,255,.10) 1px, transparent 1px) 0 0/28px 28px, linear-gradient(90deg,rgba(255,255,255,.10) 1px, transparent 1px) 0 0/28px 28px, linear-gradient(180deg,#1c2029,#141821)' },
  { id: 'diagonal', label: '斜紋', kind: 'static', base: 'repeating-linear-gradient(45deg,rgba(255,255,255,.06) 0 10px,transparent 10px 20px), linear-gradient(180deg,#222634,#14171f)' },
  { id: 'bokeh', label: '光斑', kind: 'static', base: 'radial-gradient(circle at 20% 30%,rgba(255,220,180,.25),transparent 12%), radial-gradient(circle at 70% 60%,rgba(180,200,255,.22),transparent 14%), radial-gradient(circle at 45% 80%,rgba(255,180,220,.20),transparent 12%), linear-gradient(180deg,#171a26,#0e1018)' },
  { id: 'mesh', label: '網格光暈', kind: 'static', base: 'radial-gradient(40% 50% at 20% 20%,rgba(120,200,255,.35),transparent 70%), radial-gradient(40% 50% at 80% 30%,rgba(255,150,200,.30),transparent 70%), radial-gradient(50% 50% at 50% 90%,rgba(150,255,200,.25),transparent 70%), #0d1018' },
]

export function getScene(id: string | null | undefined): SceneDef | null {
  if (!id) return null
  return SCENES.find((sc) => sc.id === id) ?? null
}

/** 場景清單（給選擇器分組）。 */
export const DYNAMIC_SCENES = SCENES.filter((sc) => sc.kind === 'dynamic')
export const STATIC_SCENES = SCENES.filter((sc) => sc.kind === 'static')
