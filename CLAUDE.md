# 教室小書櫃（Classroom）

老師個人的教材網站，以 GitHub Pages 發布在 https://x287287.github.io/classroom/ 。

## 結構
- `index.html`：書櫃首頁。教材清單寫在檔案裡的 `MATERIALS` 陣列，新增教材就在這裡加一筆。
- `lessons/`：每份教材一個獨立的 HTML 檔。
- `assets/home-fab.js`：共用的「⌂ 回書櫃」懸浮按鈕。

## 每份教材的固定規則
- 每個 `lessons/` 裡的教材都要在 `</body>` 前加上 `<script src="../assets/home-fab.js"></script>`，讓「回書櫃」按鈕固定懸浮在左下角。所有教材一律如此，不另外做別的返回按鈕。
- 按鈕會讓頁面底部留出 84px 空白。如果教材是一整個畫面的版面（底部有控制列），要讓控制列避開左下角的按鈕，可參考 `lessons/smoke-devil.html` 最後的那段 `<style>`。
- 新教材加入後，要同時在 `index.html` 的 `MATERIALS` 加上對應的一筆。
