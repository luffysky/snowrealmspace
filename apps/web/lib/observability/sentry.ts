import { randomUUID } from 'node:crypto'

/**
 * 極簡 Sentry 上報（server-only）。沒設 SENTRY_DSN 就完全 no-op（誠實：不假裝有監控）。
 *
 * 刻意不引 @sentry/nextjs：那會包 next.config + 加 build-time plugin，對「還沒有 DSN」
 * 的情況是純負擔、且動到 build（會自動部署）風險高。這裡只用一個 fetch 送 envelope，
 * 設了 DSN 就會動、沒設就靜默跳過，零 build 風險。
 *
 * 之後若要完整功能（source maps、tracing、前端錯誤）再換 @sentry/nextjs。
 */

type CaptureContext = { tags?: Record<string, string>; extra?: Record<string, unknown> }

function parseDsn(dsn: string): { endpoint: string; publicKey: string } | null {
  try {
    const u = new URL(dsn)
    const segs = u.pathname.split('/').filter(Boolean)
    const projectId = segs.pop()
    if (!u.username || !projectId) return null
    const prefix = segs.length ? `/${segs.join('/')}` : ''
    return {
      endpoint: `${u.protocol}//${u.host}${prefix}/api/${projectId}/envelope/`,
      publicKey: u.username,
    }
  } catch {
    return null
  }
}

export async function captureException(err: unknown, context?: CaptureContext): Promise<void> {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) return
  const parsed = parseDsn(dsn)
  if (!parsed) {
    console.error('[sentry] DSN 格式無法解析，略過上報')
    return
  }

  const error = err instanceof Error ? err : new Error(typeof err === 'string' ? err : 'Unknown error')
  const eventId = randomUUID().replace(/-/g, '')
  const sentAt = new Date().toISOString()

  const event = {
    event_id: eventId,
    timestamp: Date.now() / 1000,
    platform: 'node',
    level: 'error',
    environment: process.env.NODE_ENV ?? 'production',
    exception: { values: [{ type: error.name, value: error.message }] },
    ...(context?.tags ? { tags: context.tags } : {}),
    extra: { ...(context?.extra ?? {}), stack: error.stack ?? null },
  }

  const body = [
    JSON.stringify({ event_id: eventId, sent_at: sentAt, dsn }),
    JSON.stringify({ type: 'event' }),
    JSON.stringify(event),
  ].join('\n')

  try {
    await fetch(parsed.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-sentry-envelope',
        'x-sentry-auth': `Sentry sentry_version=7, sentry_client=snowrealm-lite/1.0, sentry_key=${parsed.publicKey}`,
      },
      body,
      signal: AbortSignal.timeout(3000),
    })
  } catch (e) {
    // 上報失敗不致命，但也不吞：log 出來（監控自己壞掉也要看得到）
    console.error('[sentry] 上報失敗', (e as Error).message)
  }
}
