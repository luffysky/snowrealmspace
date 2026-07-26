/**
 * 大頭貼（純呈現）。吃已解析好的 signed URL（伺服器端用 lib/avatar.ts 解），
 * 沒有就退回名字首字，再沒有就退回人形 icon。可當 server component 直接用。
 *
 * 為什麼吃 URL 而不是 asset id：private bucket 的 signed URL 要在伺服器產（跨 space
 * 的管理頁還得用 service role 繞 RLS），統一在伺服器解好、這裡只負責畫。
 */
export function Avatar({
  src,
  name,
  size = 32,
}: {
  src?: string | null
  name?: string | null
  size?: number
}) {
  const label = (name ?? '').trim()
  const initial = label ? label[0]!.toUpperCase() : ''
  return (
    <span
      className="sr-avatar"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42), fontWeight: 600 }}
      title={label || undefined}
    >
      {src ? (
        <img src={src} alt={label ? `${label} 的大頭貼` : '大頭貼'} />
      ) : initial ? (
        <span aria-hidden="true">{initial}</span>
      ) : (
        <svg
          viewBox="0 0 24 24"
          width={Math.round(size * 0.55)}
          height={Math.round(size * 0.55)}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-3.5 3.6-6 8-6s8 2.5 8 6" strokeLinecap="round" />
        </svg>
      )}
    </span>
  )
}
