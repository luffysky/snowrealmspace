/**
 * 釋放開發用的 port。
 *
 * 為什麼需要：Playwright 的 webServer 設 `reuseExistingServer: false`
 * （刻意的 —— 沿用既有 server 就無法保證測到的是目前這份程式碼）。
 * 但若 :3100 被上一次沒收乾淨的行程佔住，Playwright 會直接失敗，
 * 訊息只有一行 "already used"，在背景執行時很容易被忽略。
 *
 * Windows 上 `pkill` 不可靠，必須依 port 查 PID。
 * 用 netstat + taskkill 而非 PowerShell：多行 `-Command` 在某些 shell 下
 * 會被回顯成文字而不是執行。
 */
import { execFileSync } from 'node:child_process'

const requested = process.argv.slice(2).map(Number).filter(Number.isFinite)
const ports = requested.length > 0 ? requested : [3000, 3100]

function releaseWindows(port: number): string[] {
  let out = ''
  try {
    out = execFileSync('netstat', ['-ano', '-p', 'TCP'], { encoding: 'utf8' })
  } catch {
    return []
  }

  const pids = new Set<string>()
  for (const line of out.split('\n')) {
    if (!line.includes('LISTENING')) continue
    const parts = line.trim().split(/\s+/)
    const local = parts[1] ?? ''
    const pid = parts[parts.length - 1] ?? ''
    // 本機位址結尾必須剛好是 :<port>，避免 :31000 之類的誤判
    if (local.endsWith(`:${port}`) && /^\d+$/.test(pid) && pid !== '0') {
      pids.add(pid)
    }
  }

  const killed: string[] = []
  for (const pid of pids) {
    try {
      execFileSync('taskkill', ['/PID', pid, '/F', '/T'], { stdio: 'ignore' })
      killed.push(pid)
    } catch {
      // 行程可能已自行結束
    }
  }
  return killed
}

let total = 0
for (const port of ports) {
  const killed = process.platform === 'win32' ? releaseWindows(port) : []
  if (killed.length > 0) {
    console.log(`✓ 釋放 :${port}（PID ${killed.join(', ')}）`)
    total += killed.length
  }
}

if (total === 0) console.log(`✓ ${ports.join(' / ')} 都是空的`)
