'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatedEmoji } from './AnimatedEmoji'

/**
 * 表情選擇器（移植自 AI 島）：搜尋 + 分類 tab + 顔文字，格子用動態 emoji（Noto）預覽。
 * portal + fixed 定位到 body（逃出 overflow 容器不被裁切）；底部空間不夠就往上開。
 * 插入的是純 emoji 字元（聊天輸入框是純文字）。
 */

const PANEL_W = 300

const CATEGORIES: { id: string; icon: string; name: string; emojis: string[] }[] = [
  { id: 'faces', icon: '😀', name: '表情', emojis: '😀 😃 😄 😁 😆 😅 😂 🤣 🥲 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 🤨 🧐 🤓 😎 🥳 😏 😒 😞 😔 😟 😕 🙁 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔 🫡 🤭 🫢 😶 😐 😑 😬 🙄 😯 😲 🥱 😴 🤤 😷 🤒 🤕 🤢 🤮 🤧 🥴 😵 🤠 🥸 🤡 👻 💀 👽 🤖 💩'.split(' ') },
  { id: 'gestures', icon: '👍', name: '手勢', emojis: '👍 👎 👌 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐️ 🖖 👋 🤝 🙏 ✍️ 💪 🦾 👏 🙌 👐 🤲 🫶 🤜 🤛 ✊ 👊 🫵'.split(' ') },
  { id: 'hearts', icon: '❤️', name: '愛心', emojis: '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ♥️ 💌 💋 💯'.split(' ') },
  { id: 'animals', icon: '🐾', name: '動物', emojis: '🐱 🐶 🐰 🐹 🐭 🐷 🐸 🐵 🙈 🙉 🙊 🐔 🐧 🐦 🐤 🦆 🦅 🦉 🦇 🐺 🐗 🐴 🦄 🐝 🐛 🦋 🐌 🐞 🐜 🕷️ 🐢 🐍 🦎 🐙 🦑 🦀 🐠 🐟 🐬 🐳 🐋 🦈 🐊 🐅 🐆 🦓 🦍 🐘 🦛 🦏 🐪 🦒 🐄 🐕 🐈 🦔 🐾'.split(' ') },
  { id: 'food', icon: '🍔', name: '食物', emojis: '🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🥑 🥦 🌽 🥕 🥔 🍠 🥐 🍞 🥖 🧀 🥚 🍳 🥞 🧇 🥓 🍔 🍟 🍕 🌭 🥪 🌮 🌯 🥗 🍜 🍝 🍣 🍱 🍙 🍤 🍦 🍰 🎂 🧁 🍫 🍬 🍭 🍩 🍪 ☕ 🍵 🧋 🥤 🍺 🥂 🍷'.split(' ') },
  { id: 'activity', icon: '⚽', name: '活動', emojis: '⚽ 🏀 🏈 ⚾ 🎾 🏐 🏉 🎱 🏓 🏸 🥅 🏒 🏑 🥍 🏹 🎣 🥊 🥋 ⛳ ⛸️ 🎿 🏂 🏋️ 🤸 🤾 🏌️ 🧘 🏄 🏊 🚴 🎮 🕹️ 🎲 🧩 🎯 🎳 🎨 🎭 🎬 🎤 🎧 🎹 🥁 🎸 🎺 🎻 🏆 🥇 🥈 🥉 🏅'.split(' ') },
  { id: 'objects', icon: '💡', name: '物品', emojis: '⌚ 📱 💻 ⌨️ 🖥️ 🖨️ 🖱️ 💾 📀 📷 📸 🎥 📹 🔍 🔎 💡 🔦 🕯️ 📔 📕 📗 📘 📙 📚 📖 🔖 📝 ✏️ 🖊️ 🖌️ 📐 📏 📌 📎 🔗 📅 📆 📊 📈 📉 💰 💸 💳 💎 🔧 🔨 ⚙️ 🧲 🔑 🚪 🎁 🎈 🎉 🎊 🔔'.split(' ') },
  { id: 'symbols', icon: '✨', name: '符號', emojis: '✅ ❌ ⭕ ❗ ❓ ‼️ ⚠️ 🚫 💯 🔥 ⭐ 🌟 💫 ✨ 💥 💢 💨 💦 🎵 🎶 ➕ ➖ ✔️ ☑️ 🆗 🆕 🆒 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ 🟥 🟧 🟨 🟩 🟦 🟪 🔺 🔻 💠 🔘 🏁 🚩'.split(' ') },
  { id: 'nature', icon: '🌸', name: '自然', emojis: '🌸 🌺 🌻 🌹 🌷 🌼 💐 🌿 🍀 🌱 🌳 🌲 🌴 🌵 🎋 🍁 🍂 🍃 🌾 🌊 🔥 💧 🌈 ☀️ 🌤️ ⛅ ☁️ 🌧️ ⛈️ ❄️ ⛄ 🌙 🌝 ⭐ 🌟 💫 🌍 🌎 🌏 🪐 🌋 🏔️ 🏝️ 🌅'.split(' ') },
]

