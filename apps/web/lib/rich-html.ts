import sanitizeHtml from 'sanitize-html'

/**
 * 清洗富文本 HTML（伺服器端，存檔前跑）。
 *
 * 儲存的是 HTML 字串 → 絕不信任，存前 sanitize。白名單涵蓋編輯器會產出的全部結構：
 * 標題/清單/待辦/表格/引言/程式碼區塊(語法高亮)/螢光筆/文字顏色/對齊/連結/圖片。
 * style 只放行 color / background-color / text-align；class 只放行語法高亮與清單標記。
 * img 只允許 http/https/data。任何未列出的標籤/屬性一律丟棄。
 */
export function sanitizeRichHtml(dirty: string): string {
  return sanitizeHtml(dirty, {
    allowedTags: [
      'p', 'br', 'hr', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'mark', 'span',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'label', 'input', 'div',
      'blockquote', 'code', 'pre',
      'a', 'img',
      'table', 'thead', 'tbody', 'tr', 'td', 'th', 'colgroup', 'col',
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt'],
      span: ['style', 'class'],
      code: ['class'],
      pre: ['class'],
      p: ['style'],
      h1: ['style'],
      h2: ['style'],
      h3: ['style'],
      h4: ['style'],
      h5: ['style'],
      h6: ['style'],
      ul: ['data-type', 'class'],
      li: ['data-checked', 'data-type', 'class'],
      input: ['type', 'checked', 'disabled'],
      td: ['colspan', 'rowspan', 'colwidth', 'style'],
      th: ['colspan', 'rowspan', 'colwidth', 'style'],
      table: ['style'],
    },
    allowedStyles: {
      '*': {
        color: [/^#(0x)?[0-9a-fA-F]+$/, /^rgb\(/, /^[a-zA-Z]+$/],
        'background-color': [/^#(0x)?[0-9a-fA-F]+$/, /^rgb\(/, /^[a-zA-Z]+$/],
        'text-align': [/^(left|right|center|justify)$/],
      },
    },
    allowedClasses: {
      code: ['language-*'],
      pre: ['language-*'],
      span: [/^hljs/],
      ul: ['*'],
      li: ['*'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https', 'data'] },
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow', target: '_blank' }),
      // 唯讀渲染時待辦勾選框不可互動
      input: sanitizeHtml.simpleTransform('input', { disabled: 'disabled' }),
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
