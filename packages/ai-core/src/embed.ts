import { endpointFor, protocolFor, splitProviderPrefix, stripLoneSurrogates } from './providers.js'
import type { ProviderId } from './providers.js'

/**
 * 文字向量化（語意檢索用）。與 callAI 平行的一層 —— 只送一次請求、把回應正規化成 number[]。
 * fallback 是 router / 呼叫端的事，這裡不做。
 *
 * 目前支援兩種協定：
 *  - openai 相容（openai）：POST /v1/embeddings，用 `dimensions` 參數把維度壓到 768
 *  - google：POST /v1beta/models/{model}:embedContent，text-embedding-004 原生就是 768 維
 *
 * 為什麼固定 768：memories.embedding 欄位是 vector(768)（配合 google text-embedding-004）。
 * openai text-embedding-3-small 預設 1536，靠 dimensions 參數截成 768 才能寫進同一欄位、
 * 兩家模型的向量落在同一空間比較。
 */

export const EMBEDDING_DIMS = 768

export type EmbedRequest = {
  provider: ProviderId
  model: string
  apiKey: string
  input: string
  fetchImpl?: typeof fetch
}

export type EmbedResult = {
  vector: number[]
  dims: number
  tokensInput: number
}

/** openai /v1/embeddings 的 URL（把 chat endpoint 尾巴換掉）。 */
function openaiEmbedUrl(provider: ProviderId): string {
  return endpointFor(provider).replace(/\/chat\/completions$/, '/embeddings')
}

export async function embedText(reqIn: EmbedRequest): Promise<EmbedResult> {
  const model = splitProviderPrefix(reqIn.model).model
  const doFetch = reqIn.fetchImpl ?? fetch
  const input = stripLoneSurrogates(reqIn.input).slice(0, 8000)
  const protocol = protocolFor(reqIn.provider)

  if (protocol === 'anthropic') {
    throw new Error('anthropic 沒有 embedding 端點')
  }

  if (protocol === 'google') {
    const url = `${endpointFor('google')}/models/${model}:embedContent?key=${reqIn.apiKey}`
    const res = await doFetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: `models/${model}`,
        content: { parts: [{ text: input }] },
        outputDimensionality: EMBEDDING_DIMS,
      }),
    })
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      throw new Error(`${res.status} ${res.statusText} ${t.slice(0, 300)}`)
    }
    const json = (await res.json()) as { embedding?: { values?: number[] } }
    const vector = json.embedding?.values ?? []
    if (!vector.length) throw new Error('google embedContent 回傳空向量')
    return { vector, dims: vector.length, tokensInput: 0 }
  }

  // openai 相容
  const res = await doFetch(openaiEmbedUrl(reqIn.provider), {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${reqIn.apiKey}` },
    body: JSON.stringify({ model, input, dimensions: EMBEDDING_DIMS }),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText} ${t.slice(0, 300)}`)
  }
  const json = (await res.json()) as {
    data?: { embedding?: number[] }[]
    usage?: { prompt_tokens?: number }
  }
  const vector = json.data?.[0]?.embedding ?? []
  if (!vector.length) throw new Error('openai embeddings 回傳空向量')
  return { vector, dims: vector.length, tokensInput: json.usage?.prompt_tokens ?? 0 }
}

/** pgvector 字面量：number[] → '[0.1,0.2,…]'（RPC 傳參與寫入都用這個格式最穩）。 */
export function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(',')}]`
}
