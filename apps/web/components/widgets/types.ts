/**
 * Widget 元件的共用型別。
 *
 * 獨立成檔是為了打斷循環相依：registry 用 lazy() 匯入各個 widget，
 * 而 widget 又需要 props 型別。若型別放在 registry，兩者互相 import。
 */
export type WidgetProps = {
  spaceId: string
  instanceId: string
  config: unknown
}
