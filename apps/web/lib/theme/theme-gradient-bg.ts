import type { ThemeDefinition } from '@snowrealm/theme-engine'
import type { BackgroundItem, BackgroundState } from '@/components/BackgroundLayer'

/**
 * 主題色自動生成的漸層背景（#54）。
 *
 * 「背景為主」：背景的明暗決定整體模式與文字對比。使用者沒設對應明暗的背景時，
 * 就用目前主題的顏色生成一張漸層背景——這樣永遠有背景、且會跟主題連動，
 * tone 也標好（light/dark）讓 layout 據以決定模式與文字色。
 */

function gradientItem(theme: ThemeDefinition, tone: 'light' | 'dark'): BackgroundItem {
  const c = theme.colors
  return {
    id: `theme-gradient-${tone}`,
    name: '主題漸層',
    tone,
    type: 'gradient',
    asset_id: null,
    fit: 'cover',
    position_x: 50,
    position_y: 50,
    zoom: 1,
    blur: 0,
    brightness: 1,
    contrast: 1,
    saturation: 1,
    // overlay/glass 都是關閉狀態（opacity 0 / glass_enabled false），顏色欄位其實用不到；
    // 直接借主題色填，避免寫死 hex（no-restricted-syntax）。
    overlay_color: c.textPrimary,
    overlay_opacity: 0,
    loop: true,
    muted: true,
    glass_enabled: false,
    glass_blur: 0,
    glass_opacity: 0,
    glass_radius: 0,
    glass_color: c.surface,
    crop_x: 0,
    crop_y: 0,
    crop_w: 100,
    crop_h: 100,
    procedural_id: null,
    lottie_id: null,
    scene_id: null,
    scene_density: 1,
    // 從主題底色柔和地漸到次要色，跟主題同一個明暗、不搶戲。
    gradient_spec: {
      kind: 'linear',
      angle: 160,
      stops: [
        { color: c.background, position: 0 },
        { color: c.secondary, position: 100 },
      ],
    },
  }
}

/** 用主題顏色包一個「單張漸層」的 BackgroundState。 */
export function themeGradientBackground(theme: ThemeDefinition, tone: 'light' | 'dark'): BackgroundState {
  const item = gradientItem(theme, tone)
  return {
    current: item,
    next: null,
    transition: 'fade',
    transitionMs: 600,
    playMode: 'single',
    intervalSeconds: 0,
    items: [item],
  }
}
