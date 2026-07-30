/**
 * 平台內建「場景」——canvas 粒子系統即時生成（免素材授權、可配合 reduced-motion）。
 *
 * 兩種用法：
 *   1. 疊加在任何背景上（scene_id + scene_density 存在 background_item）。
 *   2. 當成獨立的動態背景（procedural type，base 當底色 + 粒子）。
 *
 * 資料驅動：一組 behavior（掉落/雨/花瓣/閃爍/漫遊/上升）× 形狀 × 配色 × 密度 × 速度，
 * 組出約 70 個場景。渲染器只看這些參數，不寫死每個場景。
 *
 * 每個場景都掛一個 `category`（zh-TW 固定分類），供「背景商店」分頁瀏覽。
 */
export type SceneKind = 'dynamic' | 'static'
export type SceneBehavior = 'fall' | 'rain' | 'petal' | 'twinkle' | 'wander' | 'rise'
export type SceneShape = 'circle' | 'streak' | 'petal' | 'square' | 'heart' | 'star' | 'ring'

/** 背景商店的固定分類詞彙（zh-TW）。Lottie 清單也共用同一組。 */
export type SceneCategory = '天氣' | '星空宇宙' | '自然' | '慶祝' | '簡約' | '城市夜景'

/** 分頁顯示順序（同時是「有哪些分類」的真相來源）。 */
export const SCENE_CATEGORIES: readonly SceneCategory[] = ['天氣', '星空宇宙', '自然', '慶祝', '簡約', '城市夜景']

