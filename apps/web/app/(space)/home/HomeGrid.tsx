'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  GRID,
  breakpointForWidth,
  deriveTabletFromDesktop,
  LAYOUT_PRESETS,
  type GridItem,
  type LayoutPreset,
} from '@snowrealm/widget-engine'
import { WidgetGrid } from '@/components/widgets/WidgetGrid'
import { WidgetRenderer, hasImplementation } from '@/components/widgets/registry'
import { WidgetSettings } from './WidgetSettings'
import { useGlassBudget } from '@/lib/theme/use-glass-budget'
import { useDialog } from '@/components/ui/DialogProvider'

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
  category: string
}

/** widget 分類 → 中文標題。未知分類退回「其他」。 */
const CATEGORY_LABELS: Record<string, string> = {
  daily: '每日',
  creative: '創作',
  agent: 'Agent',
  project: '專案',
  system: '系統',
  utility: '工具',
  personal: '個人',
  fun: '娛樂',
  relax: '放鬆',
}

function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? '其他'
}

// 「加入區塊」清單分類的顯示順序；未列出的分類排在最後。
const CATEGORY_ORDER = ['daily', 'personal', 'creative', 'project', 'utility', 'relax', 'fun', 'system', 'agent']

export type LayoutSummary = { id: string; name: string }

/**
 * 把可加入的 widget 依 category 分組，供「加入區塊」清單分區顯示。
 * 分類順序照 CATEGORY_ORDER，未列出的排在最後；每組內維持原本順序。
 */
