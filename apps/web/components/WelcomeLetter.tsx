'use client'

import { useEffect, useState } from 'react'

const KEY = 'sr-welcome-dismissed'

/** 幾封不同的歡迎信，讓每個人看到的不完全一樣（依 space 穩定挑一封）。 */
const LETTERS: { lines: string[] }[] = [
  {
    lines: [
      '這是一個只屬於你的小小空間。它會隨著你放進來的東西、留下的痕跡，一點一點長成你的樣子。',
      '不用急著填滿它。慢慢來——把喜歡的照片、想記住的片刻、當下的心情放進來就好。之後回頭看，它們都會在。',
      '我們把隱私放在第一位：AI、記憶、對外連結全都預設關閉，只有你想開才開。這裡沒有別人在看，你可以很自在。祝你在這裡，過得溫暖。🤍',
    ],
  },
  {
    lines: [
      '嗨，歡迎你來。這裡是你的角落，怎麼佈置都行——換個背景、挑個主題、放上你喜歡的東西。',
      '它不追求「完成」，而是陪你慢慢長。今天放一張圖、明天記一句話，日子久了就成了只有你懂的風景。',
      '所有涉及隱私的功能都預設關著，主導權在你手上。願你每次回來，都覺得踏實又自在。🌙',
    ],
  },
  {
    lines: [
      '很高興你來到這裡。把這當成一個可以喘口氣的地方——沒有進度、沒有比較，只有你和你在乎的事。',
      '想收藏的、想紀念的、想偷偷放著的，都可以。它會安靜地替你保管，等你哪天想起。',
      '隱私是預設：AI 與記憶要你親手打開才會運作。慢慢來，這裡不趕你。❄️',
    ],
  },
  {
    lines: [
      '歡迎回到屬於你的雪境。這裡的一切都可以照你的喜好調整，讓它慢慢變成最像你的樣子。',
      '不必一次做完，也不必做給誰看。放上一點點，它就多長一點點。',
      '你的資料只屬於你，能隨時帶走或刪掉。願你在這裡，被好好接住。🤍',
    ],
  },
]

function pick(seed: string): { lines: string[] } {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return LETTERS[h % LETTERS.length]!
}

/**
 * 給一般使用者的歡迎信（生日主角看到的是生日鏈，見 home/page）。
 * 溫暖、不催促、每人挑到的不完全一樣；看過可收起（記 localStorage）。
 */
export function WelcomeLetter({ spaceName, seed }: { spaceName: string; seed: string }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!window.localStorage.getItem(KEY)) setShow(true)
  }, [])

  if (!show) return null
  const letter = pick(seed)

  return (
    <section
      className="sr-card sr-stack"
      aria-label="歡迎"
      style={{ borderColor: 'var(--sr-primary)' }}
    >
      <div className="sr-row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h2 className="sr-section-title" style={{ marginBottom: 0 }}>
          歡迎來到「{spaceName}」
        </h2>
        <button
          type="button"
          className="sr-button sr-button-secondary"
          onClick={() => {
            window.localStorage.setItem(KEY, new Date().toISOString())
            setShow(false)
          }}
        >
          收起
        </button>
      </div>

      <div style={{ lineHeight: 1.9 }}>
        {letter.lines.map((line, i) => (
          <p key={i} style={{ marginTop: i === 0 ? 0 : undefined, marginBottom: i === letter.lines.length - 1 ? 0 : undefined }}>
            {line}
          </p>
        ))}
      </div>

      <p className="sr-muted" style={{ margin: 0, fontSize: 'var(--sr-text-sm)' }}>
        不知道從哪開始？頁尾有「互動教學」帶你走一遍。
      </p>
    </section>
  )
}
