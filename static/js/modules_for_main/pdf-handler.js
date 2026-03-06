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

        this.qualitySettings = {
            displayScale: 2.0,        // Масштаб для отображения
            exportScale: 4.0,         // Масштаб для экспорта
            useDevicePixelRatio: true,// Учитывать DPI устройства
            imageSmoothing: true,     // Сглаживание изображений
            renderIntent: 'print'     // Намерение рендеринга
        };
        
        // ИНИЦИАЛИЗИРУЕМ PDF.js worker
        this.initPdfJs();
    }
    
    // Добавьте этот метод для инициализации PDF.js
    initPdfJs() {
        // Проверяем, что библиотека загружена
        if (typeof pdfjsLib !== 'undefined') {
            // Устанавливаем worker source для PDF.js
            if (pdfjsLib.GlobalWorkerOptions) {
                pdfjsLib.GlobalWorkerOptions.workerSrc = 
                    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
            }
            this.pdfjsLibLoaded = true;
        } else {
            console.warn('PDF.js library not loaded yet');
        }
    }
    
    // Проверка загрузки PDF.js
    checkPdfJsLib() {
        if (typeof pdfjsLib === 'undefined' || !pdfjsLib.getDocument) {
            showToast('Библиотека PDF не загружена. Проверьте интернет-соединение', 'warning', 'Предупреждение');
            return false;
        }
        
        // Убедимся, что worker установлен
        if (!this.pdfjsLibLoaded) {
            this.initPdfJs();
        }
        
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
                showToast('Ошибка сети при загрузке PDF. Проверьте интернет-соединение', 'error', 'Ошибка');
            } else if (error.name === 'UnknownErrorException') {
                showToast('Ошибка загрузки PDF файла. Возможно файл поврежден', 'error', 'Ошибка');
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
        
        // Расчет базового viewport
        const baseViewport = page.getViewport({ scale: 1.0 });
        
        // УВЕЛИЧИВАЕМ МАСШТАБ ДЛЯ ВЫСОКОГО КАЧЕСТВА
        // Вместо ограничения 3.0 используем более высокий множитель
        const qualityMultiplier = 4; // Можно увеличить до 4-5 для лучшего качества
        
        // Расчет масштаба с учетом DPI устройства
        const devicePixelRatio = window.devicePixelRatio || 1;
        const targetScale = Math.min(
            qualityMultiplier * devicePixelRatio, // Учитываем DPI устройства
            (containerWidth * qualityMultiplier) / baseViewport.width,
            (containerHeight * qualityMultiplier) / baseViewport.height
        );
        
        // Создание viewport с увеличенным масштабом
        const scaledViewport = page.getViewport({ 
            scale: targetScale,
            rotation: this.currentRotation
        });
        
        console.log('Rendering with high quality:', {
            baseWidth: baseViewport.width,
            baseHeight: baseViewport.height,
            targetScale: targetScale,
            scaledWidth: scaledViewport.width,
            scaledHeight: scaledViewport.height,
            devicePixelRatio: devicePixelRatio
        });
        
        // Создание canvas с высоким DPI
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', {
            alpha: false,
            desynchronized: false, // Для качества лучше false
            willReadFrequently: false
        });
        
        // Устанавливаем размеры canvas
        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;
        
        // Для отображения уменьшаем размеры (сохраняя высокое DPI внутри)
        const displayScale = 1 / devicePixelRatio;
        canvas.style.width = `${scaledViewport.width * displayScale}px`;
        canvas.style.height = `${scaledViewport.height * displayScale}px`;
        canvas.style.maxWidth = '100%';
        canvas.style.maxHeight = '100%';
        
        // Устанавливаем высокое качество рендеринга
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        
        // Создаем контейнер для canvas и выделения
        const canvasContainer = document.createElement('div');
        canvasContainer.className = 'canvas-container';
        canvasContainer.style.cssText = `
            position: relative;
            display: inline-block;
            margin: 0 auto;
            max-width: 100%;
            max-height: 100%;
        `;
        
        // Добавляем canvas в контейнер
        canvasContainer.appendChild(canvas);
        
        // Очищаем pdfPreview и добавляем контейнер
        this.pdfPreview.innerHTML = '';
        this.pdfPreview.appendChild(canvasContainer);
        
        // Сохраняем ссылку
        this.canvasContainer = canvasContainer;
        
        // Рендер страницы с высоким качеством
        const renderContext = {
            canvasContext: context,
            viewport: scaledViewport,
            intent: 'print', // Используем print intent для лучшего качества
            enableWebGL: false,
            renderInteractiveForms: false
        };
        
        await page.render(renderContext).promise;
        
        console.log('Page rendered with high quality:', {
            canvasWidth: canvas.width,
            canvasHeight: canvas.height,
            displayWidth: canvas.style.width,
            displayHeight: canvas.style.height
        });
        
        // Инициализируем обработчик выделения ПОСЛЕ рендера
        this.initSelectionHandler();
        
        // Если режим выделения активен, активируем его
        if (this.isSelectionMode) {
            setTimeout(() => {
                this.activateSelectionMode();
            }, 150);
        }
        
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

