'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { restoreSpace } from '../../(space)/settings/actions'

/** 寬限期內還原已軟刪除的空間。成功後回首頁。 */
export function RestoreSpace({ spaceId }: { spaceId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onRestore() {
    setError(null)
    startTransition(async () => {
      const res = await restoreSpace(spaceId)
      if (res.ok) router.replace('/home')
      else setError(res.message ?? '還原失敗。')
    })
  }

  return (
    <div className="sr-stack" style={{ gap: 'var(--sr-space-2)' }}>
      {error && (
        <p className="sr-message sr-message-error" role="alert" style={{ margin: 0 }}>
          ✕ {error}
        </p>
      )}
      <button type="button" className="sr-button" onClick={onRestore} disabled={pending}>
        {pending ? '還原中…' : '還原這個空間'}
      </button>
    </div>
  )
}
