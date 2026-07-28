import { z } from 'zod'

/**
 * Agent 對話輸入。使用者訊息上限 4000 字（07-agent.md §3.1，超過在 API 層擋）。
 *
 * 多模態：attachmentAssetIds 帶已上傳的圖片 asset（走既有 assets 管線，ADR-005 —— 位元組只在 assets）。
 * 純圖片訊息（沒打字）允許 message 為空，但至少要有一項（文字或附件）。
 */
export const agentChatSchema = z
  .object({
    threadId: z.string().uuid().nullable().optional(),
    message: z.string().trim().max(4000).default(''),
    /** 已上傳的圖片 asset id（最多 4 張）。伺服器會驗證屬於本 space 且為 image。 */
    attachmentAssetIds: z.array(z.string().uuid()).max(4).optional(),
    selectedSnapshotId: z.string().uuid().nullable().optional(),
    /**
     * 綁定「這個對話屬於哪件作品」。伺服器會寫進 agent_messages.context_refs.designFileId，
     * /works 才能用它找回同一件作品的對話（不需新 migration，複用既有 jsonb 欄位）。
     */
    designFileId: z.string().uuid().optional(),
    route: z.string().max(120).optional(),
  })
  .strict()
  .refine((v) => v.message.length > 0 || (v.attachmentAssetIds?.length ?? 0) > 0, {
    message: '請輸入訊息或附加圖片',
    path: ['message'],
  })

export type AgentChatInput = z.infer<typeof agentChatSchema>
