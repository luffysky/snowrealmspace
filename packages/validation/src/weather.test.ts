import { describe, it, expect } from 'vitest'
import {
  weatherCodeToCondition,
  conditionToContentTags,
  weatherCitySchema,
  weatherLookupSchema,
  TYPHOON_WIND_KMH,
  type WeatherCondition,
} from './weather.js'

describe('weatherCodeToCondition', () => {
  it('晴：0 與 1 都是 clear', () => {
    expect(weatherCodeToCondition(0, 5)).toBe('clear')
    expect(weatherCodeToCondition(1, 5)).toBe('clear')
  })

  it('多雲 / 陰：2、3 是 cloudy', () => {
    expect(weatherCodeToCondition(2, 5)).toBe('cloudy')
    expect(weatherCodeToCondition(3, 5)).toBe('cloudy')
  })

  it('霧：45、48', () => {
    expect(weatherCodeToCondition(45, 5)).toBe('fog')
    expect(weatherCodeToCondition(48, 5)).toBe('fog')
  })

  it('毛毛雨：51–57', () => {
    for (const c of [51, 53, 55, 56, 57]) expect(weatherCodeToCondition(c, 5)).toBe('drizzle')
  })

  it('雨：61–67 與陣雨 80–82', () => {
    for (const c of [61, 63, 65, 66, 67, 80, 81, 82]) expect(weatherCodeToCondition(c, 5)).toBe('rain')
  })

  it('雪：71–77 與陣雪 85、86', () => {
    for (const c of [71, 73, 75, 77, 85, 86]) expect(weatherCodeToCondition(c, 5)).toBe('snow')
  })

  it('雷雨：95、96、99', () => {
    for (const c of [95, 96, 99]) expect(weatherCodeToCondition(c, 5)).toBe('thunder')
  })

  it('雨/雷 + 高風速 → 颱風', () => {
    expect(weatherCodeToCondition(65, TYPHOON_WIND_KMH)).toBe('typhoon')
    expect(weatherCodeToCondition(82, 120)).toBe('typhoon')
    expect(weatherCodeToCondition(95, 100)).toBe('typhoon')
  })

  it('晴天再大風也不是颱風（沒有降水結構）', () => {
    expect(weatherCodeToCondition(0, 150)).toBe('clear')
  })

  it('雪配高風速不升級成颱風（維持 snow）', () => {
    expect(weatherCodeToCondition(75, 150)).toBe('snow')
  })

  it('風速門檻是「達到即升級」', () => {
    expect(weatherCodeToCondition(65, TYPHOON_WIND_KMH - 1)).toBe('rain')
    expect(weatherCodeToCondition(65, TYPHOON_WIND_KMH)).toBe('typhoon')
  })

  it('未知代碼與 NaN 風速安全降級', () => {
    expect(weatherCodeToCondition(999, 5)).toBe('clear')
    expect(weatherCodeToCondition(65, Number.NaN)).toBe('rain')
  })
})

describe('conditionToContentTags', () => {
  const cases: [WeatherCondition, string][] = [
    ['clear', 'sunny'],
    ['cloudy', 'cloudy'],
    ['fog', 'foggy'],
    ['drizzle', 'rainy'],
    ['rain', 'rainy'],
    ['snow', 'snowy'],
    ['thunder', 'thunder'],
    ['typhoon', 'typhoon'],
  ]
  it.each(cases)('%s → %s', (condition, tag) => {
    expect(conditionToContentTags(condition, 20)).toContain(tag)
  })

  it('低溫加 cold、高溫加 hot、常溫都不加', () => {
    expect(conditionToContentTags('clear', 5)).toEqual(['sunny', 'cold'])
    expect(conditionToContentTags('clear', 35)).toEqual(['sunny', 'hot'])
    expect(conditionToContentTags('clear', 20)).toEqual(['sunny'])
  })

  it('產出的 tag 皆為合法 slug', () => {
    for (const [condition] of cases) {
      for (const tag of conditionToContentTags(condition, -5)) {
        expect(tag).toMatch(/^[a-z0-9_]+$/)
      }
    }
  })
})

describe('weatherCitySchema', () => {
  it('修剪並保留城市名', () => {
    expect(weatherCitySchema.parse('  台北  ')).toBe('台北')
  })
  it('空字串 → null', () => {
    expect(weatherCitySchema.parse('   ')).toBeNull()
    expect(weatherCitySchema.parse(null)).toBeNull()
  })
  it('超過 80 字報錯', () => {
    expect(weatherCitySchema.safeParse('a'.repeat(81)).success).toBe(false)
  })
})

describe('weatherLookupSchema', () => {
  it('只有城市 OK', () => {
    expect(weatherLookupSchema.safeParse({ city: '東京' }).success).toBe(true)
  })
  it('只有座標 OK', () => {
    expect(weatherLookupSchema.safeParse({ lat: 25.03, lon: 121.56 }).success).toBe(true)
  })
  it('兩者皆無 → 失敗', () => {
    expect(weatherLookupSchema.safeParse({}).success).toBe(false)
    expect(weatherLookupSchema.safeParse({ city: '' }).success).toBe(false)
  })
  it('座標超範圍 → 失敗', () => {
    expect(weatherLookupSchema.safeParse({ lat: 999, lon: 0 }).success).toBe(false)
  })
})
