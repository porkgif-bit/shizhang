# 每日食帳

個人飲食紀錄網頁 App：熱量、三大營養素、添加糖、纖維、鈉、喝水、運動與體重趨勢。

- 計算：BMR 用 Mifflin-St Jeor（有填體脂率時改用 Cunningham 1991），TDEE＝BMR×活動係數，營養素目標依國健署 DRIs 第八版與每日飲食指南。
- 資料：每個人登入自己的 Google 帳號，紀錄存在自己 Google 雲端的 App 專用隱藏資料夾（`drive.appdata` 範圍），App 看不到雲端裡的其他檔案，開發者也看不到使用者的紀錄。
- 沒登入時只存在該裝置的瀏覽器。

這是自我紀錄工具，不是醫療建議。

## 開發

程式拆成幾個瀏覽器原生模組（不需要建置工具），用 GitHub Pages 網址開啟即可。直接雙擊 `index.html` 會被瀏覽器擋下模組載入，本機要看請用 `npm run serve`，再開 http://127.0.0.1:4173/ 。

| 檔案 | 內容 |
|---|---|
| `core.js` | 共用工具、共用資料（profile、days、items）、儲存與同步、Google 授權、備份 |
| `diet.js` | 飲食計算、首頁、設定、記一筆、飲水、評語、每日評分 |
| `care.js` | 補給品與用藥 |
| `money.js` | 物品與花費 |
| `review.js` | 本週回顧、週心得 |
| `style.css` | 樣式 |

`index.html` 的 importmap 幫每個檔案加上 `?v=內容雜湊`，只有改過的檔案會換號；`npm test` 會自動更新，改完記得把 `index.html` 一起 commit。

## 分支與上線（D13）

- `main`：GitHub Pages 從這裡發布，**不直接推送**。
- `dev`：所有開發都推到這裡。每次推送 GitHub Actions 自動跑「測試」（`npm test`），失敗即標紅。
- 上線：GitHub → Actions → **上線** → Run workflow。它會在 dev 最新版本上重跑全部測試，全過才把 dev 快轉合併到 main；main 若有 dev 沒有的 commit 會直接失敗，不會強制覆蓋。約 1 分鐘後網址生效。
- 退回：在 dev 上 `git revert` 要撤掉的 commit，推送、測試通過後再跑一次「上線」。

## 回歸測試

推送前必須全部通過，任何一項失敗都不推送（推送後 GitHub Actions 會再跑一次）。

```
npm install                         # 第一次
npx playwright install chromium     # 第一次（下載測試用瀏覽器）
npm test                            # 一個指令跑完全部測試
```

- 測試只用 `tests/fixtures/` 的示範資料（全部虛構，`npm run demo` 可重新產生），時鐘固定在 2026-10-28 20:00，所有對外連線（Google 登入、雲端、字型）一律擋掉，不碰任何真實帳號或紀錄。
- 截圖比對：首頁、記一筆、週回顧、物品與花費、設定五個畫面，必須和 `tests/__screenshots__/` 的基準逐像素相同。字型在不同作業系統會有像素差，所以基準依系統分開存；這台電腦沒有基準時，截圖測試會自動略過，其他測試照跑。要在自己電腦建立基準：先切到已知正確的版本執行 `npm run baseline`。
- GitHub Actions 在固定版本的 Playwright 容器裡跑，使用另一組基準 `*-ci.png`；CI 上缺基準一律算失敗，不會略過。
- 刻意改變畫面的修正，要在同一個 commit 更新基準（`npm run baseline`），並在 commit 說明寫出更新哪幾張、為什麼；說明裡再加 `[ci-baseline]`，CI 會先確認其他測試全過，再重拍 `*-ci.png` 並 commit 回 dev（推送後記得 `git pull`）。
- 測試結果報告：`npx playwright show-report tests/report`。
