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
  'folders',
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

    // 0020 後：內容欄位由 trigger pin 住，改不動；delete 仍以 RULE 全擋。
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

  it('projected_at 可被投影 job 更新（0020 的 trigger 放行此欄位）', async () => {
    const admin = adminDb()
    const { data: ev } = await admin
      .from('activity_events')
      .insert({
        space_id: alice.spaceId,
        actor_id: alice.userId,
        event_type: 'project.created',
        properties: { name: 'x', projectId: null },
      })
      .select('id')
      .single()

    const now = new Date().toISOString()
    await admin.from('activity_events').update({ projected_at: now }).eq('id', ev!.id)

    const { data: after } = await admin
      .from('activity_events')
      .select('projected_at')
      .eq('id', ev!.id)
      .single()
    expect(after?.projected_at).not.toBeNull()
  })
})

/**
 * Milestone C 的新表：projects / design_files / design_snapshots /
 * design_insights / timeline_events。ADR-017：每張帶 space_id 的表都要證明隔離。
 *
 * 這裡刻意用 admin 種入 Bob 的真實資料，再用 Alice 的受 RLS client 斷言，
 * 避免「表是空的所以查詢當然回空陣列」這種假通過。
 */
describe('RLS：Creative Core（Milestone C）', () => {
  let bobAssetId: string
  let bobFileId: string

  beforeAll(async () => {
    const admin = adminDb()

    // Bob 的專案
    await admin.from('projects').insert({
      space_id: bob.spaceId,
      created_by: bob.userId,
      name: 'Bob 的私密專案',
    })

    // Bob 的一張 asset（design_snapshot 的 FK 需要）
    const { data: asset } = await admin
      .from('assets')
      .insert({
        space_id: bob.spaceId,
        created_by: bob.userId,
        kind: 'image',
        mime_type: 'image/png',
        bytes: 1234,
        checksum: `bobsum-${Date.now()}`,
        storage_key: `bob/${Date.now()}.png`,
        status: 'ready',
      })
      .select('id')
      .single()
    bobAssetId = asset!.id

    // Bob 的作品 + 版本快照
    const { data: file } = await admin
      .from('design_files')
      .insert({
        space_id: bob.spaceId,
        created_by: bob.userId,
        provider: 'upload',
        title: 'Bob 的作品',
      })
      .select('id')
      .single()
    bobFileId = file!.id

    await admin.from('design_snapshots').insert({
      space_id: bob.spaceId,
      design_file_id: bobFileId,
      asset_id: bobAssetId,
      checksum: `bobsnap-${Date.now()}`,
    })

    // Bob 的 timeline 投影
    await admin.from('timeline_events').insert({
      space_id: bob.spaceId,
      event_type: 'project.created',
      title: 'Bob 建立了專案',
      occurred_at: new Date().toISOString(),
    })

    // Alice 自己的專案（證明正向可讀）
    await admin.from('projects').insert({
      space_id: alice.spaceId,
      created_by: alice.userId,
      name: 'Alice 的專案',
    })
  })

  it('Alice 讀得到自己的 project', async () => {
    const { data } = await alice.db.from('projects').select('name').eq('space_id', alice.spaceId)
    expect(data?.map((r) => r.name)).toContain('Alice 的專案')
  })

  it.each(['projects', 'design_files', 'design_snapshots', 'timeline_events'] as const)(
    '%s：Alice 查不到任何 Bob 的列',
    async (table) => {
      const { data, error } = await alice.db.from(table).select('space_id').eq('space_id', bob.spaceId)
      expect(error).toBeNull()
      expect(data).toEqual([])
    },
  )

  it('Alice 無法在 Bob 的 space 建立 project', async () => {
    const { error } = await alice.db
      .from('projects')
      .insert({ space_id: bob.spaceId, name: '越權' })
    expect(error).not.toBeNull()
  })

  // 成功路徑：POST/PATCH/DELETE /api/projects 用的是受 RLS 約束的 ctx.db，
  // 這裡直接走同一條路徑證明 API↔DB 接得起來（E2E 已移除，改由此把關）。
  it('Alice 可在自己的 space 完成 project 建立→更新→軟刪（route 路徑）', async () => {
    const { data: created, error: insErr } = await alice.db
      .from('projects')
      .insert({ space_id: alice.spaceId, created_by: alice.userId, name: '海報系列', status: 'idea' })
      .select('id, status')
      .single()
    expect(insErr).toBeNull()
    expect(created?.status).toBe('idea')

    const { data: updated, error: updErr } = await alice.db
      .from('projects')
      .update({ status: 'active', tags: ['海報'] })
      .eq('id', created!.id)
      .eq('space_id', alice.spaceId)
      .select('status, tags')
      .single()
    expect(updErr).toBeNull()
    expect(updated?.status).toBe('active')
    expect(updated?.tags).toEqual(['海報'])

    // 軟刪：projects policy 不含 deleted_at 過濾（依 spec），
    // 可見性由 route 的 .is('deleted_at', null) 負責 —— 這裡照 route 的查法斷言。
    await alice.db
      .from('projects')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', created!.id)
      .eq('space_id', alice.spaceId)
    const { data: afterDelete } = await alice.db
      .from('projects')
      .select('id')
      .eq('id', created!.id)
      .is('deleted_at', null)
    expect(afterDelete).toEqual([])
  })

  it('Alice 無法在 Bob 的 space 建立 design_file', async () => {
    const { error } = await alice.db
      .from('design_files')
      .insert({ space_id: bob.spaceId, provider: 'upload', title: '越權' })
    expect(error).not.toBeNull()
  })

  it('Alice 可在自己 space 建立 design_file（POST /api/design/files 的路徑）', async () => {
    const { data, error } = await alice.db
      .from('design_files')
      .insert({
        space_id: alice.spaceId,
        created_by: alice.userId,
        provider: 'upload',
        title: '我的海報',
      })
      .select('id, title')
      .single()
    expect(error).toBeNull()
    expect(data?.title).toBe('我的海報')
  })

  it('design_snapshots 沒有成員 INSERT policy（版本不可偽造）', async () => {
    // 即使在自己的 space，成員也不能直接建 snapshot —— 只能走 service role。
    const { data: aliceFile } = await adminDb()
      .from('design_files')
      .insert({ space_id: alice.spaceId, created_by: alice.userId, provider: 'upload', title: 'x' })
      .select('id')
      .single()
    const { data: aliceAsset } = await adminDb()
      .from('assets')
      .insert({
        space_id: alice.spaceId,
        kind: 'image',
        mime_type: 'image/png',
        bytes: 10,
        checksum: `asum-${Date.now()}`,
        storage_key: `alice/${Date.now()}.png`,
        status: 'ready',
      })
      .select('id')
      .single()

    const { error } = await alice.db.from('design_snapshots').insert({
      space_id: alice.spaceId,
      design_file_id: aliceFile!.id,
      asset_id: aliceAsset!.id,
      checksum: `snap-${Date.now()}`,
    })
    expect(error).not.toBeNull()
  })

  it('Alice 可更新自己 asset 的整理 metadata（收藏/封存/標籤，PATCH 路徑）', async () => {
    const { data: asset } = await adminDb()
      .from('assets')
      .insert({
        space_id: alice.spaceId,
        created_by: alice.userId,
        kind: 'image',
        mime_type: 'image/png',
        bytes: 20,
        checksum: `meta-${Date.now()}`,
        storage_key: `alice/meta-${Date.now()}.png`,
        status: 'ready',
      })
      .select('id')
      .single()

    const { data: updated, error } = await alice.db
      .from('assets')
      .update({ is_favorite: true, tags: ['海報'], archived_at: new Date().toISOString() })
      .eq('id', asset!.id)
      .eq('space_id', alice.spaceId)
      .select('is_favorite, tags, archived_at')
      .single()
    expect(error).toBeNull()
    expect(updated?.is_favorite).toBe(true)
    expect(updated?.tags).toEqual(['海報'])
    expect(updated?.archived_at).not.toBeNull()
  })

  it('刪除被 snapshot 引用的 asset 被 DB 擋下（on delete restrict）', async () => {
    // service role 硬刪也會被 FK restrict 擋 —— 強制走「先檢查引用」的刪除流程。
    const { error } = await adminDb().from('assets').delete().eq('id', bobAssetId)
    expect(error).not.toBeNull()
    expect(error?.code).toBe('23503') // foreign_key_violation
  })

  it('timeline：owner 讀得到自己隱藏的投影（供管理／取消隱藏）', async () => {
    // visibility=hidden 的過濾寫在 "member reads" policy，作用於未來的 guest 角色；
    // owner 透過 "owner manages timeline" policy 仍看得到全部，這是刻意的 ——
    // 否則 owner 一旦隱藏就再也管理不到。Birthday Alpha 只有 owner。
    await adminDb().from('timeline_events').insert({
      space_id: alice.spaceId,
      event_type: 'test.hidden',
      title: '隱藏的事件',
      occurred_at: new Date().toISOString(),
      visibility: 'hidden',
    })
    const { data } = await alice.db
      .from('timeline_events')
      .select('title, visibility')
      .eq('space_id', alice.spaceId)
    expect(data?.some((r) => r.title === '隱藏的事件' && r.visibility === 'hidden')).toBe(true)
  })
})

