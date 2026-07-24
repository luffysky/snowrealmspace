'use client'

import { useEffect, useState } from 'react'

const KEY = 'sr-welcome-dismissed'

/**
 * 給一般使用者的歡迎信（生日主角看到的是生日鏈，見 home/page）。
 * 溫暖、不催促；看過可收起（記 localStorage），不會一直出現。
 */
export function WelcomeLetter({ spaceName }: { spaceName: string }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!window.localStorage.getItem(KEY)) setShow(true)
  }, [])

  if (!show) return null

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
        <p style={{ marginTop: 0 }}>
          這是一個只屬於你的小小空間。它會隨著你放進來的東西、留下的痕跡，一點一點長成你的樣子。
        </p>
        <p>
          不用急著填滿它。慢慢來——把喜歡的照片、想記住的片刻、當下的心情放進來就好。
          之後回頭看，它們都會在。
        </p>
        <p style={{ marginBottom: 0 }}>
          我們把隱私放在第一位：AI、記憶、對外連結全都<strong>預設關閉</strong>，只有你想開才開。
          這裡沒有別人在看，你可以很自在。祝你在這裡，過得溫暖。🤍
        </p>
      </div>

      <p className="sr-muted" style={{ margin: 0, fontSize: 'var(--sr-text-sm)' }}>
        不知道從哪開始？頁尾有「互動教學」帶你走一遍。
      </p>
    </section>
  )
}
