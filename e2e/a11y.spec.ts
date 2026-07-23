import AxeBuilder from '@axe-core/playwright'
import { test, expect, signInThroughUi } from './fixtures'

/**
 * 無障礙掃描。ADR-011：WCAG 2.2 AA 是硬需求。
 *
 * 門檻：0 個 critical / serious violation（11-engineering-setup.md §7）。
 * moderate / minor 會列出但不擋 —— 它們常是 axe 對設計選擇的意見，
 * 而非實際的存取障礙。
 */

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

type Violation = { id: string; impact?: string | null; nodes: unknown[]; help: string }

function blocking(violations: Violation[]): Violation[] {
  return violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
}

function format(violations: Violation[]): string {
  return violations
    .map((v) => `  [${v.impact}] ${v.id}: ${v.help}（${v.nodes.length} 個元素）`)
    .join('\n')
}

async function scan(page: import('@playwright/test').Page) {
  return new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
}

test.describe('無障礙 @a11y', () => {
  test('登入頁', async ({ page }) => {
    await page.goto('/login')
    const results = await scan(page)
    expect(blocking(results.violations), format(results.violations)).toEqual([])
  })

  test('邀請頁', async ({ page, invited }) => {
    await page.goto(invited.inviteUrl)
    const results = await scan(page)
    expect(blocking(results.violations), format(results.violations)).toEqual([])
  })

  test('邀請無效的錯誤頁', async ({ page }) => {
    await page.goto('/invite?token=invalid')
    const results = await scan(page)
    expect(blocking(results.violations), format(results.violations)).toEqual([])
  })

  test('404 頁', async ({ page }) => {
    await page.goto('/this-route-does-not-exist')
    const results = await scan(page)
    expect(blocking(results.violations), format(results.violations)).toEqual([])
  })

  test('Home', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    const results = await scan(page)
    expect(blocking(results.violations), format(results.violations)).toEqual([])
  })

  test('Settings', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.goto('/settings')
    const results = await scan(page)
    expect(blocking(results.violations), format(results.violations)).toEqual([])
  })

  test('登入方式', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.goto('/settings/account')
    const results = await scan(page)
    expect(blocking(results.violations), format(results.violations)).toEqual([])
  })
})

test.describe('鍵盤操作 @a11y', () => {
  test('登入表單可完全用鍵盤完成', async ({ page }) => {
    await page.goto('/login')

    await page.keyboard.press('Tab')
    const focused = await page.evaluate(() => document.activeElement?.tagName)
    expect(focused).toBe('INPUT')

    await page.keyboard.type('keyboard-test@e2e.local')
    await page.keyboard.press('Tab')

    const buttonFocused = await page.evaluate(
      () => document.activeElement?.tagName === 'BUTTON',
    )
    expect(buttonFocused).toBe(true)
  })

  test('focus 有可見的外框（ADR-011）', async ({ page }) => {
    await page.goto('/login')
    await page.keyboard.press('Tab')

    const outline = await page.evaluate(() => {
      const el = document.activeElement
      if (!el) return null
      const s = getComputedStyle(el)
      return { width: s.outlineWidth, style: s.outlineStyle }
    })

    expect(outline).not.toBeNull()
    expect(outline!.style).not.toBe('none')
    expect(parseFloat(outline!.width)).toBeGreaterThanOrEqual(2)
  })

  test('設定頁的每個開關都有關聯的標籤與說明', async ({ page, invited }) => {
    await signInThroughUi(page, invited)
    await page.goto('/settings')

    for (const name of [
      '記錄我的活動',
      '允許 Agent 記住事情',
      '允許 AI 分析我的作品',
      '允許連接外部設計軟體',
    ]) {
      const box = page.getByLabel(name)
      await expect(box).toBeVisible()
      // aria-describedby 指向的說明必須真的存在
      const describedBy = await box.getAttribute('aria-describedby')
      expect(describedBy).toBeTruthy()
      await expect(page.locator(`#${describedBy}`)).toBeVisible()
    }
  })
})

test.describe('Reduced motion @a11y', () => {
  test('prefers-reduced-motion 時動畫時長趨近於零', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/login')

    const intensity = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--sr-motion-intensity').trim(),
    )
    expect(parseFloat(intensity)).toBeLessThanOrEqual(0.01)
  })
})
