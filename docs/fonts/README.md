# 字體下載來源

SnowRealm Space 的字體**不走 Google Fonts CDN**（會把「誰何時開了空間」洩漏給第三方），
一律自架在 R2。這份文件列出 14 套字體的原始下載來源。

- 收錄標準：**開源、免費、可商用，且授權允許 web 嵌入與子集化**（實務上＝ OFL 1.1 或 Apache 2.0）。
- 真相來源是程式碼：`packages/shared-types/src/font-catalogue.ts`。若與本文件不符，以該檔為準。
- 下載器：`scripts/download-fonts.ts`。授權全文（OFL.txt / LICENSE）**必須**隨字體散布，抓不到就中止。

> ⚠️ 字體二進位檔放 `assets/fonts/<slug>/`，該目錄在 `.gitignore` 裡（繁中字體單檔 6–9 MB，commit 進 git 就永遠移不掉）。**不要 commit 字體檔。** 這個 `docs/fonts/` 只放文件。

---

## 一鍵下載（13 套可自動化）

```bash
export PATH="$HOME/.npm-global:$PATH"   # pnpm 在使用者目錄，見 CLAUDE.md
pnpm tsx scripts/download-fonts.ts            # 抓全部能自動抓的
pnpm tsx scripts/download-fonts.ts noto-sans-tc   # 只抓單一套
```

GitHub API 有匿名速率限制；大量下載時設 `GITHUB_TOKEN` 環境變數可提高上限。

**唯一需要人工的是「台北黑體」**（見下方 🔴）—— 下載器不會去猜網址抓錯東西，會直接列出來要人處理。

---

## 繁體中文（9 套）

| 字體 | slug | 類別 | 授權 | 來源 |
|---|---|---|---|---|
| 思源黑體 Noto Sans TC | `noto-sans-tc` | 黑體 | OFL-1.1 | Google Fonts repo：<https://github.com/google/fonts/tree/main/ofl/notosanstc> |
| 思源宋體 Noto Serif TC | `noto-serif-tc` | 宋體 | OFL-1.1 | <https://github.com/google/fonts/tree/main/ofl/notoseriftc> |
| jf open 粉圓 | `jf-open-huninn` | 圓體 | OFL-1.1 | GitHub Release：<https://github.com/justfont/open-huninn-font/releases>（資產 `jf-openhuninn-*.ttf`） |
| **台北黑體** 🔴 | `taipei-sans-tc` | 黑體 | OFL-1.1 | **需人工**：翰字鑄造 JT Foundry <https://sites.google.com/view/jtfoundry/> |
| 昭源黑體 Chiron Hei HK | `chiron-hei-hk` | 黑體 | OFL-1.1 | GitHub `release` 分支：<https://github.com/chiron-fonts/chiron-hei-hk/tree/release/STATIC_TTF>（`ChironHeiHK-{L,N,M,B}.ttf`） |
| 昭源宋體 Chiron Sung HK | `chiron-sung-hk` | 宋體 | OFL-1.1 | <https://github.com/chiron-fonts/chiron-sung-hk/tree/release/STATIC_TTF>（`ChironSungHK-{L,N,M,B}.ttf`） |
| 霞鶩文楷 LXGW WenKai TC | `lxgw-wenkai-tc` | 楷體 | OFL-1.1 | GitHub Release：<https://github.com/lxgw/LxgwWenKaiTC/releases>（`LXGWWenKaiTC-*.ttf`） |
| 芫荽 Iansui | `iansui` | 手寫 | OFL-1.1 | GitHub `main` 分支：<https://github.com/ButTaiwan/iansui/tree/main/fonts/ttf>（`Iansui-*.ttf`） |
| 朱雀仿宋 Zhuque Fangsong | `zhuque-fangsong` | 仿宋 | OFL-1.1 | GitHub Release：<https://github.com/TrionesType/zhuque/releases>（`ZhuqueFangsong-*.zip`，自動解壓） |

## 拉丁（5 套，負責英數與標點）

| 字體 | slug | 類別 | 授權 | 來源 |
|---|---|---|---|---|
| Inter | `inter` | sans | OFL-1.1 | <https://github.com/google/fonts/tree/main/ofl/inter>（上游 <https://github.com/rsms/inter>） |
| Playfair Display | `playfair-display` | display | OFL-1.1 | <https://github.com/google/fonts/tree/main/ofl/playfairdisplay> |
| Cormorant Garamond | `cormorant-garamond` | serif | OFL-1.1 | <https://github.com/google/fonts/tree/main/ofl/cormorantgaramond> |
| Source Serif 4 | `source-serif-4` | serif | OFL-1.1 | <https://github.com/google/fonts/tree/main/ofl/sourceserif4>（上游 <https://github.com/adobe-fonts/source-serif>） |
| JetBrains Mono | `jetbrains-mono` | mono | OFL-1.1 | <https://github.com/google/fonts/tree/main/ofl/jetbrainsmono> |

---

## 🔴 台北黑體（唯一人工步驟）

下載器對這套回報 `manual`，不算失敗——它是「需要人做」，不是「壞了」。

1. 到翰字鑄造 JT Foundry 官網：<https://sites.google.com/view/jtfoundry/>
2. 下載「台北黑體 Taipei Sans TC Beta」（3 個字重：Light 300 / Regular 400 / Bold 700）。
3. 放進 `assets/fonts/taipei-sans-tc/`，檔名維持原樣即可。
4. **連同 OFL 授權全文一起放**（存成 `assets/fonts/taipei-sans-tc/OFL.txt`）——OFL 要求授權隨字體散布，這不是可選的。
5. 之後照一般流程建置＋上傳：

```bash
pnpm tsx scripts/build-fonts.ts     # 子集化、產 woff2、分片
pnpm tsx scripts/upload-fonts.ts    # 上傳 R2
```

字形基於思源黑體、貼近台灣教育部標準字形；沒有穩定的直接下載網址，這是它需要人工的唯一原因。

---

## 授權注意事項

- 全部 14 套都是 **OFL 1.1**（Apache 2.0 目前未使用）。
- OFL 兩條硬規則，程式碼有對應機制：
  1. **授權全文隨字體散布** → `licenseFile`，`build-fonts.ts` 會一併上傳，缺檔中止。
  2. **有 Reserved Font Name 的字體，子集產物不可沿用原名** → 一律用 `slug` 當內部字體名，不宣稱是原字體。
     （目前收錄的 14 套 `reservedFontName` 皆為 `null`，但機制保留。）
