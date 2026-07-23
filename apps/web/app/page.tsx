import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth/session'

export default async function RootPage() {
  // getUser 失敗（auth 暫時連不上等）不該讓進站第一頁 500 ——
  // 當成未登入，導去 /login。
  //
  // ⚠️ redirect() 必須在 try/catch **之外**：它靠拋出 NEXT_REDIRECT 運作，
  // 放進 try 會被 catch 吞掉，反而永遠不跳轉。
  let user: Awaited<ReturnType<typeof getUser>> = null
  try {
    user = await getUser()
  } catch {
    user = null
  }
  redirect(user ? '/home' : '/login')
}
