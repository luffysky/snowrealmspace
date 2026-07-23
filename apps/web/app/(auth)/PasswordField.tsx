'use client'

import { useId, useState } from 'react'

/**
 * 密碼輸入框 + 顯示/隱藏眼睛。跟一般網站一樣。
 *
 * 眼睛是按鈕（可鍵盤操作），切換 input type。value 可受控（給強度條用）。
 */
export function PasswordField({
  name,
  label,
  autoComplete,
  placeholder,
  minLength,
  required = true,
  disabled = false,
  value,
  onChange,
}: {
  name: string
  label: string
  autoComplete: string
  placeholder?: string | undefined
  minLength?: number | undefined
  required?: boolean
  disabled?: boolean
  value?: string | undefined
  onChange?: ((v: string) => void) | undefined
}) {
  const [show, setShow] = useState(false)
  const id = useId()

  return (
    <div>
      <label className="sr-label" htmlFor={id}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          className="sr-input"
          id={id}
          name={name}
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          placeholder={placeholder}
          disabled={disabled}
          value={value}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          style={{ paddingInlineEnd: '2.75rem' }}
        />
        <button
          type="button"
          className="sr-eye"
          aria-label={show ? '隱藏密碼' : '顯示密碼'}
          aria-pressed={show}
          onClick={() => setShow((s) => !s)}
          disabled={disabled}
          tabIndex={0}
        >
          {show ? (
            // 眼睛 + 斜線（隱藏中）
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M3 3l18 18M10.6 10.7a2 2 0 002.7 2.8M9.9 5.1A9.5 9.5 0 0112 5c5 0 9 4.5 10 7a13 13 0 01-2.2 3.2M6.1 6.2A13 13 0 002 12c1 2.5 5 7 10 7a9.6 9.6 0 003.4-.6"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            // 眼睛（顯示中）
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
