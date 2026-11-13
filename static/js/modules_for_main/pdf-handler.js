import { convertCanvasToBlackAndWhite } from './processing-image.js';
import { showToast } from '../alerts.js';
import { SelectionHandler } from './selection-handler.js';

export class PDFHandler {
    constructor() {
        this.currentPdf = null;
        this.currentPageNum = 1;
        this.totalPages = 1;
        this.selectedFile = null;
        this.currentRotation = 0;
        this.modal = document.getElementById('pdfModal');
        this.pdfPreview = document.getElementById('pdfPreview');
        this.pageThumbnails = document.getElementById('pageThumbnails');
        this.pageCounter = document.getElementById('pageCounter');
        this.pdfjsLibLoaded = false;
        this.isSelectionMode = false;
        
        // Canvas для отображения
        this.displayCanvas = null;
        this.selectionHandler = null;
    }

    // Проверка загрузки PDF.js
    checkPdfJsLib() {
        if (typeof pdfjsLib === 'undefined' || !pdfjsLib.getDocument) {
            showToast('Библиотека PDF не загружена. Проверьте интернет-соединение', 'warning', 'Предупреждение');
            return false;
        }
        this.pdfjsLibLoaded = true;
        return true;
    }

    // Функция для отображения модального окна PDF
    async showPdfPageSelector(file) {
        if (!file) {
            showToast('Пожалуйста, выберите файл', 'warning', 'Предупреждение');
            return;
        }
        
        if (!this.checkPdfJsLib()) {
            return;
        }
        
        this.selectedFile = file;
        this.modal.style.display = 'block';
        this.currentRotation = 0;
        
        try {
            const arrayBuffer = await file.arrayBuffer();
            this.currentPdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
            
            if (!this.currentPdf.numPages) {
                throw new Error('PDF не содержит страниц');
            }
            
            this.totalPages = this.currentPdf.numPages;
            this.currentPageNum = 1;
            
            await this.createThumbnails();
            this.updatePageInfo();
            await this.renderPage();
        } catch (error) {
            console.error('Ошибка загрузки PDF:', error);
            
            if (error.name === 'NetworkError' || error.message.includes('network') || error.message.includes('connection')) {
                showToast('Ошибка сети при загрузке PDF. Проверьте интернет-соединение', 'error', 'Ошибка');
            } else {
                showToast('Ошибка загрузки PDF: ' + error.message, 'error', 'Ошибка');
            }
            
            this.closeModalHandler();
        }
    }

    closeModalHandler() {
        if (this.modal) this.modal.style.display = 'none';
        this.currentPdf = null;
        this.selectedFile = null;
        this.currentPageNum = 1;
        this.totalPages = 1;
        this.currentRotation = 0;
        this.selectionHandler = null;
        if (this.pdfPreview) this.pdfPreview.innerHTML = '';
    }

    async createThumbnails() {
        this.pageThumbnails.innerHTML = '';
        
        for (let i = 1; i <= this.totalPages; i++) {
            const thumbnail = document.createElement('div');
            thumbnail.className = 'thumbnail';
            thumbnail.innerHTML = `<div>Стр. ${i}</div>`;
            thumbnail.dataset.page = i;
            
            try {
                const page = await this.currentPdf.getPage(i);
                const viewport = page.getViewport({ scale: 0.2 });
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                
                await page.render({
                    canvasContext: context,
                    viewport: viewport
                }).promise;
                
                thumbnail.appendChild(canvas);
            } catch (error) {
                console.error('Ошибка создания миниатюры:', error);
            }
            
            thumbnail.addEventListener('click', () => {
                this.currentPageNum = i;
                this.updatePageInfo();
                this.renderPage();
            });
            
            this.pageThumbnails.appendChild(thumbnail);
        }
    }

