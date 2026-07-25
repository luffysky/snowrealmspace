import {
  embedText,
  splitProviderPrefix,
  providerFromModel,
  type CompleteDeps,
  type ProviderId,
} from '@snowrealm/ai-core'

/**
 * 走 embedding 候選鏈把文字向量化。跟 completeForUsage 一樣的精神：
 * 依序試候選，缺金鑰就跳過，全失敗回 null（誠實失敗、不寫壞資料）。
 *
 * 額度不在這裡擋 —— embedding 是背景寫入/檢索的基礎設施，量小且免費層為主，
 * 由呼叫端決定要不要記 usage。回 null 時呼叫端該保留舊行為（例如退回時間序）。
 */
export async function embedForUsage(text: string, deps: CompleteDeps): Promise<number[] | null> {
  const clean = text.trim()
  if (!clean) return null
  const chain = await deps.getCandidates('embedding')
  for (const c of chain) {
    const sp = splitProviderPrefix(c.model)
    const provider = (sp.provider ?? providerFromModel(c.model)) as ProviderId
    const apiKey = await deps.getKey(provider)
    if (!apiKey) continue
    try {
      const { vector } = await embedText({ provider, model: sp.model, apiKey, input: clean })
      if (vector.length) return vector
    } catch (err) {
      console.error(`[embed] ${c.model} 失敗：`, (err as Error).message)
      // 試下一個候選
    }
  }
  return null
}