async renderPageWithMaxQuality(scale = 4.0) {
    if (!this.currentPdf || this.currentPageNum < 1 || this.currentPageNum > this.totalPages) {
        throw new Error('PDF не загружен');
    }
    
    const page = await this.currentPdf.getPage(this.currentPageNum);
    
    // Получаем оригинальный размер страницы в точках (points)
    const viewport = page.getViewport({ 
        scale: scale,
        rotation: this.currentRotation
    });
    
    // Создаем canvas с высоким разрешением
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', {
        alpha: false,
        desynchronized: false
    });
    
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    // Устанавливаем максимальное качество
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    
    // Рендерим с настройками для печати
    await page.render({
        canvasContext: context,
        viewport: viewport,
        intent: 'print',
        enableWebGL: false
    }).promise;
    
    console.log('Rendered with max quality:', {
        scale: scale,
        width: canvas.width,
        height: canvas.height,
        dpi: (canvas.width / (viewport.width / 72)).toFixed(1) + ' DPI' // Примерный расчет DPI
    });
    
    return canvas;
}


    initSelectionHandler() {
    console.log('initSelectionHandler called');
    
    try {
        // Проверяем, что canvasContainer существует
        if (!this.canvasContainer) {
            console.warn('canvasContainer не найден');
            return;
        }
        
        console.log('Creating SelectionHandler with canvasContainer:', this.canvasContainer);
        
        // Создаем новый обработчик с правильным параметром
        this.selectionHandler = new SelectionHandler(this.canvasContainer);
        
        console.log('SelectionHandler created successfully');
        
        // Если режим выделения активен, показываем его
        if (this.isSelectionMode) {
            setTimeout(() => {
                if (this.selectionHandler && this.selectionHandler.show) {
                    this.selectionHandler.show();
                    console.log('SelectionHandler shown');
                }
            }, 100);
        }
        
    } catch (error) {
        console.error('Error initializing selection handler:', error);
        showToast('Ошибка инициализации выделения', 'error', 'Ошибка');
    }
}

    forceShowSelectionButtons() {
        const convertBtn = document.getElementById('convertSelection');
        const resetBtn = document.getElementById('resetSelection');
        
        if (convertBtn) {
            convertBtn.style.display = 'block';
            convertBtn.disabled = false;
        }
        
        if (resetBtn) {
            resetBtn.style.display = 'inline-block';
        }
    }

 async convertSelection(outputFormat) {
    console.log('convertSelection called with format:', outputFormat);
    
    if (!this.selectionHandler || !this.selectionHandler.hasValidSelection()) {
        showToast('Выделите область для отправки', 'warning', 'Предупреждение');
        return null;
    }
    
    try {
        // Сначала рендерим всю страницу с высоким качеством
        const highQualityCanvas = await this.renderPageWithMaxQuality(4.0);
        
        // Обновляем selectionHandler для работы с highQualityCanvas
        this.selectionHandler.canvas = highQualityCanvas;
        this.selectionHandler.ctx = highQualityCanvas.getContext('2d');
        
        // Пересчитываем scale для нового canvas
        const canvasRect = this.selectionHandler.selectionContainer.querySelector('canvas').getBoundingClientRect();
        if (canvasRect.width > 0) {
            this.selectionHandler.selection.scale = highQualityCanvas.width / canvasRect.width;
        }
        
        // Получаем выделение с высоким качеством
        const selectionCanvas = this.selectionHandler.getSelectionCanvas();
        
        if (!selectionCanvas) {
            throw new Error('Не удалось получить выделенную область');
        }
        
        console.log('High quality selection canvas:', {
            width: selectionCanvas.width,
            height: selectionCanvas.height
        });
        
        // Конвертируем в ч/б
        console.log('Converting to black and white with high quality...');
        const bwCanvas = await convertCanvasToBlackAndWhite(selectionCanvas);
        
        console.log('High quality black and white canvas created:', {
            width: bwCanvas.width,
            height: bwCanvas.height
        });
        
        return bwCanvas;
    } catch (error) {
        console.error('Ошибка конвертации выделенной области:', error);
        showToast('Ошибка конвертации: ' + error.message, 'error', 'Ошибка');
        throw error;
    }
}
    
    // Метод для переключения режима выделения
    // Метод для переключения режима выделения
