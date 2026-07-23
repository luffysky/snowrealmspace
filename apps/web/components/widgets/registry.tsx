'use client'

import { lazy, Suspense, type ComponentType } from 'react'
import { getWidgetDefinition } from '@snowrealm/widget-engine'
import { WidgetBoundary } from './WidgetBoundary'
import type { WidgetProps } from './types'

/**
 * Widget 元件註冊表。
 *
 * 06-widget-contract.md §7：**每個 widget 的元件必須 code-split。**
 * 未被使用的 widget 不該出現在 bundle 中 —— Future Widgets 有 11 個，
 * 全部靜態 import 會讓首屏 bundle 白白膨脹。
 */

export type { WidgetProps } from './types'

const COMPONENTS: Record<string, ComponentType<WidgetProps>> = {
  daily_card: lazy(() => import('./impl/DailyCardWidget')),
  surprise_box: lazy(() => import('./impl/SurpriseBoxWidget')),
  agent_message: lazy(() => import('./impl/AgentMessageWidget')),
  theme_switcher: lazy(() => import('./impl/ThemeSwitcherWidget')),
  background_control: lazy(() => import('./impl/BackgroundControlWidget')),
  quick_note: lazy(() => import('./impl/QuickNoteWidget')),
}

export function hasImplementation(definitionId: string): boolean {
  return definitionId in COMPONENTS
}

export function WidgetRenderer({
  definitionId,
  spaceId,
  instanceId,
  config,
  onError,
  onDisable,
}: {
  definitionId: string
  spaceId: string
  instanceId: string
  config: unknown
  onError?: (info: { definitionId: string; version: string; errorName: string }) => void
  onDisable?: () => void
}) {
  const definition = getWidgetDefinition(definitionId)
  const Component = COMPONENTS[definitionId]

  // 定義存在但元件還沒實作：誠實說明，不留一個空殼（Q6）
  if (!definition || !Component) {
    return (
      <div className="sr-card sr-widget-fallback">
        <strong>{definition?.name ?? '未知的區塊'}</strong>
        <p className="sr-muted" style={{ marginBottom: 0 }}>
          這個區塊還沒做好。
        </p>
      </div>
    )
  }

  return (
    <WidgetBoundary
      definitionId={definitionId}
      version={definition.version}
      name={definition.name}
      {...(onError ? { onError } : {})}
      {...(onDisable ? { onDisable } : {})}
    >
      <Suspense
        fallback={
          <div className="sr-card sr-widget-fallback" aria-busy="true">
            <span className="sr-muted">載入中…</span>
          </div>
        }
      >
        <Component spaceId={spaceId} instanceId={instanceId} config={config} />
      </Suspense>
    </WidgetBoundary>
  )
}
