import type { Metadata, Viewport } from 'next'
import { DEFAULT_THEME } from '@/lib/theme-defaults'
import { TutorialHost } from '@/components/tutorial/TutorialController'
import { CookieConsent } from '@/components/CookieConsent'
import '@/styles/globals.css'

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://snowrealm-space.snowrealm.pet'
const DESCRIPTION = '一個會隨你長期使用而成長的私人數位空間。'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'SnowRealm Space', template: '%s — SnowRealm Space' },
  description: DESCRIPTION,
  applicationName: 'SnowRealm Space',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'SnowRealm', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    siteName: 'SnowRealm Space',
    title: 'SnowRealm Space',
    description: DESCRIPTION,
    locale: 'zh_TW',
    images: [{ url: '/icon-512.png', width: 512, height: 512, alt: 'SnowRealm Space' }],
  },
  twitter: { card: 'summary', title: 'SnowRealm Space', description: DESCRIPTION, images: ['/icon-512.png'] },
  // 封閉測試（邀請制、站台閘門後）階段先不讓搜尋引擎索引；對外開放時改成 index:true。
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: DEFAULT_THEME.browserThemeColor,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant-TW">
      <body>
        {children}
        <TutorialHost />
        <CookieConsent />
      </body>
    </html>
  )
}
