/** 深淺色模式。跟主題分開：任何主題都能切明/暗（選項 A）。 */

export type ColorMode = 'light' | 'dark'

export const MODE_COOKIE = 'sr-mode'
export const MODE_MAX_AGE = 365 * 24 * 60 * 60

export function parseMode(value: string | undefined | null): ColorMode {
  return value === 'dark' ? 'dark' : 'light'
}
