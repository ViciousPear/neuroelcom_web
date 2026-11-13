import { convertCanvasToBlackAndWhite } from './processing-image.js';
import { showToast } from '../alerts.js';
import { SelectionHandler } from './selection-handler.js';

export class ImageHandler {
    constructor() {
        this.currentImage = null;
        this.currentRotation = 0;
        this.modal = document.getElementById('imageModal');
        this.imagePreview = document.getElementById('imagePreview');
        this.selectedFile = null;
        this.isSelectionMode = false;
        
        // Фиксированный формат вывода - PNG
        this.outputFormat = 'png';
        
        // Canvas для отображения
        this.displayCanvas = null;
        // Оригинальное изображение 
        this.originalImage = null;
        this.selectionHandler = null;
        
        // Привязка методов
        this.closeModalHandler = this.closeModalHandler.bind(this);
        this.toggleSelectionMode = this.toggleSelectionMode.bind(this);
        this.resetSelection = this.resetSelection.bind(this);
        this.rotateImage = this.rotateImage.bind(this);
        
        console.log('ImageHandler initialized');
    }

    async showImageEditor(file) {
        console.log('showImageEditor called with file:', file);
        
        if (!file) {
            showToast('Пожалуйста, выберите файл', 'warning', 'Предупреждение');
            return;
        }

        this.selectedFile = file;
        
        if (!this.modal) {
            console.error('Модальное окно imageModal не найдено в DOM');
            showToast('Ошибка: модальное окно не найдено', 'error', 'Ошибка');
            return;
        }
        
        this.modal.style.display = 'block';
        this.currentRotation = 0;

        try {
            await this.loadAndDisplayImage(file);
        } catch (error) {
            console.error('Ошибка загрузки изображения:', error);
            showToast('Ошибка загрузки изображения: ' + error.message, 'error', 'Ошибка');
            this.closeModalHandler();
        }
    }

    async loadAndDisplayImage(file) {
        console.log('loadAndDisplayImage started');
        
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                console.log('FileReader onload, creating image');
                const img = new Image();
                
                img.onload = () => {
                    console.log('Image loaded successfully', {
                        width: img.width,
                        height: img.height,
                        naturalWidth: img.naturalWidth,
                        naturalHeight: img.naturalHeight
                    });
                    
                    this.currentImage = img;
                    this.originalImage = img; 
                    
                    setTimeout(() => {
                        this.renderImage();
                        resolve();
                    }, 100);
                };
                
                img.onerror = (error) => {
                    console.error('Error loading image:', error);
                    reject(new Error('Не удалось загрузить изображение'));
                };
                
                img.src = e.target.result;
            };
            
            reader.onerror = (error) => {
                console.error('FileReader error:', error);
                reject(new Error('Ошибка чтения файла'));
            };
            
            reader.readAsDataURL(file);
        });
    }

    renderImage() {
    console.log('renderImage called, rotation:', this.currentRotation);
    
    if (!this.currentImage || !this.imagePreview) return;
    
    this.imagePreview.innerHTML = '';
    
    const canvasContainer = document.createElement('div');
    canvasContainer.className = 'canvas-container';
    canvasContainer.style.cssText = `
        position: relative;
        display: inline-block;
        margin: 0 auto;
    `;
    
    const containerRect = this.imagePreview.getBoundingClientRect();
    let containerWidth = containerRect.width || 800;
    
    const imgWidth = this.currentImage.naturalWidth || this.currentImage.width;
    const imgHeight = this.currentImage.naturalHeight || this.currentImage.height;
    
    const isRotated90 = this.currentRotation % 180 !== 0;
    const effectiveWidth = isRotated90 ? imgHeight : imgWidth;
    const effectiveHeight = isRotated90 ? imgWidth : imgHeight;
    
    // Расчет масштаба исключительно для комфортного отображения на экране
    this.renderScale = Math.max(1.0, containerWidth / effectiveWidth);
    
    const displayWidth = Math.round(effectiveWidth * this.renderScale);
    const displayHeight = Math.round(effectiveHeight * this.renderScale);
    
    this.displayCanvas = document.createElement('canvas');
    this.displayCanvas.width = displayWidth;
    this.displayCanvas.height = displayHeight;
    const displayCtx = this.displayCanvas.getContext('2d');
    
    displayCtx.imageSmoothingEnabled = true;
    displayCtx.imageSmoothingQuality = 'high';
    
    // Отрисовка просмотровой копии с учетом поворота
    displayCtx.save();
    displayCtx.translate(displayWidth / 2, displayHeight / 2);
    displayCtx.rotate((this.currentRotation * Math.PI) / 180);
    
    const drawWidth = isRotated90 ? displayHeight : displayWidth;
    const drawHeight = isRotated90 ? displayWidth : displayHeight;
    
    displayCtx.drawImage(
        this.currentImage,
        -drawWidth / 2,
        -drawHeight / 2,
        drawWidth,
        drawHeight
    );
    displayCtx.restore();
    
    canvasContainer.appendChild(this.displayCanvas);
    this.imagePreview.appendChild(canvasContainer);
    this.canvasContainer = canvasContainer;
    
    this.initSelectionHandler();
    
    this.imagePreview.style.overflow = 'auto';
    this.imagePreview.style.display = 'flex';
    this.imagePreview.style.justifyContent = 'flex-start';
    this.imagePreview.style.alignItems = 'flex-start';
}

