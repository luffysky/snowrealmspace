import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { serverEnv, publicEnv, resetEnvCache } from './env.js'

const VALID_32_BYTE_B64 = Buffer.alloc(32, 7).toString('base64')

const VALID: Record<string, string> = {
  NODE_ENV: 'test',
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  R2_ACCOUNT_ID: 'acct',
  R2_ACCESS_KEY_ID: 'akid',
  R2_SECRET_ACCESS_KEY: 'secret',
  R2_BUCKET: 'bucket',
  AI_KEY_ENCRYPTION_SECRET: VALID_32_BYTE_B64,
  TOKEN_ENCRYPTION_SECRET: VALID_32_BYTE_B64,
  CRON_SECRET: 'c'.repeat(32),
}

let original: NodeJS.ProcessEnv

beforeEach(() => {
  original = process.env
  process.env = { ...VALID }
  resetEnvCache()
})

afterEach(() => {
  process.env = original
  resetEnvCache()
})

describe('serverEnv', () => {
  it('接受完整的合法設定', () => {
    expect(() => serverEnv()).not.toThrow()
    expect(serverEnv().R2_BUCKET).toBe('bucket')
  })

  it('缺少必要變數時拋出，且訊息指出是哪個', () => {
    delete process.env['CRON_SECRET']
    resetEnvCache()
    expect(() => serverEnv()).toThrow(/CRON_SECRET/)
  })

  it('加密金鑰長度不是 32 bytes 時拋出', () => {
    process.env['AI_KEY_ENCRYPTION_SECRET'] = Buffer.alloc(16).toString('base64')
    resetEnvCache()
    expect(() => serverEnv()).toThrow(/AI_KEY_ENCRYPTION_SECRET/)
  })

  it('CRON_SECRET 太短時拋出', () => {
    process.env['CRON_SECRET'] = 'short'
    resetEnvCache()
    expect(() => serverEnv()).toThrow(/CRON_SECRET/)
  })

  it('AI 金鑰全部缺席仍可通過（ADR-023：路由層會跳過沒金鑰的候選）', () => {
    expect(() => serverEnv()).not.toThrow()
    expect(serverEnv().ANTHROPIC_API_KEY).toBeUndefined()
    expect(serverEnv().GROQ_API_KEY).toBeUndefined()
  })

  it('錯誤訊息不包含任何變數的值', () => {
    process.env['CRON_SECRET'] = 'leaked-secret-value-should-not-appear'
    process.env['DATABASE_URL'] = ''
    resetEnvCache()
    try {
      serverEnv()
      expect.unreachable('應該要拋出')
    } catch (err) {
      expect(String(err)).not.toContain('leaked-secret-value-should-not-appear')
    }
  })

  it('結果會被快取', () => {
    const first = serverEnv()
    expect(serverEnv()).toBe(first)
  })
})

describe('publicEnv', () => {
  it('只驗證 NEXT_PUBLIC_* 變數', () => {
    delete process.env['SUPABASE_SERVICE_ROLE_KEY']
    expect(() => publicEnv()).not.toThrow()
  })

  it('回傳值不含任何伺服器端變數', () => {
    const env = publicEnv()
    expect(Object.keys(env).every((k) => k.startsWith('NEXT_PUBLIC_'))).toBe(true)
  })

  it('URL 格式不合法時拋出', () => {
    process.env['NEXT_PUBLIC_SUPABASE_URL'] = 'not-a-url'
    expect(() => publicEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/)
  })
})
