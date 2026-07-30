# 工作日誌 0731

> 修手機 widget 沒地方調整順序的問題。經 typecheck / lint（web）；E2E/a11y 依既定暫停。

## 手機 widget 重新排序（bugpic 38/39）

- **症狀**：手機版進「編輯版面」後，widget 只是單欄堆疊，**沒有任何調整位置／順序的 UI**。桌機/平板是拖曳格線，手機沒有格線可拖，等於行動版根本無法排序。
- **根因**：`HomeGrid.tsx` 的行動版分支只 `sort by position.mobile.order` 後直接 render，沒給任何控制項；且 `commit()` 對 mobile 直接 early-return。**但 bulk API 其實早就支援** `{ breakpoint:'mobile', items:[{id, order}] }`（`widgets/bulk/route.ts` 有專門的 mobile 分支寫 `position.mobile.order`）——缺的純粹是前端入口。
- **修法**：
  - `HomeGrid.tsx` 新增 `commitMobileOrder(orderedIds)`：把可見 widget 重新編號 `order = index`，樂觀更新本地狀態 + 打 bulk API，失敗回滾並提示。
  - 行動版分支改成：算出排序後的 `ordered`，每個 slot 在編輯模式多出 **↑／↓ 上移/下移**兩顆鈕（`move(index, dir)` splice 換位後 commit）；首/末項對應鈕 `disabled`。
  - 編輯模式加一行手機專屬提示：「用每個區塊左上角的 ↑ ↓ 調整順序，這個順序只影響手機。」
  - `globals.css` 加 `.sr-mobile-reorder`（絕對定位右上角，避開左上角 ⚙ 設定）＋ `.sr-mobile-reorder-btn`（44×44 合 WCAG target size、disabled 半透明）。
- **驗**：web typecheck / lint 綠。E2E mobile 依 [[e2e-a11y-paused]] 暫停未跑；既有 `e2e/widgets.spec.ts` 的手機測試只驗檢視模式（stack 可見、grid=0），不受影響。

## 待你

- redeploy 後在手機實機確認 ↑↓ 位置不擋內容、順序有存住（重整後保持）。
- Canva A/B、#55 仍等你開一次 live session（見 `todo_list_0728.md` §E）。
