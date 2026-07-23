/**
 * 釋放開發用的 port。
 *
 * 為什麼需要：Playwright 的 webServer 設 `reuseExistingServer: false`
 * （刻意的 —— 沿用既有 server 就無法保證測到的是目前這份程式碼）。
 * 但若 :3100 被上一次沒收乾淨的行程佔住，Playwright 會直接失敗，
 * 而訊息只有一行 "already used"，在背景執行時很容易被忽略。
 *
 * Windows 上 `pkill` 不可靠，必須用 PowerShell 依 port 查 PID。
 */
import { execFileSync } from 'node:child_process'

const PORTS = process.argv.slice(2).map(Number).filter(Number.isFinite)
const targets = PORTS.length > 0 ? PORTS : [3000, 3100]

const script = targets
  .map(
    (port) => `
$procs = Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique
foreach ($p in $procs) {
  Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
  Write-Output "released ${port} (PID $p)"
}`,
  )
  .join('\n')

try {
  const out = execFileSync(
    'powershell',
    ['-NoProfile', '-NonInteractive', '-Command', script],
    { encoding: 'utf8' },
  ).trim()
  console.log(out || `ports ${targets.join(', ')} already free`)
} catch (err) {
  // 非 Windows 或沒有 PowerShell：不是致命錯誤
  console.warn('無法釋放 port（非 Windows？）：', err instanceof Error ? err.message : err)
}
