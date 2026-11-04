# 教室小書櫃（Classroom）

老師個人的教材網站，以 GitHub Pages 發布在 https://x287287.github.io/classroom/ 。使用場景是教室的大型觸控螢幕（教室電腦沒有登入 Claude），對象是國小四年級。

## 結構
- `index.html`：書櫃首頁。教材清單寫在檔案裡的 `MATERIALS` 陣列，依單元 → 課次分組顯示；每一筆有 `unit`、`lesson`、`topic`（對應的課本小標題）、`title`、`type`、`grade`、`pages`（課本頁碼，如 `"32–33"`）、`mins`（建議分鐘數）、`note`、`url`。首頁的「已上過」與「最近打開」只存在該台電腦的 localStorage（`shelfDone`、`shelfRecent`），不上傳。陣列順序就是頁面上的順序，請依課本小標題順序排列。
- `lessons/`：每份教材一個獨立的 HTML 檔。補充教材命名為 `u<單元>-<課><a,b,c…>-<英文代號>.html`，統整遊戲為 `u<單元>-game-<代號>.html`。
- `lessons/data/`：統整遊戲的題庫／關卡（`u2-game-questions.js`、`u3-game-levels.js`），檔頭有格式說明；改題目只要改這裡。
- `assets/home-fab.js`：共用的左下角懸浮按鈕：「⌂ 回書櫃」與「QR」（顯示這份教材網址的 QR Code，產生器是 `assets/vendor/qrcode.js`，MIT）。它也會自動載入 `assets/class-tools.js` 並註冊離線用的 `sw.js`。
- `assets/class-tools.js`：「上課工具」懸浮視窗（計時器、抽籤、小白板），每份教材打開時出現在右上角（手機寬度預設收起），可拖曳、收起；位置依教材分別記在 localStorage（`ctPos:<檔名>`），計時器與抽籤紀錄（`ctTimer`、`ctDraw`）跨教材延續。抽籤只用座號，不放學生姓名。
- `sw.js`：離線快取。首頁、所有教材（從 `MATERIALS` 讀取）、共用檔與 `-site` 字型會存到教室電腦；有網路時一律先抓最新版。新增共用檔時記得加到 `CORE`。
- `assets/fonts.css`、`assets/fonts/`：自架字型（Huninn 粉圓、Noto Sans TC、霞鶩文楷 TC，皆 OFL，授權見 `assets/fonts/OFL.txt`），不連 Google Fonts。每份教材用 `<link rel="stylesheet" href="../assets/fonts.css">` 載入。由 `tools/build-fonts.py` 產生：`-site` 檔含網站目前用到的字，`-more` 檔含其他 Big5 常用字（用到才下載）。新教材若用了罕用字，重跑腳本。
- `assets/kit.css`、`assets/kit.js`：補充教材共用的版面與互動元件（`KIT.quiz`、`KIT.ox`、`KIT.order`、`KIT.sort`、`KIT.stepper`）。`<body class="u2">` 或 `class="u3"` 套用單元主色。

## 每份教材的固定規則
- 每個 `lessons/` 裡的教材都要在 `</body>` 前加上 `<script src="../assets/home-fab.js"></script>`，讓「回書櫃」按鈕固定懸浮在左下角。所有教材一律如此，不另外做別的返回按鈕。
- 按鈕會讓頁面底部留出 84px 空白。如果教材是一整個畫面的版面（底部有控制列），要讓控制列避開左下角的按鈕，可參考 `lessons/smoke-devil.html` 最後的那段 `<style>`。
- 新教材加入後，要同時在 `index.html` 的 `MATERIALS` 加上對應的一筆（含課本頁碼與建議時間）。
- 字型一律用 `../assets/fonts.css`，不要再加 Google Fonts 連結。
- 網站是公開的：不放學生姓名、照片或成績。
- 補充教材的數據要查證並在頁尾列出資料來源；「老師補充資料」區塊寫給老師看的出處與教學提醒。整頁式的動畫簡報與遊戲沒有頁尾，改用標題列的「資料來源」／「老師說明」按鈕開視窗（參考 `smoke-devil.html`、`u2-game-demons.html`）。
- 顏色對比：文字與背景至少 4.5:1（kit.css 的 `--good`、`--warn`、`--bad`、單元主色都已調整過，直接用變數即可）。
- 觸控優先：按鈕至少約 44px 高，不依賴滑鼠懸停；不使用 alert／confirm。
