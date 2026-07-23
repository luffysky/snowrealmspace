/**
 * 產生邀請。
 *
 * ADR-003：Alpha 期間 sign-up 關閉，只有持有效邀請的 email 能完成註冊。
 * Milestone A 只需要 CLI，不需要 UI。
 *
 * 用法：
 *   pnpm invite:create nami@example.com
 *   pnpm invite:create someone@example.com --space <uuid> --role collaborator
 */
import { config } from 'dotenv'

config({ path: '.env.local' })
config({ path: '.env' })

const { createInvite } = await import('@snowrealm/db/provisioning')

function parseArgs(argv: string[]) {
  const positional: string[] = []
  const flags = new Map<string, string>()
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === undefined) continue
    if (arg.startsWith('--')) {
      const next = argv[i + 1]
      if (next !== undefined && !next.startsWith('--')) {
        flags.set(arg.slice(2), next)
        i++
      } else {
        flags.set(arg.slice(2), 'true')
      }
    } else {
      positional.push(arg)
    }
  }
  return { positional, flags }
}

const { positional, flags } = parseArgs(process.argv.slice(2))
const email = positional[0]

if (!email || !email.includes('@')) {
  console.error('用法：pnpm invite:create <email> [--space <uuid>] [--role owner|collaborator|guest]')
  process.exit(1)
}

const role = (flags.get('role') ?? 'owner') as 'owner' | 'collaborator' | 'guest'
if (!['owner', 'collaborator', 'guest'].includes(role)) {
  console.error(`role 必須是 owner / collaborator / guest，收到：${role}`)
  process.exit(1)
}

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

try {
  const invite = await createInvite({
    email,
    spaceId: flags.get('space') ?? null,
    role,
  })

  const link = `${appUrl}/invite?token=${invite.token}`

  console.log('')
  console.log('邀請已建立')
  console.log('─'.repeat(60))
  console.log(`  Email    ${invite.email}`)
  console.log(`  Role     ${role}`)
  console.log(`  到期     ${new Date(invite.expiresAt).toLocaleString('zh-TW')}`)
  console.log('')
  console.log('  邀請連結（token 只會顯示這一次）：')
  console.log(`  ${link}`)
  console.log('─'.repeat(60))
  console.log('')
  process.exit(0)
} catch (err: unknown) {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
}