/**
 * Рендерит выделенный участок (или всё изображение) в исходном качестве
 * (Аналог getHighQualityCropCanvas из PDF-обработчика)
 */
async getHighQualityCropCanvas() {
    if (!this.currentImage) return null;

    const imgWidth = this.currentImage.naturalWidth || this.currentImage.width;
    const imgHeight = this.currentImage.naturalHeight || this.currentImage.height;

    const isRotated90 = this.currentRotation % 180 !== 0;
    // Оригинальные базовые размеры с учётом текущего поворота
    const baseWidth = isRotated90 ? imgHeight : imgWidth;
    const baseHeight = isRotated90 ? imgWidth : imgHeight;

    let cropX = 0;
    let cropY = 0;
    let cropW = baseWidth;
    let cropH = baseHeight;

    // Если есть выделение, то делается перевод из экранных координат в базовые координаты картинки 
    if (this.hasValidSelection()) {
        const selection = this.selectionHandler.selection; // координаты в CSS-пикселях displayCanvas
        const canvasRect = this.displayCanvas.getBoundingClientRect();

        // Нормализация координат от 0.0 до 1.0
        const normX = selection.x / canvasRect.width;
        const normY = selection.y / canvasRect.height;
        const normW = selection.width / canvasRect.width;
        const normH = selection.height / canvasRect.height;

        // Перевод в реальные пиксельные размеры оригинала
        cropX = normX * baseWidth;
        cropY = normY * baseHeight;
        cropW = normW * baseWidth;
        cropH = normH * baseHeight;
    }

    // Холст с оригинальным разрешением повернутой картинки
    const fullCanvas = document.createElement('canvas');
    fullCanvas.width = baseWidth;
    fullCanvas.height = baseHeight;

    const fullCtx = fullCanvas.getContext('2d');
    fullCtx.imageSmoothingEnabled = true;
    fullCtx.imageSmoothingQuality = 'high';

    // Рендер оригинала 1:1 с поворотом
    fullCtx.save();
    fullCtx.translate(baseWidth / 2, baseHeight / 2);
    fullCtx.rotate((this.currentRotation * Math.PI) / 180);
    
    fullCtx.drawImage(
        this.currentImage,
        -imgWidth / 2,
        -imgHeight / 2,
        imgWidth,
        imgHeight
    );
    fullCtx.restore();

    // Точная вырезка выделенного фрагмента 1:1 из полноразмерного холста
    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = Math.round(cropW);
    croppedCanvas.height = Math.round(cropH);

    const cropCtx = croppedCanvas.getContext('2d');
    
    cropCtx.drawImage(
        fullCanvas,
        Math.round(cropX), Math.round(cropY), Math.round(cropW), Math.round(cropH),
        0, 0, Math.round(cropW), Math.round(cropH)
    );

    return croppedCanvas;
}

hasValidSelection() {
    return this.selectionHandler && typeof this.selectionHandler.hasValidSelection === 'function'
        ? this.selectionHandler.hasValidSelection()
        : false;
}

    drawRotatedImageOnCanvas(ctx, canvasWidth, canvasHeight) {
        if (!this.currentImage) return;
        
        ctx.save();
        
        // Перемещение центра в середину canvas
        ctx.translate(canvasWidth / 2, canvasHeight / 2);
        
        ctx.rotate((this.currentRotation * Math.PI) / 180);
        
        let drawWidth, drawHeight;
        
        if (this.currentRotation % 180 === 90) {
            drawWidth = canvasHeight;
            drawHeight = canvasWidth;
        } else {
            drawWidth = canvasWidth;
            drawHeight = canvasHeight;
        }
        
        ctx.drawImage(
            this.currentImage,
            -drawWidth / 2,
            -drawHeight / 2,
            drawWidth,
            drawHeight
        );
        
        ctx.restore();
    }

