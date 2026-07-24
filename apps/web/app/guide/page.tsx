import type { Metadata } from 'next'
import { GuideClient } from './GuideClient'

export const metadata: Metadata = { title: '使用說明 — SnowRealm Space' }

export default function GuidePage() {
  return (
    <main className="sr-legal">
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <GuideClient />
      </div>
    </main>
  )
}
