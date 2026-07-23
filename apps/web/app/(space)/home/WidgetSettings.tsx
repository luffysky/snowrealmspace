'use client'

import { useMemo, useState } from 'react'
import { editableConfigFields, type ConfigField, type WidgetId } from '@snowrealm/widget-engine'

/**
 * 單一 widget 的設定面板。從 configSchema 自動生成（config-fields.ts）。
 *
 * 涵蓋 06-widget-contract.md 的三件事：
 *   - 設定（config）：依 schema 型別渲染控制項
 *   - 隱藏（hidden）：暫時不顯示但保留設定，不是刪除
 *   - 鎖定（locked）：編輯版面時不會被拖動或改大小
 *
 * 隱藏與刪除的差別要說清楚：隱藏留著設定，刪除是真的移除。
 */

type EditableField = Exclude<ConfigField, { kind: 'unsupported' }>

export function WidgetSettings({
  widgetName,
  definitionId,
  config,
  hidden,
  locked,
  onSave,
  onToggleHidden,
  onToggleLocked,
  onClose,
}: {
  widgetName: string
  definitionId: string
  config: Record<string, unknown>
  hidden: boolean
  locked: boolean
  onSave: (config: Record<string, unknown>) => void
  onToggleHidden: (hidden: boolean) => void
  onToggleLocked: (locked: boolean) => void
  onClose: () => void
}) {
  const fields = useMemo(
    () => editableConfigFields(definitionId as WidgetId),
    [definitionId],
  )

  const [draft, setDraft] = useState<Record<string, unknown>>(() => {
    // 以 schema 預設為底，蓋上已存的值 —— 缺欄位時控制項才有初值
    const base: Record<string, unknown> = {}
    for (const field of fields) base[field.key] = field.default
    return { ...base, ...config }
  })
  const [dirty, setDirty] = useState(false)

  function set(key: string, value: unknown) {
    setDraft((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  return (
    <div className="sr-card sr-widget-settings" role="group" aria-label={`${widgetName} 設定`}>
      <div className="sr-row" style={{ justifyContent: 'space-between' }}>
        <h3 className="sr-subsection-title" style={{ margin: 0 }}>
          {widgetName}
        </h3>
        <button type="button" className="sr-asset-delete" onClick={onClose} aria-label="關閉設定">
          ✕
        </button>
      </div>

      {/* ── 顯示狀態 ── */}
      <div className="sr-field">
        <label className="sr-checkbox">
          <input
            type="checkbox"
            checked={hidden}
            onChange={(e) => onToggleHidden(e.target.checked)}
          />
          <span>
            隱藏這個區塊
            <span className="sr-muted"> —— 暫時不顯示，但保留設定。與移除不同。</span>
          </span>
        </label>
        <label className="sr-checkbox">
          <input
            type="checkbox"
            checked={locked}
            onChange={(e) => onToggleLocked(e.target.checked)}
          />
          <span>
            鎖定位置
            <span className="sr-muted"> —— 編輯版面時不會被拖動或改大小。</span>
          </span>
        </label>
      </div>

      {/* ── 設定欄位（自動生成）── */}
      {fields.length === 0 ? (
        <p className="sr-muted">這個區塊沒有可調整的設定。</p>
      ) : (
        <div className="sr-field">
          {fields.map((field) => (
            <FieldControl
              key={field.key}
              field={field}
              value={draft[field.key]}
              onChange={(v) => set(field.key, v)}
            />
          ))}
        </div>
      )}

      {fields.length > 0 && (
        <button
          type="button"
          className="sr-button"
          disabled={!dirty}
          onClick={() => {
            onSave(draft)
            setDirty(false)
          }}
        >
          {dirty ? '儲存設定' : '已儲存'}
        </button>
      )}
    </div>
  )
}

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: EditableField
  value: unknown
  onChange: (value: unknown) => void
}) {
  const id = `cfg-${field.key}`

  if (field.kind === 'boolean') {
    return (
      <label className="sr-checkbox">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>{field.label}</span>
      </label>
    )
  }

  if (field.kind === 'number') {
    const num = typeof value === 'number' ? value : field.default
    // 有明確 min+max 且範圍不大時用滑桿，否則用數字框
    const useSlider = field.min !== undefined && field.max !== undefined && field.max - field.min <= 60
    return (
      <div className="sr-field-row">
        <label className="sr-label" htmlFor={id}>
          {field.label}
          {useSlider && <span className="sr-muted"> {num}</span>}
        </label>
        <input
          id={id}
          type={useSlider ? 'range' : 'number'}
          className={useSlider ? undefined : 'sr-input'}
          value={num}
          {...(field.min !== undefined ? { min: field.min } : {})}
          {...(field.max !== undefined ? { max: field.max } : {})}
          step={field.step ?? 1}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
    )
  }

  if (field.kind === 'enum') {
    return (
      <div className="sr-field-row">
        <label className="sr-label" htmlFor={id}>
          {field.label}
        </label>
        <select
          id={id}
          className="sr-input"
          value={typeof value === 'string' ? value : field.default}
          onChange={(e) => onChange(e.target.value)}
        >
          {field.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    )
  }

  // string
  return (
    <div className="sr-field-row">
      <label className="sr-label" htmlFor={id}>
        {field.label}
      </label>
      <input
        id={id}
        type="text"
        className="sr-input"
        value={typeof value === 'string' ? value : field.default}
        {...(field.maxLength !== undefined ? { maxLength: field.maxLength } : {})}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
