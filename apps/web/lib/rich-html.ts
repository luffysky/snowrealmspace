import sanitizeHtml from 'sanitize-html'

/**
 * 清洗富文本 HTML（伺服器端，存檔前跑）。
 *
 * 儲存的是 HTML 字串 → 絕不信任，存前 sanitize。白名單只留基本排版 + 連結 + 圖片
 * （emoji 是純字元、GIF 是 giphy 的 <img>）。img 允許 http/https/data，其餘一律丟。
 */
export function sanitizeRichHtml(dirty: string): string {
  return sanitizeHtml(dirty, {
    allowedTags: [
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li',
      'a', 'h1', 'h2', 'h3', 'blockquote', 'code', 'pre', 'img', 'span',
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https', 'data'] },
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow', target: '_blank' }),
    },
    disallowedTagsMode: 'discard',
  })
}

/** HTML → 純文字（給搜尋、AI、列表預覽用）。 */
export function htmlToText(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, ' ')
    .trim()
}
