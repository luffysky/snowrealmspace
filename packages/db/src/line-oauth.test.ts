import { describe, it, expect, afterEach } from 'vitest'
import { buildAuthorizeUrl, claimsToProfile, constantTimeEqual, lineConfig } from './line-oauth.js'

/**
 * 只測純函式。需要資料庫或 LINE 伺服器的部分由 E2E 涵蓋。
 *
 * 這裡測的每一項都是「寫錯了也不會有執行期錯誤」的類型 ——
 * scope 少一個、nonce 忘了帶、未驗證的 email 被當成已驗證，
 * 程式照跑，只有被攻擊時才會知道。
 */

const CFG = {
  channelId: '1234567890',
  channelSecret: 'secret',
  redirectUri: 'https://example.com/api/auth/line/callback',
}

describe('buildAuthorizeUrl', () => {
  const url = new URL(buildAuthorizeUrl(CFG, 'the-state', 'the-nonce'))
  const q = url.searchParams

  it('指向 LINE 的授權端點', () => {
    expect(url.origin + url.pathname).toBe('https://access.line.me/oauth2/v2.1/authorize')
  })

  it('用 authorization code flow', () => {
    expect(q.get('response_type')).toBe('code')
  })

  it('帶上 state —— 少了它就沒有 CSRF 防護', () => {
    expect(q.get('state')).toBe('the-state')
  })

  it('帶上 nonce —— 少了它 id_token 可被重放', () => {
    expect(q.get('nonce')).toBe('the-nonce')
  })

  it('scope 含 openid，否則根本拿不到 id_token', () => {
    expect(q.get('scope')?.split(' ')).toContain('openid')
  })

  it('redirect_uri 原樣送出（LINE 端要求完全一致，多一個斜線就失敗）', () => {
    expect(q.get('redirect_uri')).toBe(CFG.redirectUri)
  })

  it('不外洩 channel secret', () => {
    expect(url.toString()).not.toContain(CFG.channelSecret)
  })

  it('state 與 nonce 是不同的值時不會互相覆蓋', () => {
    const other = new URL(buildAuthorizeUrl(CFG, 'a', 'b'))
    expect(other.searchParams.get('state')).toBe('a')
    expect(other.searchParams.get('nonce')).toBe('b')
  })
})

describe('claimsToProfile', () => {
  it('有 email 就視為已驗證（LINE 只在驗證過時才回傳）', () => {
    const p = claimsToProfile({ sub: 'U1', email: 'a@b.c' })
    expect(p.emailVerified).toBe(true)
    expect(p.email).toBe('a@b.c')
  })

  it('沒有 email 時 emailVerified 必須是 false —— 這條擋的是帳號接管', () => {
    const p = claimsToProfile({ sub: 'U1' })
    expect(p.email).toBeNull()
    expect(p.emailVerified).toBe(false)
  })

  it('空字串 email 不算已驗證', () => {
    const p = claimsToProfile({ sub: 'U1', email: '' })
    expect(p.emailVerified).toBe(false)
  })

  it('缺少的欄位一律為 null 而不是 undefined', () => {
    const p = claimsToProfile({ sub: 'U1' })
    expect(p.displayName).toBeNull()
    expect(p.pictureUrl).toBeNull()
  })

  it('sub 就是 LINE userId', () => {
    expect(claimsToProfile({ sub: 'Uabc123' }).userId).toBe('Uabc123')
  })
})

describe('constantTimeEqual', () => {
  it('相同字串為 true', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true)
  })

  it('不同字串為 false', () => {
    expect(constantTimeEqual('abc', 'abd')).toBe(false)
  })

  it('長度不同也能比較而不拋錯（先 hash 成固定長度）', () => {
    expect(constantTimeEqual('a', 'aaaaaaaaaaaaaaaa')).toBe(false)
  })

  it('空字串不等於任何非空字串 —— nonce 缺漏不可被當成相符', () => {
    expect(constantTimeEqual('', 'the-nonce')).toBe(false)
    expect(constantTimeEqual('', '')).toBe(true)
  })
})

describe('lineConfig', () => {
  const saved = { ...process.env }
  afterEach(() => {
    process.env = { ...saved }
  })

  it('三個變數都有才回傳設定', () => {
    process.env['LINE_LOGIN_CHANNEL_ID'] = '1'
    process.env['LINE_LOGIN_CHANNEL_SECRET'] = '2'
    process.env['LINE_LOGIN_REDIRECT_URI'] = 'https://x/cb'
    expect(lineConfig()).toEqual({
      channelId: '1',
      channelSecret: '2',
      redirectUri: 'https://x/cb',
    })
  })

  it.each(['LINE_LOGIN_CHANNEL_ID', 'LINE_LOGIN_CHANNEL_SECRET', 'LINE_LOGIN_REDIRECT_URI'])(
    '少了 %s 就回 null（功能整個關閉，而不是半開）',
    (missing) => {
      process.env['LINE_LOGIN_CHANNEL_ID'] = '1'
      process.env['LINE_LOGIN_CHANNEL_SECRET'] = '2'
      process.env['LINE_LOGIN_REDIRECT_URI'] = 'https://x/cb'
      delete process.env[missing]
      expect(lineConfig()).toBeNull()
    },
  )

  it('空字串視同未設定', () => {
    process.env['LINE_LOGIN_CHANNEL_ID'] = ''
    process.env['LINE_LOGIN_CHANNEL_SECRET'] = '2'
    process.env['LINE_LOGIN_REDIRECT_URI'] = 'https://x/cb'
    expect(lineConfig()).toBeNull()
  })
})