function groupByCategory(
  available: AvailableWidget[],
): { category: string; widgets: AvailableWidget[] }[] {
  const groups = new Map<string, AvailableWidget[]>()
  for (const w of available) {
    const list = groups.get(w.category)
    if (list) list.push(w)
    else groups.set(w.category, [w])
  }
  return [...groups.keys()]
    .sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a)
      const ib = CATEGORY_ORDER.indexOf(b)
      return (ia === -1 ? Number.MAX_SAFE_INTEGER : ia) - (ib === -1 ? Number.MAX_SAFE_INTEGER : ib)
    })
    .map((category) => ({ category, widgets: groups.get(category)! }))
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
  layouts,
  activeLayoutId,
}: {
  spaceId: string
  layoutId: string
  initialWidgets: WidgetInstanceRow[]
  available: AvailableWidget[]
  layouts: LayoutSummary[]
  activeLayoutId: string
}) {
  const { confirm, prompt } = useDialog()
  const [widgets, setWidgets] = useState(initialWidgets)
  const [breakpoint, setBreakpoint] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const [editing, setEditing] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  // 目前打開設定面板的 widget id
  const [settingsFor, setSettingsFor] = useState<string | null>(null)
  const router = useRouter()

  /**
   * 切換 / 新增 / 改名 / 刪除版面。
   *
   * 切換後用 router.refresh() 重新載入 —— 版面內容是伺服器端渲染的
   * （page.tsx 依 active_layout_id 載入 widget），前端沒有另一個版面的
   * widget 資料，硬在前端切會顯示錯的內容。
   */
  async function switchLayout(id: string) {
    if (id === activeLayoutId) return
    try {
      await api(`/api/layouts/${id}`, { method: 'PATCH', body: JSON.stringify({ activate: true }) })
      router.refresh()
    } catch (err) {
      setNotice(err instanceof Error ? err.message : '無法切換版面。')
    }
  }

  async function createLayout() {
    const name = await prompt({ title: '新版面', message: '版面名稱', defaultValue: `版面 ${layouts.length + 1}` })
    if (!name) return
    try {
      const created = (await api('/api/layouts', {
        method: 'POST',
        body: JSON.stringify({ name }),
      })) as { id: string }
      // 新版面建立後直接切過去
      await api(`/api/layouts/${created.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ activate: true }),
      })
      router.refresh()
    } catch (err) {
      setNotice(err instanceof Error ? err.message : '無法建立版面。')
    }
  }

  async function renameLayout() {
    const current = layouts.find((l) => l.id === activeLayoutId)
    const name = await prompt({ title: '重新命名版面', message: '版面名稱', defaultValue: current?.name ?? '' })
    if (!name || name === current?.name) return
    try {
      await api(`/api/layouts/${activeLayoutId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      })
      router.refresh()
    } catch (err) {
      setNotice(err instanceof Error ? err.message : '無法改名。')
    }
  }

  async function deleteLayout() {
    if (layouts.length <= 1) {
      setNotice('這是最後一個版面，不能刪除。')
      return
    }
    const current = layouts.find((l) => l.id === activeLayoutId)
    if (!(await confirm({ title: '刪除版面', message: `確定刪除版面「${current?.name}」嗎？裡面的區塊排列會一起刪掉。`, danger: true, confirmText: '刪除' }))) return
    try {
      await api(`/api/layouts/${activeLayoutId}`, { method: 'DELETE' })
      router.refresh()
    } catch (err) {
      setNotice(err instanceof Error ? err.message : '無法刪除。')
    }
  }

  async function createFromPreset(preset: LayoutPreset) {
    try {
      const created = (await api('/api/layouts', {
        method: 'POST',
        body: JSON.stringify({ name: preset.name, preset: preset.key }),
      })) as { id: string }
      await api(`/api/layouts/${created.id}`, { method: 'PATCH', body: JSON.stringify({ activate: true }) })
      router.refresh()
    } catch (err) {
      setNotice(err instanceof Error ? err.message : '無法從範本建立。')
    }
  }

  async function resetLayout() {
    if (
      !(await confirm({
        title: '還原預設版面',
        message: '會清掉目前這個版面的排列，重新放回一組預設區塊。這個動作無法復原，確定嗎？',
        danger: true,
        confirmText: '還原預設',
      }))
    )
      return
    try {
      await api(`/api/layouts/${layoutId}/reset`, { method: 'POST' })
      // 同一個版面 id、widget 清單整批換掉 → 直接重載入取得乾淨狀態
      window.location.reload()
    } catch (err) {
      setNotice(err instanceof Error ? err.message : '還原失敗。')
    }
  }

  // 設定面板開啟時，Esc 關閉（backdrop 點擊與面板內 ✕ 之外的第三條關閉路徑）
  useEffect(() => {
    if (!settingsFor) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSettingsFor(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [settingsFor])

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

  // 目前要在浮動面板顯示設定的 widget（齒輪或清單「設定」都會設定 settingsFor）。
  // 找不到（例如剛被移除）就不渲染面板。
  const settingsWidget = settingsFor ? widgets.find((w) => w.id === settingsFor) ?? null : null
  const settingsWidgetName = settingsWidget
    ? available.find((a) => a.id === settingsWidget.widget_definition_id)?.name ??
      settingsWidget.widget_definition_id
    : ''

  // 毛玻璃數量上限（05-theme-tokens.md §2）。容器內超過預算的 widget
  // 會被降級為 solid，優先保留視窗內的。
  const gridContainerRef = useRef<HTMLDivElement>(null)
  useGlassBudget(gridContainerRef, breakpoint, visible.length)

  const renderWidget = (id: string) => {
    const row = visible.find((w) => w.id === id)
    if (!row) return null
    const name =
      available.find((a) => a.id === row.widget_definition_id)?.name ??
      row.widget_definition_id
    return (
      <>
        <WidgetRenderer
          definitionId={row.widget_definition_id}
          spaceId={spaceId}
          instanceId={row.id}
          config={row.config}
          onDisable={() => void removeWidget(row.id)}
        />
        {/*
          每個 widget 的「設定」齒輪：只在編輯模式出現（檢視模式保持乾淨）。
          必須擋掉事件冒泡，否則 pointerdown 會被 WidgetGrid 當成拖曳起手式：
          preventDefault + stopPropagation（pointer/mouse/click 三個都擋）。
          放左上角，避開右上／右下的拖曳與縮放把手。
        */}
        {editing && (
          <button
            type="button"
            className="sr-widget-gear"
            aria-label={`${name} 設定`}
            title="設定"
            onPointerDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              setSettingsFor(id)
            }}
          >
            <span aria-hidden="true">⚙</span> 設定
          </button>
        )}
      </>
    )
  }

  return (
    <div className="sr-stack">
      <div className="sr-row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div className="sr-row">
          <button
            type="button"
            className="sr-button sr-button-secondary"
            onClick={() => setEditing((v) => !v)}
            aria-pressed={editing}
          >
            {editing ? '完成編輯' : '編輯版面'}
          </button>

          {/* 版面切換器。多套版面時才顯示 —— 只有一套時沒有東西可切。 */}
          {layouts.length > 1 && (
            <label className="sr-row" style={{ gap: 'var(--sr-space-2)' }}>
              <span className="sr-visually-hidden">選擇版面</span>
              <select
                className="sr-input"
                aria-label="選擇版面"
                value={activeLayoutId}
                onChange={(e) => void switchLayout(e.target.value)}
                style={{ maxWidth: 200 }}
              >
                {layouts.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {editing && (
          <div className="sr-row">
            <button type="button" className="sr-button sr-button-secondary" onClick={() => void createLayout()}>
              新增版面
            </button>
            <button type="button" className="sr-button sr-button-secondary" onClick={() => void renameLayout()}>
              版面改名
            </button>
            <button type="button" className="sr-button sr-button-secondary" onClick={() => void resetLayout()}>
              還原預設
            </button>
            {layouts.length > 1 && (
              <button type="button" className="sr-asset-delete" onClick={() => void deleteLayout()}>
                刪除此版面
              </button>
            )}
          </div>
        )}

        {editing && (
          <div style={{ marginTop: 'var(--sr-space-3)' }}>
            <p className="sr-label" style={{ margin: '0 0 var(--sr-space-2)' }}>
              從範本新增一套版面（可依工作狀態切換）
            </p>
            <div className="sr-preset-grid">
              {LAYOUT_PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  className="sr-preset-card"
                  onClick={() => void createFromPreset(preset)}
                  title={`從「${preset.name}」建立新版面`}
                >
                  <span className="sr-preset-name">{preset.name}</span>
                  <span className="sr-preset-desc sr-muted">{preset.description}</span>
                  <span className="sr-preset-count sr-muted">{preset.items.length} 個區塊</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {editing && breakpoint !== 'mobile' && (
        <p className="sr-muted" style={{ margin: 0 }}>
          拖曳右上角的把手移動，或用方向鍵；Shift 加方向鍵調整大小。每套版面各自記住排列。
        </p>
      )}

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
            <div className="sr-stack">
              {groupByCategory(available).map(({ category, widgets }) => (
                <div key={category} style={{ minWidth: 0 }}>
                  <p className="sr-label" style={{ margin: '0 0 var(--sr-space-2)' }}>
                    {categoryLabel(category)}
                  </p>
                  <div className="sr-row" style={{ flexWrap: 'wrap' }}>
                    {widgets.map((w) => (
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
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <div ref={gridContainerRef}>
        {visible.length === 0 ? (
          <section className="sr-card">
            <p className="sr-muted" style={{ marginBottom: 0 }}>
              這個版面還是空的。按「編輯版面」加入區塊。
            </p>
          </section>
        ) : breakpoint === 'mobile' ? (
          // 行動版是單欄排序，不使用格線（06-widget-contract.md §1）。
          // 外層仍用 .sr-widget-slot，毛玻璃預算的偵測才涵蓋得到行動版。
          <div className="sr-mobile-stack">
            {[...visible]
              .sort((a, b) => (a.position?.mobile?.order ?? 0) - (b.position?.mobile?.order ?? 0))
              .map((w) => (
                <div key={w.id} className="sr-widget-slot">
                  {renderWidget(w.id)}
                </div>
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
      </div>

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
              return (
                <li key={w.id}>
                  <div className="sr-row" style={{ justifyContent: 'space-between' }}>
                    <span>
                      {name}
                      {w.hidden && <span className="sr-muted">（已隱藏）</span>}
                      {w.locked && <span className="sr-muted">（已鎖定）</span>}
                    </span>
                    <span className="sr-row">
                      {/* 設定改為開啟浮動彈跳面板（見下方 modal），不再就地展開。
                          隱藏的 widget 不在格線上、沒有齒輪，這份清單是它們唯一的入口。 */}
                      <button
                        type="button"
                        className="sr-button sr-button-secondary"
                        onClick={() => setSettingsFor(w.id)}
                      >
                        設定
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
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/*
        單一 widget 的設定：浮動彈跳面板（modal）。齒輪或清單「設定」設定 settingsFor。
        關閉三途：backdrop 點擊、Esc（上方 useEffect）、面板內建 ✕（onClose）。
        面板內容點擊 stopPropagation，避免冒泡到 backdrop 而誤關。
      */}
      {settingsWidget && (
        <div
          className="sr-widget-settings-modal-backdrop"
          role="presentation"
          onClick={() => setSettingsFor(null)}
        >
          <div
            className="sr-widget-settings-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`${settingsWidgetName} 設定`}
            onClick={(e) => e.stopPropagation()}
          >
            <WidgetSettings
              spaceId={spaceId}
              widgetName={settingsWidgetName}
              definitionId={settingsWidget.widget_definition_id}
              config={(settingsWidget.config ?? {}) as Record<string, unknown>}
              hidden={settingsWidget.hidden}
              locked={settingsWidget.locked}
              onSave={(config) => void patchWidget(settingsWidget.id, { config })}
              onToggleHidden={(hidden) => void patchWidget(settingsWidget.id, { hidden })}
              onToggleLocked={(locked) => void patchWidget(settingsWidget.id, { locked })}
              onClose={() => setSettingsFor(null)}
            />
          </div>
        </div>
      )}

      <p className="sr-muted">
        目前是{breakpoint === 'desktop' ? '桌機' : breakpoint === 'tablet' ? '平板' : '手機'}版面
        {breakpoint !== 'mobile' && `（${GRID[breakpoint].columns} 欄）`}。
        每種寬度各自記住自己的排列。
      </p>
    </div>
  )
}
