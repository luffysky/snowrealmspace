/**
 * 生日卡內容。使用者填了生日、當天進 Home 就會看到一張信封卡（EnvelopeCard）。
 *
 * 原則（沿用生日信改寫時 Luffy 的方向）：溫暖、不施壓、不說「這是為你做的」，
 * 不要求對方變成誰、也不催進度。就只是好好祝一句生日快樂。
 */

export type BirthdayCard = { title: string; lines: string[] }

const CARDS: BirthdayCard[] = [
  {
    title: '生日快樂 🎂',
    lines: [
      '今天不用做什麼，也不用變成誰。',
      '你能好好長到今天，本身就值得慶祝。',
      '願接下來這一年，你被溫柔地對待，也記得溫柔地對待自己。',
    ],
  },
  {
    title: '嘿，今天是你的日子 🤍',
    lines: [
      '謝謝你又陪自己走過了一年。',
      '那些撐過的、放下的、學會的，都算數。',
      '願這一年，有人惦記你，也有你惦記的人。',
    ],
  },
  {
    title: '生日快樂 ✨',
    lines: [
      '願你今年的願望，不必說出口也能被聽見。',
      '累的時候可以慢下來，這個小角落會一直在。',
      '好好過今天，剩下的慢慢來。',
    ],
  },
  {
    title: '生日快樂 🌷',
    lines: [
      '今天，就好好被自己喜歡的東西圍著吧。',
      '不必趕上什麼，也不必成為誰。',
      '願這一年，你過得比想像中更自在一點。',
    ],
  },
]

/** 決定性挑一張（同一個人每年當天看到同一張，換人才不同）。 */
export function birthdayCardFor(seed: string): BirthdayCard {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return CARDS[h % CARDS.length]!
}
