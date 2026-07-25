export const dynamic = 'force-dynamic'

/**
 * 公開端點：提供 magic link 登入信的 HTML 給 hosted GoTrue 使用。
 *
 * hosted GoTrue 設 `GOTRUE_MAILER_TEMPLATES_MAGIC_LINK` 指向這個網址
 * （https://<你的網域>/api/email/magic-link），GoTrue 抓取後替換 {{ .ConfirmationURL }}、
 * {{ .Token }} 等變數再寄出。本產品的登入信就會是這個美化版，而非 GoTrue 內建的陽春版。
 *
 * 這是公開的（middleware 白名單）——只回一份含樣板變數的靜態 HTML，不含任何機密。
 * 本地 Supabase 則吃 supabase/templates/magic_link.html（內容同步）。
 */

const TEMPLATE = `<!doctype html>
<html lang="zh-Hant-TW">
  <body style="margin:0;padding:0;background:#faf3f7;font-family:'PingFang TC','Noto Sans TC','Microsoft JhengHei',system-ui,-apple-system,'Segoe UI',sans-serif;color:#3a2831;-webkit-font-smoothing:antialiased;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">你的 SnowRealm Space 登入連結與代碼，1 小時內有效。</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf3f7;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:456px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 12px 40px rgba(140,88,112,0.10);">
            <tr>
              <td style="padding:0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="height:110px;background:linear-gradient(135deg,#f5b7cf 0%,#c98aa6 55%,#8c5870 100%);text-align:center;vertical-align:middle;">
                      <div style="font-size:40px;line-height:40px;">&#10052;&#65039;</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 40px 8px;text-align:center;">
                <h1 style="margin:0 0 8px;font-size:23px;font-weight:700;color:#3a2831;letter-spacing:0.2px;">歡迎回到 SnowRealm</h1>
                <p style="margin:0;color:#7a5866;font-size:15px;line-height:1.6;">一個只屬於你的角落，正安安靜靜地等你。<br/>點下面的按鈕就能進來。</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px 8px;">
                <a href="{{ .ConfirmationURL }}"
                   style="display:block;text-align:center;background:linear-gradient(135deg,#f3a7c3,#c98aa6);color:#ffffff;text-decoration:none;font-weight:700;padding:15px 20px;border-radius:999px;font-size:16px;box-shadow:0 6px 18px rgba(201,138,166,0.35);">
                  進入我的空間
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 40px 8px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border-top:1px solid #f0e3ea;font-size:0;line-height:0;">&nbsp;</td>
                    <td style="padding:0 12px;color:#b49aa6;font-size:12px;white-space:nowrap;">或用代碼</td>
                    <td style="border-top:1px solid #f0e3ea;font-size:0;line-height:0;">&nbsp;</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 40px 6px;text-align:center;">
                <p style="margin:0 0 12px;color:#7a5866;font-size:14px;line-height:1.6;">換一台裝置也可以，在登入頁輸入這組 6 位數：</p>
                <div style="display:inline-block;background:#faf3f7;border:1px solid #f0d9e4;border-radius:14px;padding:14px 24px;font-size:30px;letter-spacing:10px;font-weight:700;color:#8c5870;">
                  {{ .Token }}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px 32px;">
                <p style="margin:0;color:#ab94a0;font-size:12px;line-height:1.8;text-align:center;">
                  這封信 1 小時內有效。<br/>
                  如果不是你要登入，忽略它就好，帳號不會有任何變化。
                </p>
              </td>
            </tr>
          </table>
          <p style="margin:20px 0 0;color:#c3aeb9;font-size:12px;letter-spacing:0.3px;">SnowRealm Space · 你的私人數位空間</p>
        </td>
      </tr>
    </table>
  </body>
</html>`

export function GET() {
  return new Response(TEMPLATE, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' },
  })
}
