'use client'

import Link from 'next/link'
import { startTutorial } from '@/components/tutorial/TutorialController'

/** 頁尾：法律/說明連結 + 叫出互動教學。 */
export function SiteFooter() {
  return (
    <footer className="sr-footer">
      <div className="sr-footer-links">
        <Link href="/guide" className="sr-link">
          使用說明
        </Link>
        <button
          type="button"
          className="sr-linkish"
          onClick={() => startTutorial('library')}
          style={{ background: 'none', border: 0, cursor: 'pointer', font: 'inherit' }}
        >
          ▶ 互動教學
        </button>
        <Link href="/privacy" className="sr-link">
          隱私政策
        </Link>
        <Link href="/terms" className="sr-link">
          使用條款
        </Link>
        <span className="sr-muted">© {'SnowRealm'}</span>
      </div>
    </footer>
  )
}
