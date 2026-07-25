'use client'

import { useEffect } from 'react'

/**
 * 註冊 /sw.js（PWA 離線殼層）。
 *
 * 刻意跳過 localhost：本機 dev 的 .next chunk 會頻繁變動，SW 介入容易踩到
 * CLAUDE.md 記載的「過期 chunk → CSS 404」問題。SW 只在正式網域啟用，
 * dev 保持乾淨、每次都拿最新檔案。
 */
export function ServiceWorkerRegistrar(): null {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    const host = window.location.hostname
    const isLocal = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')
    if (isLocal) return

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('[sw] 註冊失敗：', err)
      })
    }
    // 等頁面 load 後再註冊，不跟首屏資源搶頻寬
    if (document.readyState === 'complete') register()
    else {
      window.addEventListener('load', register, { once: true })
      return () => window.removeEventListener('load', register)
    }
  }, [])

  return null
}
