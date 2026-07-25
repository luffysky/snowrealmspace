/*
 * SnowRealm Space — Service Worker
 *
 * 設計原則（避開 CLAUDE.md 記載的「.next chunk 過期 → CSS 404」陷阱）：
 *  - 導覽（HTML）走 network-first：永遠拿最新頁面，離線才退回 offline.html。
 *    → 絕不服務過期的 HTML/入口，部署後立即生效。
 *  - 只有「內容雜湊、不可變」的靜態資產（/_next/static、字型、圖示）走 cache-first。
 *    新部署 = 新雜湊檔名 = cache miss = 重新抓，因此不可能服務到錯誤版本的 chunk。
 *  - API 與其他動態請求：完全不介入（直接走網路，避免快取到帶授權的回應）。
 *  - 版本號一升，activate 清掉所有舊 cache。
 */
const VERSION = 'sr-v1'
const STATIC_CACHE = `sr-static-${VERSION}`
const OFFLINE_URL = '/offline.html'
const PRECACHE = [OFFLINE_URL, '/icon-192.png', '/icon-512.png', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

const IMMUTABLE = /\.(?:png|svg|webp|jpg|jpeg|gif|ico|woff2?|ttf)$/i

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // 導覽：network-first，離線退回 offline page
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((r) => r ?? new Response('離線中', { status: 503 })),
      ),
    )
    return
  }

  // 不可變靜態資產：cache-first
  const isImmutable = url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/fonts/') || IMMUTABLE.test(url.pathname)
  if (isImmutable) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((res) => {
          if (res && res.ok) {
            const copy = res.clone()
            caches.open(STATIC_CACHE).then((c) => c.put(request, copy))
          }
          return res
        })
      }),
    )
    return
  }

  // 其餘（API/動態）：不介入
})
