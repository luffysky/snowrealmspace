/**
 * 唯讀渲染富文本。內容在存檔時已於伺服器 sanitize（見 lib/rich-html.ts），
 * 這裡直接 dangerouslySetInnerHTML。純文字舊資料沒有標籤，照樣正常顯示。
 */
export function RichHtml({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={`sr-rich-view${className ? ` ${className}` : ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
