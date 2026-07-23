'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  GRID,
  breakpointForWidth,
  deriveTabletFromDesktop,
  type GridItem,
} from '@snowrealm/widget-engine'
import { WidgetGrid } from '@/components/widgets/WidgetGrid'
import { WidgetRenderer, hasImplementation } from '@/components/widgets/registry'
import { WidgetSettings } from './WidgetSettings'

export type WidgetInstanceRow = {
  id: string
  widget_definition_id: string
  position: {
    desktop?: { x: number; y: number; w: number; h: number }
    tablet?: { x: number; y: number; w: number; h: number }
    mobile?: { order: number }
  }
  config: unknown
  hidden: boolean
  locked: boolean
}

export type AvailableWidget = {
  id: string
  name: string
  description: string
}

function toGridItems(
  rows: WidgetInstanceRow[],
  breakpoint: 'desktop' | 'tablet',
): GridItem[] {
  const items: GridItem[] = []
  for (const row of rows) {
    const pos = row.position?.[breakpoint]
    if (!pos) continue
    items.push(row.locked ? { id: row.id, ...pos, locked: true } : { id: row.id, ...pos })
  }
  return items
}

export function HomeGrid({
  spaceId,
  layoutId,
  initialWidgets,
  available,
}: {
  spaceId: string
  layoutId: string
  initialWidgets: WidgetInstanceRow[]
  available: AvailableWidget[]
}) {
  const [widgets, setWidgets] = useState(initialWidgets)
  const [breakpoint, setBreakpoint] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const [editing, setEditing] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  // 目前打開設定面板的 widget id
  const [settingsFor, setSettingsFor] = useState<string | null>(null)

  // 依視窗寬度決定斷點
  useEffect(() => {
    const update = () => setBreakpoint(breakpointForWidth(window.innerWidth))
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const api = useCallback(
    async (path: string, init?: RequestInit) => {
      const res = await fetch(path, {
        ...init,
        headers: {
          'content-type': 'application/json',
          'x-space-id': spaceId,
          ...(init?.headers ?? {}),
        },
      })
      const body: unknown = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(
          (body as { error?: { message?: string } } | null)?.error?.message ?? '操作失敗。',
        )
      }
      return (body as { data: unknown }).data
    },
    [spaceId],
  )

  /**
   * 首次進入某個斷點且該斷點沒有配置時，從 desktop 推導並**立即持久化**。
   * 06-widget-contract.md §1.2：推導只做一次，之後以使用者的調整為準。
   */
  useEffect(() => {
    if (breakpoint !== 'tablet') return
    const missing = widgets.filter((w) => !w.position?.tablet)
    if (missing.length === 0) return

    const derived = deriveTabletFromDesktop(toGridItems(widgets, 'desktop'))
    if (derived.length === 0) return

    void api(`/api/layouts/${layoutId}/widgets/bulk`, {
      method: 'PATCH',
      body: JSON.stringify({ breakpoint: 'tablet', items: derived }),
    })
      .then(() => {
        setWidgets((prev) =>
          prev.map((w) => {
            const item = derived.find((d) => d.id === w.id)
            return item
              ? {
                  ...w,
                  position: {
                    ...w.position,
                    tablet: { x: item.x, y: item.y, w: item.w, h: item.h },
                  },
                }
              : w
          }),
        )
      })
      .catch(() => {
        /* 推導失敗不致命：這次先用 desktop 的版面 */
      })
  }, [breakpoint, widgets, layoutId, api])

  const commit = useCallback(
    (items: GridItem[]) => {
      if (breakpoint === 'mobile') return

      setWidgets((prev) =>
        prev.map((w) => {
          const item = items.find((i) => i.id === w.id)
          return item
            ? {
                ...w,
                position: {
                  ...w.position,
                  [breakpoint]: { x: item.x, y: item.y, w: item.w, h: item.h },
                },
              }
            : w
        }),
      )

      void api(`/api/layouts/${layoutId}/widgets/bulk`, {
        method: 'PATCH',
        body: JSON.stringify({ breakpoint, items }),
      }).catch((err: unknown) => {
        // 樂觀更新失敗時回滾並說明（06-widget-contract.md §2.4）
        setNotice(err instanceof Error ? err.message : '位置沒有存起來。')
        setWidgets(initialWidgets)
      })
    },
    [api, breakpoint, layoutId, initialWidgets],
  )

  async function addWidget(definitionId: string) {
    try {
      const created = (await api(`/api/layouts/${layoutId}/widgets`, {
        method: 'POST',
        body: JSON.stringify({ widgetDefinitionId: definitionId }),
      })) as WidgetInstanceRow
      setWidgets((prev) => [...prev, created])
      setNotice(null)
    } catch (err) {
      setNotice(err instanceof Error ? err.message : '無法新增。')
    }
  }

  async function removeWidget(id: string) {
    try {
      await api(`/api/widgets/${id}`, { method: 'DELETE' })
      setWidgets((prev) => prev.filter((w) => w.id !== id))
      if (settingsFor === id) setSettingsFor(null)
    } catch (err) {
      setNotice(err instanceof Error ? err.message : '無法移除。')
    }
  }

  /**
   * 更新單一 widget 的 config / hidden / locked。
   *
   * 樂觀更新：先改本地狀態讓 UI 立刻反應，失敗才回滾並說明。
   * 位置調整走 bulk API，這裡走單一 widget 的 PATCH，兩者不同端點。
   */
  async function patchWidget(id: string, patch: Partial<Pick<WidgetInstanceRow, 'config' | 'hidden' | 'locked'>>) {
    const before = widgets
    setWidgets((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch } : w)))
    try {
      await api(`/api/widgets/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
      setNotice(null)
    } catch (err) {
      setWidgets(before)
      setNotice(err instanceof Error ? err.message : '設定沒有存起來。')
    }
  }

  const visible = widgets.filter((w) => !w.hidden)

  const renderWidget = (id: string) => {
    const row = visible.find((w) => w.id === id)
    if (!row) return null
    return (
      <WidgetRenderer
        definitionId={row.widget_definition_id}
        spaceId={spaceId}
        instanceId={row.id}
        config={row.config}
        onDisable={() => void removeWidget(row.id)}
      />
    )
  }

  return (
    <div className="sr-stack">
      <div className="sr-row" style={{ justifyContent: 'space-between' }}>
        <button
          type="button"
          className="sr-button sr-button-secondary"
          onClick={() => setEditing((v) => !v)}
          aria-pressed={editing}
        >
          {editing ? '完成編輯' : '編輯版面'}
        </button>

        {editing && breakpoint !== 'mobile' && (
          <span className="sr-muted">
            拖曳右上角的把手移動，或用方向鍵；Shift 加方向鍵調整大小
          </span>
        )}
      </div>

      {notice && (
        <p className="sr-message sr-message-error" role="alert">
          ✕ {notice}
        </p>
      )}

      {editing && (
        <section className="sr-card">
          <h2 className="sr-section-title">加入區塊</h2>
          {available.length === 0 ? (
            <p className="sr-muted">目前沒有可加入的區塊。</p>
          ) : (
            <div className="sr-row">
              {available.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  className="sr-button sr-button-secondary"
                  onClick={() => void addWidget(w.id)}
                  disabled={!hasImplementation(w.id)}
                  title={hasImplementation(w.id) ? w.description : '這個區塊還沒做好'}
                >
                  {w.name}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {visible.length === 0 ? (
        <section className="sr-card">
          <p className="sr-muted" style={{ marginBottom: 0 }}>
            這個版面還是空的。按「編輯版面」加入區塊。
          </p>
        </section>
      ) : breakpoint === 'mobile' ? (
        // 行動版是單欄排序，不使用格線（06-widget-contract.md §1）
        <div className="sr-mobile-stack">
          {[...visible]
            .sort((a, b) => (a.position?.mobile?.order ?? 0) - (b.position?.mobile?.order ?? 0))
            .map((w) => (
              <div key={w.id}>{renderWidget(w.id)}</div>
            ))}
        </div>
      ) : (
        <WidgetGrid
          items={toGridItems(visible, breakpoint)}
          breakpoint={breakpoint}
          editing={editing}
          onCommit={commit}
          renderItem={(item) => renderWidget(item.id)}
        />
      )}

      {/*
        設定區塊。列出**所有** widget（含已隱藏的）——
        隱藏的 widget 不在格線上，若這裡也不列出，使用者就沒有任何
        入口把它再打開，等於單向的黑洞。
      */}
      {editing && widgets.length > 0 && (
        <section className="sr-card">
          <h2 className="sr-section-title">區塊設定</h2>
          <ul className="sr-widget-settings-list" role="list">
            {widgets.map((w) => {
              const name =
                available.find((a) => a.id === w.widget_definition_id)?.name ??
                w.widget_definition_id
              const isOpen = settingsFor === w.id
              return (
                <li key={w.id}>
                  <div className="sr-row" style={{ justifyContent: 'space-between' }}>
                    <span>
                      {name}
                      {w.hidden && <span className="sr-muted">（已隱藏）</span>}
                      {w.locked && <span className="sr-muted">（已鎖定）</span>}
                    </span>
                    <span className="sr-row">
                      <button
                        type="button"
                        className="sr-button sr-button-secondary"
                        aria-expanded={isOpen}
                        onClick={() => setSettingsFor(isOpen ? null : w.id)}
                      >
                        {isOpen ? '收起' : '設定'}
                      </button>
                      <button
                        type="button"
                        className="sr-asset-delete"
                        onClick={() => void removeWidget(w.id)}
                        aria-label={`移除 ${name}`}
                      >
                        移除
                      </button>
                    </span>
                  </div>

                  {isOpen && (
                    <WidgetSettings
                      widgetName={name}
                      definitionId={w.widget_definition_id}
                      config={(w.config ?? {}) as Record<string, unknown>}
                      hidden={w.hidden}
                      locked={w.locked}
                      onSave={(config) => void patchWidget(w.id, { config })}
                      onToggleHidden={(hidden) => void patchWidget(w.id, { hidden })}
                      onToggleLocked={(locked) => void patchWidget(w.id, { locked })}
                      onClose={() => setSettingsFor(null)}
                    />
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <p className="sr-muted">
        目前是{breakpoint === 'desktop' ? '桌機' : breakpoint === 'tablet' ? '平板' : '手機'}版面
        {breakpoint !== 'mobile' && `（${GRID[breakpoint].columns} 欄）`}。
        每種寬度各自記住自己的排列。
      </p>
    </div>
  )
}
