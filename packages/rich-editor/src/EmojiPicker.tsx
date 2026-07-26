'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * 表情選擇器（手刻，無外部依賴）。
 * 面板用 portal 掛到 body + fixed 定位，避開工具列的 overflow 裁切。
 */

const GROUPS: { label: string; emojis: string[] }[] = [
  { label: '表情', emojis: '😀 😄 😁 😊 🙂 😉 😍 🥰 😘 😎 🤔 🙃 😌 😴 😷 🤒 😭 😢 😅 😂 🤣 😳 😱 🥳 🤗 🤩 😏 😒 😔 😩 😤 😠 🥺 😇 🤠 🤡'.split(' ') },
  { label: '手勢', emojis: '👍 👎 👏 🙌 🙏 👌 ✌️ 🤞 🤙 💪 👋 🤝 ✋ 🖐️ 👀 🫶 🤟'.split(' ') },
  { label: '心情', emojis: '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💖 💗 💓 💞 💕 ✨ 🌟 ⭐ 🔥 💯 🎉 🎊 🌈 ☀️ 🌙 ⛅ ☁️ ❄️ 🌸 🌺 🌼 🌷 🍀'.split(' ') },
  { label: '生活', emojis: '☕ 🍵 🍰 🍩 🍪 🍎 🍓 🍑 🍉 🥑 🍜 🍔 🍕 🎂 🎁 📚 ✏️ 🖊️ 🎨 🎵 🎶 💡 ⏰ 📌 ✅ ❌ ⚡ 💤'.split(' ') },
]

export function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [mounted, setMounted] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      const t = e.target as Node
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const PANEL_H = 320
      const left = Math.max(8, Math.min(r.left, window.innerWidth - 300))
      // 下方空間不夠（例如底部的漂浮對話）就往上開，避免被裁切
      const top = window.innerHeight - r.bottom >= PANEL_H ? r.bottom + 6 : Math.max(8, r.top - PANEL_H - 6)
      setPos({ top, left })
    }
    setOpen((o) => !o)
  }

  return (
    <>
      <button ref={btnRef} type="button" className="sr-rich-btn" onClick={toggle} title="表情" aria-label="插入表情">
        🙂
      </button>
      {open && mounted && pos && createPortal(
        <div ref={panelRef} className="sr-emoji-panel" style={{ top: pos.top, left: pos.left }} role="dialog" aria-label="表情選擇器">
          {GROUPS.map((g) => (
            <div key={g.label}>
              <p className="sr-emoji-group">{g.label}</p>
              <div className="sr-emoji-grid">
                {g.emojis.map((e) => (
                  <button
                    key={e}
                    type="button"
                    className="sr-emoji-cell"
                    onClick={() => {
                      onSelect(e)
                      setOpen(false)
                    }}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </>
  )
}
