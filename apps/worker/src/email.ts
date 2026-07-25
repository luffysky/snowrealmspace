/**
 * 寄 email（Resend）。全站唯一的應用層寄信點（登入信是 GoTrue 走 SMTP，不經這裡）。
 *
 * 誠實原則：沒設 RESEND_API_KEY 就回 {sent:false, reason:'no_key'} 並 log，不假裝寄出。
 * from 網域需在 Resend 驗證；用 RESEND_FROM 設定（預設用 resend.dev 測試網域）。
 */

const RESEND_URL = 'https://api.resend.com/emails'

export async function sendEmail(opts: {
  to: string
  subject: string
  html: string
}): Promise<{ sent: boolean; reason?: string }> {
  const key = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM ?? 'SnowRealm Space <onboarding@resend.dev>'
  if (!key) return { sent: false, reason: 'no_key' }
  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from, to: opts.to, subject: opts.subject, html: opts.html }),
    })
    if (!res.ok) {
      console.error('[email] Resend', res.status, (await res.text().catch(() => '')).slice(0, 200))
      return { sent: false, reason: `http_${res.status}` }
    }
    return { sent: true }
  } catch (e) {
    console.error('[email] 寄送失敗', (e as Error).message)
    return { sent: false, reason: 'network' }
  }
}

/** 週報信的 HTML（簡潔品牌樣式，深淺色安全）。 */
export function weeklyRecapHtml(count: number, link: string): string {
  return `<!doctype html><html lang="zh-Hant-TW"><body style="margin:0;padding:0;background:#faf3f7;font-family:'PingFang TC','Noto Sans TC','Microsoft JhengHei',system-ui,sans-serif;color:#3a2831;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf3f7;padding:40px 16px;"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:456px;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 12px 40px rgba(140,88,112,0.10);">
      <tr><td style="height:96px;background:linear-gradient(135deg,#f5b7cf 0%,#c98aa6 55%,#8c5870 100%);text-align:center;vertical-align:middle;"><div style="font-size:36px;">&#128220;</div></td></tr>
      <tr><td style="padding:32px 40px 8px;text-align:center;">
        <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#3a2831;">這週的回顧來了</h1>
        <p style="margin:0;color:#7a5866;font-size:15px;line-height:1.6;">整理了你這週的 ${count} 項活動觀察。<br/>點進來看看，也順手記下這一週。</p>
      </td></tr>
      <tr><td style="padding:24px 40px 32px;"><a href="${link}" style="display:block;text-align:center;background:linear-gradient(135deg,#f3a7c3,#c98aa6);color:#fff;text-decoration:none;font-weight:700;padding:14px 20px;border-radius:999px;font-size:16px;">看這週回顧</a></td></tr>
    </table>
    <p style="margin:20px 0 0;color:#c3aeb9;font-size:12px;">SnowRealm Space · 不想收信可到設定關閉週報 email</p>
  </td></tr></table></body></html>`
}
