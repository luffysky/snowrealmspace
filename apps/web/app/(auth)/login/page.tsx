import type { Metadata } from 'next'
import { LoginForm } from './LoginForm'

export const metadata: Metadata = { title: '登入 — SnowRealm Space' }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null

  return (
    <main className="sr-center">
      <div className="sr-card" style={{ maxWidth: 420, width: '100%' }}>
        <h1 style={{ fontSize: 'var(--sr-text-h2)', marginBottom: 'var(--sr-space-2)' }}>
          SnowRealm Space
        </h1>
        <p className="sr-muted" style={{ marginTop: 0, marginBottom: 'var(--sr-space-6)' }}>
          一個會隨你長期使用而成長的私人數位空間。
        </p>
        <LoginForm
          inviteToken={first(params['invite'])}
          next={first(params['next']) ?? '/home'}
          error={first(params['error'])}
        />
      </div>
    </main>
  )
}