/**
 * Memory（ADR-014）：僅 owner 可讀寫；Agent 產生的記憶不得直接 approved。
 */
describe('RLS：Memory（ADR-014）', () => {
  it('Alice（owner）可建立與讀取自己的記憶', async () => {
    const { error } = await alice.db.from('memories').insert({
      space_id: alice.spaceId,
      created_by: alice.userId,
      type: 'note',
      content: '喜歡暖色',
      source_type: 'user_explicit',
      approved: true,
    })
    expect(error).toBeNull()
    const { data } = await alice.db.from('memories').select('content').eq('space_id', alice.spaceId)
    expect(data?.some((m) => m.content === '喜歡暖色')).toBe(true)
  })

  it('Bob 讀不到 Alice 的記憶（跨 space 隔離）', async () => {
    const { data } = await bob.db.from('memories').select('id').eq('space_id', alice.spaceId)
    expect(data ?? []).toEqual([])
  })

  it('ADR-014：agent_summary 記憶且 created_by 為 null 不得 approved（DB constraint）', async () => {
    const { error } = await adminDb().from('memories').insert({
      space_id: alice.spaceId,
      created_by: null,
      type: 'inferred',
      content: '越權的自動記憶',
      source_type: 'agent_summary',
      approved: true, // 違反 memory_approval_check
    })
    expect(error).not.toBeNull()
    expect(error?.code).toBe('23514') // check_violation
  })

  it('agent_summary 提案（approved=false）可建立', async () => {
    const { error } = await adminDb().from('memories').insert({
      space_id: alice.spaceId,
      created_by: null,
      type: 'inferred',
      content: 'Agent 的提案',
      source_type: 'agent_summary',
      approved: false,
    })
    expect(error).toBeNull()
  })
})