const KAOMOJI = [
  '(｡・ω・｡)', '(≧▽≦)', '(´｡• ᵕ •｡`)', '(๑˃ᴗ˂)ﻭ', '(*≧ω≦*)', 'ヽ(・∀・)ﾉ', '(＾▽＾)', '(◕‿◕)', '(✿◕‿◕)', '(｡♥‿♥｡)',
  '(♡˙︶˙♡)', '(*´꒳`*)', '(っ˘ω˘ς)', '(ᵔ◡ᵔ)', 'ʕ•ᴥ•ʔ', '(=^･ω･^=)', '(｡•́︿•̀｡)', '(╥﹏╥)', '(¬‿¬)', '(⊙_⊙)',
  '(*^▽^*)', '(๑>◡<๑)', 'o(≧□≦)o', '٩(◕‿◕)۶', '(づ￣ ³￣)づ', '(๑•̀ㅂ•́)و✧', 'ヽ(´▽`)/', '(´；ω；`)', '(＞﹏＜)', '(╯°□°）╯︵ ┻━┻',
  '¯\\_(ツ)_/¯', '(◍•ᴗ•◍)', '(｡•̀ᴗ-)✧', '(´ ▽ ` )ﾉ', '(*´∀`)~♥', '(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧',
]

const ALL_EMOJIS = [...new Set(CATEGORIES.flatMap((c) => c.emojis))]

export function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [cat, setCat] = useState('faces')
  const [q, setQ] = useState('')
  const [pos, setPos] = useState<{ left: number; top: number; above: boolean } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])

  const place = () => {
    const b = btnRef.current?.getBoundingClientRect()
    if (!b || typeof window === 'undefined') return
    const vw = window.innerWidth
    const vh = window.innerHeight
    const w = Math.min(PANEL_W, vw - 16)
    const left = Math.max(8, Math.min(b.left, vw - w - 8))
    const above = b.top > Math.min(360, vh - 80)
    setPos({ left, top: above ? b.top - 8 : b.bottom + 8, above })
  }

  useLayoutEffect(() => {
    if (open) place()
  }, [open, q, cat])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pick = (e: string) => {
    onSelect(e)
    setOpen(false)
    setQ('')
  }

  const isKao = cat === 'kaomoji' && !q.trim()
  const list = q.trim()
    ? ALL_EMOJIS
    : isKao
      ? KAOMOJI
      : (CATEGORIES.find((c) => c.id === cat)?.emojis ?? [])

  const w = mounted ? Math.min(PANEL_W, window.innerWidth - 16) : PANEL_W

  const panel = open && pos && (
    <div
      ref={panelRef}
      className="sr-emoji-panel"
      style={{ left: pos.left, top: pos.top, width: w, transform: pos.above ? 'translateY(-100%)' : undefined }}
      role="dialog"
      aria-label="表情選擇器"
    >
      <input
        className="sr-input"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="搜尋表情…"
        autoFocus
        style={{ marginBottom: 'var(--sr-space-2)' }}
      />
      {!q && (
        <div className="sr-emoji-tabs" role="tablist" aria-label="分類">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={cat === c.id}
              className={`sr-emoji-tab${cat === c.id ? ' is-active' : ''}`}
              title={c.name}
              aria-label={c.name}
              onClick={() => setCat(c.id)}
            >
              {c.icon}
            </button>
          ))}
          <button
            type="button"
            role="tab"
            aria-selected={cat === 'kaomoji'}
            className={`sr-emoji-tab${cat === 'kaomoji' ? ' is-active' : ''}`}
            title="顔文字"
            aria-label="顔文字"
            onClick={() => setCat('kaomoji')}
          >
            ツ
          </button>
        </div>
      )}
      <div className="sr-emoji-scroll">
        {isKao ? (
          <div className="sr-kaomoji-grid">
            {KAOMOJI.map((k, i) => (
              <button key={`${k}-${i}`} type="button" className="sr-kaomoji-cell" title={k} onClick={() => pick(k)}>
                {k}
              </button>
            ))}
          </div>
        ) : (
          <div className="sr-emoji-grid">
            {list.map((e, i) => (
              <button key={`${e}-${i}`} type="button" className="sr-emoji-cell" title={e} onClick={() => pick(e)}>
                <AnimatedEmoji emoji={e} size={26} />
              </button>
            ))}
          </div>
        )}
        {q && list.length === 0 && <p className="sr-muted" style={{ textAlign: 'center', margin: 'var(--sr-space-4) 0' }}>沒有結果</p>}
      </div>
    </div>
  )

  return (
    <>
      <button ref={btnRef} type="button" className="sr-rich-btn" onClick={() => setOpen((o) => !o)} title="表情" aria-label="插入表情">
        🙂
      </button>
      {mounted && panel ? createPortal(panel, document.body) : null}
    </>
  )
}
