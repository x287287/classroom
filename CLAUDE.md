# 教室小書櫃（Classroom）

老師個人的教材網站，以 GitHub Pages 發布在 https://x287287.github.io/classroom/ 。使用場景是教室的大型觸控螢幕（教室電腦沒有登入 Claude），對象是國小四年級。

## 結構
- `index.html`：書櫃首頁。教材清單寫在檔案裡的 `MATERIALS` 陣列，依單元 → 課次分組顯示；每一筆有 `unit`、`lesson`、`topic`（對應的課本小標題）、`title`、`type`、`grade`、`pages`（課本頁碼，如 `"32–33"`）、`mins`（建議分鐘數）、`note`、`url`。首頁的「已上過」、「最近打開」與「本週要用」（卡片上的「☆ 本週」釘選，置頂顯示，按「清空本週」換週）存在 localStorage（`shelfDone`、`shelfRecent`、`shelfWeek`）；老師登入後由 `assets/sync.js` 同步到雲端。首頁工具列有「字」與「⛶ 全螢幕」按鈕。陣列順序就是頁面上的順序，請依課本小標題順序排列。
- `lessons/`：每份教材一個獨立的 HTML 檔。補充教材命名為 `u<單元>-<課><a,b,c…>-<英文代號>.html`，統整遊戲為 `u<單元>-game-<代號>.html`。
- `lessons/data/`：統整遊戲的題庫／關卡（`u2-game-questions.js`、`u3-game-levels.js`），檔頭有格式說明；改題目只要改這裡。
- `assets/home-fab.js`：共用的左下角懸浮按鈕：「⌂ 回書櫃」與「QR」（顯示這份教材網址的 QR Code，產生器是 `assets/vendor/qrcode.js`，MIT）。它也會自動載入 `assets/class-tools.js` 並註冊離線用的 `sw.js`。
- `assets/class-tools.js`：「上課工具」懸浮視窗（計時器：拖拉轉盤設定，10／60 分鐘盤；抽籤；白板：全螢幕白板／格線／黑板；畫筆：直接畫在教材上、有螢光筆、可暫停去點教材、跟著頁面捲動），每份教材打開時先收起成右上角一顆小小的「工具」按鈕（計時中會顯示剩餘時間），點一下展開，收起時也能直接拖曳；畫筆工具列預設在畫面下方；抽籤可設定當天未到的號碼（`absent`，隔天自動清空）；位置依教材分別記在 localStorage（`ctPos:<檔名>`），計時器與抽籤紀錄（`ctTimer`、`ctDraw`）跨教材延續。抽籤只用座號，不放學生姓名。標題列另有「字」（文字大小：標準／大／特大／超大，放大教材的根字級 rem，記在 `clsFont`，首頁與所有教材共用）與「⛶」全螢幕按鈕。教材文字大小請用 rem，才會跟著放大。
- `assets/sync.js`：雲端同步（Supabase 專案 `classroom`，ref `tsxbphngzuzpdddhadfw`，東京）。老師登入後，`SYNC_KEYS`（`shelfDone`、`shelfWeek`、`shelfRecent`、`shelfOpen`、`clsFont`、`ctDraw`、`ctTimer`）只要有網路就在所有登入的電腦同步：攔截 localStorage 寫入，存到 `kv` 資料表，每項以最後修改的為準；某台電腦第一次登入時，清單型項目（已上過、本週要用、展開）會合併。別台更新時發出 `cls-sync` 事件，首頁與 `class-tools.js` 會重新讀取。工具視窗位置（`ctPos:*`）與分頁不同步。新增要同步的 localStorage 項目時，加到 `SYNC_KEYS` 並在頁面監聽 `cls-sync`。首頁與 `lessons/view.html` 直接在 `<head>` 載入它；其他教材由 `home-fab.js` 先載入它再載入上課工具。
- 老師帳號：Email／密碼登入（Supabase Auth），老師名單在 `teachers` 資料表；只有名單裡的帳號能寫入（RLS），其他人就算註冊了帳號也不能改任何東西。網站沒有註冊或忘記密碼的畫面；老師帳號是直接在資料庫建立的，忘記密碼時請 Claude 用 Supabase 連接器重設。
- 老師上傳的教材：存在 `materials` 資料表（公開可讀）與 Storage 的 `materials` bucket（公開讀取，限 PDF、Word、PowerPoint、ODF、圖片，50 MB）。首頁「＋ 新增教材」上傳檔案或貼網址，卡片的「編輯」可修改或刪除；它們會併入 `MATERIALS`（排在靜態教材後面），網址是 `lessons/view.html?id=<uuid>`。`view.html` 用 iframe 顯示 PDF（先抓成 blob，可離線）、圖片、Word／PPT（Microsoft 線上檢視，需網路）、YouTube／Google 簡報等可嵌入的網址；其他網站顯示「打開網站」按鈕。清單快取在 localStorage `clsUploads`，PDF 與圖片也存進離線快取。
- `.github/workflows/keep-supabase-awake.yml`：每 3 天呼叫一次資料庫，避免免費專案閒置一週被暫停。若專案還是被暫停，到 Supabase 後台按 Restore，或請 Claude 用 Supabase 連接器恢復。
- 友善校園：`MATERIALS` 最後的「友善校園」單元，收學務處的宣導簡報。原始 PPT 用 LibreOffice 轉成 PDF 放在 `files/friendly/`（原檔內嵌字型約 45 MB，太大且 Microsoft 線上檢視有 10 MB 上限，所以網站只放 PDF；GIF 動畫在 PDF 裡是靜止的）。用 `lesson` 分成「低年級（一、二年級）」「中年級（三、四年級）」「高年級（五、六年級）」，`grade:0` 加上 `grades:[…]` 表示適用年級，年級篩選會用 `grades`。網址是 `lessons/view.html?src=files/…pdf&t=標題&l=分類`。類型 `ppt`（「簡報」）是一般投影片，`slide`（「動畫簡報」）是網站自製的 HTML 動畫簡報。老師上傳表單的年級也可選低／中／高年級（存在 `materials.grades`）。
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
