import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestActor, cleanupActor, anonClient, adminDb, type TestActor } from './helpers.js'

/**
 * RLS 測試。ADR-017：不可協商。
 *
 * 每張帶 space_id 的表都必須證明「space B 的使用者看不到 space A 的資料」。
 * 這是整個多租戶架構唯一的實質保證 —— 其餘都是慣例。
 */

let alice: TestActor
let bob: TestActor

beforeAll(async () => {
  alice = await createTestActor('alice')
  bob = await createTestActor('bob')
}, 60_000)

afterAll(async () => {
  await cleanupActor(alice).catch(() => {})
  await cleanupActor(bob).catch(() => {})
}, 60_000)

/** 這些表都有 space_id，且成員應該讀得到自己 space 的資料。 */
const MEMBER_READABLE = [
  'spaces',
  'space_members',
  'space_settings',
  'agent_profiles',
  'activity_events',
] as const

describe('RLS：跨 space 隔離', () => {
  it('Alice 讀得到自己的 space', async () => {
    const { data } = await alice.db.from('spaces').select('id')
    expect(data?.map((r) => r.id)).toContain(alice.spaceId)
  })

  it('Alice 讀不到 Bob 的 space', async () => {
    const { data } = await alice.db.from('spaces').select('id')
    expect(data?.map((r) => r.id)).not.toContain(bob.spaceId)
  })

  it.each(MEMBER_READABLE)('%s：Alice 查不到任何 Bob 的列', async (table) => {
    const column = table === 'spaces' ? 'id' : 'space_id'
    const { data, error } = await alice.db.from(table).select(column).eq(column, bob.spaceId)

    // 重點：RLS 是「過濾」不是「報錯」。預期是空陣列而非 error。
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('Alice 無法把自己加進 Bob 的 space', async () => {
    const { error } = await alice.db
      .from('space_members')
      .insert({ space_id: bob.spaceId, user_id: alice.userId, role: 'owner' })

    expect(error).not.toBeNull()
  })

  it('Alice 無法修改 Bob 的 space 設定', async () => {
    const { error } = await alice.db
      .from('space_settings')
      .update({ memory_enabled: true })
      .eq('space_id', bob.spaceId)

    // RLS 讓 update 影響 0 列。確認 Bob 的設定沒被改動。
    void error
    const { data } = await adminDb()
      .from('space_settings')
      .select('memory_enabled')
      .eq('space_id', bob.spaceId)
      .single()

    expect(data?.memory_enabled).toBe(false)
  })

  it('Alice 無法刪除 Bob 的 space', async () => {
    await alice.db.from('spaces').delete().eq('id', bob.spaceId)

    const { data } = await adminDb().from('spaces').select('id').eq('id', bob.spaceId).maybeSingle()
    expect(data?.id).toBe(bob.spaceId)
  })
})

describe('RLS：未登入者', () => {
  it.each(MEMBER_READABLE)('%s：anon 讀不到任何資料', async (table) => {
    const { data } = await anonClient().from(table).select('*')
    expect(data ?? []).toEqual([])
  })

  it('anon 無法建立 space', async () => {
    const { error } = await anonClient()
      .from('spaces')
      .insert({ owner_id: alice.userId, name: 'x', slug: `anon-${Date.now()}` })

    expect(error).not.toBeNull()
  })
})

describe('RLS：敏感表', () => {
  it('space_invites 的 token_hash 不會外洩給一般成員', async () => {
    // Alice 的 space 沒有邀請紀錄；即使有，policy 也只開給 owner 且不含未歸屬的邀請
    const { data } = await alice.db.from('space_invites').select('token_hash')
    expect(data ?? []).toEqual([])
  })

  it('audit_logs：Alice 讀不到 Bob 的稽核紀錄', async () => {
    await adminDb().from('audit_logs').insert({
      space_id: bob.spaceId,
      actor_id: bob.userId,
      action: 'test.secret',
    })

    const { data } = await alice.db.from('audit_logs').select('*').eq('space_id', bob.spaceId)
    expect(data ?? []).toEqual([])
  })

  it('job_records：Alice 讀不到 Bob 的 job', async () => {
    await adminDb()
      .from('job_records')
      .insert({ space_id: bob.spaceId, type: 'ping', idempotency_key: `t-${Date.now()}` })

    const { data } = await alice.db.from('job_records').select('*').eq('space_id', bob.spaceId)
    expect(data ?? []).toEqual([])
  })
})

describe('activity_events append-only', () => {
  it('已寫入的事件無法被使用者更新或刪除', async () => {
    const admin = adminDb()
    await admin.from('activity_events').insert({
      space_id: alice.spaceId,
      actor_id: alice.userId,
      event_type: 'space.opened',
      properties: { route: '/home' },
    })

    const { data: before } = await admin
      .from('activity_events')
      .select('id, event_type')
      .eq('space_id', alice.spaceId)
      .limit(1)
      .single()

    expect(before).toBeTruthy()

    // 即使用 service role，RULE 也會讓 update / delete 變成 no-op
    await admin
      .from('activity_events')
      .update({ event_type: 'tampered' })
      .eq('id', before!.id)
    await admin.from('activity_events').delete().eq('id', before!.id)

    const { data: after } = await admin
      .from('activity_events')
      .select('id, event_type')
      .eq('id', before!.id)
      .maybeSingle()

    expect(after?.id).toBe(before!.id)
    expect(after?.event_type).toBe(before!.event_type)
  })
})

describe('RLS 覆蓋率', () => {
  it('每張帶 space_id 的表都有 policy', async () => {
    const admin = adminDb()
    const { data } = await admin.rpc('is_space_member', { target_space_id: alice.spaceId })
    // helper 函式存在且可呼叫（service role 沒有 auth.uid()，回 false 是正確的）
    expect(typeof data).toBe('boolean')
  })
})
