import { cookies } from 'next/headers'
import { createUserClient, type Db } from '@snowrealm/db/server'

/**
 * 受 RLS 約束的 client。Server Component 與 Route Handler 都用這個。
 *
 * 除了 auth callback 中明確標註的佈建流程，其餘一律不得使用 service role。
 */
export async function getDb(): Promise<Db> {
  const cookieStore = await cookies()
  return createUserClient({
    getAll: () => cookieStore.getAll().map((c) => ({ name: c.name, value: c.value })),
    setAll: (toSet) => {
      for (const { name, value, options } of toSet) {
        cookieStore.set({ name, value, ...(options ?? {}) })
      }
    },
  })
}
