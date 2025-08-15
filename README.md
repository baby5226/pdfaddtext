# PDF 增加文字

一個基於瀏覽器的輕量級 PDF 編輯工具，支援繁體中文文字編輯和匯出。

## ✨ 功能特色

- 📄 **PDF 上傳與預覽**: 支援多頁 PDF 檔案上傳和即時預覽
- ✏️ **文字編輯**: 點擊 PDF 頁面即可新增文字
- 🎨 **文字樣式**: 可調整字型大小、顏色和粗體設定
- 🌏 **繁體中文支援**: 預設使用思源黑體 (Noto Sans TC)，完美支援繁體中文
- 🔍 **縮放控制**: 支援頁面縮放 (50% - 300%)
- 📱 **頁面導航**: 支援頁面跳轉和導航
- 💾 **PDF 匯出**: 可匯出編輯後的 PDF 檔案

## 🚀 快速開始

1. **上傳 PDF**: 點擊「匯入 PDF」按鈕選擇要編輯的 PDF 檔案
2. **新增文字**: 點擊 PDF 頁面任意位置即可新增文字方塊
3. **編輯樣式**: 調整字型大小、顏色和粗體設定
4. **匯出檔案**: 點擊「匯出 PDF」按鈕下載編輯後的檔案

## 🛠️ 技術架構

- **前端**: HTML5, CSS3, JavaScript (ES6+)
- **PDF 處理**: PDF.js (預覽), PDF-lib (編輯)
- **字型支援**: Fontkit (中文字型嵌入)
- **字型檔案**: Noto Sans TC (思源黑體)

## 📁 檔案結構

```
PDF-文字增加/
├── index.html          # 主頁面
├── script.js           # 核心 JavaScript 邏輯
├── style.css           # 樣式表
├── fonts.js            # 字型載入器
└── NotoSansTC-Medium.ttf  # 中文字型檔案
```

## 🌐 使用方式

### 本地使用
由於瀏覽器 CORS 政策限制，建議使用本地伺服器：

```bash
# 使用 Python 啟動本地伺服器
python -m http.server 8000

# 然後在瀏覽器中開啟
http://localhost:8000
```

### 線上部署
可直接部署到 GitHub Pages 或其他靜態網站託管服務。

## 📝 授權條款

本專案採用 [MIT License](LICENSE) 授權條款。

## 🙏 致謝

- **字型**: Google Noto Fonts 專案提供的思源黑體
- **PDF 處理**: PDF.js 和 PDF-lib 開發團隊
- **AI 助手**: 由 Claude Sonnet 4 協助開發和優化

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

## 📞 聯絡方式

如有問題或建議，請在 GitHub 上提交 Issue。

---

⭐ 如果這個專案對您有幫助，請給個 Star 支持一下！
