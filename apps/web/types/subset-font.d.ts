declare module 'subset-font' {
  /**
   * 把字體子集化成只含指定字元的新字體。
   * 見 scripts/build-fonts.ts 與 lib/fonts/subset.ts 的用法。
   */
  export default function subsetFont(
    font: Buffer | Uint8Array,
    text: string,
    options?: {
      targetFormat?: 'sfnt' | 'woff' | 'woff2'
      /** 固定可變字體的軸（例如 { wght: 400 }）→ 產出單一字重的靜態實例。 */
      variationAxes?: Record<string, number>
      preserveNameIds?: number[]
    },
  ): Promise<Buffer>
}
