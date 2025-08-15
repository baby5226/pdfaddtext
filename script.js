// 從 window 物件取得 pdf-lib 和 fontkit
const { PDFDocument, rgb, StandardFonts } = PDFLib;
const { fontkit } = window;

// 設定 PDF.js 的 worker 路徑
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js`;

// DOM 元素
const pdfUpload = document.getElementById('pdf-upload');
const pdfViewer = document.getElementById('pdf-viewer');
const fontSizeInput = document.getElementById('font-size');
const fontColorInput = document.getElementById('font-color');
const fontBoldCheckbox = document.getElementById('font-bold');
const exportPdfBtn = document.getElementById('export-pdf-btn');
const pageJumperInput = document.getElementById('page-jumper');
const jumpToPageBtn = document.getElementById('jump-to-page-btn');

// 全域變數
let pdfLibDoc = null;
let notoFontBytes = null;
let totalPages = 0;
let currentScale = 1.5;
let addedTexts = []; // 儲存已新增的文字，用於即時顯示
let currentTextbox = null; // 追蹤目前的文字輸入框

// --- 字型載入 ---
async function loadFonts() {
    try {
        console.log('正在載入思源黑體字型...');
        
        // 檢查是否為本地檔案協議
        if (window.isLocalFileProtocol && window.isLocalFileProtocol()) {
            console.warn('⚠️ 檢測到本地檔案協議，建議使用本地伺服器');
        }
        
        // 使用改進的字型載入器
        if (window.loadRealFont) {
            notoFontBytes = await window.loadRealFont();
            if (notoFontBytes && notoFontBytes.byteLength > 1024) {
                console.log('✅ 真實字型載入成功！');
                if (notoFontBytes.byteLength > 1024 * 1024) { // 大於 1MB
                    console.log('🎉 本地中文字型檔案載入成功！');
                }
            } else {
                console.log('⚠️ 字型載入失敗，將使用系統預設字型');
                notoFontBytes = null; // 確保設為 null
            }
        } else {
            // 嘗試多個字型來源
            const fontUrls = [
                // 本地字型檔案（優先）
                './NotoSansTC-Medium.ttf',
                './NotoSansTC-Regular.ttf'
            ];
            
            let fontLoaded = false;
            
            for (const fontUrl of fontUrls) {
                try {
                    console.log(`嘗試載入字型: ${fontUrl}`);
                    const response = await fetch(fontUrl);
                    
                    if (response.ok) {
                        notoFontBytes = await response.arrayBuffer();
                        console.log(`字型載入成功！來源: ${fontUrl}`);
                        console.log(`字型大小: ${(notoFontBytes.byteLength / 1024).toFixed(1)} KB`);
                        
                        if (fontUrl.startsWith('./')) {
                            console.log('🎉 本地中文字型檔案載入成功！');
                        }
                        
                        fontLoaded = true;
                        break;
                    } else {
                        console.warn(`字型載入失敗: ${fontUrl} - HTTP ${response.status}`);
                    }
                } catch (error) {
                    console.warn(`字型載入錯誤: ${fontUrl} - ${error.message}`);
                }
            }
            
            if (!fontLoaded) {
                console.warn('所有字型來源都失敗，將使用系統預設字型');
                notoFontBytes = null; // 確保設為 null
            }
        }
        
    } catch (error) {
        console.error('字型載入過程發生錯誤:', error);
        notoFontBytes = null; // 確保設為 null
    }
}

// --- 建立工具列 ---
function createToolbar() {
    const toolbar = document.querySelector('.toolbar');
    
    // 添加縮放控制
    const zoomGroup = document.createElement('div');
    zoomGroup.className = 'tool-group';
    zoomGroup.innerHTML = `
        <label>縮放:</label>
        <button id="zoom-out" title="縮小">-</button>
        <span id="zoom-level">150%</span>
        <button id="zoom-in" title="放大">+</button>
        <button id="zoom-reset" title="重置縮放">重置</button>
    `;
    
    // 添加頁面導航
    const navGroup = document.createElement('div');
    navGroup.className = 'tool-group';
    navGroup.innerHTML = `
        <button id="prev-page" disabled>上一頁</button>
        <span id="page-info">0 / 0</span>
        <button id="next-page" disabled>下一頁</button>
    `;
    
    // 插入到匯出按鈕之前
    const exportGroup = toolbar.querySelector('.tool-group:last-child');
    toolbar.insertBefore(zoomGroup, exportGroup);
    toolbar.insertBefore(navGroup, exportGroup);
    
    // 綁定縮放事件
    document.getElementById('zoom-out').addEventListener('click', () => changeZoom(-0.2));
    document.getElementById('zoom-in').addEventListener('click', () => changeZoom(0.2));
    document.getElementById('zoom-reset').addEventListener('click', () => resetZoom());
    
    // 綁定頁面導航事件
    document.getElementById('prev-page').addEventListener('click', () => changePage(-1));
    document.getElementById('next-page').addEventListener('click', () => changePage(1));
}

// --- 縮放控制 ---
function changeZoom(delta) {
    currentScale = Math.max(0.5, Math.min(3.0, currentScale + delta));
    updateZoomDisplay();
    reRenderPages();
}

function resetZoom() {
    currentScale = 1.5;
    updateZoomDisplay();
    reRenderPages();
}

function updateZoomDisplay() {
    const zoomLevel = document.getElementById('zoom-level');
    if (zoomLevel) {
        zoomLevel.textContent = `${Math.round(currentScale * 100)}%`;
    }
}

// --- 頁面導航 ---
let currentPage = 1;

function changePage(delta) {
    const newPage = currentPage + delta;
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        updatePageInfo();
        scrollToPage(currentPage);
        updateNavigationButtons();
    }
}

function updatePageInfo() {
    document.getElementById('page-info').textContent = `${currentPage} / ${totalPages}`;
}

function updateNavigationButtons() {
    document.getElementById('prev-page').disabled = currentPage <= 1;
    document.getElementById('next-page').disabled = currentPage >= totalPages;
}

function scrollToPage(pageNum) {
    const targetPage = document.getElementById(`page-${pageNum}`);
    if (targetPage) {
        targetPage.scrollIntoView({ behavior: 'smooth' });
    }
}

// --- 重新渲染頁面 ---
async function reRenderPages() {
    if (!pdfLibDoc) return;
    
    try {
        // 重新載入 PDF 進行渲染
        const pdfBytes = await pdfLibDoc.save();
        const pdfjsDoc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
        
        const pageContainers = document.querySelectorAll('.page-container');
        pageContainers.forEach(async (container, index) => {
            const pageNum = index + 1;
            const canvas = container.querySelector('canvas');
            
            if (canvas && pageNum <= pdfjsDoc.numPages) {
                const page = await pdfjsDoc.getPage(pageNum);
                const viewport = page.getViewport({ scale: currentScale });
                
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                
                const context = canvas.getContext('2d');
                await page.render({ canvasContext: context, viewport: viewport }).promise;
                
                // 重新顯示已新增的文字
                redrawAddedTexts(pageNum, canvas);
            }
        });
        
        console.log('頁面重新渲染完成，縮放比例:', currentScale);
        
    } catch (error) {
        console.error('重新渲染頁面失敗:', error);
    }
}

// --- 監聽檔案上傳事件 ---
pdfUpload.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file || file.type !== 'application/pdf') return;

    exportPdfBtn.disabled = true;
    pdfViewer.innerHTML = '正在載入預覽...';
    
    try {
        const arrayBuffer = await file.arrayBuffer();

        // 建立新的 PDF 文件並註冊 fontkit
        pdfLibDoc = await PDFDocument.load(arrayBuffer);
        
        // 關鍵：註冊 fontkit 實例
        if (fontkit) {
            pdfLibDoc.registerFontkit(fontkit);
            console.log('fontkit 已成功註冊');
        } else {
            console.warn('fontkit 未載入，中文字型可能無法使用');
        }
        
        const pdfjsDoc = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
        
        totalPages = pdfjsDoc.numPages;
        currentPage = 1;
        pageJumperInput.max = totalPages;
        addedTexts = []; // 清空已新增的文字
        pdfViewer.innerHTML = '';

        await renderAllPages(pdfjsDoc);
        
        exportPdfBtn.disabled = false;
        updatePageInfo();
        updateNavigationButtons();
        
        showMessage(`PDF 載入成功！共 ${totalPages} 頁`, 'success');
        
    } catch (error) {
        console.error('PDF 載入失敗:', error);
        pdfViewer.innerHTML = 'PDF 載入失敗，請檢查檔案格式';
        showMessage('PDF 載入失敗', 'error');
    }
});

// --- 渲染所有頁面 ---
async function renderAllPages(pdfjsDoc) {
    for (let i = 1; i <= totalPages; i++) {
        const page = await pdfjsDoc.getPage(i);
        const viewport = page.getViewport({ scale: currentScale });
        const canvas = document.createElement('canvas');
        canvas.id = `page-${i}`;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const context = canvas.getContext('2d');
        await page.render({ canvasContext: context, viewport: viewport }).promise;

        const pageContainer = document.createElement('div');
        pageContainer.className = 'page-container';
        pageContainer.style.position = 'relative';
        pageContainer.style.width = `${canvas.width}px`;
        pageContainer.style.height = `${canvas.height}px`;
        pageContainer.style.margin = '10px auto';
        
        pageContainer.appendChild(canvas);
        pdfViewer.appendChild(pageContainer);
        
        pageContainer.addEventListener('click', (e) => handleCanvasClick(e, i));
    }
}

// --- 跳至頁面功能 ---
jumpToPageBtn.addEventListener('click', () => {
    const pageNum = parseInt(pageJumperInput.value);
    if (pageNum >= 1 && pageNum <= totalPages) {
        currentPage = pageNum;
        updatePageInfo();
        updateNavigationButtons();
        scrollToPage(pageNum);
    } else {
        alert(`請輸入 1 到 ${pageNum} 之間的有效頁碼。`);
    }
});

// --- 處理點擊事件，建立文字方塊 ---
function handleCanvasClick(event, pageNum) {
    if (event.target.nodeName.toLowerCase() !== 'canvas') return;

    // 如果有現有的文字輸入框，先完成編輯
    if (currentTextbox) {
        completeTextEdit();
    }

    const canvas = event.currentTarget.querySelector('canvas');
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const textarea = document.createElement('textarea');
    textarea.className = 'pdf-textbox';
    
    const fontSize = parseInt(fontSizeInput.value);
    textarea.style.left = `${x}px`;
    textarea.style.top = `${y}px`;
    textarea.style.fontSize = `${fontSize}px`;
    textarea.style.color = fontColorInput.value;
    textarea.style.lineHeight = '1.2';
    textarea.style.minWidth = `${fontSize * 2}px`;
    textarea.style.minHeight = `${fontSize}px`;

    // 儲存文字方塊資訊
    currentTextbox = {
        element: textarea,
        pageNum: pageNum,
        x: x,
        y: y,
        canvas: canvas
    };

    // 按 Enter 鍵完成編輯
    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            completeTextEdit();
        }
    });

    // 失去焦點時完成編輯
    textarea.addEventListener('blur', () => {
        setTimeout(() => {
            if (currentTextbox && currentTextbox.element === textarea) {
                completeTextEdit();
            }
        }, 100);
    });

    canvas.parentNode.appendChild(textarea);
    textarea.focus();
}

// --- 完成文字編輯 ---
function completeTextEdit() {
    if (!currentTextbox) return;
    
    const { element, pageNum, x, y, canvas } = currentTextbox;
    const text = element.value.trim();
    
    if (text) {
        addTextToPdf(text, pageNum, x, y, canvas);
    }
    
    // 移除文字輸入框
    if (element.parentNode) {
        element.parentNode.removeChild(element);
    }
    
    currentTextbox = null;
}

// --- 移除即時預覽功能，避免重疊顯示 ---
// 不再需要 previewText 函數

// --- 將文字正式添加到 PDF 物件的函式 ---
async function addTextToPdf(text, pageNum, canvasX, canvasY, canvas) {
    if (!text.trim()) return;

    try {
        const page = pdfLibDoc.getPages()[pageNum - 1];
        
        const pdfX = (canvasX / canvas.width) * page.getWidth();
        const pdfY = (1 - (canvasY / canvas.height)) * page.getHeight();

        const fontSize = parseInt(fontSizeInput.value);
        const fontColor = hexToRgb(fontColorInput.value);
        const isBold = fontBoldCheckbox.checked;

        let customFont;
        let fontFamily = 'NotoSansTC'; // 預設使用思源黑體
        
        // 檢查是否包含中文字符
        const hasChineseChars = /[\u4e00-\u9fff]/.test(text);
        
        if (hasChineseChars) {
            if (!notoFontBytes) {
                console.warn('中文字型未載入，嘗試使用系統內建字型...');
                // 嘗試使用系統內建的中文字型
                try {
                    // 使用 PDF-lib 的內建字型，這些字型通常支援中文
                    customFont = await pdfLibDoc.embedFont(isBold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica);
                    fontFamily = 'Helvetica';
                    console.log('使用系統內建字型作為中文字型替代');
                    
                } catch (fontError) {
                    console.error('系統字型載入失敗:', fontError);
                    throw new Error('無法載入任何字型');
                }
            } else {
                try {
                    // 使用已註冊的 fontkit 嵌入字型，移除字型子集功能
                    customFont = await pdfLibDoc.embedFont(notoFontBytes);
                    console.log('中文字型嵌入成功');
                } catch (fontError) {
                    console.error('中文字型嵌入失敗:', fontError);
                    console.log('嘗試使用系統內建字型...');
                    
                    // 回退到標準字型
                    customFont = await pdfLibDoc.embedFont(isBold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica);
                    fontFamily = 'Helvetica';
                    console.log('已回退到系統內建字型');
                }
            }
        } else {
            // 純英文文字，使用標準字型
            customFont = await pdfLibDoc.embedFont(isBold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica);
            fontFamily = 'Helvetica';
        }
        
        // 修復：使用正確的顏色格式 - rgb() 函式而不是物件
        const colorObj = rgb(fontColor.r, fontColor.g, fontColor.b);
        
        // 檢查文字是否包含中文字符，如果包含且使用系統字型，可能需要特殊處理
        if (hasChineseChars && fontFamily === 'Helvetica') {
            // 對於中文字符，嘗試使用不同的編碼方式
            try {
                page.drawText(text, {
                    x: pdfX,
                    y: pdfY - fontSize,
                    font: customFont,
                    size: fontSize,
                    color: colorObj,
                    lineHeight: fontSize * 1.2,
                });
            } catch (encodingError) {
                console.warn('中文字符編碼失敗，嘗試轉換為英文:', encodingError);
                // 如果中文字符無法編碼，轉換為英文或移除
                const englishText = text.replace(/[\u4e00-\u9fff]/g, '?');
                page.drawText(englishText, {
                    x: pdfX,
                    y: pdfY - fontSize,
                    font: customFont,
                    size: fontSize,
                    color: colorObj,
                    lineHeight: fontSize * 1.2,
                });
                
                showMessage('中文字符已轉換為問號，建議使用支援中文的字型', 'warning');
            }
        } else {
            // 正常繪製文字
            page.drawText(text, {
                x: pdfX,
                y: pdfY - fontSize,
                font: customFont,
                size: fontSize,
                color: colorObj,
                lineHeight: fontSize * 1.2,
            });
        }
        
        // 儲存文字資訊用於即時顯示
        addedTexts.push({
            text: text,
            page: pageNum,
            x: canvasX,
            y: canvasY,
            fontSize: fontSize,
            color: fontColorInput.value,
            isBold: isBold,
            fontFamily: fontFamily
        });
        
        // 在畫布上繪製文字
        drawTextOnCanvas(text, canvasX, canvasY, fontSize, fontColorInput.value, isBold, fontFamily, canvas);
        
        // 更新狀態顯示
        updateStatusDisplay();
        
        console.log(`文字 "${text}" 已成功寫入第 ${pageNum} 頁，座標: (${pdfX.toFixed(2)}, ${pdfY.toFixed(2)})`);
        
        // 顯示成功訊息
        showMessage(`文字 "${text}" 已新增到第 ${pageNum} 頁`, 'success');
        
    } catch (error) {
        console.error('添加文字到 PDF 失敗:', error);
        showMessage('添加文字失敗，請檢查瀏覽器控制台', 'error');
    }
}

// --- 在畫布上繪製文字 ---
function drawTextOnCanvas(text, x, y, fontSize, color, isBold, fontFamily, canvas) {
    try {
        const ctx = canvas.getContext('2d');
        ctx.save();
        
        // 設定字型 - 直接使用思源黑體
        ctx.font = `${isBold ? 'bold' : 'normal'} ${fontSize}px Noto Sans TC, sans-serif`;
        ctx.fillStyle = color;
        ctx.textBaseline = 'top';
        
        // 繪製文字
        ctx.fillText(text, x, y);
        
        ctx.restore();
        
        console.log(`文字已繪製到畫布: "${text}" at (${x}, ${y})`);
        
    } catch (error) {
        console.error('繪製文字到畫布失敗:', error);
    }
}

// --- 重新繪製已新增的文字 ---
function redrawAddedTexts(pageNum, canvas) {
    const pageTexts = addedTexts.filter(t => t.page === pageNum);
    pageTexts.forEach(textInfo => {
        drawTextOnCanvas(
            textInfo.text,
            textInfo.x,
            textInfo.y,
            textInfo.fontSize,
            textInfo.color,
            textInfo.isBold,
            textInfo.fontFamily,
            canvas
        );
    });
}

// --- 匯出 PDF 按鈕事件 ---
exportPdfBtn.addEventListener('click', async () => {
    if (!pdfLibDoc) {
        alert('沒有可匯出的 PDF！');
        return;
    }
    
    // 確保所有文字都已添加到 PDF
    if (currentTextbox) {
        completeTextEdit();
    }
    
    try {
        showMessage('正在匯出 PDF...', 'info');
        
        const pdfBytes = await pdfLibDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `edited_${new Date().toISOString().slice(0,10)}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        
        console.log('PDF 匯出成功！');
        showMessage('PDF 匯出成功！', 'success');
        
    } catch (error) {
        console.error('PDF 匯出失敗:', error);
        showMessage('PDF 匯出失敗，請檢查瀏覽器控制台', 'error');
    }
});

