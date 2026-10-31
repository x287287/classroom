# 教室小書櫃（Classroom）

老師個人的教材網站，以 GitHub Pages 發布在 https://x287287.github.io/classroom/ 。使用場景是教室的大型觸控螢幕（教室電腦沒有登入 Claude），對象是國小四年級。

## 結構
- `index.html`：書櫃首頁。教材清單寫在檔案裡的 `MATERIALS` 陣列，依單元 → 課次分組顯示；每一筆有 `unit`、`lesson`、`topic`（對應的課本小標題）、`title`、`type`、`note`、`url`。陣列順序就是頁面上的順序，請依課本小標題順序排列。
- `lessons/`：每份教材一個獨立的 HTML 檔。補充教材命名為 `u<單元>-<課><a,b,c…>-<英文代號>.html`，統整遊戲為 `u<單元>-game-<代號>.html`。
- `assets/home-fab.js`：共用的「⌂ 回書櫃」懸浮按鈕。
- `assets/kit.css`、`assets/kit.js`：補充教材共用的版面與互動元件（`KIT.quiz`、`KIT.ox`、`KIT.order`、`KIT.sort`、`KIT.stepper`）。`<body class="u2">` 或 `class="u3"` 套用單元主色。

## 每份教材的固定規則
- 每個 `lessons/` 裡的教材都要在 `</body>` 前加上 `<script src="../assets/home-fab.js"></script>`，讓「回書櫃」按鈕固定懸浮在左下角。所有教材一律如此，不另外做別的返回按鈕。
- 按鈕會讓頁面底部留出 84px 空白。如果教材是一整個畫面的版面（底部有控制列），要讓控制列避開左下角的按鈕，可參考 `lessons/smoke-devil.html` 最後的那段 `<style>`。
- 新教材加入後，要同時在 `index.html` 的 `MATERIALS` 加上對應的一筆。
- 補充教材的數據要查證並在頁尾列出資料來源；「老師補充資料」區塊寫給老師看的出處與教學提醒。
- 觸控優先：按鈕至少約 44px 高，不依賴滑鼠懸停；不使用 alert／confirm。
