'use client'

import { Component, type ReactNode } from 'react'

/**
 * Widget 錯誤隔離。v1.0 §14.6、06-widget-contract.md §5。
 *
 * 必須行為：
 *   - 單一 widget 崩潰不影響其他
 *   - **保留原本的格線位置與大小** —— fallback 縮成小方塊會讓整個
 *     版面塌陷重排，使用者會以為自己的配置壞了
 *   - 可重新載入，不需重整頁面
 *   - 連續失敗 3 次後提供停用選項
 *   - 錯誤記錄不含使用者內容
 */

type Props = {
  definitionId: string
  version: string
  name: string
  onError?: (info: { definitionId: string; version: string; errorName: string }) => void
  onDisable?: () => void
  children: ReactNode
}

type State = { error: Error | null; failureCount: number }

export class WidgetBoundary extends Component<Props, State> {
  override state: State = { error: null, failureCount: 0 }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  override componentDidCatch(error: Error) {
    this.setState((prev) => ({ failureCount: prev.failureCount + 1 }))
    // 只送出識別資訊，不含 widget 內顯示的使用者內容
    this.props.onError?.({
      definitionId: this.props.definitionId,
      version: this.props.version,
      errorName: error.name,
    })
    console.error(`[widget:${this.props.definitionId}]`, error)
  }

  private reset = () => {
    this.setState({ error: null })
  }

  override render() {
    if (!this.state.error) return this.props.children

    const exhausted = this.state.failureCount >= 3

    return (
      // sr-card 讓 fallback 填滿原本的格線位置，版面不會塌陷
      <div className="sr-card sr-widget-fallback" role="alert">
        <strong>{this.props.name}</strong>
        <p className="sr-muted" style={{ margin: 'var(--sr-space-2) 0' }}>
          {exhausted
            ? '這個區塊一直出問題。你可以先把它移除，其他部分不受影響。'
            : '這個區塊暫時無法顯示。'}
        </p>

        <div className="sr-row">
          {!exhausted && (
            <button type="button" className="sr-button sr-button-secondary" onClick={this.reset}>
              重新載入
            </button>
          )}
          {exhausted && this.props.onDisable && (
            <button
              type="button"
              className="sr-button sr-button-secondary"
              onClick={this.props.onDisable}
            >
              移除這個區塊
            </button>
          )}
        </div>
      </div>
    )
  }
}
