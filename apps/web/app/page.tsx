import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth/session'

/**
 * getUser 失敗（auth 暫時連不上等）不該讓進站第一頁 500，當成未登入。
 * 抽成 helper 避免在 RootPage 裡出現「先賦值再覆寫」的多餘賦值。
 */
async function currentUserOrNull(): Promise<Awaited<ReturnType<typeof getUser>>> {
  try {
    return await getUser()
  } catch {
    return null
  }
}

export default async function RootPage() {
  const user = await currentUserOrNull()
  // redirect() 靠拋出 NEXT_REDIRECT 運作，必須在 try/catch 之外，否則會被吞掉。
  redirect(user ? '/home' : '/login')
}