async getSelectionCanvas() {
    if (!this.selectionHandler || !this.selectionHandler.hasValidSelection()) {
        return null;
    }

    try {
        // Выделение в пикселях CSS элемента (относительно отображаемого displayCanvas)
        const selection = this.selectionHandler.selection; // { x, y, width, height }
        const canvasRect = this.displayCanvas.getBoundingClientRect();

        // Временный canvas с ПОЛНЫМ исходным разрешением и учетом поворота
        const fullCanvas = document.createElement('canvas');
        const isRotated90 = this.currentRotation % 180 !== 0;
        
        const origWidth = this.originalImage.naturalWidth;
        const origHeight = this.originalImage.naturalHeight;
        
        fullCanvas.width = isRotated90 ? origHeight : origWidth;
        fullCanvas.height = isRotated90 ? origWidth : origHeight;

        const fullCtx = fullCanvas.getContext('2d');
        fullCtx.imageSmoothingEnabled = true;
        fullCtx.imageSmoothingQuality = 'high';

        fullCtx.save();
        fullCtx.translate(fullCanvas.width / 2, fullCanvas.height / 2);
        fullCtx.rotate((this.currentRotation * Math.PI) / 180);
        
        fullCtx.drawImage(
            this.originalImage,
            -origWidth / 2,
            -origHeight / 2,
            origWidth,
            origHeight
        );
        fullCtx.restore();

        // Точный коэффициент масштабирования между CSS-размером и оригинал-размером
        const scaleX = fullCanvas.width / canvasRect.width;
        const scaleY = fullCanvas.height / canvasRect.height;

        // Координаты вырезки на полноразмерном Canvas
        const cropX = Math.round(selection.x * scaleX);
        const cropY = Math.round(selection.y * scaleY);
        const cropW = Math.round(selection.width * scaleX);
        const cropH = Math.round(selection.height * scaleY);

        if (cropW <= 0 || cropH <= 0) return null;

        // Вырезка куска БЕЗ потери качества в итоговый Canvas
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = cropW;
        finalCanvas.height = cropH;

        const finalCtx = finalCanvas.getContext('2d');

        // При пиксельном копировании 1:1 сглаживание не требуется
        finalCtx.imageSmoothingEnabled = false; 

        finalCtx.drawImage(
            fullCanvas,
            cropX, cropY, cropW, cropH,
            0, 0, cropW, cropH
        );

        console.log('Вырезан фрагмент высокого качества:', { width: cropW, height: cropH });

        return finalCanvas;

    } catch (error) {
        console.error('Ошибка при выделении области:', error);
        return null;
    }
}

    // Получение полного изображения с учетом поворота
    async getFullImageCanvas() {
        if (!this.originalImage) return null;
        
        try {
            // canvas с оригинальным изображением
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = this.originalImage.naturalWidth;
            tempCanvas.height = this.originalImage.naturalHeight;
            
            const tempCtx = tempCanvas.getContext('2d', {
                alpha: false,
                desynchronized: false,
                willReadFrequently: false
            });
            
            tempCtx.drawImage(this.originalImage, 0, 0);
            
            console.log('Getting full image:', {
                width: tempCanvas.width,
                height: tempCanvas.height
            });
            
            // Конвертация в ч/б
            const bwCanvas = await convertCanvasToBlackAndWhite(tempCanvas);
            return bwCanvas;
        } catch (error) {
            console.error('Ошибка конвертации изображения:', error);
            showToast('Ошибка конвертации: ' + error.message, 'error', 'Ошибка');
            throw error;
        }
    }

    rotateImage() {
        this.currentRotation = (this.currentRotation + 90) % 360;
        console.log('Rotating to:', this.currentRotation);
        this.renderImage();
    }

    initSelectionHandler() {
        if (!this.canvasContainer) {
            console.warn('canvasContainer не найден');
            return;
        }
        
        this.selectionHandler = new SelectionHandler(this.canvasContainer);
        
        const originalHandleMouseUp = this.selectionHandler.handleMouseUp;
        this.selectionHandler.handleMouseUp = (e) => {
            originalHandleMouseUp.call(this.selectionHandler, e);
            
            if (this.selectionHandler && this.selectionHandler.hasValidSelection()) {
                const imageConvertBtn = document.getElementById('sendImageSelection');
                if (imageConvertBtn) {
                    imageConvertBtn.style.display = 'block';
                }
            }
        };
        
        if (this.isSelectionMode) {
            setTimeout(() => {
                if (this.selectionHandler && this.selectionHandler.show) {
                    this.selectionHandler.show();
                }
            }, 100);
        }
    }

    toggleSelectionMode() {
        const toggleBtn = document.getElementById('imageToggleSelection');
        const resetBtn = document.getElementById('imageResetSelection');
        const sendSelectionBtn = document.getElementById('sendImageSelection');
        
        if (!this.isSelectionMode) {
            this.activateSelectionMode();
            document.body.style.cursor = 'crosshair';
            
            if (toggleBtn) {
                toggleBtn.innerHTML = '<i class="select-icon">✕</i> Отменить выделение';
                toggleBtn.classList.add('active');
            }
            if (resetBtn) resetBtn.style.display = 'inline-block';
            if (sendSelectionBtn) sendSelectionBtn.style.display = 'none';
            
            this.isSelectionMode = true;
            showToast('Режим выделения активен. Выделите нужную область', 'info', 'Информация');
        } else {
            this.deactivateSelectionAndReset();
            document.body.style.cursor = '';
            
            if (toggleBtn) {
                toggleBtn.innerHTML = '<i class="select-icon">▦</i> Выделить область';
                toggleBtn.classList.remove('active');
            }
            if (resetBtn) resetBtn.style.display = 'none';
            if (sendSelectionBtn) sendSelectionBtn.style.display = 'none';
            
            this.isSelectionMode = false;
        }
    }

    activateSelectionMode() {
        if (this.selectionHandler) {
            this.selectionHandler.show();
        } else {
            this.initSelectionHandler();
            setTimeout(() => {
                if (this.selectionHandler && this.selectionHandler.show) {
                    this.selectionHandler.show();
                }
            }, 200);
        }
        
        if (this.canvasContainer) {
            this.canvasContainer.classList.add('selection-mode-active');
        }
    }

    deactivateSelectionAndReset() {
        this.deactivateSelectionMode();
        this.isSelectionMode = false;
        document.body.style.cursor = '';
        
        const toggleBtn = document.getElementById('imageToggleSelection');
        const resetBtn = document.getElementById('imageResetSelection');
        const sendSelectionBtn = document.getElementById('sendImageSelection');
        
        if (toggleBtn) {
            toggleBtn.innerHTML = '<i class="select-icon">▦</i> Выделить область';
            toggleBtn.classList.remove('active');
        }
        
        if (resetBtn) resetBtn.style.display = 'none';
        if (sendSelectionBtn) sendSelectionBtn.style.display = 'none';
        
        if (this.selectionHandler) {
            this.selectionHandler.clearSelection();
            if (this.selectionHandler.overlay) {
                this.selectionHandler.overlay.style.display = 'none';
            }
            this.selectionHandler.unbindEventListeners();
        }
        
        if (this.canvasContainer) {
            this.canvasContainer.classList.remove('selection-mode-active');
        }
        
        const selectionElements = this.canvasContainer?.querySelectorAll('.selection-overlay, .selection-rect, .selection-handles, .selection-dimensions');
        if (selectionElements) {
            selectionElements.forEach(el => el.remove());
        }
    }

    deactivateSelectionMode() {
        if (this.selectionHandler && this.selectionHandler.hide) {
            this.selectionHandler.hide();
        }
        
        if (this.canvasContainer) {
            this.canvasContainer.classList.remove('selection-mode-active');
        }
        
        this.resetSelection();
    }

    resetSelection() {
        if (this.selectionHandler && this.selectionHandler.clearSelection) {
            this.selectionHandler.clearSelection();
        }
        
        const sendSelectionBtn = document.getElementById('sendImageSelection');
        if (sendSelectionBtn) sendSelectionBtn.style.display = 'none';
    }

    closeModalHandler() {
        console.log('Closing image modal');
        
        if (this.modal) {
            this.modal.style.display = 'none';
        }
        
        this.currentImage = null;
        this.originalImage = null;
        this.selectedFile = null;
        this.currentRotation = 0;
        this.isSelectionMode = false;
        this.selectionHandler = null;
        this.displayCanvas = null;
        
        if (this.imagePreview) {
            this.imagePreview.innerHTML = '';
        }
        
        const toggleBtn = document.getElementById('imageToggleSelection');
        const resetBtn = document.getElementById('imageResetSelection');
        const sendSelectionBtn = document.getElementById('sendImageSelection');
        
        if (toggleBtn) {
            toggleBtn.innerHTML = '<i class="select-icon">▦</i> Выделить область';
            toggleBtn.classList.remove('active');
        }
        if (resetBtn) resetBtn.style.display = 'none';
        if (sendSelectionBtn) sendSelectionBtn.style.display = 'none';
    }

    hasValidSelection() {
        return this.selectionHandler && 
               this.selectionHandler.isActive && 
               this.selectionHandler.hasValidSelection();
    }
}