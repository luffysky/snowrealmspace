/**
 * @snowrealm/rich-editor — 共用富文本 SDK（tiptap v3）。
 *
 * 純 client 元件，透過 props 解耦：
 *  - RichEditor 需要 `promptLink`（宿主注入自己的網址對話框）。
 *  - GifPicker 的 `giphyEndpoint` 預設 `/api/giphy`（宿主提供伺服器代理）。
 *
 * 存 HTML；顯示前的 sanitize 由宿主 app 負責（伺服器端，避免把 Node 依賴
 * 帶進 client bundle）。樣式目前由宿主提供（`.sr-rich*` 類別 + `--sr-*` token），
 * 未來對外發佈時再抽出獨立 stylesheet。
 */
export { RichEditor } from './RichEditor'
export { RichHtml } from './RichHtml'
export { EmojiPicker } from './EmojiPicker'
export { GifPicker } from './GifPicker'
