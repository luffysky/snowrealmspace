'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useScrollLock } from '@/lib/use-scroll-lock'

/**
 * 承諾式對話框：取代 window.confirm / window.prompt。
 *   const { confirm, prompt } = useDialog()
 *   if (!(await confirm({ message: '確定？' }))) return
 *   const name = await prompt({ message: '名稱', defaultValue: '舊值' })  // string | null
 *
 * 無障礙：Esc 取消、Enter 確認、開啟時鎖背景捲動、點遮罩取消。
 */

type ConfirmOpts = { title?: string; message: string; confirmText?: string; cancelText?: string; danger?: boolean }
type PromptOpts = {
  title?: string
  message?: string
  defaultValue?: string
  placeholder?: string
  multiline?: boolean
  confirmText?: string
  cancelText?: string
}

type Ctx = {
  confirm: (o: ConfirmOpts) => Promise<boolean>
  prompt: (o: PromptOpts) => Promise<string | null>
}

const DialogContext = createContext<Ctx | null>(null)

export function useDialog(): Ctx {
  const ctx = useContext(DialogContext)
  if (!ctx) throw new Error('useDialog 必須在 <DialogProvider> 內使用')
  return ctx
}

type State =
  | { kind: 'confirm'; opts: ConfirmOpts; resolve: (v: boolean) => void }
  | { kind: 'prompt'; opts: PromptOpts; resolve: (v: string | null) => void }
  | null

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(null)
  const [value, setValue] = useState('')
  const [mounted, setMounted] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)

  useEffect(() => setMounted(true), [])

  const confirm = useCallback((opts: ConfirmOpts) => new Promise<boolean>((resolve) => setState({ kind: 'confirm', opts, resolve })), [])
  const prompt = useCallback(
    (opts: PromptOpts) =>
      new Promise<string | null>((resolve) => {
        setValue(opts.defaultValue ?? '')
        setState({ kind: 'prompt', opts, resolve })
      }),
    [],
  )

  function close(result: boolean | string | null) {
    if (!state) return
    if (state.kind === 'confirm') state.resolve(result as boolean)
    else state.resolve(result as string | null)
    setState(null)
  }

  useScrollLock(state !== null)
  useEffect(() => {
    if (!state) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(state.kind === 'confirm' ? false : null)
    }
    window.addEventListener('keydown', onKey)
    const t = setTimeout(() => inputRef.current?.focus(), 30)
    return () => {
      window.removeEventListener('keydown', onKey)
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  const overlay = state && mounted
    ? createPortal(
        <div className="sr-dialog-scrim" onClick={() => close(state.kind === 'confirm' ? false : null)}>
          <div
            className="sr-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={state.opts.title ?? (state.kind === 'confirm' ? '確認' : '輸入')}
            onClick={(e) => e.stopPropagation()}
          >
            {state.opts.title && <h2 className="sr-dialog-title">{state.opts.title}</h2>}
            {state.kind === 'confirm' ? (
              <p className="sr-dialog-message">{state.opts.message}</p>
            ) : (
              <>
                {state.opts.message && <p className="sr-dialog-message">{state.opts.message}</p>}
                {state.opts.multiline ? (
                  <textarea
                    ref={(el) => {
                      inputRef.current = el
                    }}
                    className="sr-input"
                    style={{ width: '100%', minHeight: 90 }}
                    value={value}
                    placeholder={state.opts.placeholder}
                    onChange={(e) => setValue(e.target.value)}
                  />
                ) : (
                  <input
                    ref={(el) => {
                      inputRef.current = el
                    }}
                    className="sr-input"
                    style={{ width: '100%' }}
                    value={value}
                    placeholder={state.opts.placeholder}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') close(value)
                    }}
                  />
                )}
              </>
            )}
            <div className="sr-dialog-actions">
              <button type="button" className="sr-button sr-button-secondary" onClick={() => close(state.kind === 'confirm' ? false : null)}>
                {state.opts.cancelText ?? '取消'}
              </button>
              <button
                type="button"
                className="sr-button"
                style={state.kind === 'confirm' && state.opts.danger ? { background: 'var(--sr-danger)' } : undefined}
                onClick={() => close(state.kind === 'confirm' ? true : value)}
              >
                {state.opts.confirmText ?? '確定'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <DialogContext.Provider value={{ confirm, prompt }}>
      {children}
      {overlay}
    </DialogContext.Provider>
  )
}