toggleSelectionMode() {
    console.log('toggleSelectionMode called');
    
    const toggleBtn = document.getElementById('toggleSelection');
    const resetBtn = document.getElementById('resetSelection');
    const convertSelectionBtn = document.getElementById('convertSelection');
    
    if (!this.isSelectionMode) {
        // АКТИВИРУЕМ режим выделения
        this.activateSelectionMode();
        
        // Меняем курсор
        document.body.style.cursor = 'crosshair';
        
        // Обновляем UI
        toggleBtn.innerHTML = '<i class="select-icon">✕</i> Отменить выделение';
        toggleBtn.classList.add('active');
        if (resetBtn) resetBtn.style.display = 'inline-block';
        
        // Прячем кнопку отправки выделения пока нет выделения
        if (convertSelectionBtn) {
            convertSelectionBtn.style.display = 'none';
        }
        
        this.isSelectionMode = true;
        showToast('Режим выделения активен. Выделите нужную область', 'info', 'Информация');
    } else {
        // ДЕАКТИВИРУЕМ режим выделения
        this.deactivateSelectionMode();
        
        // Возвращаем курсор
        document.body.style.cursor = '';
        
        // Обновляем UI
        toggleBtn.innerHTML = '<i class="select-icon">▦</i> Выделить область';
        toggleBtn.classList.remove('active');
        if (resetBtn) resetBtn.style.display = 'none';
        if (convertSelectionBtn) convertSelectionBtn.style.display = 'none';
        
        this.isSelectionMode = false;
    }
}

// Новый метод для активации режима выделения
    activateSelectionMode() {
        console.log('activateSelectionMode called');
        
        if (this.selectionHandler) {
            console.log('Showing existing selectionHandler');
            this.selectionHandler.show();
        } else {
            console.log('No selectionHandler, initializing...');
            this.initSelectionHandler();
            
            // Даем больше времени на инициализацию
            setTimeout(() => {
                if (this.selectionHandler && this.selectionHandler.show) {
                    console.log('Showing selectionHandler after timeout');
                    this.selectionHandler.show();
                } else {
                    console.error('Failed to initialize selectionHandler');
                }
            }, 200);
        }
        
        // Добавляем класс для визуального выделения
        if (this.canvasContainer) {
            this.canvasContainer.classList.add('selection-mode-active');
            console.log('Added selection-mode-active class');
        }
    }

    deactivateSelectionAndReset() {
    console.log('=== FULL DEACTIVATE SELECTION ===');
    
    // 1. Деактивируем режим выделения
    this.deactivateSelectionMode();
    
    // 2. Сбрасываем состояние
    this.isSelectionMode = false;
    
    // 3. Восстанавливаем курсор на всех уровнях
    document.body.style.cursor = '';
    if (this.canvasContainer) {
        this.canvasContainer.style.cursor = '';
    }
    
    // 4. Сбрасываем UI кнопок
    const toggleBtn = document.getElementById('toggleSelection');
    const resetBtn = document.getElementById('resetSelection');
    const convertSelectionBtn = document.getElementById('convertSelection');
    
    if (toggleBtn) {
        toggleBtn.innerHTML = '<i class="select-icon">▦</i> Выделить область';
        toggleBtn.classList.remove('active');
        toggleBtn.style.cursor = 'pointer';
    }
    
    if (resetBtn) {
        resetBtn.style.display = 'none';
    }
    
    if (convertSelectionBtn) {
        convertSelectionBtn.style.display = 'none';
    }
    
    // 5. Освобождаем ресурсы выделения
    if (this.selectionHandler) {
        // Полностью сбрасываем выделение
        this.selectionHandler.clearSelection();
        
        // Скрываем overlay
        if (this.selectionHandler.overlay) {
            this.selectionHandler.overlay.style.display = 'none';
        }
        
        // Удаляем все обработчики
        this.selectionHandler.unbindEventListeners();
    }
    
    // 6. Убираем классы визуального выделения
    if (this.canvasContainer) {
        this.canvasContainer.classList.remove('selection-mode-active');
    }
    
    // 7. Удаляем все созданные элементы выделения
    const selectionElements = this.canvasContainer?.querySelectorAll('.selection-overlay, .selection-rect, .selection-handles, .selection-dimensions');
    if (selectionElements) {
        selectionElements.forEach(el => {
            if (el.parentNode) {
                el.parentNode.removeChild(el);
            }
        });
    }
    
    console.log('Selection mode fully deactivated');
}

