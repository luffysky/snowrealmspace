/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // E2E 用獨立的 build 目錄。沒有這個隔離，`next build` 會覆寫
  // 正在執行的 dev server 的 .next，導致 CSS chunk 變成 404
  // ——頁面看起來還在，但完全沒有樣式。見 90-build-log.md。
  distDir: process.env.NEXT_DIST_DIR || '.next',

  // workspace 套件以 TS 原始碼發佈（無 build step），由 Next 直接轉譯
  transpilePackages: [
    '@snowrealm/shared-types',
    '@snowrealm/db',
    '@snowrealm/analytics',
    '@snowrealm/storage',
    '@snowrealm/validation',
  ],

  webpack: (webpackConfig) => {
    // 套件內部用 `./foo.js` 風格的相對 import（Node ESM 與 tsc 的要求），
    // 但實際檔案是 .ts。webpack 預設不做這個對應，必須明確告知。
    webpackConfig.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    }
    return webpackConfig
  },

  turbopack: {
    resolveExtensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.json'],
  },
}

export default nextConfig

/*
 * 環境變數刻意不在這裡載入。
 *
 * 走過的彎路：先用 dotenv 在 next.config 載入根目錄的 .env.local，
 * 但 Next 的 render worker 是獨立 process，拿不到那些變數。
 * 改用 next.config 的 `env` key 也不對 —— 那會把值 inline 進 client bundle，
 * 機密會直接洩漏給瀏覽器。
 *
 * 正解是在 Next 啟動「之前」就把變數放進 process.env：
 *   dotenv -e ../../.env.local -- next dev
 * 這樣父行程與所有 worker 都繼承得到，NEXT_PUBLIC_* 照常被 inline，
 * 其餘變數留在伺服器端。見 package.json 的 scripts。
 */