export type SceneDef = {
  id: string
  label: string
  kind: SceneKind
  /** 商店分類（每個場景剛好一個）。 */
  category: SceneCategory
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
const DAWN = 'linear-gradient(180deg,#3b2f4e,#c98a6a)'
const TWILIGHT = 'linear-gradient(180deg,#182a4e,#3a2a4e)'
const MEADOW = 'linear-gradient(180deg,#243a1c,#101a0c)'
const DEEPSEA = 'linear-gradient(180deg,#08243c,#020810)'

// 城市夜景底色（#55：深藍/靛/霓虹洋紅/青綠，底部微微上光模擬城市輝光）
const CITY_BLUE = 'linear-gradient(180deg,#0a1428,#04070f)'
const CITY_INDIGO = 'linear-gradient(180deg,#12103a,#070517)'
const CITY_MAGENTA = 'linear-gradient(180deg,#280f26,#100513)'
const CITY_TEAL = 'linear-gradient(180deg,#08242e,#031015)'
const CITY_AMBER = 'linear-gradient(180deg,#241a0e,#100b05)'
const CITY_HAZE = 'linear-gradient(180deg,#182034,#0a0e18)'
const CITY_INK = 'linear-gradient(180deg,#0c0e1a,#050609)'
const CITY_GLOW = 'radial-gradient(circle at 50% 100%,#3a2352,#07050f)'
const CITY_ROSE_GLOW = 'radial-gradient(circle at 50% 100%,#3a1030,#0c0510)'
const CITY_TEAL_GLOW = 'radial-gradient(circle at 50% 100%,#0e3a44,#030e13)'

function s(def: SceneDef): SceneDef {
  return def
}

export const SCENES: SceneDef[] = [
  // ── 雪（天氣） ──
  s({ id: 'snow-soft', label: '細雪', kind: 'dynamic', category: '天氣', base: DARK, behavior: 'fall', shape: 'circle', colors: ['255,255,255'], density: 0.8, speed: 0.7, sizeMin: 1, sizeMax: 2.6 }),
  s({ id: 'snow-heavy', label: '大雪', kind: 'dynamic', category: '天氣', base: DARK, behavior: 'fall', shape: 'circle', colors: ['255,255,255'], density: 1.6, speed: 1, sizeMin: 1.2, sizeMax: 3.4 }),
  s({ id: 'snow-storm', label: '暴風雪', kind: 'dynamic', category: '天氣', base: 'linear-gradient(180deg,#3a4250,#181d26)', behavior: 'fall', shape: 'circle', colors: ['255,255,255'], density: 2.4, speed: 1.7, sizeMin: 1, sizeMax: 3 }),
  s({ id: 'snow-gold', label: '金雪', kind: 'dynamic', category: '天氣', base: DUSK, behavior: 'fall', shape: 'circle', colors: ['255,224,150', '255,240,210'], density: 1, speed: 0.6, sizeMin: 1, sizeMax: 2.4 }),
  s({ id: 'snow-blue', label: '藍雪', kind: 'dynamic', category: '天氣', base: NIGHT, behavior: 'fall', shape: 'circle', colors: ['200,225,255'], density: 1.1, speed: 0.7, sizeMin: 1, sizeMax: 2.8 }),

  // ── 雨（天氣） ──
  s({ id: 'rain-soft', label: '細雨', kind: 'dynamic', category: '天氣', base: DARK, behavior: 'rain', shape: 'streak', colors: ['190,210,235'], density: 0.9, speed: 0.8, sizeMin: 6, sizeMax: 12 }),
  s({ id: 'rain-heavy', label: '大雨', kind: 'dynamic', category: '天氣', base: 'linear-gradient(180deg,#2a3a49,#141c26)', behavior: 'rain', shape: 'streak', colors: ['190,210,235'], density: 1.8, speed: 1.3, sizeMin: 8, sizeMax: 16 }),
  s({ id: 'rain-storm', label: '暴雨', kind: 'dynamic', category: '天氣', base: 'linear-gradient(180deg,#20303c,#0c141a)', behavior: 'rain', shape: 'streak', colors: ['170,195,225'], density: 2.6, speed: 1.8, sizeMin: 10, sizeMax: 20 }),
  s({ id: 'rain-blue', label: '藍雨', kind: 'dynamic', category: '天氣', base: OCEAN, behavior: 'rain', shape: 'streak', colors: ['150,210,255'], density: 1.3, speed: 1.1, sizeMin: 7, sizeMax: 14 }),
  s({ id: 'rain-neon', label: '霓虹雨', kind: 'dynamic', category: '天氣', base: 'linear-gradient(180deg,#1a1030,#0a0618)', behavior: 'rain', shape: 'streak', colors: ['120,220,255', '220,120,255'], density: 1.4, speed: 1.4, sizeMin: 8, sizeMax: 16 }),

  // ── 花瓣 / 落葉（自然） ──
  s({ id: 'sakura', label: '櫻花', kind: 'dynamic', category: '自然', base: BLUSH, behavior: 'petal', shape: 'petal', colors: ['255,180,205', '255,200,220'], density: 1, speed: 0.9, sizeMin: 4, sizeMax: 8 }),
  s({ id: 'sakura-white', label: '白櫻', kind: 'dynamic', category: '自然', base: 'linear-gradient(180deg,#f2f4ff,#e6ecff)', behavior: 'petal', shape: 'petal', colors: ['255,255,255', '240,240,255'], density: 1, speed: 0.9, sizeMin: 4, sizeMax: 8 }),
  s({ id: 'sakura-heavy', label: '櫻吹雪', kind: 'dynamic', category: '自然', base: BLUSH, behavior: 'petal', shape: 'petal', colors: ['255,175,205', '255,205,225'], density: 2, speed: 1.2, sizeMin: 4, sizeMax: 9 }),
  s({ id: 'maple', label: '楓紅', kind: 'dynamic', category: '自然', base: WARM, behavior: 'petal', shape: 'petal', colors: ['235,90,40', '220,140,50'], density: 1, speed: 0.8, sizeMin: 5, sizeMax: 10 }),
  s({ id: 'autumn', label: '秋葉', kind: 'dynamic', category: '自然', base: 'linear-gradient(180deg,#2c2114,#160f08)', behavior: 'petal', shape: 'petal', colors: ['210,150,60', '180,110,40', '160,80,30'], density: 1.1, speed: 0.8, sizeMin: 5, sizeMax: 10 }),
  s({ id: 'leaves-green', label: '綠葉', kind: 'dynamic', category: '自然', base: FOREST, behavior: 'petal', shape: 'petal', colors: ['120,200,120', '90,170,90'], density: 1, speed: 0.8, sizeMin: 5, sizeMax: 10 }),
  s({ id: 'feather', label: '羽毛', kind: 'dynamic', category: '自然', base: 'linear-gradient(180deg,#e8eef5,#d6e0ec)', behavior: 'petal', shape: 'petal', colors: ['255,255,255'], density: 0.7, speed: 0.5, sizeMin: 5, sizeMax: 11 }),

  // ── 星空 / 閃爍（星空宇宙） ──
  s({ id: 'stars', label: '星空', kind: 'dynamic', category: '星空宇宙', base: NIGHT, behavior: 'twinkle', shape: 'circle', colors: ['255,255,255'], density: 1, sizeMin: 0.6, sizeMax: 1.8 }),
  s({ id: 'stars-dense', label: '繁星', kind: 'dynamic', category: '星空宇宙', base: NIGHT, behavior: 'twinkle', shape: 'circle', colors: ['255,255,255', '200,220,255'], density: 2.2, sizeMin: 0.5, sizeMax: 1.6 }),
  s({ id: 'stars-star', label: '星芒', kind: 'dynamic', category: '星空宇宙', base: 'radial-gradient(circle at 50% 20%,#241a3a,#0a0714)', behavior: 'twinkle', shape: 'star', colors: ['255,244,200'], density: 0.7, sizeMin: 1.5, sizeMax: 3.5 }),
  s({ id: 'stars-blue', label: '藍星', kind: 'dynamic', category: '星空宇宙', base: 'radial-gradient(circle at 50% 20%,#16233f,#05080f)', behavior: 'twinkle', shape: 'circle', colors: ['160,200,255'], density: 1.4, sizeMin: 0.6, sizeMax: 1.8 }),
  s({ id: 'galaxy', label: '銀河', kind: 'dynamic', category: '星空宇宙', base: 'radial-gradient(circle at 50% 40%,#2a1e46,#07060f)', behavior: 'twinkle', shape: 'circle', colors: ['255,255,255', '210,180,255', '180,210,255'], density: 2.8, sizeMin: 0.5, sizeMax: 1.6 }),

  // ── 漫遊光點 ──
  s({ id: 'fireflies', label: '螢火蟲', kind: 'dynamic', category: '自然', base: FOREST, behavior: 'wander', shape: 'circle', colors: ['220,255,140'], density: 0.7, speed: 0.8, sizeMin: 1.2, sizeMax: 2.6 }),
  s({ id: 'fireflies-blue', label: '藍螢', kind: 'dynamic', category: '自然', base: 'linear-gradient(180deg,#0e1a26,#060d13)', behavior: 'wander', shape: 'circle', colors: ['150,220,255'], density: 0.8, speed: 0.7, sizeMin: 1.2, sizeMax: 2.6 }),
  s({ id: 'dust-gold', label: '金塵', kind: 'dynamic', category: '簡約', base: DUSK, behavior: 'wander', shape: 'circle', colors: ['255,220,150'], density: 1.4, speed: 0.4, sizeMin: 0.8, sizeMax: 2 }),
  s({ id: 'dust-motes', label: '塵光', kind: 'dynamic', category: '簡約', base: WARM, behavior: 'wander', shape: 'circle', colors: ['255,240,210'], density: 1.6, speed: 0.35, sizeMin: 0.8, sizeMax: 2.2 }),
  s({ id: 'plankton', label: '浮游光', kind: 'dynamic', category: '自然', base: OCEAN, behavior: 'wander', shape: 'circle', colors: ['120,255,220'], density: 1.2, speed: 0.5, sizeMin: 1, sizeMax: 2.4 }),
  s({ id: 'spirits', label: '靈光', kind: 'dynamic', category: '自然', base: 'linear-gradient(180deg,#141830,#080a16)', behavior: 'wander', shape: 'circle', colors: ['180,220,255', '220,200,255'], density: 0.9, speed: 0.5, sizeMin: 1.4, sizeMax: 3 }),

  // ── 上升 ──
  s({ id: 'bubbles', label: '氣泡', kind: 'dynamic', category: '自然', base: OCEAN, behavior: 'rise', shape: 'ring', colors: ['220,240,255'], density: 1, speed: 0.9, sizeMin: 3, sizeMax: 12 }),
  s({ id: 'bubbles-dense', label: '泡泡', kind: 'dynamic', category: '自然', base: 'linear-gradient(180deg,#0e3648,#06141c)', behavior: 'rise', shape: 'ring', colors: ['200,235,255'], density: 2, speed: 1.1, sizeMin: 2, sizeMax: 9 }),
  s({ id: 'embers', label: '餘燼', kind: 'dynamic', category: '慶祝', base: WARM, behavior: 'rise', shape: 'circle', colors: ['255,150,60', '255,90,40'], density: 1.2, speed: 1, sizeMin: 1, sizeMax: 3 }),
  s({ id: 'sparks', label: '火花', kind: 'dynamic', category: '慶祝', base: 'linear-gradient(180deg,#1a0f0a,#0a0605)', behavior: 'rise', shape: 'circle', colors: ['255,210,120', '255,140,60'], density: 1.6, speed: 1.5, sizeMin: 0.8, sizeMax: 2.2 }),
  s({ id: 'rise-light', label: '上升光點', kind: 'dynamic', category: '簡約', base: 'linear-gradient(180deg,#101828,#070b13)', behavior: 'rise', shape: 'circle', colors: ['200,220,255'], density: 1, speed: 0.7, sizeMin: 1, sizeMax: 3 }),
  s({ id: 'rise-pink', label: '粉光上升', kind: 'dynamic', category: '簡約', base: 'linear-gradient(180deg,#2a1424,#140912)', behavior: 'rise', shape: 'circle', colors: ['255,170,210'], density: 1, speed: 0.7, sizeMin: 1, sizeMax: 3 }),

  // ── 掉落雜項 ──
  s({ id: 'confetti', label: '彩紙', kind: 'dynamic', category: '慶祝', base: 'linear-gradient(180deg,#1a1e2a,#101320)', behavior: 'fall', shape: 'square', colors: ['255,90,120', '90,200,255', '255,220,90', '120,230,150', '200,120,255'], density: 1.4, speed: 1.2, sizeMin: 3, sizeMax: 6 }),
  s({ id: 'confetti-gold', label: '金彩', kind: 'dynamic', category: '慶祝', base: DUSK, behavior: 'fall', shape: 'square', colors: ['255,215,120', '255,235,180'], density: 1.3, speed: 1, sizeMin: 3, sizeMax: 6 }),
  s({ id: 'hearts', label: '愛心', kind: 'dynamic', category: '慶祝', base: 'linear-gradient(180deg,#2a1420,#160a12)', behavior: 'fall', shape: 'heart', colors: ['255,120,150', '255,160,190'], density: 0.9, speed: 0.8, sizeMin: 5, sizeMax: 10 }),
  s({ id: 'hearts-rise', label: '愛心上升', kind: 'dynamic', category: '慶祝', base: 'linear-gradient(180deg,#2a1420,#160a12)', behavior: 'rise', shape: 'heart', colors: ['255,120,150'], density: 0.9, speed: 0.8, sizeMin: 5, sizeMax: 10 }),
  s({ id: 'stardrop', label: '流星塵', kind: 'dynamic', category: '星空宇宙', base: NIGHT, behavior: 'fall', shape: 'star', colors: ['255,244,210'], density: 0.8, speed: 1.1, sizeMin: 2, sizeMax: 4 }),
  s({ id: 'petals-up', label: '花瓣上升', kind: 'dynamic', category: '自然', base: BLUSH, behavior: 'rise', shape: 'petal', colors: ['255,180,205'], density: 1, speed: 0.7, sizeMin: 4, sizeMax: 8 }),
  s({ id: 'ash', label: '飄灰', kind: 'dynamic', category: '簡約', base: 'linear-gradient(180deg,#22252b,#111318)', behavior: 'fall', shape: 'circle', colors: ['180,180,185'], density: 1.2, speed: 0.5, sizeMin: 1, sizeMax: 2.4 }),
  s({ id: 'pollen', label: '花粉', kind: 'dynamic', category: '自然', base: 'linear-gradient(180deg,#26301a,#141a0d)', behavior: 'wander', shape: 'circle', colors: ['235,230,120'], density: 1.6, speed: 0.4, sizeMin: 0.8, sizeMax: 2 }),
  s({ id: 'snow-pink', label: '粉雪', kind: 'dynamic', category: '天氣', base: 'linear-gradient(180deg,#2a2030,#161018)', behavior: 'fall', shape: 'circle', colors: ['255,210,230'], density: 1.1, speed: 0.7, sizeMin: 1, sizeMax: 2.8 }),
  s({ id: 'rain-pink', label: '粉雨', kind: 'dynamic', category: '天氣', base: 'linear-gradient(180deg,#2a1a24,#140b12)', behavior: 'rain', shape: 'streak', colors: ['255,180,210'], density: 1.2, speed: 1, sizeMin: 7, sizeMax: 14 }),
  s({ id: 'meteor', label: '流星雨', kind: 'dynamic', category: '星空宇宙', base: NIGHT, behavior: 'rain', shape: 'streak', colors: ['255,244,210'], density: 0.4, speed: 2.2, sizeMin: 16, sizeMax: 30 }),
  s({ id: 'glitter', label: '閃粉', kind: 'dynamic', category: '慶祝', base: DUSK, behavior: 'twinkle', shape: 'circle', colors: ['255,215,150', '255,255,255'], density: 2.4, sizeMin: 0.6, sizeMax: 1.6 }),

  // ── 追加（皆用既有 behavior×shape×配色，資料驅動，實際會渲染） ──
  s({ id: 'snow-violet', label: '紫雪', kind: 'dynamic', category: '天氣', base: 'linear-gradient(180deg,#241a2e,#120b18)', behavior: 'fall', shape: 'circle', colors: ['220,200,255'], density: 1, speed: 0.7, sizeMin: 1, sizeMax: 2.8 }),
  s({ id: 'snow-mint', label: '薄荷雪', kind: 'dynamic', category: '天氣', base: 'linear-gradient(180deg,#16241f,#0a1310)', behavior: 'fall', shape: 'circle', colors: ['210,255,235'], density: 1, speed: 0.7, sizeMin: 1, sizeMax: 2.8 }),
  s({ id: 'rain-forest', label: '林雨', kind: 'dynamic', category: '天氣', base: FOREST, behavior: 'rain', shape: 'streak', colors: ['150,220,170'], density: 1.2, speed: 1, sizeMin: 7, sizeMax: 14 }),
  s({ id: 'sakura-night', label: '夜櫻', kind: 'dynamic', category: '自然', base: 'linear-gradient(180deg,#1c1424,#0e0812)', behavior: 'petal', shape: 'petal', colors: ['255,190,215', '255,210,230'], density: 1, speed: 0.9, sizeMin: 4, sizeMax: 8 }),
  s({ id: 'gold-leaves', label: '金葉', kind: 'dynamic', category: '自然', base: 'linear-gradient(180deg,#2a2010,#150f06)', behavior: 'petal', shape: 'petal', colors: ['235,190,90', '210,160,60'], density: 1.1, speed: 0.8, sizeMin: 5, sizeMax: 10 }),
  s({ id: 'stars-warm', label: '暖星', kind: 'dynamic', category: '星空宇宙', base: 'radial-gradient(circle at 50% 20%,#2a2016,#0a0806)', behavior: 'twinkle', shape: 'circle', colors: ['255,230,180', '255,255,255'], density: 1.4, sizeMin: 0.6, sizeMax: 1.8 }),
  s({ id: 'fireflies-warm', label: '暖螢', kind: 'dynamic', category: '自然', base: 'linear-gradient(180deg,#1a160e,#0c0a06)', behavior: 'wander', shape: 'circle', colors: ['255,220,140'], density: 0.8, speed: 0.7, sizeMin: 1.2, sizeMax: 2.6 }),
  s({ id: 'lanterns', label: '天燈', kind: 'dynamic', category: '慶祝', base: 'linear-gradient(180deg,#1a1020,#0a0610)', behavior: 'rise', shape: 'circle', colors: ['255,190,120', '255,150,90'], density: 0.6, speed: 0.5, sizeMin: 2, sizeMax: 5 }),
  s({ id: 'bubbles-pink', label: '粉泡', kind: 'dynamic', category: '自然', base: 'linear-gradient(180deg,#2a1826,#140a12)', behavior: 'rise', shape: 'ring', colors: ['255,200,225'], density: 1.2, speed: 0.9, sizeMin: 3, sizeMax: 12 }),
  s({ id: 'confetti-pastel', label: '粉彩紙', kind: 'dynamic', category: '慶祝', base: 'linear-gradient(180deg,#1c2030,#12151f)', behavior: 'fall', shape: 'square', colors: ['255,180,200', '180,220,255', '200,255,210', '255,235,180'], density: 1.3, speed: 1.1, sizeMin: 3, sizeMax: 6 }),
  s({ id: 'hearts-white', label: '白心', kind: 'dynamic', category: '慶祝', base: 'linear-gradient(180deg,#241a20,#120a10)', behavior: 'fall', shape: 'heart', colors: ['255,255,255', '255,220,230'], density: 0.8, speed: 0.8, sizeMin: 5, sizeMax: 10 }),
  s({ id: 'star-fall-blue', label: '藍星墜', kind: 'dynamic', category: '星空宇宙', base: NIGHT, behavior: 'fall', shape: 'star', colors: ['180,210,255'], density: 0.7, speed: 1.1, sizeMin: 2, sizeMax: 4 }),
  s({ id: 'glitter-rainbow', label: '虹彩閃粉', kind: 'dynamic', category: '慶祝', base: 'linear-gradient(180deg,#161428,#0a0814)', behavior: 'twinkle', shape: 'circle', colors: ['255,120,150', '120,200,255', '255,220,120', '160,255,180', '210,140,255'], density: 2.4, sizeMin: 0.6, sizeMax: 1.6 }),
  s({ id: 'dust-blue', label: '藍塵', kind: 'dynamic', category: '簡約', base: 'linear-gradient(180deg,#101826,#080d16)', behavior: 'wander', shape: 'circle', colors: ['170,205,255'], density: 1.6, speed: 0.35, sizeMin: 0.8, sizeMax: 2.2 }),
  s({ id: 'petal-storm-white', label: '白瓣吹雪', kind: 'dynamic', category: '自然', base: 'linear-gradient(180deg,#eef1f8,#dfe5f0)', behavior: 'petal', shape: 'petal', colors: ['255,255,255', '235,240,255'], density: 2.2, speed: 1.2, sizeMin: 4, sizeMax: 9 }),

  // ── 追加二（#55 S2：新配色/氛圍，皆資料驅動、實際會渲染） ──

  // 天氣：曦光、暮色、金雨、霧靄等新氣象
  s({ id: 'snow-dawn', label: '曦雪', kind: 'dynamic', category: '天氣', base: DAWN, behavior: 'fall', shape: 'circle', colors: ['255,240,225', '255,225,215'], density: 1, speed: 0.6, sizeMin: 1, sizeMax: 2.8 }),
  s({ id: 'snow-teal', label: '青雪', kind: 'dynamic', category: '天氣', base: 'linear-gradient(180deg,#123030,#08181a)', behavior: 'fall', shape: 'circle', colors: ['200,245,240'], density: 1, speed: 0.7, sizeMin: 1, sizeMax: 2.8 }),
  s({ id: 'rain-dusk', label: '暮雨', kind: 'dynamic', category: '天氣', base: TWILIGHT, behavior: 'rain', shape: 'streak', colors: ['255,200,160', '230,180,200'], density: 1.3, speed: 1.1, sizeMin: 7, sizeMax: 14 }),
  s({ id: 'rain-mist', label: '霧雨', kind: 'dynamic', category: '天氣', base: 'linear-gradient(180deg,#2c3138,#161a1f)', behavior: 'rain', shape: 'streak', colors: ['200,210,220'], density: 0.7, speed: 0.6, sizeMin: 5, sizeMax: 10 }),
  s({ id: 'rain-gold', label: '金雨', kind: 'dynamic', category: '天氣', base: WARM, behavior: 'rain', shape: 'streak', colors: ['255,220,150', '255,235,190'], density: 1.2, speed: 1, sizeMin: 7, sizeMax: 14 }),
  s({ id: 'rain-violet', label: '紫雨', kind: 'dynamic', category: '天氣', base: 'linear-gradient(180deg,#241a34,#100a1c)', behavior: 'rain', shape: 'streak', colors: ['210,180,255'], density: 1.3, speed: 1.1, sizeMin: 7, sizeMax: 14 }),
  s({ id: 'sleet', label: '霰', kind: 'dynamic', category: '天氣', base: 'linear-gradient(180deg,#2e343e,#161a20)', behavior: 'fall', shape: 'square', colors: ['225,235,245'], density: 1.8, speed: 1.5, sizeMin: 1.5, sizeMax: 3 }),
  s({ id: 'fog-drift', label: '霧靄', kind: 'dynamic', category: '天氣', base: 'linear-gradient(180deg,#3a4048,#20252c)', behavior: 'wander', shape: 'circle', colors: ['210,215,220'], density: 1.4, speed: 0.3, sizeMin: 1, sizeMax: 2.6 }),

  // 星空宇宙：彗星、雙色銀河、深空、脈衝
  s({ id: 'comet', label: '彗星', kind: 'dynamic', category: '星空宇宙', base: NIGHT, behavior: 'rain', shape: 'streak', colors: ['180,240,255', '255,255,255'], density: 0.3, speed: 2.4, sizeMin: 18, sizeMax: 34 }),
  s({ id: 'stars-green', label: '綠星', kind: 'dynamic', category: '星空宇宙', base: 'radial-gradient(circle at 50% 20%,#12261e,#05100a)', behavior: 'twinkle', shape: 'circle', colors: ['160,255,200'], density: 1.4, sizeMin: 0.6, sizeMax: 1.8 }),
  s({ id: 'galaxy-rose', label: '玫瑰銀河', kind: 'dynamic', category: '星空宇宙', base: 'radial-gradient(circle at 50% 40%,#3a1e30,#0f0710)', behavior: 'twinkle', shape: 'circle', colors: ['255,255,255', '255,190,220', '255,220,180'], density: 2.8, sizeMin: 0.5, sizeMax: 1.6 }),
  s({ id: 'deep-space', label: '深空', kind: 'dynamic', category: '星空宇宙', base: 'radial-gradient(circle at 50% 30%,#0e1424,#03040a)', behavior: 'twinkle', shape: 'circle', colors: ['210,225,255'], density: 0.6, sizeMin: 0.5, sizeMax: 1.6 }),
  s({ id: 'pulsar', label: '脈衝星', kind: 'dynamic', category: '星空宇宙', base: 'radial-gradient(circle at 50% 25%,#201838,#07060f)', behavior: 'twinkle', shape: 'star', colors: ['200,220,255', '255,255,255'], density: 0.5, sizeMin: 1.6, sizeMax: 3.6 }),
  s({ id: 'stardust-violet', label: '紫星塵', kind: 'dynamic', category: '星空宇宙', base: NIGHT, behavior: 'fall', shape: 'star', colors: ['210,180,255'], density: 0.8, speed: 1, sizeMin: 2, sizeMax: 4 }),
  s({ id: 'nebula-drift', label: '星雲塵', kind: 'dynamic', category: '星空宇宙', base: 'radial-gradient(circle at 50% 40%,#2a1840,#08060f)', behavior: 'wander', shape: 'circle', colors: ['200,160,255', '160,200,255'], density: 1.6, speed: 0.35, sizeMin: 0.8, sizeMax: 2 }),
  s({ id: 'meteor-blue', label: '藍流星雨', kind: 'dynamic', category: '星空宇宙', base: NIGHT, behavior: 'rain', shape: 'streak', colors: ['170,215,255'], density: 0.4, speed: 2.2, sizeMin: 16, sizeMax: 30 }),

  // 自然：草原、深海、曦櫻、柳絮
  s({ id: 'meadow-fireflies', label: '草原螢', kind: 'dynamic', category: '自然', base: MEADOW, behavior: 'wander', shape: 'circle', colors: ['210,255,150', '255,240,150'], density: 0.8, speed: 0.7, sizeMin: 1.2, sizeMax: 2.6 }),
  s({ id: 'deep-sea', label: '深海', kind: 'dynamic', category: '自然', base: DEEPSEA, behavior: 'rise', shape: 'ring', colors: ['150,215,255'], density: 1.1, speed: 0.7, sizeMin: 3, sizeMax: 12 }),
  s({ id: 'ocean-glow', label: '海光', kind: 'dynamic', category: '自然', base: DEEPSEA, behavior: 'wander', shape: 'circle', colors: ['120,230,255', '130,255,220'], density: 1.3, speed: 0.5, sizeMin: 1, sizeMax: 2.4 }),
  s({ id: 'petals-dawn', label: '曦櫻', kind: 'dynamic', category: '自然', base: DAWN, behavior: 'petal', shape: 'petal', colors: ['255,210,215', '255,225,225'], density: 1, speed: 0.9, sizeMin: 4, sizeMax: 8 }),
  s({ id: 'willow', label: '柳絮', kind: 'dynamic', category: '自然', base: 'linear-gradient(180deg,#dfe8dc,#cdddc8)', behavior: 'petal', shape: 'petal', colors: ['255,255,255', '245,250,240'], density: 1, speed: 0.5, sizeMin: 4, sizeMax: 9 }),
  s({ id: 'moss-spores', label: '苔孢', kind: 'dynamic', category: '自然', base: 'linear-gradient(180deg,#1c2a18,#0d150a)', behavior: 'wander', shape: 'circle', colors: ['180,220,120'], density: 1.5, speed: 0.35, sizeMin: 0.8, sizeMax: 2 }),
  s({ id: 'dew', label: '露光', kind: 'dynamic', category: '自然', base: 'linear-gradient(180deg,#1a2a24,#0c1510)', behavior: 'wander', shape: 'circle', colors: ['200,255,235'], density: 1, speed: 0.4, sizeMin: 1, sizeMax: 2.4 }),
  s({ id: 'leaves-dusk', label: '暮葉', kind: 'dynamic', category: '自然', base: 'linear-gradient(180deg,#2a2418,#14100a)', behavior: 'petal', shape: 'petal', colors: ['200,150,80', '170,110,60', '210,180,90'], density: 1.1, speed: 0.8, sizeMin: 5, sizeMax: 10 }),

  // 慶祝：煙花、霓虹、玫瑰閃、金粉
  s({ id: 'fireworks', label: '煙花', kind: 'dynamic', category: '慶祝', base: 'linear-gradient(180deg,#0e1020,#060812)', behavior: 'rise', shape: 'star', colors: ['255,120,150', '120,200,255', '255,220,120', '160,255,180'], density: 1, speed: 1.6, sizeMin: 2, sizeMax: 5 }),
  s({ id: 'confetti-neon', label: '霓虹彩紙', kind: 'dynamic', category: '慶祝', base: 'linear-gradient(180deg,#120a20,#080512)', behavior: 'fall', shape: 'square', colors: ['120,255,220', '255,120,220', '255,240,120', '120,200,255'], density: 1.5, speed: 1.2, sizeMin: 3, sizeMax: 6 }),
  s({ id: 'sparkle-rose', label: '玫瑰閃', kind: 'dynamic', category: '慶祝', base: 'linear-gradient(180deg,#241422,#120a12)', behavior: 'twinkle', shape: 'circle', colors: ['255,180,210', '255,220,235'], density: 2.2, sizeMin: 0.6, sizeMax: 1.6 }),
  s({ id: 'gold-rise', label: '金粉升', kind: 'dynamic', category: '慶祝', base: DUSK, behavior: 'rise', shape: 'circle', colors: ['255,215,130', '255,235,180'], density: 1.4, speed: 0.9, sizeMin: 1, sizeMax: 3 }),
  s({ id: 'hearts-gold', label: '金心', kind: 'dynamic', category: '慶祝', base: 'linear-gradient(180deg,#241c10,#120d06)', behavior: 'rise', shape: 'heart', colors: ['255,215,130', '255,235,180'], density: 0.9, speed: 0.8, sizeMin: 5, sizeMax: 10 }),
  s({ id: 'streamers', label: '緞帶', kind: 'dynamic', category: '慶祝', base: 'linear-gradient(180deg,#1a1e2c,#0e1119)', behavior: 'fall', shape: 'streak', colors: ['255,120,150', '120,200,255', '255,220,120'], density: 1, speed: 1, sizeMin: 8, sizeMax: 16 }),

  // 簡約：中性漂移、粉彩、暖靄
  s({ id: 'mono-drift', label: '灰漂', kind: 'dynamic', category: '簡約', base: 'linear-gradient(180deg,#26292f,#16181d)', behavior: 'wander', shape: 'circle', colors: ['190,195,200'], density: 1.4, speed: 0.3, sizeMin: 0.8, sizeMax: 2.2 }),
  s({ id: 'pastel-rise', label: '粉彩升', kind: 'dynamic', category: '簡約', base: 'linear-gradient(180deg,#1e2230,#141824)', behavior: 'rise', shape: 'circle', colors: ['200,220,255', '255,200,225', '210,255,220'], density: 1, speed: 0.6, sizeMin: 1, sizeMax: 3 }),
  s({ id: 'dust-rose', label: '玫瑰塵', kind: 'dynamic', category: '簡約', base: 'linear-gradient(180deg,#2a1c22,#160d12)', behavior: 'wander', shape: 'circle', colors: ['255,200,215'], density: 1.6, speed: 0.35, sizeMin: 0.8, sizeMax: 2.2 }),
  s({ id: 'calm-blue', label: '靜藍', kind: 'dynamic', category: '簡約', base: 'linear-gradient(180deg,#14202e,#0a1016)', behavior: 'wander', shape: 'circle', colors: ['160,200,240'], density: 1, speed: 0.3, sizeMin: 1, sizeMax: 2.4 }),
  s({ id: 'quiet-snow', label: '靜雪', kind: 'dynamic', category: '簡約', base: 'linear-gradient(180deg,#1c1f26,#111318)', behavior: 'fall', shape: 'circle', colors: ['235,240,248'], density: 0.6, speed: 0.5, sizeMin: 1, sizeMax: 2.6 }),
  s({ id: 'haze-warm', label: '暖靄', kind: 'dynamic', category: '簡約', base: 'linear-gradient(180deg,#2a2016,#161009)', behavior: 'wander', shape: 'circle', colors: ['255,225,180'], density: 1.5, speed: 0.3, sizeMin: 0.8, sizeMax: 2.2 }),

  // ══════════════════════════════════════════════════════════════════
  // 追加三（#55 S3：各分類擴充至 50 + 新分類「城市夜景」，皆資料驅動、實際會渲染）
  // ══════════════════════════════════════════════════════════════════

  // ── 天氣 +25（雪/雨/霧/塵的新配色與新型態） ──
  s({ id: 'hail', label: '冰雹', kind: 'dynamic', category: '天氣', base: 'linear-gradient(180deg,#2c333d,#141a20)', behavior: 'fall', shape: 'square', colors: ['210,235,255'], density: 1.8, speed: 1.8, sizeMin: 1.5, sizeMax: 3 }),
  s({ id: 'flurries', label: '碎雪', kind: 'dynamic', category: '天氣', base: DARK, behavior: 'fall', shape: 'circle', colors: ['245,248,255'], density: 0.6, speed: 0.5, sizeMin: 1, sizeMax: 2.2 }),
  s({ id: 'blizzard-blue', label: '藍暴雪', kind: 'dynamic', category: '天氣', base: 'linear-gradient(180deg,#2e3a4e,#141c28)', behavior: 'fall', shape: 'circle', colors: ['200,225,255'], density: 2.6, speed: 1.8, sizeMin: 1, sizeMax: 3 }),
  s({ id: 'snow-lavender', label: '薰衣雪', kind: 'dynamic', category: '天氣', base: 'linear-gradient(180deg,#221c30,#110c18)', behavior: 'fall', shape: 'circle', colors: ['225,210,255'], density: 1, speed: 0.7, sizeMin: 1, sizeMax: 2.8 }),
  s({ id: 'snow-peach', label: '蜜桃雪', kind: 'dynamic', category: '天氣', base: 'linear-gradient(180deg,#2c1f18,#16100b)', behavior: 'fall', shape: 'circle', colors: ['255,225,205'], density: 1, speed: 0.6, sizeMin: 1, sizeMax: 2.6 }),
  s({ id: 'snow-aqua', label: '水藍雪', kind: 'dynamic', category: '天氣', base: 'linear-gradient(180deg,#132a30,#091518)', behavior: 'fall', shape: 'circle', colors: ['205,240,255'], density: 1.1, speed: 0.7, sizeMin: 1, sizeMax: 2.8 }),
  s({ id: 'snow-amber', label: '琥珀雪', kind: 'dynamic', category: '天氣', base: 'linear-gradient(180deg,#2a2010,#150f06)', behavior: 'fall', shape: 'circle', colors: ['255,220,170'], density: 1, speed: 0.6, sizeMin: 1, sizeMax: 2.6 }),
  s({ id: 'snow-coral', label: '珊瑚雪', kind: 'dynamic', category: '天氣', base: 'linear-gradient(180deg,#2c1a18,#16100c)', behavior: 'fall', shape: 'circle', colors: ['255,200,190'], density: 1, speed: 0.7, sizeMin: 1, sizeMax: 2.8 }),
  s({ id: 'ice-crystals', label: '冰晶', kind: 'dynamic', category: '天氣', base: 'linear-gradient(180deg,#12283c,#08131e)', behavior: 'fall', shape: 'star', colors: ['225,245,255'], density: 0.9, speed: 0.8, sizeMin: 1.5, sizeMax: 3 }),
  s({ id: 'frost', label: '霜華', kind: 'dynamic', category: '天氣', base: 'linear-gradient(180deg,#1c2630,#0c141c)', behavior: 'twinkle', shape: 'circle', colors: ['235,245,255'], density: 1.6, sizeMin: 0.6, sizeMax: 1.8 }),
  s({ id: 'drizzle-warm', label: '暖毛雨', kind: 'dynamic', category: '天氣', base: WARM, behavior: 'rain', shape: 'streak', colors: ['235,210,180'], density: 0.9, speed: 0.7, sizeMin: 5, sizeMax: 10 }),
  s({ id: 'rain-emerald', label: '翠雨', kind: 'dynamic', category: '天氣', base: 'linear-gradient(180deg,#0e2a22,#061510)', behavior: 'rain', shape: 'streak', colors: ['150,235,190'], density: 1.3, speed: 1.1, sizeMin: 7, sizeMax: 14 }),
  s({ id: 'rain-silver', label: '銀雨', kind: 'dynamic', category: '天氣', base: 'linear-gradient(180deg,#262c34,#12161c)', behavior: 'rain', shape: 'streak', colors: ['215,225,235'], density: 1.4, speed: 1.2, sizeMin: 7, sizeMax: 15 }),
  s({ id: 'rain-cyan', label: '青雨', kind: 'dynamic', category: '天氣', base: 'linear-gradient(180deg,#0c2a2e,#061518)', behavior: 'rain', shape: 'streak', colors: ['150,235,240'], density: 1.3, speed: 1.1, sizeMin: 7, sizeMax: 14 }),
  s({ id: 'rain-plum', label: '梅雨', kind: 'dynamic', category: '天氣', base: 'linear-gradient(180deg,#241e2c,#120c18)', behavior: 'rain', shape: 'streak', colors: ['200,180,215'], density: 1.6, speed: 1, sizeMin: 8, sizeMax: 15 }),
  s({ id: 'rain-copper', label: '銅雨', kind: 'dynamic', category: '天氣', base: 'linear-gradient(180deg,#2a1c12,#150e08)', behavior: 'rain', shape: 'streak', colors: ['235,180,140'], density: 1.2, speed: 1, sizeMin: 7, sizeMax: 14 }),
  s({ id: 'rain-rose', label: '薔薇雨', kind: 'dynamic', category: '天氣', base: 'linear-gradient(180deg,#2c1420,#160a12)', behavior: 'rain', shape: 'streak', colors: ['255,150,180'], density: 1.3, speed: 1.1, sizeMin: 7, sizeMax: 14 }),
  s({ id: 'sunshower', label: '太陽雨', kind: 'dynamic', category: '天氣', base: 'radial-gradient(circle at 50% 20%,#3a2c16,#160f08)', behavior: 'rain', shape: 'streak', colors: ['255,235,170'], density: 1, speed: 1, sizeMin: 6, sizeMax: 13 }),
  s({ id: 'monsoon', label: '季風雨', kind: 'dynamic', category: '天氣', base: 'linear-gradient(180deg,#132a30,#08151a)', behavior: 'rain', shape: 'streak', colors: ['170,205,215'], density: 2.4, speed: 1.6, sizeMin: 9, sizeMax: 18 }),
  s({ id: 'storm-grey', label: '灰風暴', kind: 'dynamic', category: '天氣', base: 'linear-gradient(180deg,#2a2e34,#141719)', behavior: 'fall', shape: 'circle', colors: ['200,205,212'], density: 2.4, speed: 1.7, sizeMin: 1, sizeMax: 2.8 }),
  s({ id: 'mist-blue', label: '藍霧', kind: 'dynamic', category: '天氣', base: 'linear-gradient(180deg,#2a323c,#161c24)', behavior: 'wander', shape: 'circle', colors: ['195,215,235'], density: 1.4, speed: 0.3, sizeMin: 1, sizeMax: 2.6 }),
  s({ id: 'mist-rose', label: '霞霧', kind: 'dynamic', category: '天氣', base: 'linear-gradient(180deg,#322830,#1a1218)', behavior: 'wander', shape: 'circle', colors: ['235,205,215'], density: 1.4, speed: 0.3, sizeMin: 1, sizeMax: 2.6 }),
  s({ id: 'sandstorm', label: '沙塵', kind: 'dynamic', category: '天氣', base: 'linear-gradient(180deg,#2e2416,#17110a)', behavior: 'wander', shape: 'circle', colors: ['225,200,150'], density: 1.8, speed: 0.8, sizeMin: 0.8, sizeMax: 2.2 }),
  s({ id: 'drizzle-night', label: '夜毛雨', kind: 'dynamic', category: '天氣', base: NIGHT, behavior: 'rain', shape: 'streak', colors: ['170,190,215'], density: 0.9, speed: 0.7, sizeMin: 5, sizeMax: 11 }),
  s({ id: 'rain-mono', label: '灰雨', kind: 'dynamic', category: '天氣', base: DARK, behavior: 'rain', shape: 'streak', colors: ['200,205,210'], density: 1.3, speed: 1, sizeMin: 7, sizeMax: 14 }),

  // ── 星空宇宙 +31（星色/銀河/星雲/流星彗星的新配色） ──
  s({ id: 'stars-rose', label: '粉星', kind: 'dynamic', category: '星空宇宙', base: 'radial-gradient(circle at 50% 20%,#2a1622,#0c060f)', behavior: 'twinkle', shape: 'circle', colors: ['255,200,225'], density: 1.4, sizeMin: 0.6, sizeMax: 1.8 }),
  s({ id: 'stars-teal', label: '青星', kind: 'dynamic', category: '星空宇宙', base: 'radial-gradient(circle at 50% 20%,#0e2626,#040f0f)', behavior: 'twinkle', shape: 'circle', colors: ['150,235,225'], density: 1.4, sizeMin: 0.6, sizeMax: 1.8 }),
  s({ id: 'stars-amber', label: '琥珀星', kind: 'dynamic', category: '星空宇宙', base: 'radial-gradient(circle at 50% 20%,#2a2214,#0c0906)', behavior: 'twinkle', shape: 'circle', colors: ['255,215,160'], density: 1.4, sizeMin: 0.6, sizeMax: 1.8 }),
  s({ id: 'stars-violet', label: '紫星', kind: 'dynamic', category: '星空宇宙', base: 'radial-gradient(circle at 50% 20%,#201838,#08060f)', behavior: 'twinkle', shape: 'circle', colors: ['210,185,255'], density: 1.4, sizeMin: 0.6, sizeMax: 1.8 }),
  s({ id: 'stars-crimson', label: '赤星', kind: 'dynamic', category: '星空宇宙', base: 'radial-gradient(circle at 50% 20%,#2a1414,#0f0606)', behavior: 'twinkle', shape: 'circle', colors: ['255,170,170'], density: 1.4, sizeMin: 0.6, sizeMax: 1.8 }),
  s({ id: 'stars-mono', label: '白星塵', kind: 'dynamic', category: '星空宇宙', base: 'radial-gradient(circle at 50% 25%,#181c26,#06080e)', behavior: 'twinkle', shape: 'circle', colors: ['235,240,248'], density: 0.8, sizeMin: 0.5, sizeMax: 1.6 }),
  s({ id: 'galaxy-blue', label: '藍銀河', kind: 'dynamic', category: '星空宇宙', base: 'radial-gradient(circle at 50% 40%,#16264a,#05080f)', behavior: 'twinkle', shape: 'circle', colors: ['255,255,255', '180,210,255', '150,235,255'], density: 2.8, sizeMin: 0.5, sizeMax: 1.6 }),
  s({ id: 'galaxy-gold', label: '金銀河', kind: 'dynamic', category: '星空宇宙', base: 'radial-gradient(circle at 50% 40%,#2e2416,#0a0806)', behavior: 'twinkle', shape: 'circle', colors: ['255,255,255', '255,225,170', '255,200,140'], density: 2.8, sizeMin: 0.5, sizeMax: 1.6 }),
  s({ id: 'galaxy-emerald', label: '翠銀河', kind: 'dynamic', category: '星空宇宙', base: 'radial-gradient(circle at 50% 40%,#123626,#060f0b)', behavior: 'twinkle', shape: 'circle', colors: ['255,255,255', '170,255,210', '150,220,255'], density: 2.8, sizeMin: 0.5, sizeMax: 1.6 }),
  s({ id: 'galaxy-violet', label: '紫銀河', kind: 'dynamic', category: '星空宇宙', base: 'radial-gradient(circle at 50% 40%,#2a1846,#08060f)', behavior: 'twinkle', shape: 'circle', colors: ['255,255,255', '210,170,255', '170,190,255'], density: 2.8, sizeMin: 0.5, sizeMax: 1.6 }),
  s({ id: 'star-cluster', label: '星團', kind: 'dynamic', category: '星空宇宙', base: 'radial-gradient(circle at 50% 45%,#1c2038,#06070f)', behavior: 'twinkle', shape: 'circle', colors: ['255,250,235', '220,225,255'], density: 3.2, sizeMin: 0.5, sizeMax: 1.5 }),
  s({ id: 'supernova', label: '超新星', kind: 'dynamic', category: '星空宇宙', base: 'radial-gradient(circle at 50% 30%,#2e2016,#0a0706)', behavior: 'twinkle', shape: 'star', colors: ['255,220,180', '255,255,255'], density: 0.5, sizeMin: 1.8, sizeMax: 4 }),
  s({ id: 'quasar', label: '類星體', kind: 'dynamic', category: '星空宇宙', base: 'radial-gradient(circle at 50% 25%,#14243a,#05080f)', behavior: 'twinkle', shape: 'star', colors: ['180,230,255', '255,255,255'], density: 0.5, sizeMin: 1.6, sizeMax: 3.8 }),
  s({ id: 'nova-rose', label: '玫瑰新星', kind: 'dynamic', category: '星空宇宙', base: 'radial-gradient(circle at 50% 28%,#301828,#0d0710)', behavior: 'twinkle', shape: 'star', colors: ['255,190,215', '255,255,255'], density: 0.5, sizeMin: 1.6, sizeMax: 3.8 }),
  s({ id: 'star-shower', label: '星屑雨', kind: 'dynamic', category: '星空宇宙', base: NIGHT, behavior: 'fall', shape: 'star', colors: ['255,240,215'], density: 0.9, speed: 1.1, sizeMin: 2, sizeMax: 4 }),
  s({ id: 'star-shower-violet', label: '紫星屑', kind: 'dynamic', category: '星空宇宙', base: 'radial-gradient(circle at 50% 20%,#201838,#07060f)', behavior: 'fall', shape: 'star', colors: ['215,190,255'], density: 0.9, speed: 1.1, sizeMin: 2, sizeMax: 4 }),
  s({ id: 'star-shower-teal', label: '青星屑', kind: 'dynamic', category: '星空宇宙', base: 'radial-gradient(circle at 50% 20%,#0e2626,#040f0f)', behavior: 'fall', shape: 'star', colors: ['170,240,235'], density: 0.9, speed: 1.1, sizeMin: 2, sizeMax: 4 }),
  s({ id: 'meteor-gold', label: '金流星雨', kind: 'dynamic', category: '星空宇宙', base: NIGHT, behavior: 'rain', shape: 'streak', colors: ['255,225,160'], density: 0.4, speed: 2.2, sizeMin: 16, sizeMax: 30 }),
  s({ id: 'meteor-rose', label: '玫瑰流星', kind: 'dynamic', category: '星空宇宙', base: NIGHT, behavior: 'rain', shape: 'streak', colors: ['255,180,210'], density: 0.4, speed: 2.2, sizeMin: 16, sizeMax: 30 }),
  s({ id: 'meteor-green', label: '綠流星', kind: 'dynamic', category: '星空宇宙', base: NIGHT, behavior: 'rain', shape: 'streak', colors: ['170,255,200'], density: 0.4, speed: 2.2, sizeMin: 16, sizeMax: 30 }),
  s({ id: 'comet-gold', label: '金彗星', kind: 'dynamic', category: '星空宇宙', base: NIGHT, behavior: 'rain', shape: 'streak', colors: ['255,225,170', '255,255,255'], density: 0.3, speed: 2.4, sizeMin: 18, sizeMax: 34 }),
  s({ id: 'comet-violet', label: '紫彗星', kind: 'dynamic', category: '星空宇宙', base: NIGHT, behavior: 'rain', shape: 'streak', colors: ['210,180,255', '255,255,255'], density: 0.3, speed: 2.4, sizeMin: 18, sizeMax: 34 }),
  s({ id: 'nebula-rose-drift', label: '玫瑰星雲塵', kind: 'dynamic', category: '星空宇宙', base: 'radial-gradient(circle at 50% 40%,#301828,#0a0610)', behavior: 'wander', shape: 'circle', colors: ['255,180,215', '255,210,180'], density: 1.6, speed: 0.35, sizeMin: 0.8, sizeMax: 2 }),
  s({ id: 'nebula-teal-drift', label: '青星雲塵', kind: 'dynamic', category: '星空宇宙', base: 'radial-gradient(circle at 50% 40%,#0e2e30,#040f0f)', behavior: 'wander', shape: 'circle', colors: ['150,235,225', '160,200,255'], density: 1.6, speed: 0.35, sizeMin: 0.8, sizeMax: 2 }),
  s({ id: 'nebula-gold-drift', label: '金星雲塵', kind: 'dynamic', category: '星空宇宙', base: 'radial-gradient(circle at 50% 40%,#2e2414,#0a0806)', behavior: 'wander', shape: 'circle', colors: ['255,220,160', '255,190,140'], density: 1.6, speed: 0.35, sizeMin: 0.8, sizeMax: 2 }),
  s({ id: 'cosmic-dust', label: '宇宙塵', kind: 'dynamic', category: '星空宇宙', base: 'radial-gradient(circle at 50% 35%,#12162a,#04050c)', behavior: 'wander', shape: 'circle', colors: ['210,215,240'], density: 1.2, speed: 0.3, sizeMin: 0.8, sizeMax: 2 }),
  s({ id: 'starfall-rain', label: '星墜雨', kind: 'dynamic', category: '星空宇宙', base: NIGHT, behavior: 'fall', shape: 'circle', colors: ['235,240,255'], density: 1.2, speed: 0.9, sizeMin: 1, sizeMax: 2.4 }),
  s({ id: 'constellation', label: '星座', kind: 'dynamic', category: '星空宇宙', base: 'radial-gradient(circle at 50% 25%,#141a30,#05070e)', behavior: 'twinkle', shape: 'circle', colors: ['255,255,255', '255,240,210'], density: 0.5, sizeMin: 1, sizeMax: 2.4 }),
  s({ id: 'void-stars', label: '虛空星', kind: 'dynamic', category: '星空宇宙', base: 'radial-gradient(circle at 50% 30%,#0a0e18,#020308)', behavior: 'twinkle', shape: 'circle', colors: ['190,205,235'], density: 0.5, sizeMin: 0.5, sizeMax: 1.6 }),
  s({ id: 'andromeda', label: '仙女座', kind: 'dynamic', category: '星空宇宙', base: 'radial-gradient(circle at 50% 40%,#241a3e,#07060f)', behavior: 'twinkle', shape: 'circle', colors: ['255,255,255', '200,180,255', '255,200,220'], density: 3, sizeMin: 0.5, sizeMax: 1.6 }),
  s({ id: 'milky-drift', label: '星河漂', kind: 'dynamic', category: '星空宇宙', base: 'radial-gradient(circle at 50% 40%,#1a2040,#06070f)', behavior: 'wander', shape: 'circle', colors: ['220,225,255', '200,215,255'], density: 2, speed: 0.3, sizeMin: 0.6, sizeMax: 1.8 }),

  // ── 自然 +21（花葉/螢光/海洋/苔露的新配色與型態） ──
  s({ id: 'sakura-gold', label: '金櫻', kind: 'dynamic', category: '自然', base: 'linear-gradient(180deg,#2a2214,#150f08)', behavior: 'petal', shape: 'petal', colors: ['255,225,180', '255,240,210'], density: 1, speed: 0.9, sizeMin: 4, sizeMax: 8 }),
  s({ id: 'sakura-violet', label: '紫櫻', kind: 'dynamic', category: '自然', base: 'linear-gradient(180deg,#221830,#100a18)', behavior: 'petal', shape: 'petal', colors: ['225,190,255', '240,215,255'], density: 1, speed: 0.9, sizeMin: 4, sizeMax: 8 }),
  s({ id: 'maple-gold', label: '金楓', kind: 'dynamic', category: '自然', base: 'linear-gradient(180deg,#2a2010,#140f06)', behavior: 'petal', shape: 'petal', colors: ['235,180,80', '220,140,60'], density: 1, speed: 0.8, sizeMin: 5, sizeMax: 10 }),
  s({ id: 'maple-crimson', label: '赤楓', kind: 'dynamic', category: '自然', base: 'linear-gradient(180deg,#2a1410,#150a08)', behavior: 'petal', shape: 'petal', colors: ['210,60,50', '180,50,40'], density: 1, speed: 0.8, sizeMin: 5, sizeMax: 10 }),
  s({ id: 'leaves-teal', label: '青葉', kind: 'dynamic', category: '自然', base: 'linear-gradient(180deg,#132a26,#091512)', behavior: 'petal', shape: 'petal', colors: ['120,210,190', '90,180,160'], density: 1, speed: 0.8, sizeMin: 5, sizeMax: 10 }),
  s({ id: 'leaves-fall', label: '落葉紛', kind: 'dynamic', category: '自然', base: 'linear-gradient(180deg,#2a2014,#14100a)', behavior: 'petal', shape: 'petal', colors: ['210,150,60', '180,100,50', '160,80,40'], density: 2, speed: 1, sizeMin: 5, sizeMax: 10 }),
  s({ id: 'fireflies-rose', label: '粉螢', kind: 'dynamic', category: '自然', base: 'linear-gradient(180deg,#1c1218,#0d080c)', behavior: 'wander', shape: 'circle', colors: ['255,190,215'], density: 0.8, speed: 0.7, sizeMin: 1.2, sizeMax: 2.6 }),
  s({ id: 'fireflies-teal', label: '青螢', kind: 'dynamic', category: '自然', base: 'linear-gradient(180deg,#0e1e1c,#060f0d)', behavior: 'wander', shape: 'circle', colors: ['150,255,225'], density: 0.8, speed: 0.7, sizeMin: 1.2, sizeMax: 2.6 }),
  s({ id: 'pollen-white', label: '白絮', kind: 'dynamic', category: '自然', base: 'linear-gradient(180deg,#2a2c20,#141610)', behavior: 'wander', shape: 'circle', colors: ['245,245,235'], density: 1.6, speed: 0.4, sizeMin: 0.8, sizeMax: 2 }),
  s({ id: 'seeds-drift', label: '蒲公英', kind: 'dynamic', category: '自然', base: MEADOW, behavior: 'petal', shape: 'petal', colors: ['255,255,255', '245,250,235'], density: 0.9, speed: 0.5, sizeMin: 4, sizeMax: 9 }),
  s({ id: 'bubbles-teal', label: '青泡', kind: 'dynamic', category: '自然', base: 'linear-gradient(180deg,#0e3236,#06161a)', behavior: 'rise', shape: 'ring', colors: ['150,235,225'], density: 1.2, speed: 0.9, sizeMin: 3, sizeMax: 12 }),
  s({ id: 'bubbles-gold', label: '金泡', kind: 'dynamic', category: '自然', base: 'linear-gradient(180deg,#2a2210,#150f06)', behavior: 'rise', shape: 'ring', colors: ['255,225,170'], density: 1.1, speed: 0.9, sizeMin: 3, sizeMax: 12 }),
  s({ id: 'coral-glow', label: '珊瑚光', kind: 'dynamic', category: '自然', base: DEEPSEA, behavior: 'wander', shape: 'circle', colors: ['255,180,160', '255,150,180'], density: 1.2, speed: 0.5, sizeMin: 1, sizeMax: 2.4 }),
  s({ id: 'kelp-light', label: '海藻光', kind: 'dynamic', category: '自然', base: 'linear-gradient(180deg,#0a2a26,#041412)', behavior: 'rise', shape: 'ring', colors: ['150,220,170'], density: 1.1, speed: 0.7, sizeMin: 3, sizeMax: 11 }),
  s({ id: 'tide-glow', label: '潮光', kind: 'dynamic', category: '自然', base: OCEAN, behavior: 'wander', shape: 'circle', colors: ['130,230,255'], density: 1.3, speed: 0.5, sizeMin: 1, sizeMax: 2.4 }),
  s({ id: 'spring-buds', label: '春芽', kind: 'dynamic', category: '自然', base: FOREST, behavior: 'rise', shape: 'circle', colors: ['180,230,140'], density: 1, speed: 0.6, sizeMin: 1, sizeMax: 3 }),
  s({ id: 'dew-rose', label: '玫瑰露', kind: 'dynamic', category: '自然', base: 'linear-gradient(180deg,#1c2a22,#0d150f)', behavior: 'wander', shape: 'circle', colors: ['255,210,220'], density: 1, speed: 0.4, sizeMin: 1, sizeMax: 2.4 }),
  s({ id: 'mountain-mist', label: '山嵐', kind: 'dynamic', category: '自然', base: 'linear-gradient(180deg,#1e2a26,#0e1512)', behavior: 'wander', shape: 'circle', colors: ['210,220,220'], density: 1.5, speed: 0.3, sizeMin: 1, sizeMax: 2.6 }),
  s({ id: 'petals-rose-rise', label: '落英', kind: 'dynamic', category: '自然', base: 'linear-gradient(180deg,#2a1824,#140a12)', behavior: 'rise', shape: 'petal', colors: ['255,180,200'], density: 1, speed: 0.7, sizeMin: 4, sizeMax: 8 }),
  s({ id: 'petals-gold-rise', label: '金瓣升', kind: 'dynamic', category: '自然', base: 'linear-gradient(180deg,#2a2212,#140f07)', behavior: 'rise', shape: 'petal', colors: ['255,220,170'], density: 1, speed: 0.7, sizeMin: 4, sizeMax: 8 }),
  s({ id: 'glowfly-green', label: '綠光蟲', kind: 'dynamic', category: '自然', base: 'linear-gradient(180deg,#16240e,#0a1206)', behavior: 'wander', shape: 'circle', colors: ['200,255,150'], density: 0.9, speed: 0.7, sizeMin: 1.2, sizeMax: 2.6 }),

  // ── 慶祝 +33（彩紙/愛心/火花/煙花/閃粉/緞帶的新配色） ──
  s({ id: 'confetti-red', label: '紅彩紙', kind: 'dynamic', category: '慶祝', base: 'linear-gradient(180deg,#1e1218,#100a10)', behavior: 'fall', shape: 'square', colors: ['255,80,90', '255,140,120'], density: 1.4, speed: 1.2, sizeMin: 3, sizeMax: 6 }),
  s({ id: 'confetti-blue', label: '藍彩紙', kind: 'dynamic', category: '慶祝', base: 'linear-gradient(180deg,#101828,#0a1018)', behavior: 'fall', shape: 'square', colors: ['120,180,255', '160,220,255'], density: 1.4, speed: 1.2, sizeMin: 3, sizeMax: 6 }),
  s({ id: 'confetti-green', label: '綠彩紙', kind: 'dynamic', category: '慶祝', base: 'linear-gradient(180deg,#12241a,#0a1410)', behavior: 'fall', shape: 'square', colors: ['120,230,150', '170,255,190'], density: 1.4, speed: 1.2, sizeMin: 3, sizeMax: 6 }),
  s({ id: 'confetti-violet', label: '紫彩紙', kind: 'dynamic', category: '慶祝', base: 'linear-gradient(180deg,#1a1230,#0e0818)', behavior: 'fall', shape: 'square', colors: ['200,140,255', '225,180,255'], density: 1.4, speed: 1.2, sizeMin: 3, sizeMax: 6 }),
  s({ id: 'confetti-rainbow', label: '虹彩紙', kind: 'dynamic', category: '慶祝', base: 'linear-gradient(180deg,#14161f,#0c0d14)', behavior: 'fall', shape: 'square', colors: ['255,90,120', '255,200,90', '120,230,150', '120,200,255', '200,120,255'], density: 1.6, speed: 1.2, sizeMin: 3, sizeMax: 6 }),
  s({ id: 'confetti-silver', label: '銀彩紙', kind: 'dynamic', category: '慶祝', base: 'linear-gradient(180deg,#1a1d24,#0e1015)', behavior: 'fall', shape: 'square', colors: ['225,230,240', '245,248,255'], density: 1.3, speed: 1.1, sizeMin: 3, sizeMax: 6 }),
  s({ id: 'hearts-red', label: '紅心', kind: 'dynamic', category: '慶祝', base: 'linear-gradient(180deg,#2a1218,#160a10)', behavior: 'fall', shape: 'heart', colors: ['255,90,110', '255,130,150'], density: 0.9, speed: 0.8, sizeMin: 5, sizeMax: 10 }),
  s({ id: 'hearts-violet', label: '紫心', kind: 'dynamic', category: '慶祝', base: 'linear-gradient(180deg,#1e1430,#100a18)', behavior: 'fall', shape: 'heart', colors: ['210,150,255'], density: 0.9, speed: 0.8, sizeMin: 5, sizeMax: 10 }),
  s({ id: 'hearts-blue', label: '藍心', kind: 'dynamic', category: '慶祝', base: 'linear-gradient(180deg,#121a2c,#0a1018)', behavior: 'fall', shape: 'heart', colors: ['150,190,255'], density: 0.9, speed: 0.8, sizeMin: 5, sizeMax: 10 }),
  s({ id: 'hearts-rainbow', label: '彩心', kind: 'dynamic', category: '慶祝', base: 'linear-gradient(180deg,#161420,#0c0a14)', behavior: 'fall', shape: 'heart', colors: ['255,120,150', '255,200,120', '160,255,180', '160,200,255'], density: 1, speed: 0.8, sizeMin: 5, sizeMax: 10 }),
  s({ id: 'hearts-rise-gold', label: '金心升', kind: 'dynamic', category: '慶祝', base: 'linear-gradient(180deg,#241c10,#120d06)', behavior: 'rise', shape: 'heart', colors: ['255,215,150'], density: 0.9, speed: 0.8, sizeMin: 5, sizeMax: 10 }),
  s({ id: 'hearts-rise-white', label: '白心升', kind: 'dynamic', category: '慶祝', base: 'linear-gradient(180deg,#20242c,#12151a)', behavior: 'rise', shape: 'heart', colors: ['255,245,248'], density: 0.9, speed: 0.8, sizeMin: 5, sizeMax: 10 }),
  s({ id: 'sparks-blue', label: '藍火花', kind: 'dynamic', category: '慶祝', base: 'linear-gradient(180deg,#0a1220,#050810)', behavior: 'rise', shape: 'circle', colors: ['150,210,255', '120,180,255'], density: 1.6, speed: 1.5, sizeMin: 0.8, sizeMax: 2.2 }),
  s({ id: 'sparks-green', label: '綠火花', kind: 'dynamic', category: '慶祝', base: 'linear-gradient(180deg,#0a1a10,#050d08)', behavior: 'rise', shape: 'circle', colors: ['170,255,180'], density: 1.6, speed: 1.5, sizeMin: 0.8, sizeMax: 2.2 }),
  s({ id: 'sparks-violet', label: '紫火花', kind: 'dynamic', category: '慶祝', base: 'linear-gradient(180deg,#140a20,#0a0512)', behavior: 'rise', shape: 'circle', colors: ['210,160,255'], density: 1.6, speed: 1.5, sizeMin: 0.8, sizeMax: 2.2 }),
  s({ id: 'sparks-rose', label: '玫瑰火花', kind: 'dynamic', category: '慶祝', base: 'linear-gradient(180deg,#1e0a14,#10050c)', behavior: 'rise', shape: 'circle', colors: ['255,170,200'], density: 1.6, speed: 1.5, sizeMin: 0.8, sizeMax: 2.2 }),
  s({ id: 'fireworks-gold', label: '金煙花', kind: 'dynamic', category: '慶祝', base: 'linear-gradient(180deg,#0e1020,#060812)', behavior: 'rise', shape: 'star', colors: ['255,225,150', '255,255,255'], density: 1, speed: 1.6, sizeMin: 2, sizeMax: 5 }),
  s({ id: 'fireworks-rose', label: '玫瑰煙花', kind: 'dynamic', category: '慶祝', base: 'linear-gradient(180deg,#12081a,#080410)', behavior: 'rise', shape: 'star', colors: ['255,150,190', '255,220,235'], density: 1, speed: 1.6, sizeMin: 2, sizeMax: 5 }),
  s({ id: 'fireworks-blue', label: '藍煙花', kind: 'dynamic', category: '慶祝', base: 'linear-gradient(180deg,#08101f,#040712)', behavior: 'rise', shape: 'star', colors: ['150,200,255', '255,255,255'], density: 1, speed: 1.6, sizeMin: 2, sizeMax: 5 }),
  s({ id: 'fireworks-green', label: '綠煙花', kind: 'dynamic', category: '慶祝', base: 'linear-gradient(180deg,#081810,#04100a)', behavior: 'rise', shape: 'star', colors: ['170,255,190', '255,255,255'], density: 1, speed: 1.6, sizeMin: 2, sizeMax: 5 }),
  s({ id: 'glitter-gold', label: '金閃粉', kind: 'dynamic', category: '慶祝', base: 'linear-gradient(180deg,#201a0e,#100c06)', behavior: 'twinkle', shape: 'circle', colors: ['255,215,140', '255,245,200'], density: 2.4, sizeMin: 0.6, sizeMax: 1.6 }),
  s({ id: 'glitter-blue', label: '藍閃粉', kind: 'dynamic', category: '慶祝', base: 'linear-gradient(180deg,#101828,#080d16)', behavior: 'twinkle', shape: 'circle', colors: ['170,215,255', '230,245,255'], density: 2.4, sizeMin: 0.6, sizeMax: 1.6 }),
  s({ id: 'glitter-violet', label: '紫閃粉', kind: 'dynamic', category: '慶祝', base: 'linear-gradient(180deg,#161028,#0c0818)', behavior: 'twinkle', shape: 'circle', colors: ['210,180,255', '235,220,255'], density: 2.4, sizeMin: 0.6, sizeMax: 1.6 }),
  s({ id: 'glitter-green', label: '翠閃粉', kind: 'dynamic', category: '慶祝', base: 'linear-gradient(180deg,#0e1e14,#08120c)', behavior: 'twinkle', shape: 'circle', colors: ['170,255,200', '225,255,235'], density: 2.4, sizeMin: 0.6, sizeMax: 1.6 }),
  s({ id: 'gold-rise-dense', label: '金粉盛', kind: 'dynamic', category: '慶祝', base: DUSK, behavior: 'rise', shape: 'circle', colors: ['255,215,130', '255,235,180'], density: 2.2, speed: 0.9, sizeMin: 1, sizeMax: 3 }),
  s({ id: 'streamers-gold', label: '金緞帶', kind: 'dynamic', category: '慶祝', base: 'linear-gradient(180deg,#1e1a10,#100c06)', behavior: 'fall', shape: 'streak', colors: ['255,215,150', '255,235,190'], density: 1, speed: 1, sizeMin: 8, sizeMax: 16 }),
  s({ id: 'streamers-rose', label: '玫瑰緞帶', kind: 'dynamic', category: '慶祝', base: 'linear-gradient(180deg,#1e1018,#100810)', behavior: 'fall', shape: 'streak', colors: ['255,150,190', '255,190,215'], density: 1, speed: 1, sizeMin: 8, sizeMax: 16 }),
  s({ id: 'streamers-neon', label: '霓虹緞帶', kind: 'dynamic', category: '慶祝', base: 'linear-gradient(180deg,#120a20,#080512)', behavior: 'fall', shape: 'streak', colors: ['120,255,220', '255,120,220', '255,240,120'], density: 1.1, speed: 1.1, sizeMin: 8, sizeMax: 16 }),
  s({ id: 'lanterns-rose', label: '玫瑰天燈', kind: 'dynamic', category: '慶祝', base: 'linear-gradient(180deg,#1e1018,#0e080e)', behavior: 'rise', shape: 'circle', colors: ['255,170,200', '255,200,190'], density: 0.6, speed: 0.5, sizeMin: 2, sizeMax: 5 }),
  s({ id: 'lanterns-gold', label: '金天燈', kind: 'dynamic', category: '慶祝', base: 'linear-gradient(180deg,#1e1608,#0e0b05)', behavior: 'rise', shape: 'circle', colors: ['255,215,150', '255,190,120'], density: 0.6, speed: 0.5, sizeMin: 2, sizeMax: 5 }),
  s({ id: 'petals-celebrate', label: '慶典花瓣', kind: 'dynamic', category: '慶祝', base: 'linear-gradient(180deg,#1c1620,#100a14)', behavior: 'fall', shape: 'petal', colors: ['255,180,200', '255,220,150', '200,255,210'], density: 1.2, speed: 1, sizeMin: 4, sizeMax: 9 }),
  s({ id: 'embers-blue', label: '藍燼', kind: 'dynamic', category: '慶祝', base: 'linear-gradient(180deg,#0a1220,#060810)', behavior: 'rise', shape: 'circle', colors: ['150,200,255', '120,170,255'], density: 1.2, speed: 1, sizeMin: 1, sizeMax: 3 }),
  s({ id: 'balloons', label: '氣球升', kind: 'dynamic', category: '慶祝', base: 'linear-gradient(180deg,#181c28,#0e1119)', behavior: 'rise', shape: 'ring', colors: ['255,120,150', '120,200,255', '255,220,120'], density: 0.5, speed: 0.5, sizeMin: 8, sizeMax: 18 }),

  // ── 簡約 +33（中性/粉彩/靄光的低調漂移） ──
  s({ id: 'dust-white', label: '白塵', kind: 'dynamic', category: '簡約', base: 'linear-gradient(180deg,#22252c,#12141a)', behavior: 'wander', shape: 'circle', colors: ['240,242,248'], density: 1.6, speed: 0.35, sizeMin: 0.8, sizeMax: 2.2 }),
  s({ id: 'dust-teal', label: '青塵', kind: 'dynamic', category: '簡約', base: 'linear-gradient(180deg,#122224,#0a1416)', behavior: 'wander', shape: 'circle', colors: ['170,225,220'], density: 1.6, speed: 0.35, sizeMin: 0.8, sizeMax: 2.2 }),
  s({ id: 'dust-violet', label: '紫塵', kind: 'dynamic', category: '簡約', base: 'linear-gradient(180deg,#1e1a28,#0f0c16)', behavior: 'wander', shape: 'circle', colors: ['200,185,235'], density: 1.6, speed: 0.35, sizeMin: 0.8, sizeMax: 2.2 }),
  s({ id: 'dust-green', label: '綠塵', kind: 'dynamic', category: '簡約', base: 'linear-gradient(180deg,#1a2418,#0e140a)', behavior: 'wander', shape: 'circle', colors: ['180,215,180'], density: 1.6, speed: 0.35, sizeMin: 0.8, sizeMax: 2.2 }),
  s({ id: 'dust-amber', label: '琥珀塵', kind: 'dynamic', category: '簡約', base: 'linear-gradient(180deg,#241c10,#130e07)', behavior: 'wander', shape: 'circle', colors: ['235,205,160'], density: 1.6, speed: 0.35, sizeMin: 0.8, sizeMax: 2.2 }),
  s({ id: 'dust-silver', label: '銀塵', kind: 'dynamic', category: '簡約', base: 'linear-gradient(180deg,#20232a,#111318)', behavior: 'wander', shape: 'circle', colors: ['210,215,225'], density: 1.6, speed: 0.35, sizeMin: 0.8, sizeMax: 2.2 }),
  s({ id: 'dust-sky', label: '天藍塵', kind: 'dynamic', category: '簡約', base: 'linear-gradient(180deg,#161e2a,#0b1018)', behavior: 'wander', shape: 'circle', colors: ['185,215,240'], density: 1.6, speed: 0.35, sizeMin: 0.8, sizeMax: 2.2 }),
  s({ id: 'mono-rise', label: '灰升', kind: 'dynamic', category: '簡約', base: 'linear-gradient(180deg,#22252b,#131519)', behavior: 'rise', shape: 'circle', colors: ['195,200,205'], density: 1, speed: 0.6, sizeMin: 1, sizeMax: 3 }),
  s({ id: 'rise-teal', label: '青升', kind: 'dynamic', category: '簡約', base: 'linear-gradient(180deg,#0e2020,#081212)', behavior: 'rise', shape: 'circle', colors: ['170,225,220'], density: 1, speed: 0.6, sizeMin: 1, sizeMax: 3 }),
  s({ id: 'rise-violet', label: '紫升', kind: 'dynamic', category: '簡約', base: 'linear-gradient(180deg,#181428,#0d0a18)', behavior: 'rise', shape: 'circle', colors: ['205,185,240'], density: 1, speed: 0.6, sizeMin: 1, sizeMax: 3 }),
  s({ id: 'rise-gold', label: '金塵升', kind: 'dynamic', category: '簡約', base: 'linear-gradient(180deg,#201a10,#100c06)', behavior: 'rise', shape: 'circle', colors: ['235,210,160'], density: 1, speed: 0.6, sizeMin: 1, sizeMax: 3 }),
  s({ id: 'rise-white', label: '白升', kind: 'dynamic', category: '簡約', base: 'linear-gradient(180deg,#1c1f26,#0f1116)', behavior: 'rise', shape: 'circle', colors: ['238,242,248'], density: 1, speed: 0.6, sizeMin: 1, sizeMax: 3 }),
  s({ id: 'quiet-rain', label: '靜雨', kind: 'dynamic', category: '簡約', base: 'linear-gradient(180deg,#1a1e26,#0f1218)', behavior: 'rain', shape: 'streak', colors: ['190,205,220'], density: 0.7, speed: 0.6, sizeMin: 5, sizeMax: 11 }),
  s({ id: 'fall-blue-calm', label: '澄藍落', kind: 'dynamic', category: '簡約', base: 'linear-gradient(180deg,#141e2a,#0a1016)', behavior: 'fall', shape: 'circle', colors: ['200,220,242'], density: 0.7, speed: 0.5, sizeMin: 1, sizeMax: 2.6 }),
  s({ id: 'quiet-rose', label: '靜玫', kind: 'dynamic', category: '簡約', base: 'linear-gradient(180deg,#221a1e,#120c10)', behavior: 'fall', shape: 'circle', colors: ['245,215,225'], density: 0.7, speed: 0.5, sizeMin: 1, sizeMax: 2.6 }),
  s({ id: 'quiet-mono', label: '靜灰', kind: 'dynamic', category: '簡約', base: 'linear-gradient(180deg,#1e2126,#111318)', behavior: 'fall', shape: 'circle', colors: ['210,213,218'], density: 0.6, speed: 0.5, sizeMin: 1, sizeMax: 2.6 }),
  s({ id: 'mist-mono', label: '灰靄', kind: 'dynamic', category: '簡約', base: 'linear-gradient(180deg,#24272c,#14161a)', behavior: 'wander', shape: 'circle', colors: ['200,203,208'], density: 1.6, speed: 0.3, sizeMin: 1, sizeMax: 2.6 }),
  s({ id: 'mist-teal', label: '青靄', kind: 'dynamic', category: '簡約', base: 'linear-gradient(180deg,#162424,#0d1414)', behavior: 'wander', shape: 'circle', colors: ['175,215,210'], density: 1.5, speed: 0.3, sizeMin: 1, sizeMax: 2.6 }),
  s({ id: 'mist-violet', label: '紫靄', kind: 'dynamic', category: '簡約', base: 'linear-gradient(180deg,#201c28,#100e18)', behavior: 'wander', shape: 'circle', colors: ['200,190,220'], density: 1.5, speed: 0.3, sizeMin: 1, sizeMax: 2.6 }),
  s({ id: 'haze-rose', label: '玫瑰靄', kind: 'dynamic', category: '簡約', base: 'linear-gradient(180deg,#241a1e,#130d11)', behavior: 'wander', shape: 'circle', colors: ['240,205,215'], density: 1.5, speed: 0.3, sizeMin: 0.8, sizeMax: 2.2 }),
  s({ id: 'haze-blue', label: '藍靄', kind: 'dynamic', category: '簡約', base: 'linear-gradient(180deg,#1a2028,#0e1218)', behavior: 'wander', shape: 'circle', colors: ['190,210,232'], density: 1.5, speed: 0.3, sizeMin: 0.8, sizeMax: 2.2 }),
  s({ id: 'haze-green', label: '翠靄', kind: 'dynamic', category: '簡約', base: 'linear-gradient(180deg,#1a241c,#0e140e)', behavior: 'wander', shape: 'circle', colors: ['190,220,195'], density: 1.5, speed: 0.3, sizeMin: 0.8, sizeMax: 2.2 }),
  s({ id: 'drift-cool', label: '冷漂', kind: 'dynamic', category: '簡約', base: 'linear-gradient(180deg,#162028,#0b1016)', behavior: 'wander', shape: 'circle', colors: ['180,210,225'], density: 1.4, speed: 0.3, sizeMin: 0.8, sizeMax: 2.2 }),
  s({ id: 'drift-warm', label: '暖漂', kind: 'dynamic', category: '簡約', base: 'linear-gradient(180deg,#241e16,#13100a)', behavior: 'wander', shape: 'circle', colors: ['235,215,190'], density: 1.4, speed: 0.3, sizeMin: 0.8, sizeMax: 2.2 }),
  s({ id: 'twinkle-mono', label: '灰閃', kind: 'dynamic', category: '簡約', base: 'linear-gradient(180deg,#1e2126,#111318)', behavior: 'twinkle', shape: 'circle', colors: ['210,215,222'], density: 1.4, sizeMin: 0.6, sizeMax: 1.6 }),
  s({ id: 'twinkle-pearl', label: '珍珠閃', kind: 'dynamic', category: '簡約', base: 'linear-gradient(180deg,#20222a,#12141a)', behavior: 'twinkle', shape: 'circle', colors: ['245,240,235', '225,230,245'], density: 1.6, sizeMin: 0.6, sizeMax: 1.6 }),
  s({ id: 'twinkle-sky', label: '天光閃', kind: 'dynamic', category: '簡約', base: 'linear-gradient(180deg,#141e2a,#0a1016)', behavior: 'twinkle', shape: 'circle', colors: ['195,220,245'], density: 1.5, sizeMin: 0.6, sizeMax: 1.6 }),
  s({ id: 'snow-quiet-grey', label: '淡雪', kind: 'dynamic', category: '簡約', base: 'linear-gradient(180deg,#20232a,#12141a)', behavior: 'fall', shape: 'circle', colors: ['225,228,234'], density: 0.6, speed: 0.5, sizeMin: 1, sizeMax: 2.6 }),
  s({ id: 'rise-pastel-warm', label: '暖粉升', kind: 'dynamic', category: '簡約', base: 'linear-gradient(180deg,#221a18,#120c0c)', behavior: 'rise', shape: 'circle', colors: ['255,225,200', '255,205,215'], density: 1, speed: 0.6, sizeMin: 1, sizeMax: 3 }),
  s({ id: 'rise-pastel-cool', label: '冷粉升', kind: 'dynamic', category: '簡約', base: 'linear-gradient(180deg,#141c26,#0a1016)', behavior: 'rise', shape: 'circle', colors: ['200,225,255', '210,255,235'], density: 1, speed: 0.6, sizeMin: 1, sizeMax: 3 }),
  s({ id: 'dust-pearl', label: '珠塵', kind: 'dynamic', category: '簡約', base: 'linear-gradient(180deg,#22242a,#131519)', behavior: 'wander', shape: 'circle', colors: ['238,235,240'], density: 1.6, speed: 0.35, sizeMin: 0.8, sizeMax: 2.2 }),
  s({ id: 'dust-slate', label: '石板塵', kind: 'dynamic', category: '簡約', base: 'linear-gradient(180deg,#1c2028,#0f1218)', behavior: 'wander', shape: 'circle', colors: ['180,188,200'], density: 1.6, speed: 0.35, sizeMin: 0.8, sizeMax: 2.2 }),
  s({ id: 'calm-teal', label: '靜青', kind: 'dynamic', category: '簡約', base: 'linear-gradient(180deg,#0e2020,#081212)', behavior: 'wander', shape: 'circle', colors: ['160,205,205'], density: 1, speed: 0.3, sizeMin: 1, sizeMax: 2.4 }),

  // ── 城市夜景 +50（新分類：以既有粒子引擎營造霓虹/夜雨/窗火/街光氛圍） ──
  // 窗火（twinkle × square）
  s({ id: 'neon-windows', label: '霓虹窗', kind: 'dynamic', category: '城市夜景', base: CITY_BLUE, behavior: 'twinkle', shape: 'square', colors: ['255,220,150', '255,180,120'], density: 1.8, sizeMin: 1.5, sizeMax: 3.5 }),
  s({ id: 'windows-warm', label: '暖窗火', kind: 'dynamic', category: '城市夜景', base: CITY_INK, behavior: 'twinkle', shape: 'square', colors: ['255,210,140'], density: 2, sizeMin: 1.5, sizeMax: 3.5 }),
  s({ id: 'windows-cool', label: '冷窗光', kind: 'dynamic', category: '城市夜景', base: CITY_BLUE, behavior: 'twinkle', shape: 'square', colors: ['170,210,255'], density: 2, sizeMin: 1.5, sizeMax: 3.5 }),
  s({ id: 'windows-mixed', label: '萬家燈', kind: 'dynamic', category: '城市夜景', base: CITY_HAZE, behavior: 'twinkle', shape: 'square', colors: ['255,215,150', '170,210,255', '255,180,190'], density: 2.4, sizeMin: 1.5, sizeMax: 3.5 }),
  s({ id: 'windows-teal', label: '青窗', kind: 'dynamic', category: '城市夜景', base: CITY_TEAL, behavior: 'twinkle', shape: 'square', colors: ['150,235,225'], density: 2, sizeMin: 1.5, sizeMax: 3.5 }),
  s({ id: 'windows-magenta', label: '桃窗', kind: 'dynamic', category: '城市夜景', base: CITY_MAGENTA, behavior: 'twinkle', shape: 'square', colors: ['255,150,210'], density: 2, sizeMin: 1.5, sizeMax: 3.5 }),
  s({ id: 'windows-gold', label: '金窗', kind: 'dynamic', category: '城市夜景', base: CITY_AMBER, behavior: 'twinkle', shape: 'square', colors: ['255,205,120', '255,230,170'], density: 2, sizeMin: 1.5, sizeMax: 3.5 }),
  s({ id: 'skyline-glow', label: '天際燈', kind: 'dynamic', category: '城市夜景', base: CITY_GLOW, behavior: 'twinkle', shape: 'square', colors: ['255,220,160', '200,220,255'], density: 1.4, sizeMin: 1.5, sizeMax: 3.5 }),
  // 霓虹點（twinkle × circle）
  s({ id: 'neon-dots', label: '霓虹點', kind: 'dynamic', category: '城市夜景', base: CITY_INDIGO, behavior: 'twinkle', shape: 'circle', colors: ['120,240,255', '255,120,220'], density: 2.2, sizeMin: 0.8, sizeMax: 2 }),
  s({ id: 'neon-pink', label: '桃紅霓虹', kind: 'dynamic', category: '城市夜景', base: CITY_MAGENTA, behavior: 'twinkle', shape: 'circle', colors: ['255,120,200', '255,170,220'], density: 2, sizeMin: 0.8, sizeMax: 2 }),
  s({ id: 'neon-cyan', label: '青霓虹', kind: 'dynamic', category: '城市夜景', base: CITY_TEAL, behavior: 'twinkle', shape: 'circle', colors: ['120,240,255'], density: 2, sizeMin: 0.8, sizeMax: 2 }),
  s({ id: 'neon-violet', label: '紫霓虹', kind: 'dynamic', category: '城市夜景', base: CITY_INDIGO, behavior: 'twinkle', shape: 'circle', colors: ['190,130,255'], density: 2, sizeMin: 0.8, sizeMax: 2 }),
  s({ id: 'neon-amber', label: '琥珀霓虹', kind: 'dynamic', category: '城市夜景', base: CITY_AMBER, behavior: 'twinkle', shape: 'circle', colors: ['255,190,110'], density: 2, sizeMin: 0.8, sizeMax: 2 }),
  s({ id: 'neon-green', label: '綠霓虹', kind: 'dynamic', category: '城市夜景', base: CITY_TEAL, behavior: 'twinkle', shape: 'circle', colors: ['130,255,170'], density: 2, sizeMin: 0.8, sizeMax: 2 }),
  s({ id: 'neon-mix', label: '霓虹夜', kind: 'dynamic', category: '城市夜景', base: CITY_GLOW, behavior: 'twinkle', shape: 'circle', colors: ['120,240,255', '255,120,200', '255,220,120', '170,255,170'], density: 2.4, sizeMin: 0.8, sizeMax: 2 }),
  s({ id: 'neon-red', label: '赤霓虹', kind: 'dynamic', category: '城市夜景', base: CITY_MAGENTA, behavior: 'twinkle', shape: 'circle', colors: ['255,100,110'], density: 2, sizeMin: 0.8, sizeMax: 2 }),
  s({ id: 'city-sparkle', label: '都會閃', kind: 'dynamic', category: '城市夜景', base: CITY_BLUE, behavior: 'twinkle', shape: 'circle', colors: ['255,225,170', '200,225,255'], density: 2.8, sizeMin: 0.6, sizeMax: 1.8 }),
  // 霓虹夜雨（rain × streak）
  s({ id: 'neon-rain', label: '霓虹夜雨', kind: 'dynamic', category: '城市夜景', base: CITY_INDIGO, behavior: 'rain', shape: 'streak', colors: ['120,235,255', '255,120,220', '255,225,130'], density: 1.6, speed: 1.4, sizeMin: 8, sizeMax: 16 }),
  s({ id: 'rain-neon-pink', label: '桃紅街雨', kind: 'dynamic', category: '城市夜景', base: CITY_MAGENTA, behavior: 'rain', shape: 'streak', colors: ['255,130,200'], density: 1.4, speed: 1.3, sizeMin: 8, sizeMax: 15 }),
  s({ id: 'rain-neon-cyan', label: '青街雨', kind: 'dynamic', category: '城市夜景', base: CITY_TEAL, behavior: 'rain', shape: 'streak', colors: ['120,235,255'], density: 1.4, speed: 1.3, sizeMin: 8, sizeMax: 15 }),
  s({ id: 'rain-neon-gold', label: '琥珀街雨', kind: 'dynamic', category: '城市夜景', base: CITY_AMBER, behavior: 'rain', shape: 'streak', colors: ['255,205,130'], density: 1.4, speed: 1.3, sizeMin: 8, sizeMax: 15 }),
  s({ id: 'rain-neon-violet', label: '紫街雨', kind: 'dynamic', category: '城市夜景', base: CITY_INDIGO, behavior: 'rain', shape: 'streak', colors: ['200,150,255'], density: 1.4, speed: 1.3, sizeMin: 8, sizeMax: 15 }),
  s({ id: 'rain-reflection', label: '濕街反光', kind: 'dynamic', category: '城市夜景', base: CITY_HAZE, behavior: 'rain', shape: 'streak', colors: ['200,220,255', '255,220,180'], density: 1.5, speed: 1.2, sizeMin: 7, sizeMax: 14 }),
  s({ id: 'downpour-neon', label: '霓虹驟雨', kind: 'dynamic', category: '城市夜景', base: CITY_INK, behavior: 'rain', shape: 'streak', colors: ['150,220,255', '255,150,220'], density: 2.6, speed: 1.8, sizeMin: 10, sizeMax: 20 }),
  s({ id: 'drizzle-neon', label: '霓虹細雨', kind: 'dynamic', category: '城市夜景', base: CITY_BLUE, behavior: 'rain', shape: 'streak', colors: ['180,220,255'], density: 0.9, speed: 0.9, sizeMin: 6, sizeMax: 12 }),
  // 街光漂移（wander / rise × circle）
  s({ id: 'city-embers', label: '街燈餘燼', kind: 'dynamic', category: '城市夜景', base: CITY_AMBER, behavior: 'rise', shape: 'circle', colors: ['255,180,110', '255,140,80'], density: 1.2, speed: 1, sizeMin: 1, sizeMax: 3 }),
  s({ id: 'lantern-drift', label: '街燈漂', kind: 'dynamic', category: '城市夜景', base: CITY_INK, behavior: 'wander', shape: 'circle', colors: ['255,200,130'], density: 1.2, speed: 0.5, sizeMin: 1, sizeMax: 2.6 }),
  s({ id: 'neon-drift-cyan', label: '青光漂', kind: 'dynamic', category: '城市夜景', base: CITY_TEAL, behavior: 'wander', shape: 'circle', colors: ['120,235,255'], density: 1.3, speed: 0.5, sizeMin: 1, sizeMax: 2.6 }),
  s({ id: 'neon-drift-pink', label: '桃光漂', kind: 'dynamic', category: '城市夜景', base: CITY_MAGENTA, behavior: 'wander', shape: 'circle', colors: ['255,140,210'], density: 1.3, speed: 0.5, sizeMin: 1, sizeMax: 2.6 }),
  s({ id: 'neon-drift-violet', label: '紫光漂', kind: 'dynamic', category: '城市夜景', base: CITY_INDIGO, behavior: 'wander', shape: 'circle', colors: ['195,140,255'], density: 1.3, speed: 0.5, sizeMin: 1, sizeMax: 2.6 }),
  s({ id: 'street-glow', label: '街光浮', kind: 'dynamic', category: '城市夜景', base: CITY_GLOW, behavior: 'wander', shape: 'circle', colors: ['255,215,160', '200,220,255'], density: 1.4, speed: 0.45, sizeMin: 1, sizeMax: 2.6 }),
  s({ id: 'firefly-city', label: '都會螢', kind: 'dynamic', category: '城市夜景', base: CITY_INK, behavior: 'wander', shape: 'circle', colors: ['200,255,180'], density: 0.9, speed: 0.6, sizeMin: 1.2, sizeMax: 2.6 }),
  s({ id: 'smog-glow', label: '霓虹煙靄', kind: 'dynamic', category: '城市夜景', base: CITY_HAZE, behavior: 'wander', shape: 'circle', colors: ['210,180,220'], density: 1.6, speed: 0.3, sizeMin: 1, sizeMax: 2.8 }),
  s({ id: 'sodium-haze', label: '鈉燈靄', kind: 'dynamic', category: '城市夜景', base: CITY_AMBER, behavior: 'wander', shape: 'circle', colors: ['255,200,140'], density: 1.6, speed: 0.3, sizeMin: 1, sizeMax: 2.8 }),
  s({ id: 'cyber-motes', label: '賽博塵', kind: 'dynamic', category: '城市夜景', base: CITY_INDIGO, behavior: 'wander', shape: 'circle', colors: ['120,255,235', '255,120,210'], density: 1.8, speed: 0.4, sizeMin: 0.8, sizeMax: 2.2 }),
  s({ id: 'rise-neon-cyan', label: '青光升', kind: 'dynamic', category: '城市夜景', base: CITY_TEAL_GLOW, behavior: 'rise', shape: 'circle', colors: ['120,235,255'], density: 1.2, speed: 0.8, sizeMin: 1, sizeMax: 3 }),
  s({ id: 'rise-neon-pink', label: '桃光升', kind: 'dynamic', category: '城市夜景', base: CITY_ROSE_GLOW, behavior: 'rise', shape: 'circle', colors: ['255,140,210'], density: 1.2, speed: 0.8, sizeMin: 1, sizeMax: 3 }),
  s({ id: 'rise-neon-gold', label: '金光升', kind: 'dynamic', category: '城市夜景', base: CITY_AMBER, behavior: 'rise', shape: 'circle', colors: ['255,205,130'], density: 1.2, speed: 0.8, sizeMin: 1, sizeMax: 3 }),
  s({ id: 'rise-neon-violet', label: '紫光升', kind: 'dynamic', category: '城市夜景', base: CITY_GLOW, behavior: 'rise', shape: 'circle', colors: ['195,140,255'], density: 1.2, speed: 0.8, sizeMin: 1, sizeMax: 3 }),
  s({ id: 'spark-city', label: '街火花', kind: 'dynamic', category: '城市夜景', base: CITY_INK, behavior: 'rise', shape: 'circle', colors: ['255,210,140', '255,160,90'], density: 1.6, speed: 1.5, sizeMin: 0.8, sizeMax: 2.2 }),
  // 霓虹星芒（twinkle × star）
  s({ id: 'neon-star-pink', label: '桃星霓', kind: 'dynamic', category: '城市夜景', base: CITY_MAGENTA, behavior: 'twinkle', shape: 'star', colors: ['255,140,210'], density: 0.9, sizeMin: 1.4, sizeMax: 3.2 }),
  s({ id: 'neon-star-cyan', label: '青星霓', kind: 'dynamic', category: '城市夜景', base: CITY_TEAL, behavior: 'twinkle', shape: 'star', colors: ['120,235,255'], density: 0.9, sizeMin: 1.4, sizeMax: 3.2 }),
  s({ id: 'sign-flicker', label: '招牌閃', kind: 'dynamic', category: '城市夜景', base: CITY_GLOW, behavior: 'twinkle', shape: 'star', colors: ['255,215,150', '255,120,200'], density: 1, sizeMin: 1.4, sizeMax: 3.2 }),
  s({ id: 'neon-sparkle-gold', label: '金霓閃', kind: 'dynamic', category: '城市夜景', base: CITY_AMBER, behavior: 'twinkle', shape: 'circle', colors: ['255,215,140'], density: 2.6, sizeMin: 0.6, sizeMax: 1.8 }),
  // 落燈（fall × circle/square）
  s({ id: 'lights-fall', label: '落燈', kind: 'dynamic', category: '城市夜景', base: CITY_BLUE, behavior: 'fall', shape: 'circle', colors: ['255,215,160', '200,220,255'], density: 1.2, speed: 0.8, sizeMin: 1, sizeMax: 2.8 }),
  s({ id: 'neon-fall-pink', label: '桃燈落', kind: 'dynamic', category: '城市夜景', base: CITY_MAGENTA, behavior: 'fall', shape: 'circle', colors: ['255,150,210'], density: 1.2, speed: 0.8, sizeMin: 1, sizeMax: 2.8 }),
  s({ id: 'neon-fall-cyan', label: '青燈落', kind: 'dynamic', category: '城市夜景', base: CITY_TEAL, behavior: 'fall', shape: 'square', colors: ['120,235,255'], density: 1.3, speed: 1, sizeMin: 2, sizeMax: 4 }),
  s({ id: 'ticker-tape', label: '霓虹紙', kind: 'dynamic', category: '城市夜景', base: CITY_INK, behavior: 'fall', shape: 'square', colors: ['255,120,200', '120,235,255', '255,225,130'], density: 1.5, speed: 1.2, sizeMin: 3, sizeMax: 6 }),
  s({ id: 'city-snow', label: '都會雪', kind: 'dynamic', category: '城市夜景', base: CITY_GLOW, behavior: 'fall', shape: 'circle', colors: ['235,240,255', '255,225,200'], density: 1.2, speed: 0.7, sizeMin: 1, sizeMax: 2.8 }),
  s({ id: 'midnight-haze', label: '子夜靄', kind: 'dynamic', category: '城市夜景', base: CITY_INK, behavior: 'wander', shape: 'circle', colors: ['180,195,225'], density: 1.5, speed: 0.3, sizeMin: 1, sizeMax: 2.6 }),

  // ── 靜態（純 CSS） ──
  { id: 'aurora', label: '極光', kind: 'static', category: '星空宇宙', base: 'linear-gradient(180deg,#0a1024,#0a1024), radial-gradient(60% 40% at 30% 30%,rgba(80,220,180,.35),transparent 70%), radial-gradient(55% 45% at 70% 40%,rgba(120,140,255,.30),transparent 70%), radial-gradient(50% 40% at 50% 70%,rgba(200,120,220,.25),transparent 70%)' },
  { id: 'dots', label: '圓點', kind: 'static', category: '簡約', base: 'radial-gradient(rgba(255,255,255,.16) 1.5px, transparent 1.6px) 0 0/22px 22px, linear-gradient(180deg,#20242e,#171a22)' },
  { id: 'grid', label: '格線', kind: 'static', category: '簡約', base: 'linear-gradient(rgba(255,255,255,.10) 1px, transparent 1px) 0 0/28px 28px, linear-gradient(90deg,rgba(255,255,255,.10) 1px, transparent 1px) 0 0/28px 28px, linear-gradient(180deg,#1c2029,#141821)' },
  { id: 'diagonal', label: '斜紋', kind: 'static', category: '簡約', base: 'repeating-linear-gradient(45deg,rgba(255,255,255,.06) 0 10px,transparent 10px 20px), linear-gradient(180deg,#222634,#14171f)' },
  { id: 'bokeh', label: '光斑', kind: 'static', category: '簡約', base: 'radial-gradient(circle at 20% 30%,rgba(255,220,180,.25),transparent 12%), radial-gradient(circle at 70% 60%,rgba(180,200,255,.22),transparent 14%), radial-gradient(circle at 45% 80%,rgba(255,180,220,.20),transparent 12%), linear-gradient(180deg,#171a26,#0e1018)' },
  { id: 'mesh', label: '網格光暈', kind: 'static', category: '簡約', base: 'radial-gradient(40% 50% at 20% 20%,rgba(120,200,255,.35),transparent 70%), radial-gradient(40% 50% at 80% 30%,rgba(255,150,200,.30),transparent 70%), radial-gradient(50% 50% at 50% 90%,rgba(150,255,200,.25),transparent 70%), #0d1018' },
  { id: 'sunburst', label: '晨曦', kind: 'static', category: '天氣', base: 'radial-gradient(circle at 50% 28%,rgba(255,220,150,.40),transparent 55%), linear-gradient(180deg,#2a1e14,#140d08)' },
  { id: 'waves', label: '波紋', kind: 'static', category: '自然', base: 'repeating-linear-gradient(180deg,rgba(255,255,255,.05) 0 12px,transparent 12px 24px), linear-gradient(180deg,#12233a,#0a1420)' },
  { id: 'nebula', label: '星雲', kind: 'static', category: '星空宇宙', base: 'radial-gradient(50% 40% at 25% 30%,rgba(200,120,255,.35),transparent 70%), radial-gradient(45% 40% at 75% 60%,rgba(120,180,255,.30),transparent 70%), radial-gradient(40% 40% at 50% 85%,rgba(255,140,200,.25),transparent 70%), #0a0714' },
  { id: 'sky-day', label: '晴空', kind: 'static', category: '天氣', base: 'radial-gradient(circle at 50% 120%,rgba(255,255,255,.35),transparent 45%), linear-gradient(180deg,#7fb4e8,#cfe6f7)' },

  // ════════ #55 內建背景擴充批次（各分類 +8，動態＋靜態）════════

  // ── 天氣 +8 ──
  s({ id: 'mist-drift', label: '流霧', kind: 'dynamic', category: '天氣', base: 'linear-gradient(180deg,#2c333c,#191d24)', behavior: 'wander', shape: 'circle', colors: ['210,220,230'], density: 1.8, speed: 0.25, sizeMin: 2, sizeMax: 5 }),
  { id: 'rainbow-mist', label: '虹霧', kind: 'static', category: '天氣', base: 'linear-gradient(180deg,rgba(255,120,140,.25),rgba(255,220,130,.22),rgba(140,220,160,.22),rgba(130,180,255,.24)), linear-gradient(180deg,#20242e,#141821)' },
  { id: 'cloud-soft', label: '軟雲', kind: 'static', category: '天氣', base: 'radial-gradient(60% 40% at 30% 65%,rgba(255,255,255,.5),transparent 70%), radial-gradient(55% 40% at 70% 72%,rgba(255,255,255,.42),transparent 72%), linear-gradient(180deg,#9cc3e8,#d9ebf7)' },

  // ── 星空宇宙 +8 ──
  s({ id: 'comet-blue', label: '藍彗', kind: 'dynamic', category: '星空宇宙', base: 'radial-gradient(circle at 50% 20%,#111d3a,#04060e)', behavior: 'fall', shape: 'streak', colors: ['150,200,255'], density: 0.4, speed: 2, sizeMin: 10, sizeMax: 20 }),
  s({ id: 'starfall-gold', label: '金星墜', kind: 'dynamic', category: '星空宇宙', base: NIGHT, behavior: 'fall', shape: 'star', colors: ['255,235,170'], density: 0.8, speed: 1.1, sizeMin: 1.5, sizeMax: 3.4 }),
  { id: 'aurora-green', label: '綠極光', kind: 'static', category: '星空宇宙', base: 'linear-gradient(180deg,#04101a,#04101a), radial-gradient(60% 45% at 35% 35%,rgba(80,230,160,.4),transparent 70%), radial-gradient(55% 45% at 70% 45%,rgba(120,220,140,.3),transparent 70%)' },

  // ── 自然 +8 ──
  s({ id: 'dandelion', label: '蒲公英', kind: 'dynamic', category: '自然', base: 'linear-gradient(180deg,#cbe0c0,#e8f2e0)', behavior: 'rise', shape: 'circle', colors: ['255,255,255'], density: 0.9, speed: 0.5, sizeMin: 1.5, sizeMax: 3.2 }),
  s({ id: 'petals-rose', label: '玫瑰瓣', kind: 'dynamic', category: '自然', base: 'linear-gradient(180deg,#3a1a24,#1c0d12)', behavior: 'petal', shape: 'petal', colors: ['235,90,120', '255,140,160'], density: 1.1, speed: 0.9, sizeMin: 4, sizeMax: 9 }),
  s({ id: 'ocean-foam', label: '浪沫', kind: 'dynamic', category: '自然', base: DEEPSEA, behavior: 'rise', shape: 'circle', colors: ['200,235,255', '255,255,255'], density: 1.3, speed: 0.6, sizeMin: 1.5, sizeMax: 4 }),
  s({ id: 'snow-blossom', label: '雪花瓣', kind: 'dynamic', category: '自然', base: 'linear-gradient(180deg,#20303a,#0e161c)', behavior: 'petal', shape: 'petal', colors: ['235,245,255'], density: 1.2, speed: 0.7, sizeMin: 4, sizeMax: 8 }),
  s({ id: 'spore-glow', label: '孢光', kind: 'dynamic', category: '自然', base: 'linear-gradient(180deg,#10231c,#06120d)', behavior: 'wander', shape: 'circle', colors: ['160,255,210'], density: 0.9, speed: 0.5, sizeMin: 1.2, sizeMax: 2.8 }),
  { id: 'moss', label: '苔綠', kind: 'static', category: '自然', base: 'radial-gradient(rgba(120,180,90,.18) 2px,transparent 2.4px) 0 0/16px 16px, linear-gradient(180deg,#1a2c16,#0e180b)' },
  { id: 'hills', label: '遠山', kind: 'static', category: '自然', base: 'radial-gradient(120% 60% at 50% 120%,rgba(90,140,90,.5),transparent 60%), radial-gradient(120% 50% at 20% 130%,rgba(60,110,70,.5),transparent 60%), linear-gradient(180deg,#bcd8e0,#e6f2ee)' },

  // ── 慶祝 +8 ──
  s({ id: 'confetti-rise', label: '彩紙升', kind: 'dynamic', category: '慶祝', base: 'linear-gradient(180deg,#241a2e,#120c18)', behavior: 'rise', shape: 'square', colors: ['255,120,160', '120,220,255', '255,225,120', '160,255,180'], density: 1.6, speed: 1, sizeMin: 3, sizeMax: 6 }),
  s({ id: 'streamers-cyan', label: '青彩帶', kind: 'dynamic', category: '慶祝', base: 'linear-gradient(180deg,#0e2630,#061318)', behavior: 'fall', shape: 'streak', colors: ['120,235,255', '160,255,220'], density: 1.4, speed: 1.1, sizeMin: 6, sizeMax: 14 }),
  s({ id: 'sparkle-pink', label: '桃花火', kind: 'dynamic', category: '慶祝', base: 'linear-gradient(180deg,#2e1226,#160812)', behavior: 'twinkle', shape: 'star', colors: ['255,150,210', '255,190,230'], density: 1.8, sizeMin: 1.5, sizeMax: 3.6 }),
  s({ id: 'balloon-drift', label: '氣球飄', kind: 'dynamic', category: '慶祝', base: 'linear-gradient(180deg,#1c2440,#0c1020)', behavior: 'rise', shape: 'circle', colors: ['255,140,160', '150,200,255', '255,220,140'], density: 0.6, speed: 0.4, sizeMin: 4, sizeMax: 9 }),
  { id: 'fireworks-still', label: '花火', kind: 'static', category: '慶祝', base: 'radial-gradient(circle at 30% 30%,rgba(255,180,120,.4),transparent 12%), radial-gradient(circle at 70% 35%,rgba(150,200,255,.4),transparent 12%), radial-gradient(circle at 50% 60%,rgba(255,140,200,.4),transparent 12%), linear-gradient(180deg,#0c0a1a,#050409)' },
  { id: 'ribbon-glow', label: '緞帶光', kind: 'static', category: '慶祝', base: 'repeating-linear-gradient(45deg,rgba(255,180,120,.14) 0 8px,transparent 8px 18px), repeating-linear-gradient(-45deg,rgba(150,200,255,.12) 0 8px,transparent 8px 18px), linear-gradient(180deg,#1a1426,#0c0814)' },

  // ── 簡約 +8 ──
  s({ id: 'dust-slow', label: '慢塵', kind: 'dynamic', category: '簡約', base: 'linear-gradient(180deg,#242832,#16191f)', behavior: 'wander', shape: 'circle', colors: ['255,255,255'], density: 1.2, speed: 0.2, sizeMin: 0.8, sizeMax: 1.8 }),
  s({ id: 'rise-mono', label: '素氣泡', kind: 'dynamic', category: '簡約', base: 'linear-gradient(180deg,#1e222b,#12151b)', behavior: 'rise', shape: 'ring', colors: ['255,255,255'], density: 1, speed: 0.5, sizeMin: 2, sizeMax: 5 }),
  { id: 'linen', label: '亞麻', kind: 'static', category: '簡約', base: 'repeating-linear-gradient(0deg,rgba(255,255,255,.04) 0 2px,transparent 2px 4px), repeating-linear-gradient(90deg,rgba(255,255,255,.04) 0 2px,transparent 2px 4px), linear-gradient(180deg,#242732,#191c24)' },
  { id: 'halftone', label: '半調', kind: 'static', category: '簡約', base: 'radial-gradient(rgba(255,255,255,.12) 2.4px,transparent 2.6px) 0 0/16px 16px, linear-gradient(135deg,#232733,#161a22)' },
  { id: 'gradient-peach', label: '蜜桃', kind: 'static', category: '簡約', base: 'linear-gradient(160deg,#ffd9c4,#ffb9cf,#e7b8ff)' },
  { id: 'gradient-mint', label: '薄荷', kind: 'static', category: '簡約', base: 'linear-gradient(160deg,#c6f2e0,#b9e0f0,#d2d6ff)' },
  { id: 'concentric', label: '同心', kind: 'static', category: '簡約', base: 'repeating-radial-gradient(circle at 50% 50%,rgba(255,255,255,.06) 0 10px,transparent 10px 20px), linear-gradient(180deg,#1f232d,#141821)' },
  { id: 'soft-blur', label: '柔暈', kind: 'static', category: '簡約', base: 'radial-gradient(50% 50% at 35% 30%,rgba(180,200,255,.28),transparent 70%), radial-gradient(50% 50% at 70% 70%,rgba(255,200,220,.24),transparent 70%), #14171f' },

  // ── 城市夜景 +8 ──
  s({ id: 'rain-window', label: '雨窗', kind: 'dynamic', category: '城市夜景', base: CITY_HAZE, behavior: 'rain', shape: 'streak', colors: ['160,200,235', '255,200,150'], density: 1.6, speed: 1.2, sizeMin: 6, sizeMax: 14 }),
  s({ id: 'neon-rise', label: '霓虹升', kind: 'dynamic', category: '城市夜景', base: CITY_INDIGO, behavior: 'rise', shape: 'circle', colors: ['120,235,255', '255,120,200'], density: 1.2, speed: 0.6, sizeMin: 1.5, sizeMax: 3.6 }),
  s({ id: 'lantern-rise', label: '天燈', kind: 'dynamic', category: '城市夜景', base: CITY_ROSE_GLOW, behavior: 'rise', shape: 'square', colors: ['255,190,120', '255,150,100'], density: 0.7, speed: 0.4, sizeMin: 3, sizeMax: 6 }),
  s({ id: 'traffic-streak', label: '車流', kind: 'dynamic', category: '城市夜景', base: CITY_INK, behavior: 'rain', shape: 'streak', colors: ['255,120,90', '255,225,150'], density: 1.3, speed: 1.6, sizeMin: 8, sizeMax: 18 }),
  s({ id: 'star-city', label: '城市星', kind: 'dynamic', category: '城市夜景', base: CITY_GLOW, behavior: 'twinkle', shape: 'circle', colors: ['255,230,180', '200,220,255'], density: 1.6, sizeMin: 0.8, sizeMax: 2 }),
  s({ id: 'glow-pulse', label: '光暈脈', kind: 'dynamic', category: '城市夜景', base: CITY_TEAL_GLOW, behavior: 'twinkle', shape: 'ring', colors: ['120,235,255'], density: 0.8, sizeMin: 2, sizeMax: 5 }),
  { id: 'skyline', label: '天際線', kind: 'static', category: '城市夜景', base: 'linear-gradient(180deg,transparent 55%,rgba(10,14,30,.9) 56%), radial-gradient(circle at 20% 60%,rgba(255,220,150,.5),transparent 6%), radial-gradient(circle at 60% 62%,rgba(150,200,255,.45),transparent 6%), linear-gradient(180deg,#12204a,#070a18)' },
  { id: 'fog-city', label: '都會霧', kind: 'static', category: '城市夜景', base: 'linear-gradient(180deg,rgba(120,140,180,.25),transparent 60%), radial-gradient(60% 40% at 50% 90%,rgba(255,210,150,.3),transparent 70%), linear-gradient(180deg,#141a2a,#080b14)' },
]

export function getScene(id: string | null | undefined): SceneDef | null {
  if (!id) return null
  return SCENES.find((sc) => sc.id === id) ?? null
}

/** 場景清單（給選擇器分組）。 */
export const DYNAMIC_SCENES = SCENES.filter((sc) => sc.kind === 'dynamic')
export const STATIC_SCENES = SCENES.filter((sc) => sc.kind === 'static')

/** 取某分類下的所有場景（「背景商店」分頁用）。 */
export function scenesByCategory(category: SceneCategory): SceneDef[] {
  return SCENES.filter((sc) => sc.category === category)
}