// Новый метод для деактивации режима выделения
deactivateSelectionMode() {
    if (this.selectionHandler && this.selectionHandler.hide) {
        this.selectionHandler.hide();
    }
    
    // Убираем класс визуального выделения
    if (this.canvasContainer) {
        this.canvasContainer.classList.remove('selection-mode-active');
    }
    
    // Сбрасываем выделение
    this.resetSelection();
    }
    
    // Метод для сброса выделения
    resetSelection() {
    if (this.selectionHandler && this.selectionHandler.clearSelection) {
        this.selectionHandler.clearSelection();
    }
    
    const toggleBtn = document.getElementById('toggleSelection');
    const resetBtn = document.getElementById('resetSelection');
    const convertSelectionBtn = document.getElementById('convertSelection');
    
    // Сбрасываем только выделение, но оставляем режим выделения активным
    if (this.isSelectionMode) {
        toggleBtn.innerHTML = '<i class="select-icon">✕</i> Отменить выделение';
        toggleBtn.classList.add('active');
        if (resetBtn) resetBtn.style.display = 'inline-block';
        if (convertSelectionBtn) convertSelectionBtn.style.display = 'none';
    } else {
        // Возвращаем кнопку в нормальное состояние
        toggleBtn.innerHTML = '<i class="select-icon">▦</i> Выделить область';
        toggleBtn.classList.remove('active');
        if (resetBtn) resetBtn.style.display = 'none';
        if (convertSelectionBtn) convertSelectionBtn.style.display = 'none';
        }
    }
    
    // Метод для проверки валидности выделения
    hasValidSelection() {
        return this.selectionHandler && 
               this.selectionHandler.isActive && 
               this.selectionHandler.hasValidSelection();
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
        // Используем рендеринг с максимальным качеством
        const canvas = await this.renderPageWithMaxQuality(4.0);
        
        // Конвертируем в ч/б
        const bwCanvas = await convertCanvasToBlackAndWhite(canvas);
        
        console.log('Converted page with high quality:', {
            original: { width: canvas.width, height: canvas.height },
            converted: { width: bwCanvas.width, height: bwCanvas.height }
        });
        
        return bwCanvas;
    } catch (error) {
        console.error('Ошибка конвертации PDF:', error);
        showToast('Ошибка конвертации PDF: ' + error.message, 'error', 'Ошибка');
        throw error;
    }
}

debugSelection() {
    console.log('=== SELECTION DEBUG ===');
    console.log('isSelectionMode:', this.isSelectionMode);
    console.log('selectionHandler exists:', !!this.selectionHandler);
    if (this.selectionHandler) {
        console.log('selectionHandler.isActive:', this.selectionHandler.isActive);
        console.log('selectionHandler.overlay:', this.selectionHandler.overlay);
        console.log('selectionHandler.selectionRect:', this.selectionHandler.selectionRect);
        console.log('selectionRect display:', 
            this.selectionHandler.selectionRect?.style?.display);
        console.log('selectionRect computed display:', 
            window.getComputedStyle(this.selectionHandler.selectionRect).display);
    }
    console.log('pdfPreview:', this.pdfPreview);
}

}