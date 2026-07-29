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
export type SceneCategory = '天氣' | '星空宇宙' | '自然' | '慶祝' | '簡約'

/** 分頁顯示順序（同時是「有哪些分類」的真相來源）。 */
export const SCENE_CATEGORIES: readonly SceneCategory[] = ['天氣', '星空宇宙', '自然', '慶祝', '簡約']

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
