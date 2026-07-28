/**
 * 二十四節氣。用來讓「季節·節氣語」隨日期換 —— 節氣內容不像每日金句是隨機輪替，
 * 而是**依當天落在哪個節氣**挑對應的一則（09-content-pool.md）。
 *
 * 節氣的公曆日期每年會 ±1 天，這裡用固定近似日期（夠好；不做天文計算）。
 * 選取時：先找 tags 含「節氣 slug」的內容，沒有再退而找「季節 slug」，都沒有才用整池。
 */

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

export type SolarTerm = {
  /** 節氣 slug（拼音，供內容 tag 對應） */
  slug: string
  /** 節氣中文名 */
  name: string
  season: Season
  /** 季節中文（春/夏/秋/冬） */
  seasonName: string
}

// 依公曆順序（1 月→12 月）。日期為近似起始日。
const TERMS: readonly { m: number; d: number; slug: string; name: string; season: Season }[] = [
  { m: 1, d: 6, slug: 'xiaohan', name: '小寒', season: 'winter' },
  { m: 1, d: 20, slug: 'dahan', name: '大寒', season: 'winter' },
  { m: 2, d: 4, slug: 'lichun', name: '立春', season: 'spring' },
  { m: 2, d: 19, slug: 'yushui', name: '雨水', season: 'spring' },
  { m: 3, d: 6, slug: 'jingzhe', name: '驚蟄', season: 'spring' },
  { m: 3, d: 21, slug: 'chunfen', name: '春分', season: 'spring' },
  { m: 4, d: 5, slug: 'qingming', name: '清明', season: 'spring' },
  { m: 4, d: 20, slug: 'guyu', name: '穀雨', season: 'spring' },
  { m: 5, d: 6, slug: 'lixia', name: '立夏', season: 'summer' },
  { m: 5, d: 21, slug: 'xiaoman', name: '小滿', season: 'summer' },
  { m: 6, d: 6, slug: 'mangzhong', name: '芒種', season: 'summer' },
  { m: 6, d: 21, slug: 'xiazhi', name: '夏至', season: 'summer' },
  { m: 7, d: 7, slug: 'xiaoshu', name: '小暑', season: 'summer' },
  { m: 7, d: 23, slug: 'dashu', name: '大暑', season: 'summer' },
  { m: 8, d: 8, slug: 'liqiu', name: '立秋', season: 'autumn' },
  { m: 8, d: 23, slug: 'chushu', name: '處暑', season: 'autumn' },
  { m: 9, d: 8, slug: 'bailu', name: '白露', season: 'autumn' },
  { m: 9, d: 23, slug: 'qiufen', name: '秋分', season: 'autumn' },
  { m: 10, d: 8, slug: 'hanlu', name: '寒露', season: 'autumn' },
  { m: 10, d: 24, slug: 'shuangjiang', name: '霜降', season: 'autumn' },
  { m: 11, d: 8, slug: 'lidong', name: '立冬', season: 'winter' },
  { m: 11, d: 22, slug: 'xiaoxue', name: '小雪', season: 'winter' },
  { m: 12, d: 7, slug: 'daxue', name: '大雪', season: 'winter' },
  { m: 12, d: 22, slug: 'dongzhi', name: '冬至', season: 'winter' },
]

const SEASON_NAME: Record<Season, string> = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' }

/** 傳入月（1-12）日（1-31），回傳當天所屬的節氣。1/1–1/5 落在上一年的冬至。 */
export function solarTermFor(month: number, day: number): SolarTerm {
  // 預設冬至（涵蓋 1/1–1/5，早於當年第一個節氣「小寒」）
  let cur = TERMS[TERMS.length - 1]!
  for (const t of TERMS) {
    if (month > t.m || (month === t.m && day >= t.d)) cur = t
    else break
  }
  return { slug: cur.slug, name: cur.name, season: cur.season, seasonName: SEASON_NAME[cur.season] }
}

export type SeasonalRow = { text: string; tags: string[] | null }

/**
 * 純函式：從 seasonal 列決定性挑一則（#49 天氣感知）。抽成純函式的理由同 daily-select ——
 * 選錯在真實環境無法重現，只能靠測試守；DB 讀取留在 service，這裡只做「給定列、節氣、天氣 tag、seed → 選一則」。
 *
 * 優先序：
 *   1. 天氣：tags 與當前天氣 tag（rainy/snowy/sunny/cold/hot…）有交集的列 —— 讓本來只依節氣過濾、
 *      長年選不到的 ~1700 則天氣 seasonal 內容真的被選中。
 *   2. 節氣 slug；3. 季節 slug；4. 整池。
 * 無天氣 tag 或無相交列時，退回與原本相同的純節氣行為。決定性：同 seed 同輸出。
 */
export function selectSeasonal(
  rows: readonly SeasonalRow[],
  term: SolarTerm,
  weatherTags: readonly string[],
  seed: string,
  hashToUnit: (s: string) => number,
): { text: string } | null {
  if (rows.length === 0) return null

  const byWeather =
    weatherTags.length > 0
      ? rows.filter((r) => (r.tags ?? []).some((t) => weatherTags.includes(t)))
      : []
  const bySlug = rows.filter((r) => (r.tags ?? []).includes(term.slug))
  const bySeason = rows.filter((r) => (r.tags ?? []).includes(term.season))
  const pool =
    byWeather.length > 0
      ? byWeather
      : bySlug.length > 0
        ? bySlug
        : bySeason.length > 0
          ? bySeason
          : rows

  const idx = Math.floor(hashToUnit(seed) * pool.length)
  const picked = pool[idx] ?? pool[0]!
  return { text: picked.text }
}
