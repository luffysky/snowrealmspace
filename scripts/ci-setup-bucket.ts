/**
 * 建立本機/CI 用的儲存 bucket。
 *
 * 正式環境的 R2 bucket 由 Cloudflare 端建立，不走這支。
 * 冪等：bucket 已存在時視為成功。
 */
import { config } from 'dotenv'

config({ path: '.env.local' })
config({ path: '.env' })

const { createAdminClient } = await import('@snowrealm/db/server')

const bucket = process.env.R2_BUCKET ?? 'snowrealm-dev'
const { error } = await createAdminClient().storage.createBucket(bucket, { public: false })

if (error && !/already exists|Duplicate/i.test(error.message)) {
  console.error(`建立 bucket 失敗：${error.message}`)
  process.exit(1)
}

console.log(error ? `✓ bucket ${bucket} 已存在` : `✓ bucket ${bucket} 已建立`)
