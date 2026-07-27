'use client'

import { BackgroundMedia, glassStyle, type BackgroundState } from './BackgroundLayer'
import { ProceduralScene } from './ProceduralScene'

/**
 * 主題工作室即時預覽用的背景層（#51）。
 *
 * 把「目前空間套用中的背景」（含幻燈片的當前這張）縮進預覽框裡，讓使用者看到
 * 主題色/卡片材質疊在真實背景上的樣子。重用正式的 BackgroundMedia（影片在預覽裡
 * 一律 paused，不佔資源），只是掛在預覽框內（絕對定位、被 .sr-preview-surface 的
 * overflow:hidden 夾住），而不是全頁 fixed。沒有套用背景時回 null（預覽退回純底色）。
 */
export function PreviewBackground({ spaceId, state }: { spaceId: string; state: BackgroundState | null }) {
  const item = state?.current
  if (!item) return null

  return (
    <div className="sr-preview-bg" aria-hidden="true">
      <BackgroundMedia spaceId={spaceId} item={item} paused onVideoPresent={() => {}} />

      {item.scene_id && <ProceduralScene sceneId={item.scene_id} density={item.scene_density} overlay paused />}

      {item.overlay_opacity > 0 && (
        <div className="sr-bg-overlay" style={{ background: item.overlay_color, opacity: item.overlay_opacity }} />
      )}

      {glassStyle(item) && <div className="sr-bg-glass" style={glassStyle(item)!} />}
    </div>
  )
}