    async renderPage() {
        if (!this.currentPdf || this.currentPageNum < 1 || this.currentPageNum > this.totalPages) {
            showToast('PDF не загружен', 'warning', 'Предупреждение');
            return;
        }
        
        this.pdfPreview.innerHTML = '<p>Загрузка страницы...</p>';
        
        try {
            const page = await this.currentPdf.getPage(this.currentPageNum);
            const containerWidth = this.pdfPreview.clientWidth || 800;
            const baseViewport = page.getViewport({ scale: 1.0, rotation: this.currentRotation });
            
            // Расчет масштаба исключительно для комфортного просмотра на экране (например, 1.5–2.0x)
            this.renderScale = Math.max(1.5, containerWidth / baseViewport.width);
            const viewport = page.getViewport({ scale: this.renderScale, rotation: this.currentRotation });
            
            this.displayCanvas = document.createElement('canvas');
            const context = this.displayCanvas.getContext('2d');
            this.displayCanvas.height = viewport.height;
            this.displayCanvas.width = viewport.width;
            
            const canvasContainer = document.createElement('div');
            canvasContainer.className = 'canvas-container';
            canvasContainer.style.cssText = `
                position: relative;
                display: inline-block;
                margin: 0 auto;
            `;
            
            canvasContainer.appendChild(this.displayCanvas);
            this.pdfPreview.innerHTML = '';
            this.pdfPreview.appendChild(canvasContainer);
            this.canvasContainer = canvasContainer;
            
            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;
            
            this.initSelectionHandler();
            
            this.pdfPreview.style.overflow = 'auto';
            this.pdfPreview.style.display = 'flex';
            this.pdfPreview.style.justifyContent = 'flex-start';
            this.pdfPreview.style.alignItems = 'flex-start';
            
        } catch (error) {
            console.error('Ошибка рендеринга:', error);
            showToast('Ошибка рендеринга: ' + error.message, 'error', 'Ошибка');
        }
    }

