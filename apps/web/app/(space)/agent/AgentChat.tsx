'use client'

import { useEffect, useRef, useState } from 'react'
import { ALLOWED_MIME } from '@snowrealm/validation'
import { uploadAsset } from '@/lib/upload-asset'
import { EmojiPicker } from '@/components/rich/EmojiPicker'
import { GifPicker } from '@/components/rich/GifPicker'
import { Avatar } from '@/components/Avatar'

export type Attachment = { assetId: string; mimeType: string; kind?: string; name?: string | null }

/** 一則附件的媒體渲染：圖片/影片直接顯示（不進氣泡框）、可點開、圖片可存；其餘為檔案連結。 */
function ChatMedia({ url, kind, name }: { url: string; kind: string; name?: string | null | undefined }) {
  async function download() {
    try {
      const r = await fetch(url)
      const blob = await r.blob()
      const u = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = u
      a.download = name || 'image'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(u)
    } catch {
      window.open(url, '_blank')
    }
  }
  if (kind === 'image') {
    return (
      <span className="sr-chat-media-wrap">
        <a href={url} target="_blank" rel="noreferrer">
          <img src={url} alt={name || '圖片'} className="sr-chat-media" />
        </a>
        <button type="button" className="sr-chat-media-dl" onClick={() => void download()} title="儲存圖片" aria-label="儲存圖片">
          ⤓
        </button>
      </span>
    )
  }
  if (kind === 'video') return <video src={url} controls className="sr-chat-media" />
  if (kind === 'audio') return <audio src={url} controls style={{ maxWidth: '100%' }} />
  return (
    <a href={url} target="_blank" rel="noreferrer" className="sr-chip sr-chip-tag">
      📄 {name || '檔案'}
    </a>
  )
}

