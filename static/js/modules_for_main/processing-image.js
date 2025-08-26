
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
                convertCanvasToBlackAndWhite(canvas).then(resolve).catch(reject);
            };
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Конвертация canvas в ч/б
export function convertCanvasToBlackAndWhite(canvas) {
    return new Promise((resolve) => {
        const bwCanvas = document.createElement('canvas');
        bwCanvas.width = canvas.width;
        bwCanvas.height = canvas.height;
        
        const ctx = bwCanvas.getContext('2d');
        ctx.drawImage(canvas, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, bwCanvas.width, bwCanvas.height);
        const data = imageData.data;
        
        // Преобразование в grayscale (формула luminance)
        for (let i = 0; i < data.length; i += 4) {
            const avg = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            data[i] = data[i + 1] = data[i + 2] = avg;
        }
        
        ctx.putImageData(imageData, 0, 0);
        resolve(bwCanvas);
    });
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