    /**
     * Рендерит выделенный участок (или всю страницу) напрямую из PDF с ВЫСОКИМ КАЧЕСТВОМ (highDpiScale)
     * @param {number} highDpiScale - Масштаб рендеринга для OCR (по умолчанию 4.0 = ~300 DPI)
     */
    async getHighQualityCropCanvas(highDpiScale = 4.0) {
        if (!this.currentPdf) return null;

        const page = await this.currentPdf.getPage(this.currentPageNum);
        const baseViewport = page.getViewport({ scale: 1.0, rotation: this.currentRotation });

        let cropX = 0;
        let cropY = 0;
        let cropW = baseViewport.width;
        let cropH = baseViewport.height;

        // Если есть выделение, перевод из экранных координат в базовые координаты PDF
        if (this.hasValidSelection()) {
            const selection = this.selectionHandler.selection; // координаты в CSS-пикселях просмотрового canvas
            const canvasRect = this.displayCanvas.getBoundingClientRect();
            
            // Нормализация координат от 0.0 до 1.0
            const normX = selection.x / canvasRect.width;
            const normY = selection.y / canvasRect.height;
            const normW = selection.width / canvasRect.width;
            const normH = selection.height / canvasRect.height;

            // Перевод в базовые размеры PDF
            cropX = normX * baseViewport.width;
            cropY = normY * baseViewport.height;
            cropW = normW * baseViewport.width;
            cropH = normH * baseViewport.height;
        }

        // Рендерим всю страницу в High DPI
        const hqViewport = page.getViewport({ scale: highDpiScale, rotation: this.currentRotation });
        const hqCanvas = document.createElement('canvas');
        hqCanvas.width = hqViewport.width;
        hqCanvas.height = hqViewport.height;
        const hqContext = hqCanvas.getContext('2d');

        await page.render({
            canvasContext: hqContext,
            viewport: hqViewport
        }).promise;

        // Вырезка куска в высоком разрешении
        const croppedCanvas = document.createElement('canvas');
        const finalSx = cropX * highDpiScale;
        const finalSy = cropY * highDpiScale;
        const finalSw = cropW * highDpiScale;
        const finalSh = cropH * highDpiScale;

        croppedCanvas.width = finalSw;
        croppedCanvas.height = finalSh;

        const cropCtx = croppedCanvas.getContext('2d');
        cropCtx.drawImage(
            hqCanvas,
            finalSx, finalSy, finalSw, finalSh,
            0, 0, finalSw, finalSh
        );

        return croppedCanvas;
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
                const convertBtn = document.getElementById('convertSelection');
                if (convertBtn) {
                    convertBtn.style.display = 'block';
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
        const toggleBtn = document.getElementById('toggleSelection');
        const resetBtn = document.getElementById('resetSelection');
        const convertSelectionBtn = document.getElementById('convertSelection');
        
        if (!this.isSelectionMode) {
            this.activateSelectionMode();
            document.body.style.cursor = 'crosshair';
            
            toggleBtn.innerHTML = '<i class="select-icon">✕</i> Отменить выделение';
            toggleBtn.classList.add('active');
            if (resetBtn) resetBtn.style.display = 'inline-block';
            if (convertSelectionBtn) convertSelectionBtn.style.display = 'none';
            
            this.isSelectionMode = true;
            showToast('Режим выделения активен. Выделите нужную область', 'info', 'Информация');
        } else {
            this.deactivateSelectionAndReset();
            document.body.style.cursor = '';
            
            toggleBtn.innerHTML = '<i class="select-icon">▦</i> Выделить область';
            toggleBtn.classList.remove('active');
            if (resetBtn) resetBtn.style.display = 'none';
            if (convertSelectionBtn) convertSelectionBtn.style.display = 'none';
            
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
        
        const toggleBtn = document.getElementById('toggleSelection');
        const resetBtn = document.getElementById('resetSelection');
        const convertSelectionBtn = document.getElementById('convertSelection');
        
        if (toggleBtn) {
            toggleBtn.innerHTML = '<i class="select-icon">▦</i> Выделить область';
            toggleBtn.classList.remove('active');
        }
        
        if (resetBtn) resetBtn.style.display = 'none';
        if (convertSelectionBtn) convertSelectionBtn.style.display = 'none';
        
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
        
        const convertSelectionBtn = document.getElementById('convertSelection');
        if (convertSelectionBtn) convertSelectionBtn.style.display = 'none';
    }

    hasValidSelection() {
        return this.selectionHandler && 
               this.selectionHandler.isActive && 
               this.selectionHandler.hasValidSelection();
    }

    async getSelectionCanvas() {
        if (!this.selectionHandler || !this.selectionHandler.hasValidSelection()) {
            return null;
        }
        
        try {
            // Выделение из SelectionHandler
            const selection = this.selectionHandler.selection;
            
            if (!this.displayCanvas) return null;
            
            // bounding rect canvas
            const canvasRect = this.displayCanvas.getBoundingClientRect();
            
            console.log('PDF Selection debug:', {
                selection: { ...selection },
                canvasRect: { width: canvasRect.width, height: canvasRect.height },
                canvasSize: { width: this.displayCanvas.width, height: this.displayCanvas.height }
            });
            
            // Расчет масштаба
            const scaleX = this.displayCanvas.width / canvasRect.width;
            const scaleY = this.displayCanvas.height / canvasRect.height;
            
            // Преобразование координат в пиксели canvas
            const sx = Math.max(0, Math.round(selection.x * scaleX));
            const sy = Math.max(0, Math.round(selection.y * scaleY));
            const sw = Math.min(Math.round(selection.width * scaleX), this.displayCanvas.width - sx);
            const sh = Math.min(Math.round(selection.height * scaleY), this.displayCanvas.height - sy);
            
            console.log('Canvas pixels:', { sx, sy, sw, sh });
            
            if (sw <= 0 || sh <= 0) {
                console.error('Invalid selection dimensions');
                return null;
            }
            
            // Создание canvas с выделенной областью
            const selectionCanvas = document.createElement('canvas');
            selectionCanvas.width = sw;
            selectionCanvas.height = sh;
            
            const ctx = selectionCanvas.getContext('2d');
            ctx.drawImage(
                this.displayCanvas,
                sx, sy, sw, sh,
                0, 0, sw, sh
            );
            
            return selectionCanvas;
            
        } catch (error) {
            console.error('Error getting selection canvas:', error);
            return null;
        }
    }

    updatePageInfo() {
        if (this.pageCounter) {
            this.pageCounter.textContent = `Страницы (${this.totalPages}) | Стр. ${this.currentPageNum}`;
        }
    }

    async convertCurrentPage(outputFormat) {
        if (!this.currentPdf) return null;
        
        try {
            // Получение чистого фрагмента или всей страницы в высоком качестве (scale 4.0)
            const hqCanvas = await this.getHighQualityCropCanvas(4.0);
            if (!hqCanvas) return null;

            //  Бинаризация / обработка на высоком разрешении
            const bwCanvas = await convertCanvasToBlackAndWhite(hqCanvas);
            return bwCanvas;
        } catch (error) {
            console.error('Ошибка обработки PDF:', error);
            showToast('Ошибка обработки PDF: ' + error.message, 'error', 'Ошибка');
            throw error;
        }
    }
}