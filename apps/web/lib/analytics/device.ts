/**
 * 純函式 User-Agent 解析（無外部相依，只靠 regex）。
 *
 * 移植自 AI 島的 analytics-device，用途相同：把 UA 字串歸類成
 * 裝置類型 / 瀏覽器 / 作業系統，供後台「使用者上線資訊」顯示。
 *
 * 刻意保持保守：無法辨識時回 'desktop' / 'Other'，不猜、不拋錯。
 */

export type DeviceType = 'mobile' | 'tablet' | 'desktop'

export type ParsedDevice = {
  deviceType: DeviceType
  browser: string
  os: string
}

export function parseDevice(userAgent: string | null | undefined): ParsedDevice {
  const ua = userAgent ?? ''
  const lower = ua.toLowerCase()

  // 平板優先於手機判定（iPad 的 UA 也含 "mobile"，但它是平板）
  const deviceType: DeviceType = /ipad|tablet|playbook|silk/.test(lower)
    ? 'tablet'
    : /mobi|iphone|android|ipod|windows phone/.test(lower)
      ? 'mobile'
      : 'desktop'

  // Edge / Opera 內含 chrome，必須先判；Safari 要排除 chrome/crios（Chrome on iOS）
  const browser = /edg\//i.test(ua)
    ? 'Edge'
    : /opr\/|opera/i.test(ua)
      ? 'Opera'
      : /chrome|crios|chromium/i.test(ua)
        ? 'Chrome'
        : /firefox|fxios/i.test(ua)
          ? 'Firefox'
          : /safari/i.test(ua) && !/chrome|crios|chromium/i.test(ua)
            ? 'Safari'
            : 'Other'

  // iPhone/iPad/iPod 都算 iOS；Windows Phone 先於 Windows；macintosh 要排除 iOS
  const os = /windows phone/i.test(ua)
    ? 'Windows Phone'
    : /windows/i.test(ua)
      ? 'Windows'
      : /iphone|ipad|ipod|ios/i.test(ua)
        ? 'iOS'
        : /android/i.test(ua)
          ? 'Android'
          : /mac os|macintosh/i.test(ua)
            ? 'macOS'
            : /cros/i.test(ua)
              ? 'ChromeOS'
              : /linux/i.test(ua)
                ? 'Linux'
                : 'Other'

  return { deviceType, browser, os }
}
