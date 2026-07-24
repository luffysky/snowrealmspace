import type { Metadata, Viewport } from 'next'
import { DEFAULT_THEME } from '@/lib/theme-defaults'
import { TutorialHost } from '@/components/tutorial/TutorialController'
import { CookieConsent } from '@/components/CookieConsent'
import '@/styles/globals.css'

export const metadata: Metadata = {
  title: 'SnowRealm Space',
  description: '一個會隨你長期使用而成長的私人數位空間。',
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
