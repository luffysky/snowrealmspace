import { SCENES, type SceneCategory } from '@/lib/scenes'
import { LOTTIE_SCENES } from '@/lib/lottie-scenes'

/** 商店 Lottie 分頁的字面值（與 BackgroundStudio 的 GalleryTab 一致）。 */
export const LOTTIE_TAB = 'Lottie'

/**
 * #55 背景套件（Pack）。
 *
 * 背景商店把內建場景／Lottie 依「套件」分組（＝分類 + 一個 Lottie 套件）。
 * 每個 space 記錄自己「已取得」哪些套件（存 localStorage，per space）：
 *   - 未取得：可預覽整個套件的每張背景，但不能套用（未下載可預覽）。
 *   - 取得後：該套件的背景才能加入你的空間（下載後套用）。
 *
 * 這不是假的網路下載 —— 資產本來就在，而是「把套件收進你的空間」的真實狀態，
 * 呼應「會隨長期使用而成長的私人空間」：慢慢蒐集、解鎖更多背景。
 * （跨裝置同步之後可再搬到 space_settings；目前 per 裝置。）
 */

export type ScenePack = {
  id: string
  label: string
  /** procedural 套件對應一個分類；Lottie 套件為 null。 */
  category: SceneCategory | null
  kind: 'scenes' | 'lottie'
  /** 封面場景 id（未取得時的代表預覽）。 */
  cover: string
}

export const SCENE_PACKS: ScenePack[] = [
  { id: 'minimal', label: '簡約', category: '簡約', kind: 'scenes', cover: 'mesh' },
  { id: 'weather', label: '天氣', category: '天氣', kind: 'scenes', cover: 'snow-soft' },
  { id: 'nature', label: '自然', category: '自然', kind: 'scenes', cover: 'sakura' },
  { id: 'starry', label: '星空宇宙', category: '星空宇宙', kind: 'scenes', cover: 'galaxy' },
  { id: 'celebrate', label: '慶祝', category: '慶祝', kind: 'scenes', cover: 'confetti-rise' },
  { id: 'city', label: '城市夜景', category: '城市夜景', kind: 'scenes', cover: 'lights-fall' },
  { id: 'lottie', label: 'Lottie 動畫', category: null, kind: 'lottie', cover: LOTTIE_SCENES[0]?.id ?? '' },
]

/** 新空間預設已取得的套件（先給幾個日常的，其餘慢慢收集）。 */
export const DEFAULT_OBTAINED = ['minimal', 'weather', 'nature']

const CATEGORY_TO_PACK = new Map<string, string>(
  SCENE_PACKS.filter((p) => p.category).map((p) => [p.category as string, p.id]),
)

/** 商店分頁（'全部' | 分類 | 'Lottie'）對應的套件 id；'全部' 回 null。 */
export function packForTab(tab: string): string | null {
  if (tab === '全部') return null
  if (tab === LOTTIE_TAB) return 'lottie'
  return CATEGORY_TO_PACK.get(tab) ?? null
}

export function getPack(id: string): ScenePack | undefined {
  return SCENE_PACKS.find((p) => p.id === id)
}

/** 某套件包含幾張背景。 */
export function packSize(pack: ScenePack): number {
  if (pack.kind === 'lottie') return LOTTIE_SCENES.length
  return SCENES.filter((s) => s.category === pack.category).length
}

/** localStorage key（per space）。 */
export function packsStorageKey(spaceId: string): string {
  return `sr:bg-packs:${spaceId}`
}