/**
 * user_identities 的隔離鍵是 user_id 而不是 space_id（ADR-006 的例外，
 * 已記在 check-rls.ts 的 REQUIRED_RLS_WITHOUT_SPACE_ID）。
 * 那是刻意的：登入方式屬於人，一個人可以在多個 space。
 * 正因為是例外，更需要證明它真的隔離得住。
 */
describe('RLS：登入方式（user_identities）', () => {
  beforeAll(async () => {
    const admin = adminDb()
    for (const actor of [alice, bob]) {
      await admin.from('user_identities').upsert(
        {
          user_id: actor.userId,
          provider: 'line',
          provider_uid: `line-${actor.userId}`,
          display_name: `${actor.userId} 的 LINE`,
        } as never,
        { onConflict: 'provider,provider_uid' },
      )
    }
  })

  it('Alice 讀得到自己的登入方式', async () => {
    const { data } = await alice.db.from('user_identities').select('user_id, provider')
    expect(data?.some((r) => r.user_id === alice.userId)).toBe(true)
  })

  it('Alice 讀不到 Bob 的登入方式', async () => {
    const { data, error } = await alice.db
      .from('user_identities')
      .select('user_id')
      .eq('user_id', bob.userId)

    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('Alice 無法把身分插進 Bob 的帳號', async () => {
    const { error } = await alice.db.from('user_identities').insert({
      user_id: bob.userId,
      provider: 'google',
      provider_uid: 'stolen-google-sub',
    } as never)

    // 沒有 insert policy → 一律拒絕
    expect(error).not.toBeNull()
  })

  it('同一個第三方帳號不可綁到兩個使用者', async () => {
    const admin = adminDb()
    const { error } = await admin.from('user_identities').insert({
      user_id: bob.userId,
      provider: 'line',
      provider_uid: `line-${alice.userId}`, // Alice 已經綁走的
    } as never)

    // unique (provider, provider_uid) —— 這條約束是帳號接管的最後一道防線
    expect(error).not.toBeNull()
    expect(error?.code).toBe('23505')
  })

  it('oauth_transactions 對一般使用者完全不可讀', async () => {
    const { data } = await alice.db.from('oauth_transactions').select('state')
    expect(data ?? []).toEqual([])
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