// --- 輔助函式 ---
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255,
    } : { r: 0, g: 0, b: 0 };
}

// --- 更新狀態顯示 ---
function updateStatusDisplay() {
    const totalTexts = addedTexts.length;
    const pageTexts = addedTexts.filter(t => t.page === currentPage).length;
    
    // 更新匯出按鈕文字
    if (totalTexts > 0) {
        exportPdfBtn.textContent = `4. 匯出 PDF (${totalTexts} 個文字)`;
        exportPdfBtn.style.backgroundColor = '#28a745';
    } else {
        exportPdfBtn.textContent = '4. 匯出 PDF';
        exportPdfBtn.style.backgroundColor = '#dc3545';
    }
    
}

// --- 顯示訊息 ---
function showMessage(message, type = 'info') {
    // 移除舊的訊息
    const oldMessage = document.querySelector('.status-message');
    if (oldMessage) {
        oldMessage.remove();
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `status-message status-${type}`;
    messageDiv.textContent = message;
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 6px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
        max-width: 300px;
        word-wrap: break-word;
    `;
    
    // 根據類型設定顏色
    switch (type) {
        case 'success':
            messageDiv.style.backgroundColor = '#28a745';
            break;
        case 'error':
            messageDiv.style.backgroundColor = '#dc3545';
            break;
        case 'warning':
            messageDiv.style.backgroundColor = '#ffc107';
            messageDiv.style.color = '#212529';
            break;
        default:
            messageDiv.style.backgroundColor = '#17a2b8';
    }
    
    document.body.appendChild(messageDiv);
    
    // 3秒後自動移除
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.remove();
                }
            }, 300);
        }
    }, 3000);
}

// --- 添加 CSS 動畫 ---
function addMessageStyles() {
    if (!document.getElementById('message-styles')) {
        const style = document.createElement('style');
        style.id = 'message-styles';
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// --- 初始化工具列 ---
document.addEventListener('DOMContentLoaded', () => {
    createToolbar();
    addMessageStyles();
    
    // 載入字型
    loadFonts();
    
    // 設定預設顏色為黑色
    fontColorInput.value = '#000000';

    // 顯示歡迎訊息
    setTimeout(() => {
        showMessage('PDF 編輯器已準備就緒！點擊 PDF 頁面即可新增文字', 'info');
    }, 1000);
});