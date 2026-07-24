/**
 * C7 驗證：刪 asset 前的引用檢查涵蓋所有 C 新實體（直連 DB）。
 * 用真實的 findReferences，證明 design_snapshot / project 封面 / timeline 封面都被抓到，
 * 且 design_snapshot 標記為不可 cascade（作品版本不可自動刪）。
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import { createAdminClient } from '@snowrealm/db/server'
import { provisionSpaceForUser } from '@snowrealm/db/provisioning'
import { findReferences } from '../apps/web/lib/api/asset-references.js'

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`✗ ${msg}`)
    process.exitCode = 1
    throw new Error(msg)
  }
  console.log(`✓ ${msg}`)
}

async function main() {
  const admin = createAdminClient()
  const email = `c7-${Date.now()}@verify.local`
  const { data: user } = await admin.auth.admin.createUser({ email, email_confirm: true })
  if (!user.user) throw new Error('建立使用者失敗')
  const { spaceId } = await provisionSpaceForUser({ userId: user.user.id, email })

  try {
    const { data: asset } = await admin
      .from('assets')
      .insert({
        space_id: spaceId,
        created_by: user.user.id,
        kind: 'image',
        mime_type: 'image/png',
        bytes: 100,
        checksum: `c7-${Date.now()}`,
        storage_key: `c7/${Date.now()}.png`,
        status: 'ready',
      })
      .select('id')
      .single()
    const assetId = asset!.id

    // 作品 + 版本快照引用這個 asset
    const { data: file } = await admin
      .from('design_files')
      .insert({ space_id: spaceId, created_by: user.user.id, provider: 'upload', title: '海報' })
      .select('id')
      .single()
    await admin.from('design_snapshots').insert({
      space_id: spaceId,
      design_file_id: file!.id,
      asset_id: assetId,
      checksum: `snap-${Date.now()}`,
    })

    // 專案封面 + timeline 封面也引用它
    await admin.from('projects').insert({ space_id: spaceId, created_by: user.user.id, name: '六月', cover_asset_id: assetId })
    await admin.from('timeline_events').insert({
      space_id: spaceId,
      event_type: 'test',
      title: '事件',
      cover_asset_id: assetId,
      occurred_at: new Date().toISOString(),
    })

    const refs = await findReferences(admin, spaceId, assetId)
    const types = refs.map((r) => r.type)

    assert(types.includes('design_snapshot'), 'design_snapshot 引用被抓到')
    assert(types.includes('project_cover'), 'project 封面引用被抓到')
    assert(types.includes('timeline'), 'timeline 封面引用被抓到')

    const snap = refs.find((r) => r.type === 'design_snapshot')!
    assert(snap.cascadable === false, 'design_snapshot 標記為不可 cascade（作品版本不可自動刪）')

    const cover = refs.find((r) => r.type === 'project_cover')!
    assert(cover.cascadable === true, 'project 封面可 cascade（設為 null）')

    console.log('\n✅ C7 引用檢查涵蓋完整')
  } finally {
    await admin.from('spaces').delete().eq('id', spaceId)
    await admin.auth.admin.deleteUser(user.user.id)
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
