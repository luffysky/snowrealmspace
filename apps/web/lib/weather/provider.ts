/**
 * 天氣 provider 的薄轉出層。
 *
 * fetch 邏輯已上提到 @snowrealm/weather（讓 daily-engine 也能 import —— 套件不能反向依賴 app）。
 * 這裡只重新轉出，讓既有的兩個 route（/api/weather、/api/weather/lookup）import 路徑不變。
 */
export * from '@snowrealm/weather'
