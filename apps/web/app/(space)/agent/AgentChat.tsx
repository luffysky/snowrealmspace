'use client'

import { useRef, useState } from 'react'

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  escalated?: boolean
}

export type ThreadSummary = { id: string; title: string | null; last_message_at: string }

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
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

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
    if (pending) return
    setThreadId(null)
    setMessages([])
    setError(null)
    setInput('')
  }

  async function switchTo(id: string) {
    if (pending || id === threadId) return
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

  async function send(text: string) {
    setPending(true)
    setError(null)
    const optimisticUser: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content: text }
    setMessages((prev) => [...prev, optimisticUser])
    scrollToBottom()

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'x-space-id': spaceId, 'content-type': 'application/json' },
        body: JSON.stringify({ threadId, message: text, route: '/agent' }),
      })
      const body: unknown = await res.json().catch(() => null)

      if (!res.ok) {
        const msg =
          (body as { error?: { message?: string } } | null)?.error?.message ?? 'AI 暫時無法回應。'
        // §46.2：保留使用者輸入（放回輸入框）、可重試，不生成假結果
        setError(msg)
        setInput(text)
        setMessages((prev) => prev.filter((m) => m.id !== optimisticUser.id))
        return
      }

      const data = (body as {
        data: { threadId: string; reply: string; escalated: boolean; degraded: boolean }
      }).data
      const wasNew = threadId === null
      setThreadId(data.threadId)
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: 'assistant', content: data.reply, escalated: data.escalated },
      ])
      if (wasNew) void refreshThreads()
      if (data.degraded) {
        setError('本次使用快速模式（今日深入分析額度已用完，明日 00:00 重置）。')
      }
      scrollToBottom()
    } catch {
      setError('網路錯誤，請重試。')
      setInput(text)
      setMessages((prev) => prev.filter((m) => m.id !== optimisticUser.id))
    } finally {
      setPending(false)
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || pending) return
    setInput('')
    void send(text)
  }

  return (
    <div className="sr-card sr-stack">
      <div className="sr-row" style={{ gap: 'var(--sr-space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" className="sr-button sr-button-secondary" onClick={newConversation} disabled={pending}>
          ＋ 新對話
        </button>
        {threads.length > 0 && (
          <select
            className="sr-input"
            style={{ flex: 1, minWidth: 160, maxWidth: 320 }}
            value={threadId ?? ''}
            disabled={pending}
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
            跟你的 AI 夥伴說點什麼吧。你可以問它對某件作品的看法（記得先選取），或請它幫你整理。
          </p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`sr-chat-msg sr-chat-${m.role}`}>
              <div className="sr-chat-bubble">
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
        {pending && (
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

      <form onSubmit={onSubmit} className="sr-chat-input-row">
        <textarea
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
        <button type="submit" className="sr-button" disabled={pending || !input.trim()}>
          送出
        </button>
      </form>
    </div>
  )
}
