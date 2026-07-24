'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const KEY = 'sr-cookie-consent'

/**
 * Cookie 同意橫幅。我們只用必要 cookie（登入/閘門/偏好），沒有第三方追蹤，
 * 所以是「知情同意」而非「選擇加入追蹤」。記住選擇後就不再出現。
 */
export function CookieConsent() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!window.localStorage.getItem(KEY)) setShow(true)
  }, [])

  if (!show) return null

  function accept() {
    window.localStorage.setItem(KEY, new Date().toISOString())
    setShow(false)
  }

  return (
    <div className="sr-cookie" role="dialog" aria-label="Cookie 說明">
      <p style={{ marginTop: 0 }}>
        本站只使用<strong>必要的 cookie</strong>（登入、進站閘門、深淺色偏好），沒有第三方廣告或追蹤。
        詳見{' '}
        <Link href="/privacy" className="sr-link">
          隱私政策
        </Link>
        。
      </p>
      <div className="sr-btn-row">
        <button type="button" className="sr-button" onClick={accept}>
          我知道了
        </button>
      </div>
    </div>
  )
}
