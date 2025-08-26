import { convertCanvasToBlackAndWhite } from './processing-image.js';
import { showToast } from '../alerts.js';

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
        
        // Проверяем загрузку библиотеки
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
            
            // Создаем миниатюры страниц
            await this.createThumbnails();
            this.updatePageInfo();
            await this.renderPage();
        } catch (error) {
            console.error('Ошибка загрузки PDF:', error);
            
            if (error.name === 'NetworkError' || error.message.includes('network') || error.message.includes('connection')) {
                this.showMessage('Ошибка сети при загрузке PDF. Проверьте интернет-соединение.', 'connection-error');
                showToast('Ошибка сети при загрузке PDF. Проверьте интернет-соединение', 'error', 'Ошибка');
            } else {
                this.showMessage('Ошибка загрузки PDF: ' + error.message, 'error');
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
        if (this.pdfPreview) this.pdfPreview.innerHTML = '';
    }

    // Создание миниатюр страниц
    async createThumbnails() {
        this.pageThumbnails.innerHTML = '';
        
        const numPagesToShow = this.totalPages;
        
        for (let i = 1; i <= numPagesToShow; i++) {
            const thumbnail = document.createElement('div');
            thumbnail.className = 'thumbnail';
            thumbnail.innerHTML = `<div>Стр. ${i}</div>`;
            thumbnail.dataset.page = i;
            
            // Загрузка миниатюры
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
            
            // Получение размера контейнера
            const containerWidth = this.pdfPreview.clientWidth;
            const containerHeight = this.pdfPreview.clientHeight;
            
            // Расчет оптимального масштаба для увеличения
            const baseViewport = page.getViewport({ scale: 1.0 });
            
            // Увеличение масштаба в 3 раза или до максимально возможного
            const targetScale = Math.min(
                3.0,
                (containerWidth * 3) / baseViewport.width,
                (containerHeight * 3) / baseViewport.height
            );
            
            // Создание viewport с увеличенным масштабом
            const scaledViewport = page.getViewport({ 
                scale: targetScale,
                rotation: this.currentRotation
            });
            
            // Создание canvas
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = scaledViewport.height;
            canvas.width = scaledViewport.width;
            
            this.pdfPreview.innerHTML = '';
            this.pdfPreview.appendChild(canvas);
            
            // Рендер страницы
            await page.render({
                canvasContext: context,
                viewport: scaledViewport
            }).promise;
            
            // Настройка скроллинга
            this.pdfPreview.style.overflow = 'auto';
            this.pdfPreview.style.display = 'flex';
            this.pdfPreview.style.justifyContent = 'flex-start';
            this.pdfPreview.style.alignItems = 'flex-start';
            
        } catch (error) {
            console.error('Ошибка рендеринга:', error);
            showToast('Ошибка рендеринга: ' + error.message, 'error', 'Ошибка');
        }
    }

    // Обновление информации о странице
    updatePageInfo() {
        if (this.pageCounter) {
            this.pageCounter.textContent = `Страницы (${this.totalPages}) | Стр. ${this.currentPageNum}`;
        }
    }

    // Конвертация текущей страницы PDF
    async convertCurrentPage(outputFormat) {
        if (!this.currentPdf) return null;
        
        try {
            const page = await this.currentPdf.getPage(this.currentPageNum);
            const viewport = page.getViewport({ 
                scale: 2.0,
                rotation: this.currentRotation
            });
            
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;
            
            const bwCanvas = await convertCanvasToBlackAndWhite(canvas);
            return bwCanvas;
        } catch (error) {
            console.error('Ошибка конвертации PDF:', error);
            showToast('Ошибка конвертации PDF: ' + error.message, 'error', 'Ошибка');
            throw error;
        }
    }


}