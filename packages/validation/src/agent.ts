import { z } from 'zod'

/** Agent 對話輸入。使用者訊息上限 4000 字（07-agent.md §3.1，超過在 API 層擋）。 */
export const agentChatSchema = z
  .object({
    threadId: z.string().uuid().nullable().optional(),
    message: z.string().trim().min(1, '請輸入訊息').max(4000),
    selectedSnapshotId: z.string().uuid().nullable().optional(),
    route: z.string().max(120).optional(),
  })
  .strict()

export type AgentChatInput = z.infer<typeof agentChatSchema>
