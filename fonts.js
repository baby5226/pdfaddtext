// 字型資料檔案
// 參考 ShippingMark 專案的做法，直接載入本地字型檔案

// 建立一個簡單的字型資料（僅作為最後備用）
const createSimpleChineseFont = () => {
    // 這是一個簡化的字型資料，實際使用時應該載入真實的字型檔案
    const fontData = new ArrayBuffer(1024); // 1KB 的緩衝區
    
    // 建立一個基本的字型結構
    const view = new Uint8Array(fontData);
    
    // 寫入一些基本的字型資訊
    const fontInfo = 'Noto Sans TC - Simplified Chinese Font';
    const encoder = new TextEncoder();
    const fontInfoBytes = encoder.encode(fontInfo);
    
    // 將字型資訊寫入緩衝區
    for (let i = 0; i < fontInfoBytes.length && i < 100; i++) {
        view[i] = fontInfoBytes[i];
    }
    
    return fontData;
};

// 檢查是否為本地檔案協議
const isLocalFileProtocol = () => {
    return window.location.protocol === 'file:';
};

// 嘗試載入真實的字型檔案
const loadRealFont = async () => {
    try {
        // 檢查是否為本地檔案協議
        if (isLocalFileProtocol()) {
            console.warn('⚠️ 檢測到本地檔案協議 (file://)，字型載入可能受限於 CORS 政策');
            return null;
        }
        
        // 參考 ShippingMark 專案的做法，直接載入本地字型檔案
        const fontSources = [
            // 本地字型檔案（優先）
            './NotoSansTC-Medium.ttf',
            './NotoSansTC-Regular.ttf'
        ];
        
        for (const source of fontSources) {
            try {
                console.log(`嘗試載入字型: ${source}`);
                const response = await fetch(source);
                
                if (response.ok) {
                    const fontBytes = await response.arrayBuffer();
                    console.log(`字型載入成功: ${source}, 大小: ${(fontBytes.byteLength / 1024).toFixed(1)} KB`);
                    
                    // 驗證字型檔案大小（NotoSansTC 應該大於 1MB）
                    if (fontBytes.byteLength > 1024 * 1024) {
                        console.log('✅ 本地中文字型檔案載入成功！');
                        console.log(`字型檔案: ${source}`);
                        console.log(`字型大小: ${(fontBytes.byteLength / (1024 * 1024)).toFixed(2)} MB`);
                        return fontBytes;
                    } else {
                        console.warn(`字型檔案過小 (${(fontBytes.byteLength / 1024).toFixed(1)} KB)，可能不是完整的字型檔案`);
                    }
                } else {
                    console.warn(`字型載入失敗: ${source} - HTTP ${response.status}`);
                }
            } catch (error) {
                console.warn(`字型載入失敗: ${source} - ${error.message}`);
            }
        }
        
        console.warn('本地字型載入失敗，將使用系統預設字型');
        return null;
        
    } catch (error) {
        console.error('字型載入過程發生錯誤:', error);
        return null;
    }
};

// 匯出字型資料
window.simpleChineseFont = createSimpleChineseFont();
window.loadRealFont = loadRealFont;
window.isLocalFileProtocol = isLocalFileProtocol;

console.log('字型載入器已準備就緒，參考 ShippingMark 專案做法');
