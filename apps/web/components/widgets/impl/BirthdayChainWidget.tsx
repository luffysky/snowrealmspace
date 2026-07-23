'use client'

import { useEffect, useState } from 'react'

/**
 * 生日鏈。09-content-pool.md §7。
 *
 * 依條件逐步解鎖的一串內容。已解鎖顯示內容，未解鎖顯示條件提示 ——
 * 給使用者一個往前走、慢慢認識這個空間的理由。
 */

type Link = {
  index: number
  title: string
  text: string | null
  unlocked: boolean
  hint: string | null
}

export default function BirthdayChainWidget() {
  const [links, setLinks] = useState<Link[] | null>(null)
  const [open, setOpen] = useState<number | null>(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await fetch('/api/chain')
      if (cancelled) return
      if (!res.ok) return setLinks([])
      const body = (await res.json()) as { data: { links: Link[] } }
      if (!cancelled) setLinks(body.data.links)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!links) {
    return (
      <div className="sr-card sr-chain" aria-busy="true">
        <span className="sr-muted">生日鏈…</span>
      </div>
    )
  }

  if (links.length === 0) {
    return (
      <div className="sr-card sr-chain">
        <p className="sr-muted" style={{ margin: 0 }}>
          還沒有生日鏈。
        </p>
      </div>
    )
  }

  return (
    <div className="sr-card sr-chain">
      <h2 className="sr-chain-title">給你的一封信，慢慢打開</h2>
      <ol className="sr-chain-list">
        {links.map((link) => {
          const isOpen = open === link.index && link.unlocked
          return (
            <li
              key={link.index}
              className="sr-chain-node"
              data-unlocked={link.unlocked}
              data-open={isOpen}
            >
              <span className="sr-chain-dot" aria-hidden="true" />
              <div className="sr-chain-body">
                <button
                  type="button"
                  className="sr-chain-head"
                  onClick={() => link.unlocked && setOpen(isOpen ? null : link.index)}
                  disabled={!link.unlocked}
                  aria-expanded={isOpen}
                >
                  <span className="sr-chain-node-title">
                    {link.unlocked ? link.title : '還沒解鎖'}
                  </span>
                  {link.unlocked ? (
                    <span className="sr-chain-caret" aria-hidden="true">
                      {isOpen ? '−' : '+'}
                    </span>
                  ) : (
                    <span className="sr-chain-lock" aria-hidden="true">
                      ✦
                    </span>
                  )}
                </button>

                {isOpen && link.text && (
                  <div className="sr-chain-text">
                    {link.text.split('\n').map((para, i) =>
                      para.trim() ? <p key={i}>{para}</p> : null,
                    )}
                  </div>
                )}

                {!link.unlocked && link.hint && (
                  <p className="sr-chain-hint">{link.hint}</p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
