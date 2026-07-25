import type { ReactNode } from 'react'

/** 對外公開頁的極簡外框：無側邊欄、無登入、無空間脈絡。 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="sr-public-shell">
      <main className="sr-public-main">{children}</main>
      <footer className="sr-public-footer">
        <span className="sr-muted">由 SnowRealm Space 呈現</span>
      </footer>
    </div>
  )
}