/** 歷史/送出後的附件：先向 /api/assets 換短期 URL，再交給 ChatMedia。 */
function AssetMedia({ assetId, kind, name, spaceId }: { assetId: string; kind?: string | undefined; name?: string | null | undefined; spaceId: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let alive = true
    fetch(`/api/assets/${assetId}/url`, { headers: { 'x-space-id': spaceId } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((b: { data: { url: string } }) => alive && setUrl(b.data.url))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [assetId, spaceId])
  if (failed) return <span className="sr-chip sr-chip-tag">📄 {name || '附件'}</span>
  if (!url) return <span className="sr-chip sr-chip-tag">載入中…</span>
  return <ChatMedia url={url} kind={kind || 'file'} name={name} />
}

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  escalated?: boolean
  /** 本地預覽（送出當下的 object URL）。 */
  images?: string[]
  /** 從歷史載入的附件參照（需向伺服器換短期 URL）。 */
  attachments?: Attachment[]
}

export type ThreadSummary = { id: string; title: string | null; last_message_at: string }

type PendingImage = { assetId: string; previewUrl: string; name: string }
type PendingFile = { assetId: string; name: string; kind: string; mimeType: string }

const IMAGE_ACCEPT = ALLOWED_MIME.image.join(',')

export function AgentChat({
  spaceId,
  initialThreadId,
  initialMessages,
  initialThreads,
  userName,
  userAvatarSrc,
  agentName,
  agentAvatarSrc,
}: {
  spaceId: string
  initialThreadId: string | null
  initialMessages: ChatMessage[]
  initialThreads: ThreadSummary[]
  userName: string
  userAvatarSrc: string | null
  agentName: string
  agentAvatarSrc: string | null
}) {
  const [threadId, setThreadId] = useState<string | null>(initialThreadId)
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [threads, setThreads] = useState<ThreadSummary[]>(initialThreads)
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const busy = pending || uploading || transcribing

  async function refreshThreads() {
    try {
      const res = await fetch('/api/agent/threads', { headers: { 'x-space-id': spaceId } })
      if (res.ok) {
        const body = (await res.json()) as { data: ThreadSummary[] }
        setThreads(body.data)
      }
    } catch {
      /* 忽略：清單載入失敗不影響對話 */
    }
  }

  function newConversation() {
    if (busy) return
    setThreadId(null)
    setMessages([])
    setError(null)
    setInput('')
    clearPendingImages()
    setPendingFiles([])
  }

  async function switchTo(id: string) {
    if (busy || id === threadId) return
    setError(null)
    try {
      const res = await fetch(`/api/agent/threads/${id}`, { headers: { 'x-space-id': spaceId } })
      if (!res.ok) throw new Error()
      const body = (await res.json()) as { data: { threadId: string; messages: ChatMessage[] } }
      setThreadId(body.data.threadId)
      setMessages(body.data.messages)
      scrollToBottom()
    } catch {
      setError('讀不到這個對話。')
    }
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
    })
  }

  function clearPendingImages() {
    setPendingImages((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.previewUrl))
      return []
    })
  }

  // ── 圖片附件：走既有 assets 管線上傳，拿到 assetId ──
  async function onPickImages(files: FileList | null) {
    if (!files || files.length === 0) return
    const slots = 4 - pendingImages.length
    const chosen = Array.from(files).slice(0, Math.max(0, slots))
    if (chosen.length === 0) {
      setError('最多附加 4 張圖片。')
      return
    }
    setError(null)
    setUploading(true)
    for (const file of chosen) {
      if (!(ALLOWED_MIME.image as readonly string[]).includes(file.type)) {
        setError(`不支援 ${file.type || '這個格式'}（圖片只收 PNG/JPEG/WebP/GIF/AVIF）。`)
        continue
      }
      const previewUrl = URL.createObjectURL(file)
      try {
        const assetId = await uploadAsset(file, spaceId)
        setPendingImages((prev) => [...prev, { assetId, previewUrl, name: file.name }])
      } catch (err) {
        URL.revokeObjectURL(previewUrl)
        setError(err instanceof Error ? err.message : '圖片上傳失敗。')
      }
    }
    setUploading(false)
  }

  function removePending(assetId: string) {
    setPendingImages((prev) => {
      const found = prev.find((p) => p.assetId === assetId)
      if (found) URL.revokeObjectURL(found.previewUrl)
      return prev.filter((p) => p.assetId !== assetId)
    })
  }

  // 表情：插到游標處（不用富文本，純字元進 textarea）
  function insertEmoji(emoji: string) {
    const ta = textareaRef.current
    if (!ta) {
      setInput((p) => p + emoji)
      return
    }
    const start = ta.selectionStart ?? input.length
    const end = ta.selectionEnd ?? input.length
    const next = input.slice(0, start) + emoji + input.slice(end)
    setInput(next)
    requestAnimationFrame(() => {
      ta.focus()
      const pos = start + emoji.length
      ta.setSelectionRange(pos, pos)
    })
  }

  // GIF：giphy 是外部 URL，抓下來當圖片走既有 assets 管線（GIF 屬 image kind）→ 就能顯示與送出。
  async function attachGif(url: string) {
    if (pendingImages.length >= 4) {
      setError('最多附加 4 張圖片。')
      return
    }
    setUploading(true)
    setError(null)
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const file = new File([blob], 'giphy.gif', { type: blob.type || 'image/gif' })
      const previewUrl = URL.createObjectURL(file)
      const assetId = await uploadAsset(file, spaceId)
      setPendingImages((prev) => [...prev, { assetId, previewUrl, name: 'GIF' }])
    } catch {
      setError('加入 GIF 失敗（可能跨網域限制），請改用圖片上傳。')
    } finally {
      setUploading(false)
    }
  }

  // ── 任意檔案：走 assets 管線上傳，當附件送出（影片/音檔/PDF/文件…）。AI 只看得到圖片，其餘是分享/顯示用。──
  async function onPickAnyFile(files: FileList | null) {
    if (!files || files.length === 0) return
    setError(null)
    setUploading(true)
    for (const file of Array.from(files).slice(0, 4)) {
      try {
        const assetId = await uploadAsset(file, spaceId)
        const kind = file.type.startsWith('image/')
          ? 'image'
          : file.type.startsWith('video/')
            ? 'video'
            : file.type.startsWith('audio/')
              ? 'audio'
              : 'file'
        setPendingFiles((prev) => [...prev, { assetId, name: file.name, kind, mimeType: file.type }])
      } catch (err) {
        setError(err instanceof Error ? err.message : `${file.name} 上傳失敗（可能不支援這個格式）。`)
      }
    }
    setUploading(false)
  }
  function removePendingFile(assetId: string) {
    setPendingFiles((prev) => prev.filter((f) => f.assetId !== assetId))
  }

  // ── 語音：錄音 → 轉寫 → 填進輸入框（不自動送出，可先改再送）──
  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop()
      return
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('這個瀏覽器不支援錄音。')
      return
    }
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.addEventListener('dataavailable', (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      })
      recorder.addEventListener('stop', () => {
        stream.getTracks().forEach((t) => t.stop())
        setRecording(false)
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        if (blob.size > 0) void transcribe(blob)
      })
      recorderRef.current = recorder
      recorder.start()
      setRecording(true)
    } catch {
      setError('無法存取麥克風（請確認已允許權限）。')
    }
  }

  async function transcribe(blob: Blob) {
    setTranscribing(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('audio', blob, 'audio.webm')
      const res = await fetch('/api/agent/transcribe', {
        method: 'POST',
        headers: { 'x-space-id': spaceId },
        body: fd,
      })
      const body: unknown = await res.json().catch(() => null)
      if (!res.ok) {
        const msg = (body as { error?: { message?: string } } | null)?.error?.message ?? '語音轉文字失敗。'
        setError(msg)
        return
      }
      const text = (body as { data: { text: string } }).data.text
      setInput((prev) => (prev ? `${prev} ${text}` : text))
    } catch {
      setError('語音轉文字時網路錯誤。')
    } finally {
      setTranscribing(false)
    }
  }

  async function send(text: string, images: PendingImage[], files: PendingFile[]) {
    setPending(true)
    setError(null)
    const optimisticUser: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      ...(images.length ? { images: images.map((i) => i.previewUrl) } : {}),
      ...(files.length
        ? { attachments: files.map((f) => ({ assetId: f.assetId, mimeType: f.mimeType, kind: f.kind, name: f.name })) }
        : {}),
    }
    setMessages((prev) => [...prev, optimisticUser])
    scrollToBottom()

    // 有任何附件（圖片/影片/音檔/檔案）：走非串流路徑；只有圖片會餵給 vision，其餘僅顯示。
    if (images.length > 0 || files.length > 0) {
      try {
        const res = await fetch('/api/agent/chat', {
          method: 'POST',
          headers: { 'x-space-id': spaceId, 'content-type': 'application/json' },
          body: JSON.stringify({
            threadId,
            message: text,
            route: '/agent',
            attachmentAssetIds: [...images.map((i) => i.assetId), ...files.map((f) => f.assetId)],
          }),
        })
        const body: unknown = await res.json().catch(() => null)
        if (!res.ok) {
          const msg = (body as { error?: { message?: string } } | null)?.error?.message ?? 'AI 暫時無法回應。'
          setError(msg)
          setInput(text)
          setPendingImages(images)
          setPendingFiles(files)
          setMessages((prev) => prev.filter((m) => m.id !== optimisticUser.id))
          return
        }
        const data = (body as { data: { threadId: string; reply: string; escalated: boolean } }).data
        const wasNew = threadId === null
        setThreadId(data.threadId)
        setMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, role: 'assistant', content: data.reply, escalated: data.escalated },
        ])
        if (wasNew) void refreshThreads()
        scrollToBottom()
      } catch {
        setError('網路錯誤，請重試。')
        setInput(text)
        setPendingImages(images)
        setMessages((prev) => prev.filter((m) => m.id !== optimisticUser.id))
      } finally {
        setPending(false)
      }
      return
    }

    // 純文字：串流（逐字吐）
    const assistantId = `a-${Date.now()}`
    let full = ''
    let started = false
    const wasNew = threadId === null
    try {
      const res = await fetch('/api/agent/chat/stream', {
        method: 'POST',
        headers: { 'x-space-id': spaceId, 'content-type': 'application/json' },
        body: JSON.stringify({ threadId, message: text, route: '/agent' }),
      })
      if (!res.ok || !res.body) {
        const body: unknown = await res.json().catch(() => null)
        const msg = (body as { error?: { message?: string } } | null)?.error?.message ?? 'AI 暫時無法回應。'
        setError(msg)
        setInput(text)
        setMessages((prev) => prev.filter((m) => m.id !== optimisticUser.id))
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const blocks = buffer.split('\n\n')
        buffer = blocks.pop() ?? ''
        for (const blk of blocks) {
          const line = blk.trim()
          if (!line.startsWith('data:')) continue
          let obj: { delta?: string; error?: string; done?: boolean; threadId?: string }
          try {
            obj = JSON.parse(line.slice(5).trim())
          } catch {
            continue
          }
          if (obj.delta) {
            full += obj.delta
            if (!started) {
              started = true
              setStreaming(true)
              setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: full }])
            } else {
              setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: full } : m)))
            }
            scrollToBottom()
          }
          if (obj.error) setError(obj.error)
          if (obj.done && obj.threadId) {
            setThreadId(obj.threadId)
            if (wasNew) void refreshThreads()
          }
        }
      }
      // 完全沒吐字也沒 error → 移除樂觀訊息、把輸入放回
      if (!full) {
        setInput(text)
        setMessages((prev) => prev.filter((m) => m.id !== optimisticUser.id))
      }
    } catch {
      if (!full) {
        setError('網路錯誤，請重試。')
        setInput(text)
        setMessages((prev) => prev.filter((m) => m.id !== optimisticUser.id))
      }
    } finally {
      setStreaming(false)
      setPending(false)
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if ((!text && pendingImages.length === 0 && pendingFiles.length === 0) || busy) return
    const images = pendingImages
    const files = pendingFiles
    setInput('')
    setPendingImages([]) // 交給 send 保管；失敗時放回
    setPendingFiles([])
    void send(text, images, files)
  }

  return (
    <div className="sr-card sr-stack">
      <div className="sr-row" style={{ gap: 'var(--sr-space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" className="sr-button sr-button-secondary" onClick={newConversation} disabled={busy}>
          ＋ 新對話
        </button>
        {threads.length > 0 && (
          <select
            className="sr-input"
            style={{ flex: 1, minWidth: 160, maxWidth: 320 }}
            value={threadId ?? ''}
            disabled={busy}
            onChange={(e) => (e.target.value ? void switchTo(e.target.value) : newConversation())}
          >
            <option value="">— 新對話 —</option>
            {threads.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title || '（未命名對話）'}
              </option>
            ))}
          </select>
        )}
      </div>

      <div ref={listRef} className="sr-chat-list" aria-live="polite">
        {messages.length === 0 ? (
          <p className="sr-muted" style={{ textAlign: 'center', padding: 'var(--sr-space-6) 0' }}>
            跟你的 AI 夥伴說點什麼吧。你可以傳一張圖片問它的看法、附上文字檔，或用語音輸入。
          </p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`sr-chat-msg sr-chat-${m.role}`}>
              <div className="sr-chat-meta">
                <Avatar
                  src={m.role === 'user' ? userAvatarSrc : agentAvatarSrc}
                  name={m.role === 'user' ? userName : agentName}
                  size={24}
                />
                <span className="sr-chat-name">{m.role === 'user' ? userName : agentName}</span>
              </div>
              {/* 圖片/影片/檔案直接顯示，不進氣泡框 */}
              {(m.images?.length || m.attachments?.length) && (
                <div className="sr-chat-media-row">
                  {m.images?.map((src, i) => (
                    <ChatMedia key={`img-${i}`} url={src} kind="image" />
                  ))}
                  {m.attachments?.map((a) => (
                    <AssetMedia key={a.assetId} assetId={a.assetId} kind={a.kind} name={a.name} spaceId={spaceId} />
                  ))}
                </div>
              )}
              {(m.content || (m.role === 'assistant' && m.escalated)) && (
                <div className="sr-chat-bubble">
                  {m.content}
                  {m.role === 'assistant' && m.escalated && (
                    <span className="sr-chip sr-chip-tag" style={{ marginLeft: 'var(--sr-space-2)' }}>
                      深入分析
                    </span>
                  )}
                </div>
              )}
            </div>
          ))
        )}
        {pending && !streaming && (
          <div className="sr-chat-msg sr-chat-assistant">
            <div className="sr-chat-meta">
              <Avatar src={agentAvatarSrc} name={agentName} size={24} />
              <span className="sr-chat-name">{agentName}</span>
            </div>
            <div className="sr-chat-bubble sr-muted">思考中…</div>
          </div>
        )}
      </div>

      {error && (
        <p className="sr-message sr-message-error" role="alert">
          {error}
        </p>
      )}

      {/* 待送出的圖片縮圖 */}
      {pendingImages.length > 0 && (
        <div className="sr-chat-attachments" aria-label="待送出的圖片">
          {pendingImages.map((p) => (
            <span key={p.assetId} className="sr-chat-thumb-wrap">
              <img src={p.previewUrl} alt={p.name} className="sr-chat-thumb" />
              <button
                type="button"
                className="sr-chat-thumb-remove"
                aria-label={`移除 ${p.name}`}
                onClick={() => removePending(p.assetId)}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {/* 待送出的檔案（影片/音檔/其他） */}
      {pendingFiles.length > 0 && (
        <div className="sr-chip-row" aria-label="待送出的檔案">
          {pendingFiles.map((f) => (
            <span key={f.assetId} className="sr-chip sr-chip-tag">
              {f.kind === 'video' ? '🎬' : f.kind === 'audio' ? '🎵' : '📄'} {f.name}
              <button
                type="button"
                aria-label={`移除 ${f.name}`}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', marginLeft: 4 }}
                onClick={() => removePendingFile(f.assetId)}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {/* 附件工具列 */}
      <div className="sr-row" style={{ gap: 'var(--sr-space-2)', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="sr-button sr-button-secondary"
          onClick={() => imageInputRef.current?.click()}
          disabled={busy || pendingImages.length >= 4}
        >
          🖼 圖片
        </button>
        <button
          type="button"
          className="sr-button sr-button-secondary"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
        >
          📎 檔案
        </button>
        <button
          type="button"
          className={`sr-button ${recording ? '' : 'sr-button-secondary'}`}
          onClick={() => void toggleRecording()}
          disabled={pending || transcribing}
        >
          {recording ? '⏹ 停止錄音' : transcribing ? '轉寫中…' : '🎤 語音'}
        </button>
        <EmojiPicker onSelect={insertEmoji} />
        <GifPicker onSelect={(url) => void attachGif(url)} />
        {uploading && <span className="sr-muted">上傳中…</span>}
        <input
          ref={imageInputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            void onPickImages(e.target.files)
            e.target.value = ''
          }}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="*/*"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            void onPickAnyFile(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      <form onSubmit={onSubmit} className="sr-chat-input-row">
        <textarea
          ref={textareaRef}
          className="sr-input"
          rows={2}
          value={input}
          maxLength={4000}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              onSubmit(e)
            }
          }}
          placeholder="輸入訊息…（Enter 送出、Shift+Enter 換行）"
          disabled={pending}
        />
        <button type="submit" className="sr-button" disabled={busy || (!input.trim() && pendingImages.length === 0)}>
          送出
        </button>
      </form>
    </div>
  )
}
