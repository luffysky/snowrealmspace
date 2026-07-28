import { describe, it, expect } from 'vitest'
import { TW_REGIONS } from './tw-regions.js'

describe('TW_REGIONS', () => {
  it('剛好 22 個縣市，且無重複、無空區清單', () => {
    expect(TW_REGIONS).toHaveLength(22)
    const cities = TW_REGIONS.map((r) => r.city)
    expect(new Set(cities).size).toBe(22) // 縣市不重複
    for (const r of TW_REGIONS) {
      expect(r.districts.length).toBeGreaterThan(0)
      // 同一縣市內的區不重複
      expect(new Set(r.districts).size).toBe(r.districts.length)
    }
  })

  it('採官方用字（臺，非台）', () => {
    const cities = TW_REGIONS.map((r) => r.city)
    expect(cities).toContain('臺北市')
    expect(cities).toContain('臺中市')
    expect(cities).toContain('臺南市')
    expect(cities).not.toContain('台北市')
  })

  it('已知對照正確', () => {
    const byCity = (c: string) => TW_REGIONS.find((r) => r.city === c)
    expect(byCity('新北市')?.districts).toContain('板橋區')
    expect(byCity('新北市')?.districts).toContain('烏來區')
    expect(byCity('新北市')?.districts).toHaveLength(29)
    expect(byCity('臺北市')?.districts).toHaveLength(12)
    expect(byCity('連江縣')?.districts).toEqual(['南竿鄉', '北竿鄉', '莒光鄉', '東引鄉'])
    expect(byCity('嘉義市')?.districts).toEqual(['東區', '西區'])
  })

  it('含 6 直轄市與 3 外島縣', () => {
    const cities = new Set(TW_REGIONS.map((r) => r.city))
    for (const c of ['臺北市', '新北市', '桃園市', '臺中市', '臺南市', '高雄市']) {
      expect(cities.has(c)).toBe(true)
    }
    for (const c of ['澎湖縣', '金門縣', '連江縣']) {
      expect(cities.has(c)).toBe(true)
    }
  })
})
