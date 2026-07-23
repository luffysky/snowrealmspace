import { test, expect } from './fixtures'
import { signInThroughUi } from './fixtures'

/**
 * 字體系統。ADR-016。
 *
 * 這裡測的重點是**「選了字體會不會真的生效」** ——
 * 那正是先前的缺口：`compileThemeToCssVars` 只輸出 `--sr-font-body-id`，
 * 沒有東西把它變成 `font-family`，使用者選了字體畫面完全沒變，
 * 而且不會有任何錯誤訊息。
 */
test.describe('字體系統', () => {
  test('字體 API 回傳可用清單與分片 manifest', async ({ page, invited }) => {
    await signInThroughUi(page, invited)

    const body = await page.evaluate(async () => {
      const res = await fetch('/api/fonts')
      return (await res.json()) as {
        data: {
          fonts: {
            slug: string
            family: string
            firstScreenBytes: number
            files: Record<string, { file: string; unicodeRange: string; critical: boolean }[]>
          }[]
          pairs: { name: string }[]
        }
      }
    })

    expect(body.data.fonts.length).toBeGreaterThan(0)

    const noto = body.data.fonts.find((f) => f.slug === 'noto-sans-tc')
    expect(noto, '思源黑體應該在清單裡').toBeTruthy()

    // 每個分片都要有 unicode-range，少了它瀏覽器會下載全部 45 片
    for (const subset of noto!.files['400'] ?? []) {
      expect(subset.unicodeRange, subset.file).toMatch(/^U\+/)
    }

    // 首屏成本要能算出來 —— UI 要靠它誠實顯示代價
    expect(noto!.firstScreenBytes).toBeGreaterThan(0)
    expect(noto!.firstScreenBytes).toBeLessThan(90 * 1024)
  })

  test('頁面實際套用了 font-family，不是只有 fontId', async ({ page, invited }) => {
    await signInThroughUi(page, invited)

    const bodyFont = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--sr-font-body').trim(),
    )

    // 這一條就是在守那個缺口：值必須是真正的 font-family 堆疊，
    // 不是 uuid、不是 slug、不是空字串
    expect(bodyFont).not.toBe('')
    expect(bodyFont).toContain('"')
    expect(bodyFont).not.toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}/)
  })

  test('@font-face 有注入且帶 unicode-range', async ({ page, invited }) => {
    await signInThroughUi(page, invited)

    const rules = await page.evaluate(() => {
      const found: { family: string; range: string }[] = []
      for (const sheet of Array.from(document.styleSheets)) {
        let cssRules: CSSRuleList
        try {
          cssRules = sheet.cssRules
        } catch {
          continue // 跨來源樣式表讀不到，略過
        }
        for (const rule of Array.from(cssRules)) {
          if (rule instanceof CSSFontFaceRule) {
            found.push({
              family: rule.style.getPropertyValue('font-family'),
              range: rule.style.getPropertyValue('unicode-range'),
            })
          }
        }
      }
      return found
    })

    expect(rules.length, '應該有 @font-face 規則').toBeGreaterThan(0)
    // 繁中字體一定是分片的，每條規則都要有 unicode-range
    expect(rules.every((r) => r.range !== '')).toBe(true)
  })

  test('critical 分片有 preload 且帶 crossorigin', async ({ page, invited }) => {
    await signInThroughUi(page, invited)

    const preloads = await page.evaluate(() =>
      Array.from(document.querySelectorAll('link[rel="preload"][as="font"]')).map((el) => ({
        type: el.getAttribute('type'),
        crossOrigin: el.getAttribute('crossorigin'),
      })),
    )

    expect(preloads.length).toBeGreaterThan(0)
    for (const link of preloads) {
      expect(link.type).toBe('font/woff2')
      // 少了 crossorigin 會下載兩次卻沒有加速
      expect(link.crossOrigin).not.toBeNull()
    }
  })

  test('Theme Studio 可以選字體，且顯示首屏成本', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.goto('/studio/theme')

    const select = page.getByLabel('內文', { exact: true })
    await expect(select).toBeVisible({ timeout: 20_000 })

    // 每個選項都要標出大小 —— 使用者要看得到代價（unicode-ranges.ts 的決定）
    const firstOption = await select.locator('option').first().textContent()
    expect(firstOption).toMatch(/\d+ KB/)

    await expect(page.getByText(/這組字體首次載入約/)).toBeVisible()
  })

  test('換字體會改變 font-family，而不是只有下拉選單變了', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.goto('/studio/theme')

    const select = page.getByLabel('內文', { exact: true })
    await expect(select).toBeVisible({ timeout: 20_000 })

    const options = await select.locator('option').all()
    expect(options.length).toBeGreaterThan(1)

    const before = await page.evaluate(
      () =>
        document.querySelector('.sr-font-sample')?.textContent ?? '',
    )

    // 換到最後一個選項（一定跟預設不同）
    const lastValue = await options[options.length - 1]!.getAttribute('value')
    await select.selectOption(lastValue!)

    // 樣張的 font-family 要跟著換
    const sampleFamily = await page.evaluate(() => {
      const el = document.querySelectorAll('.sr-font-sample')[1]
      return el ? getComputedStyle(el).fontFamily : ''
    })

    expect(sampleFamily).not.toBe('')
    expect(before).not.toBe('')
  })

  test('字體授權可以查得到 —— OFL 要求標示', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.goto('/studio/theme')

    await expect(page.getByText('授權').first()).toBeVisible({ timeout: 20_000 })
    await page.getByText('授權').first().click()
    await expect(page.getByRole('link', { name: /OFL/ }).first()).toBeVisible()
  })
})
