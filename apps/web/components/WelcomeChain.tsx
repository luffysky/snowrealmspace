/**
 * 歡迎鏈。非生日時的首頁招呼卡：一句「歡迎回來」+ 今天的一句歡迎語，
 * 給人「回家」的感覺（每天換一句，同一天穩定）。line 由 getWelcomeLine 決定。
 */
export function WelcomeChain({ line }: { line: string | null }) {
  return (
    <section className="sr-card sr-welcome">
      <p className="sr-welcome-hi">歡迎回來</p>
      <p className="sr-welcome-line">{line ?? '這裡一直都在，你想來的時候它都在。'}</p>
    </section>
  )
}
