# 裝飾品素材 — Fluent Emoji（Microsoft）

`apps/web/public/decorations/*.svg` 為 **Microsoft Fluent Emoji**（Color 風格）向量圖，
用作使用者可自由擺放的網頁裝飾品。清單與繁中標籤見 `manifest.json`。

- 作者：Microsoft
- 授權：**MIT License**（可自由使用、修改、商用；不需標註，仍在此列出以示尊重）
- 來源：https://github.com/microsoft/fluentui-emoji
- 取用：`assets/<Name>/Color/<snake>_color.svg`（Color 風格單檔 SVG）

## 為何放 `public/` 而非 `lib/`

這些 SVG 以 `<img src="/decorations/<id>.svg">` 呈現（可調色階漸層 tint + 透明度、
可自由拖曳定位），需要可直接被瀏覽器以 URL 取得，故置於 `public/decorations/`。
屬「明確授權的內建素材」，非使用者上傳檔案，與 ADR-005 精神一致（位元組不進 `assets` 儲存）。

MIT 全文見上游 repo 的 LICENSE。
