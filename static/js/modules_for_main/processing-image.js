
// Создание ч/б изображения из File объекта
export function createBlackAndWhiteImage(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();
        
        reader.onload = (e) => {
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                
                try {
                    const bwCanvas = convertCanvasToBlackAndWhite(canvas);
                    resolve(bwCanvas);
                } catch (error) {
                    reject(error);
                }
            };
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

export function convertToBlackAndWhiteWithQuality(canvas) {
    const bwCanvas = document.createElement('canvas');
    bwCanvas.width = canvas.width;
    bwCanvas.height = canvas.height;
    
    const ctx = bwCanvas.getContext('2d', {
        alpha: false,
        desynchronized: true,
        willReadFrequently: false
    });
    
    // Установка качества
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Копирование с сохранением качества
    ctx.drawImage(canvas, 0, 0);
    
    // Конвертация в ч/б
    const imageData = ctx.getImageData(0, 0, bwCanvas.width, bwCanvas.height);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    return bwCanvas;
}

export function cropCanvasWithQuality(canvas, x, y, width, height) {
   
    const croppedCanvas = document.createElement('canvas');
    
    // Сохранение оригинального DPI (умножаем на 2 для Retina/высокого DPI)
    const dpiMultiplier = window.devicePixelRatio || 1;
    croppedCanvas.width = width * dpiMultiplier;
    croppedCanvas.height = height * dpiMultiplier;
    
    // Установка отображаемого размера
    croppedCanvas.style.width = `${width}px`;
    croppedCanvas.style.height = `${height}px`;
    
    const ctx = croppedCanvas.getContext('2d', {
        alpha: false,
        desynchronized: true,
        willReadFrequently: false
    });
    
    // Устанавливаем максимальное качество рендеринга
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Сохраняем текущие трансформации
    ctx.save();
    
    // Масштабируем для высокого DPI
    ctx.scale(dpiMultiplier, dpiMultiplier);
    
    // Копируем с сохранением качества (используем антиалиасинг)
    ctx.drawImage(
        canvas,
        x, y,               // source x, y
        width, height,      // source width, height
        0, 0,               // destination x, y
        width, height       // destination width, height
    );
    
    // Восстанавливаем трансформации
    ctx.restore();
    
    console.log('High quality crop created:', {
        original: { width: canvas.width, height: canvas.height },
        crop: { x, y, width, height },
        output: { 
            canvasWidth: croppedCanvas.width, 
            canvasHeight: croppedCanvas.height,
            displayWidth: croppedCanvas.style.width,
            displayHeight: croppedCanvas.style.height
        },
        dpiMultiplier: dpiMultiplier
    });
    
    return croppedCanvas;
}

// Конвертация canvas в ч/б
export function convertCanvasToBlackAndWhite(canvas) {
    console.log('Converting to black and white with quality preservation');
    
    try {
        
        const bwCanvas = document.createElement('canvas');
        bwCanvas.width = canvas.width;
        bwCanvas.height = canvas.height;
        
        const ctx = bwCanvas.getContext('2d', {
            alpha: false,
            desynchronized: false
        });
        
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        ctx.drawImage(canvas, 0, 0);
        
        // Получение данных изображения
        const imageData = ctx.getImageData(0, 0, bwCanvas.width, bwCanvas.height);
        const data = imageData.data;
        
        // Оптимизированная конвертация в оттенки серого
        for (let i = 0; i < data.length; i += 4) {
            // Формула для оттенков серого 
            const gray = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
            
            data[i] = gray;     
            data[i + 1] = gray; 
            data[i + 2] = gray; 
            data[i + 3] = 255;
        }
        
        // Записы обработанных данных
        ctx.putImageData(imageData, 0, 0);
        
        applySharpening(bwCanvas, 0.3);
        
        return bwCanvas;
    } catch (error) {
        console.error('Error converting canvas to black and white:', error);
        // Возвращение оригинального canvas в случае ошибки
        return canvas;
    }
}

// Функция для повышения резкости 
function applySharpening(canvas, strength = 0.3) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    
    for (let y = 1; y < canvas.height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = (y * width + x) * 4;
            
            // Ядро повышения резкости
            const grayCenter = data[idx];
            
            // Соседние пиксели
            const grayTop = data[idx - width * 4];
            const grayBottom = data[idx + width * 4];
            const grayLeft = data[idx - 4];
            const grayRight = data[idx + 4];
            
            // Применение фильтра
            const sharpened = grayCenter + strength * (4 * grayCenter - grayTop - grayBottom - grayLeft - grayRight);
            
            // Ограничение значения
            const clamped = Math.max(0, Math.min(255, sharpened));
            
            data[idx] = clamped;
            data[idx + 1] = clamped;
            data[idx + 2] = clamped;
        }
    }
    
    ctx.putImageData(imageData, 0, 0);
}



// Конвертация Image в Blob
export function imageToBlob(image, type, quality) {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);
        
        canvas.toBlob(resolve, type, quality);
    });
}