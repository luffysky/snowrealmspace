'use client'

import { useEffect, useRef, useState } from 'react'
import { ALLOWED_MIME } from '@snowrealm/validation'
import { uploadAsset } from '@/lib/upload-asset'
import { EmojiPicker } from '@/components/rich/EmojiPicker'
import { GifPicker } from '@/components/rich/GifPicker'

export type Attachment = { assetId: string; mimeType: string }

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

const IMAGE_ACCEPT = ALLOWED_MIME.image.join(',')
const TEXT_ACCEPT = '.txt,.md,.markdown,.csv,.json,.log,.ts,.tsx,.js,.py,.html,.css,text/*'
const MAX_TEXT_FILE_BYTES = 1024 * 1024 // 1MB
const MAX_TEXT_CHARS = 20000

/** 歷史訊息的附件縮圖：向 /api/assets 換 15 分鐘短期 URL。 */
function HistoryThumb({ assetId, spaceId }: { assetId: string; spaceId: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let alive = true
    fetch(`/api/assets/${assetId}/url`, { headers: { 'x-space-id': spaceId } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((b: { data: { url: string } }) => {
        if (alive) setUrl(b.data.url)
      })
      .catch(() => {
        if (alive) setFailed(true)
      })
    return () => {
      alive = false
    }
  }, [assetId, spaceId])
  if (failed) return <span className="sr-chip sr-chip-tag">🖼 圖片</span>
  if (!url) return <span className="sr-chip sr-chip-tag">🖼 載入中…</span>
  return <img src={url} alt="附件" className="sr-chat-thumb" />
}

export function AgentChat({
  spaceId,
  initialThreadId,
  initialMessages,
  initialThreads,
}: {
  spaceId: string
  initialThreadId: string | null
  initialMessages: ChatMessage[]
  initialThreads: ThreadSummary[]
}) {
  const [threadId, setThreadId] = useState<string | null>(initialThreadId)
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [threads, setThreads] = useState<ThreadSummary[]>(initialThreads)
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
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

  // ── 文字檔：前端讀內容、貼進輸入框（不落地，最誠實）──
  async function onPickTextFile(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    setError(null)
    if (file.size > MAX_TEXT_FILE_BYTES) {
      setError('檔案太大（文字附件上限 1MB）。圖片請用「圖片」按鈕。')
      return
    }
    try {
      let text = await file.text()
      let truncated = false
      if (text.length > MAX_TEXT_CHARS) {
        text = text.slice(0, MAX_TEXT_CHARS)
        truncated = true
      }
      const block = `【附件：${file.name}】\n${text}${truncated ? '\n…（內容過長，已截斷）' : ''}\n`
      setInput((prev) => (prev ? `${prev}\n${block}` : block))
    } catch {
      setError('讀不到這個檔案的內容（可能不是文字檔）。')
    }
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

  async function send(text: string, images: PendingImage[]) {
    setPending(true)
    setError(null)
    const optimisticUser: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      ...(images.length ? { images: images.map((i) => i.previewUrl) } : {}),
    }
    setMessages((prev) => [...prev, optimisticUser])
    scrollToBottom()

    // 帶圖片：走非串流的 vision 路徑（工具/圖片不串流）
    if (images.length > 0) {
      try {
        const res = await fetch('/api/agent/chat', {
          method: 'POST',
          headers: { 'x-space-id': spaceId, 'content-type': 'application/json' },
          body: JSON.stringify({
            threadId,
            message: text,
            route: '/agent',
            attachmentAssetIds: images.map((i) => i.assetId),
          }),
        })
        const body: unknown = await res.json().catch(() => null)
        if (!res.ok) {
          const msg = (body as { error?: { message?: string } } | null)?.error?.message ?? 'AI 暫時無法回應。'
          setError(msg)
          setInput(text)
          setPendingImages(images)
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
    if ((!text && pendingImages.length === 0) || busy) return
    const images = pendingImages
    setInput('')
    setPendingImages([]) // 交給 send 保管；失敗時放回
    void send(text, images)
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
              <div className="sr-chat-bubble">
                {(m.images?.length || m.attachments?.length) && (
                  <div className="sr-chat-attachments">
                    {m.images?.map((src, i) => (
                      <img key={`img-${i}`} src={src} alt="附件" className="sr-chat-thumb" />
                    ))}
                    {m.attachments?.map((a) => (
                      <HistoryThumb key={a.assetId} assetId={a.assetId} spaceId={spaceId} />
                    ))}
                  </div>
                )}
                {m.content}
                {m.role === 'assistant' && m.escalated && (
                  <span className="sr-chip sr-chip-tag" style={{ marginLeft: 'var(--sr-space-2)' }}>
                    深入分析
                  </span>
                )}
              </div>
            </div>
          ))
        )}
        {pending && !streaming && (
          <div className="sr-chat-msg sr-chat-assistant">
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
          accept={TEXT_ACCEPT}
          style={{ display: 'none' }}
          onChange={(e) => {
            void onPickTextFile(e.target.files)
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
