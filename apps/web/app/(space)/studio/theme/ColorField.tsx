'use client'

import { useId, useState, useEffect } from 'react'
import { NEUTRAL } from '@snowrealm/theme-engine'

/**
 * 顏色輸入。同時提供色票選擇器與 hex 文字輸入。
 *
 * 只用 <input type="color"> 是不夠的：
 * 使用者常常有既定的色碼要貼上，而色票選擇器無法貼上。
 */
export function ColorField({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string
  label: string
  hint?: string | undefined
  value: string
  onChange: (value: string) => void
}) {
  const hintId = useId()
  const [text, setText] = useState(value)

  // 外部改變（載入其他主題）時同步文字框
  useEffect(() => {
    setText(value)
  }, [value])

  const isHex = /^#[0-9a-fA-F]{6}$/.test(text)

  function commitText(next: string) {
    setText(next)
    if (/^#[0-9a-fA-F]{6}$/.test(next)) onChange(next)
  }

  return (
    <div className="sr-field">
      <label className="sr-label" htmlFor={id}>
        {label}
      </label>

      <div className="sr-row">
        <input
          type="color"
          id={id}
          className="sr-color-swatch"
          value={isHex ? text : NEUTRAL.black}
          onChange={(e) => {
            setText(e.target.value)
            onChange(e.target.value)
          }}
          aria-describedby={hint ? hintId : undefined}
        />
        <input
          type="text"
          className="sr-input sr-input-mono"
          value={text}
          maxLength={7}
          spellCheck={false}
          onChange={(e) => commitText(e.target.value)}
          aria-label={`${label}的色碼`}
          aria-invalid={!isHex}
          aria-describedby={hint ? hintId : undefined}
        />
      </div>

      {hint && (
        <p className="sr-muted" id={hintId}>
          {hint}
        </p>
      )}
      {!isHex && (
        <p className="sr-muted" role="alert">
          請輸入 #RRGGBB 格式。
        </p>
      )}
    </div>
  )
}
