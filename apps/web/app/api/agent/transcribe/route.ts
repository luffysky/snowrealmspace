import type { NextRequest } from 'next/server'
import { createKeyResolver, type ProviderId } from '@snowrealm/ai-core'
import { createAdminClient } from '@snowrealm/db/server'
import { serverEnv } from '@snowrealm/shared-types'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

/**
 * 語音轉文字（Groq whisper）。前端錄音 → 這裡轉寫 → 回文字填進輸入框（不自動送出）。
 *
 * 誠實原則：沒設 Groq 金鑰時明確回 AI_UNAVAILABLE，不假裝有結果。
 * 位元組不落地 —— 只是轉手送給 Groq 轉寫後丟棄（沒有存進任何表，不違反 ADR-005）。
 */

const GROQ_TRANSCRIBE_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
const WHISPER_MODEL = 'whisper-large-v3-turbo'
const MAX_AUDIO_BYTES = 20 * 1024 * 1024 // 20MB，Groq 上限之內

export const POST = handler(async (request: NextRequest) => {
  const result = await resolveContext()
  if (!result.ok) {
    if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
    return fail('FORBIDDEN', '你沒有這個空間的存取權。')
  }

  const form = await request.formData().catch(() => null)
  const audio = form?.get('audio')
  if (!(audio instanceof Blob) || audio.size === 0) {
    return fail('VALIDATION_FAILED', '沒有收到語音檔。')
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return fail('VALIDATION_FAILED', `語音檔太大（上限 ${Math.round(MAX_AUDIO_BYTES / 1024 / 1024)}MB）。`)
  }

  // Groq 金鑰：DB 加密金鑰優先，退回環境變數（與 buildCompleteDeps 同一套解析）。
  const env = serverEnv()
  const admin = createAdminClient()
  const getKey = createKeyResolver({
    encryptionSecret: env.AI_KEY_ENCRYPTION_SECRET,
    env: process.env,
    fetchEncrypted: async (provider: ProviderId) => {
      const { data } = await admin
        .from('ai_provider_keys')
        .select('api_key_encrypted, enabled')
        .eq('provider', provider)
        .maybeSingle()
      return data?.enabled ? data.api_key_encrypted : null
    },
  })
  const apiKey = await getKey('groq')
  if (!apiKey) {
    return fail('AI_UNAVAILABLE', '語音轉文字暫時無法使用（尚未設定 Groq 金鑰）。')
  }

  const upstream = new FormData()
  upstream.append('file', audio, 'audio.webm')
  upstream.append('model', WHISPER_MODEL)
  upstream.append('response_format', 'json')
  upstream.append('language', 'zh')

  let res: Response
  try {
    res = await fetch(GROQ_TRANSCRIBE_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}` },
      body: upstream,
    })
  } catch {
    return fail('AI_UNAVAILABLE', '語音服務連線失敗，請重試。')
  }

  if (!res.ok) {
    // 不回傳上游原文（可能含敏感資訊），只 log
    console.error('[agent.transcribe] Groq 回應', res.status, (await res.text().catch(() => '')).slice(0, 200))
    return fail('AI_UNAVAILABLE', '語音轉文字失敗，請重試。')
  }

  const body = (await res.json().catch(() => null)) as { text?: string } | null
  const text = (body?.text ?? '').trim()
  if (!text) return fail('AI_UNAVAILABLE', '這段語音沒有辨識到文字。')

  return ok({ text })
})
