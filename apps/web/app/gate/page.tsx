import type { Metadata } from 'next'
import { GateForm } from './GateForm'

export const metadata: Metadata = { title: 'SnowRealm Space' }
export const dynamic = 'force-dynamic'

/**
 * 站台密碼閘門頁。尚未對外開放時，middleware 把所有請求導到這裡，
 * 輸入正確密碼才放行。
 */
export default async function GatePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams

  return (
    <main className="sr-center">
      <div className="sr-card" style={{ maxWidth: 380, width: '100%', textAlign: 'center' }}>
        <h1 style={{ fontSize: 'var(--sr-text-h2)', marginBottom: 'var(--sr-space-2)' }}>
          SnowRealm Space
        </h1>
        <p className="sr-muted" style={{ marginTop: 0, marginBottom: 'var(--sr-space-6)' }}>
          這裡還沒對外開放。
        </p>
        <GateForm next={typeof next === 'string' ? next : '/'} />
      </div>
    </main>
  )
}
