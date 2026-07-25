import Link from 'next/link'

/**
 * 公開資訊頁（隱私政策／使用條款／使用說明）的輕量頂列。
 *
 * 這些頁在 app 外殼之外（要能未登入、未過閘門就看，OAuth 審核要求），
 * 所以沒有側邊欄。給一條「回首頁」的頂列，才不會把人困在頁裡。
 */
export function PublicTopBar() {
  return (
    <header className="sr-public-topbar">
      <Link href="/" className="sr-public-brand">
        SnowRealm
      </Link>
      <Link href="/" className="sr-button">
        ← 回首頁
      </Link>
    </header>
  )
}
