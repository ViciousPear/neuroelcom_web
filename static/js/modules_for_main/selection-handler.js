import { cropCanvasWithQuality } from './processing-image.js';

export class SelectionHandler {
    constructor(selectionContainer) {
        this.selectionContainer = selectionContainer; // Контейнер с canvas
        this.pdfPreview = selectionContainer.parentElement; // Родительский контейнер
        
        // Находим canvas внутри контейнера
        this.canvas = selectionContainer.querySelector('canvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

        this.overlay = null;
        this.selectionRect = null;
        this.handles = null;
        this.dimensionsLabel = null;
        
        this.isSelecting = false;
        this.isResizing = false;
        this.isDragging = false;
        this.isActive = false;
        
        this.startX = 0;
        this.startY = 0;
        this.currentX = 0;
        this.currentY = 0;
        
        this.selection = {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            scale: 1
        };
        
        this.init();
    }
    
    init() {
    this.createOverlay();
    this.setupEventListeners();
    this.updateCanvasContext();
    
    // Отладка
    // setTimeout(() => {
    //     this.debugHandles();
    // }, 100);
}


    createOverlay() {
        // Удаляем существующий overlay если есть
        const existingOverlays = document.querySelectorAll('.selection-overlay');
        existingOverlays.forEach(overlay => overlay.remove());
        
        // Также удаляем старые элементы выделения
        const oldElements = this.selectionContainer.querySelectorAll('.selection-rect, .selection-handles, .selection-dimensions');
        oldElements.forEach(el => el.remove());
        
        // Создаем новый overlay ВНУТРИ selectionContainer
        this.overlay = document.createElement('div');
        this.overlay.className = 'selection-overlay';
        this.overlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: none;
            pointer-events: auto;
            cursor: crosshair;
            z-index: 1000;
        `;
        
        // Создаем прямоугольник выделения
        this.selectionRect = document.createElement('div');
        this.selectionRect.className = 'selection-rect';
        this.selectionRect.style.cssText = `
            position: absolute;
            display: none;
            pointer-events: auto;
            cursor: move;
            border: 3px solid #2A7179;
            background-color: rgba(255, 255, 255, 0.3);
            box-sizing: border-box;
            z-index: 1001;
        `;
        
        // Метка размеров
        this.dimensionsLabel = document.createElement('div');
        this.dimensionsLabel.className = 'selection-dimensions';
        this.dimensionsLabel.style.cssText = `
            position: absolute;
            display: none;
            pointer-events: none;
            z-index: 1002;
            background: #2A7179;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            white-space: nowrap;
        `;
        
        // Ручки - СОЗДАЕМ КОНТЕЙНЕР ДЛЯ РУЧЕК ВНУТРИ selectionRect
        this.handles = document.createElement('div');
        this.handles.className = 'selection-handles';
        this.handles.style.cssText = `
            position: absolute;
            display: none;
            pointer-events: none;
            width: 100%;
            height: 100%;
            top: 0;
            left: 0;
            z-index: 1003;
        `;
        
        // СОЗДАЕМ ТОЛЬКО УГЛОВЫЕ РУЧКИ
        const handleConfigs = [
            // Угловые ручки
            { class: 'handle-nw', cursor: 'nw-resize', top: '-8px', left: '-8px' },
            { class: 'handle-ne', cursor: 'ne-resize', top: '-8px', right: '-8px' },
            { class: 'handle-sw', cursor: 'sw-resize', bottom: '-8px', left: '-8px' },
            { class: 'handle-se', cursor: 'se-resize', bottom: '-8px', right: '-8px' }
        ];
        
        handleConfigs.forEach(config => {
            const handle = document.createElement('div');
            handle.className = `handle ${config.class}`;
            handle.style.cssText = `
                position: absolute;
                width: 16px;
                height: 16px;
                background: white;
                border: 2px solid #2A7179;
                border-radius: 50%;
                cursor: ${config.cursor};
                ${config.top ? `top: ${config.top};` : ''}
                ${config.bottom ? `bottom: ${config.bottom};` : ''}
                ${config.left ? `left: ${config.left};` : ''}
                ${config.right ? `right: ${config.right};` : ''}
                pointer-events: auto;
                z-index: 1004;
                transition: transform 0.1s, background-color 0.1s;
            `;
            
            // Эффекты при наведении
            handle.addEventListener('mouseenter', () => {
                handle.style.transform = 'scale(1.3)';
                handle.style.backgroundColor = '#2A7179';
            });
            
            handle.addEventListener('mouseleave', () => {
                handle.style.transform = '';
                handle.style.backgroundColor = 'white';
            });
            
            this.handles.appendChild(handle);
        });
        
        // ВАЖНО: добавляем handles и dimensionsLabel ВНУТРЬ selectionRect
        this.selectionRect.appendChild(this.handles);
        this.selectionRect.appendChild(this.dimensionsLabel);
        
        // Добавляем элементы в overlay
        this.overlay.appendChild(this.selectionRect);
        this.selectionContainer.appendChild(this.overlay);
    }
    
    setupEventListeners() {
    // Начало выделения на самом overlay
    this.overlay.addEventListener('mousedown', (e) => {
        // Проверяем, что кликнули именно на overlay, а не на другие элементы
        if (e.target === this.overlay) {
            this.startSelection(e);
        }
    });
    
    // Изменение размера через ручки
    this.handles.addEventListener('mousedown', (e) => {
        const handle = e.target.closest('.handle');
        if (handle) {
            e.stopPropagation();
            e.preventDefault();
            
            // Извлекаем только имя класса ручки (handle-se, handle-nw и т.д.)
            const classNames = handle.className.split(' ');
            const handleName = classNames.find(name => name.startsWith('handle-'));
            
            console.log('Handle clicked:', {
                fullClassName: handle.className,
                extractedHandleName: handleName
            });
            
            if (handleName) {
                this.startResize(e, handleName);
            }
        }
    }, true);
    
    // Перемещение выделенной области
    this.selectionRect.addEventListener('mousedown', (e) => {
        // Проверяем, что кликнули не на handle
        if (!e.target.closest('.handle')) {
            e.stopPropagation();
            e.preventDefault();
            this.startDrag(e);
        }
    }, true);
    
    // Глобальные события мыши
    document.addEventListener('mousemove', this.handleMouseMove.bind(this));
    document.addEventListener('mouseup', this.handleMouseUp.bind(this));
}
    
   startSelection(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const rect = this.selectionContainer.getBoundingClientRect();
        
        // Координаты относительно selectionContainer
        this.startX = e.clientX - rect.left;
        this.startY = e.clientY - rect.top;
        
        this.selection.x = this.startX;
        this.selection.y = this.startY;
        this.selection.width = 0;
        this.selection.height = 0;
        
        this.isSelecting = true;
        
        console.log('Start selection:', {
            startX: this.startX,
            startY: this.startY,
            selection: { ...this.selection }
        });
        
        // Показываем прямоугольник
        if (this.selectionRect) {
            this.selectionRect.style.display = 'block';
            this.selectionRect.classList.add('creating');
        }
        
        // Обновляем UI кнопок при начале выделения
        const toggleBtn = document.getElementById('toggleSelection');
        const convertBtn = document.getElementById('convertSelection');
        if (toggleBtn) {
            toggleBtn.innerHTML = '<i class="select-icon">✕</i> Отменить выделение';
            toggleBtn.classList.add('active');
        }
        if (convertBtn) {
            convertBtn.style.display = 'none';
        }
        
        this.updateSelectionRect();
    }

    updateCanvasContext() {
    // Убедимся, что selectionContainer существует
    if (!this.selectionContainer) {
        console.warn('selectionContainer не найден');
        return;
    }
    
    // Находим canvas внутри selectionContainer
    this.canvas = this.selectionContainer.querySelector('canvas');
    
    if (this.canvas) {
        console.log('Canvas найден:', {
            width: this.canvas.width,
            height: this.canvas.height,
            clientWidth: this.canvas.clientWidth,
            clientHeight: this.canvas.clientHeight
        });
        
        this.ctx = this.canvas.getContext('2d');
        
        // Рассчитываем scale для преобразования координат
        const canvasRect = this.canvas.getBoundingClientRect();
        
        if (canvasRect.width > 0 && canvasRect.height > 0) {
            this.selection.scale = this.canvas.width / canvasRect.width;
            console.log('Масштаб вычислен:', this.selection.scale);
        } else {
            console.warn('Canvas имеет нулевые размеры');
            this.selection.scale = 1;
        }
    } else {
        console.warn('Canvas не найден в selectionContainer');
        this.canvas = null;
        this.ctx = null;
    }
}
    
    startResize(e, handleClass) {
        e.preventDefault();
        e.stopPropagation();
        
        console.log('Start resize called for handle:', handleClass);
        
        this.isResizing = true;
        this.resizeHandle = handleClass;
        
        // Получаем координаты относительно selectionContainer
        const rect = this.selectionContainer.getBoundingClientRect();
        const scrollLeft = this.selectionContainer.scrollLeft || 0;
        const scrollTop = this.selectionContainer.scrollTop || 0;
        
        this.startX = e.clientX - rect.left + scrollLeft;
        this.startY = e.clientY - rect.top + scrollTop;
        
        // Сохраняем исходные размеры
        this.originalSelection = { 
            x: this.selection.x,
            y: this.selection.y,
            width: this.selection.width,
            height: this.selection.height
        };
        
        console.log('Start resize details:', {
            handle: handleClass,
            startX: this.startX,
            startY: this.startY,
            original: this.originalSelection,
            containerRect: rect
        });
        
        // Останавливаем дальнейшую обработку событий
        return false;
    }
    
    startDrag(e) {
        e.preventDefault();
        e.stopPropagation();
        
        this.isDragging = true;
        
        const rect = this.pdfPreview.getBoundingClientRect();
        this.dragStartX = e.clientX - rect.left;
        this.dragStartY = e.clientY - rect.top;
        
        // Сохраняем исходную позицию
        this.dragOriginalX = this.selection.x;
        this.dragOriginalY = this.selection.y;
    }
    
    handleMouseMove(e) {
        if (!this.isSelecting && !this.isResizing && !this.isDragging) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        // Получаем координаты относительно selectionContainer
        const rect = this.selectionContainer.getBoundingClientRect();
        const scrollLeft = this.selectionContainer.scrollLeft || 0;
        const scrollTop = this.selectionContainer.scrollTop || 0;
        
        this.currentX = Math.max(0, Math.min(e.clientX - rect.left + scrollLeft, rect.width));
        this.currentY = Math.max(0, Math.min(e.clientY - rect.top + scrollTop, rect.height));
        
        console.log('Mouse move:', {
            x: this.currentX,
            y: this.currentY,
            rect: rect,
            isSelecting: this.isSelecting,
            isResizing: this.isResizing,
            isDragging: this.isDragging
        });
        
        if (this.isSelecting) {
            this.updateSelectionSize();
        } else if (this.isResizing) {
            this.updateResize();
        } else if (this.isDragging) {
            this.updateDrag();
        }
        
        this.updateSelectionRect();

        // if (this.isResizing || this.isDragging) {
        // this.logSelectionState();

    }

    handleMouseUp(e) {
        console.log('Mouse up event:', {
            isSelecting: this.isSelecting,
            isResizing: this.isResizing,
            isDragging: this.isDragging,
            selection: { ...this.selection }
        });
        
        if (this.isSelecting || this.isResizing || this.isDragging) {
            // Сохраняем текущее состояние перед сбросом флагов
            const wasResizing = this.isResizing;
            const wasDragging = this.isDragging;
            
            this.isSelecting = false;
            this.isResizing = false;
            this.isDragging = false;
            
            // Убираем анимацию создания
            if (this.selectionRect) {
                this.selectionRect.classList.remove('creating');
            }
            
            // Если было изменение размера или перемещение, обновляем
            if (wasResizing || wasDragging) {
                console.log('Was resizing or dragging, updating...');
                this.updateSelectionRect();
            }
            
            // Валидация выделения
            const isValid = this.validateSelection();
            
            if (isValid) {
                console.log('Selection is valid, showing handles');
                
                // Показываем ручки и метку размеров
                if (this.handles) {
                    this.handles.style.display = 'block';
                    this.handles.style.pointerEvents = 'auto';
                }
                
                if (this.dimensionsLabel) {
                    this.dimensionsLabel.style.display = 'block';
                    this.updateDimensionsLabel();
                }
                
                // Автоматическое появление кнопки "Отправить выделенное"
                const convertBtn = document.getElementById('convertSelection');
                if (convertBtn) {
                    convertBtn.style.display = 'block';
                    convertBtn.disabled = false;
                    
                    // Плавное появление
                    setTimeout(() => {
                        convertBtn.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                        convertBtn.style.opacity = '1';
                        convertBtn.style.transform = 'translateY(0)';
                    }, 10);
                }
                
                // Также показываем кнопку "Сбросить выделение"
                const resetBtn = document.getElementById('resetSelection');
                if (resetBtn) {
                    resetBtn.style.display = 'inline-block';
                }
                
            } else {
                console.log('Selection is not valid, clearing');
                this.clearSelection();
            }
            
            // Сбрасываем handle
            this.resizeHandle = null;
            this.originalSelection = null;
        }
    }
        
    updateSelectionSize() {
        this.selection.width = this.currentX - this.startX;
        this.selection.height = this.currentY - this.startY;
        
        // Ограничиваем выделение границами контейнера
        const maxX = this.selectionContainer.clientWidth;
        const maxY = this.selectionContainer.clientHeight;
        
        if (this.selection.width < 0) {
            this.selection.x = this.currentX;
            this.selection.width = Math.abs(this.selection.width);
        } else {
            this.selection.x = this.startX;
        }
        
        if (this.selection.height < 0) {
            this.selection.y = this.currentY;
            this.selection.height = Math.abs(this.selection.height);
        } else {
            this.selection.y = this.startY;
        }
        
        // Ограничиваем границы
        this.selection.x = Math.max(0, Math.min(this.selection.x, maxX - 10));
        this.selection.y = Math.max(0, Math.min(this.selection.y, maxY - 10));
        this.selection.width = Math.min(this.selection.width, maxX - this.selection.x);
        this.selection.height = Math.min(this.selection.height, maxY - this.selection.y);
    }
    
    updateResize() {
        const dx = this.currentX - this.startX;
        const dy = this.currentY - this.startY;
        
        console.log('Updating resize:', {
            handle: this.resizeHandle,
            dx: dx,
            dy: dy,
            original: this.originalSelection,
            currentMouse: { x: this.currentX, y: this.currentY }
        });
        
        // Сохраняем исходные размеры для расчетов
        const original = {
            x: this.originalSelection.x,
            y: this.originalSelection.y,
            width: this.originalSelection.width,
            height: this.originalSelection.height
        };
        
        // ВРЕМЕННЫЕ ПЕРЕМЕННЫЕ для расчетов
        let newX = original.x;
        let newY = original.y;
        let newWidth = original.width;
        let newHeight = original.height;
        
        // Применяем изменения в зависимости от типа ручки
        switch (this.resizeHandle) {
            // ЛЕВЫЙ ВЕРХНИЙ угол
            case 'handle-nw':
                newX = original.x + dx;
                newY = original.y + dy;
                newWidth = original.width - dx;
                newHeight = original.height - dy;
                break;
                
            // ПРАВЫЙ ВЕРХНИЙ угол
            case 'handle-ne':
                newY = original.y + dy;
                newWidth = original.width + dx;
                newHeight = original.height - dy;
                break;
                
            // ЛЕВЫЙ НИЖНИЙ угол
            case 'handle-sw':
                newX = original.x + dx;
                newWidth = original.width - dx;
                newHeight = original.height + dy;
                break;
                
            // ПРАВЫЙ НИЖНИЙ угол
            case 'handle-se':
                newWidth = original.width + dx;
                newHeight = original.height + dy;
                break;
                
            default:
                console.warn('Unknown resize handle:', this.resizeHandle);
                return;
        }
        
        // Проверяем, чтобы ширина и высота были положительными
        if (newWidth < 0) {
            if (this.resizeHandle.includes('w')) {
                newX += newWidth; // Сдвигаем x на отрицательную ширину
            }
            newWidth = Math.abs(newWidth);
        }
        
        if (newHeight < 0) {
            if (this.resizeHandle.includes('n')) {
                newY += newHeight; // Сдвигаем y на отрицательную высоту
            }
            newHeight = Math.abs(newHeight);
        }
        
        // Ограничиваем минимальный размер
        const minSize = 20;
        newWidth = Math.max(minSize, newWidth);
        newHeight = Math.max(minSize, newHeight);
        
        // Ограничиваем границы контейнера
        const containerWidth = this.selectionContainer.clientWidth;
        const containerHeight = this.selectionContainer.clientHeight;
        
        // Не выходим за границы
        newX = Math.max(0, Math.min(newX, containerWidth - minSize));
        newY = Math.max(0, Math.min(newY, containerHeight - minSize));
        newWidth = Math.min(newWidth, containerWidth - newX);
        newHeight = Math.min(newHeight, containerHeight - newY);
        
        // ПРИМЕНЯЕМ ИЗМЕНЕНИЯ К ОСНОВНОМУ selection
        this.selection.x = newX;
        this.selection.y = newY;
        this.selection.width = newWidth;
        this.selection.height = newHeight;
        
        console.log('Resize applied:', {
            x: this.selection.x,
            y: this.selection.y,
            width: this.selection.width,
            height: this.selection.height
        });
        
        // Обновляем визуальное отображение
        this.updateSelectionRect();
    }
    
    updateDrag() {
        const dx = this.currentX - this.dragStartX;
        const dy = this.currentY - this.dragStartY;
        
        this.selection.x = this.dragOriginalX + dx;
        this.selection.y = this.dragOriginalY + dy;
        
        // Ограничиваем перемещение границами контейнера
        const maxX = this.pdfPreview.clientWidth - this.selection.width;
        const maxY = this.pdfPreview.clientHeight - this.selection.height;
        
        this.selection.x = Math.max(0, Math.min(this.selection.x, maxX));
        this.selection.y = Math.max(0, Math.min(this.selection.y, maxY));
    }
    
    updateSelectionRect() {
        if (!this.selectionRect) {
            console.warn('selectionRect is null');
            return;
        }
        
        // Обновляем позицию и размер прямоугольника
        this.selectionRect.style.left = `${this.selection.x}px`;
        this.selectionRect.style.top = `${this.selection.y}px`;
        this.selectionRect.style.width = `${this.selection.width}px`;
        this.selectionRect.style.height = `${this.selection.height}px`;
        
        console.log('Updating selection rect:', {
            x: this.selection.x,
            y: this.selection.y,
            width: this.selection.width,
            height: this.selection.height,
            styleLeft: this.selectionRect.style.left,
            styleTop: this.selectionRect.style.top
        });
        
        // Показываем прямоугольник, если есть размер
        if (this.selection.width > 0 && this.selection.height > 0) {
            this.selectionRect.style.display = 'block';
            
            // Затемнение ВНЕ выделенной области
            this.overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
            this.selectionRect.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
            this.selectionRect.style.boxShadow = 'inset 0 0 0 1px #2A7179';
            
            // Обновляем метку размеров
            this.updateDimensionsLabel();
            
            // ПОКАЗЫВАЕМ РУЧКИ ТОЛЬКО ЕСЛИ ВЫДЕЛЕНИЕ ЗАВЕРШЕНО И НЕ В ПРОЦЕССЕ
            if (!this.isSelecting && !this.isResizing && this.handles) {
                this.handles.style.display = 'block';
                this.handles.style.pointerEvents = 'auto';
            }
        } else {
            this.selectionRect.style.display = 'none';
            if (this.handles) {
                this.handles.style.display = 'none';
            }
        }
        
        // Принудительное обновление layout
        this.selectionRect.offsetHeight;
    }


    updateDimensionsLabel() {
        if (!this.dimensionsLabel) return;
        
        // Рассчитываем размеры в пикселях
        const widthPx = Math.round(this.selection.width);
        const heightPx = Math.round(this.selection.height);
        
        // Если есть canvas, можем рассчитать примерные размеры в мм
        let dimensionsText = `${widthPx} × ${heightPx} px`;
        
        if (this.canvas && this.selection.scale) {
            // Примерный перевод пикселей в миллиметры (96 dpi = 3.78 px/mm)
            const widthMm = Math.round((widthPx / this.selection.scale) / 3.78);
            const heightMm = Math.round((heightPx / this.selection.scale) / 3.78);
            dimensionsText += ` ≈ ${widthMm} × ${heightMm} мм`;
        }
        
        this.dimensionsLabel.textContent = dimensionsText;
        
        // Позиционируем метку
        this.dimensionsLabel.style.left = '50%';
        this.dimensionsLabel.style.transform = 'translateX(-50%)';
        this.dimensionsLabel.style.bottom = '-30px';
        
        // Если метка выходит за нижнюю границу, показываем её сверху
        const rectBottom = this.selection.y + this.selection.height;
        const containerHeight = this.pdfPreview.clientHeight;
        
        if (rectBottom + 40 > containerHeight) {
            this.dimensionsLabel.style.bottom = 'auto';
            this.dimensionsLabel.style.top = '-30px';
        }
    }
    
    validateSelection() {
        // Минимальный размер выделения
        if (this.selection.width < 10 || this.selection.height < 10) {
            this.clearSelection();
            return false;
        }
        return true;
    }
    
    show() {
        if (this.overlay) {
            this.overlay.style.display = 'block';
            this.overlay.style.cursor = 'crosshair';
            this.overlay.style.pointerEvents = 'auto';
        }
        
        this.isActive = true;
        
        // Добавляем обработчики
        this.bindEventListeners();
        
        // Обновляем контекст canvas
        this.updateCanvasContext();
    }

    hide() {
        if (this.overlay) {
            this.overlay.style.display = 'none';
        }
        
        if (this.selectionRect) {
            this.selectionRect.style.display = 'none';
            this.selectionRect.classList.remove('creating');
        }
        
        if (this.handles) {
            this.handles.style.display = 'none';
        }
        
        if (this.dimensionsLabel) {
            this.dimensionsLabel.style.display = 'none';
        }
        
        this.isActive = false;
        
        // Убираем обработчики
        this.unbindEventListeners();
        
        // Сбрасываем выделение
        this.selection = {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            scale: this.selection.scale || 1
        };
        
        // Скрываем кнопку отправки выделения
        const convertBtn = document.getElementById('convertSelection');
        if (convertBtn) {
            convertBtn.style.display = 'none';
        }
    }
    
    

      // Новый метод для привязки обработчиков событий
    bindEventListeners() {
        // Обработчики для начала действий
        this.pdfPreview.addEventListener('mousedown', this.handleMouseDown.bind(this));
        
        // Обработчики для ручек
        this.handles.querySelectorAll('.handle').forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                this.startResize(e, handle.className);
            });
        });
        
        // Обработчик для перемещения выделения
        this.selectionRect.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            this.startDrag(e);
        });
        
        // Глобальные события
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
    }
    
    // Новый метод для отвязки обработчиков событий
    unbindEventListeners() {
        this.pdfPreview.removeEventListener('mousedown', this.handleMouseDown);
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);
    }
    
    // Новый метод для обработки нажатия мыши
    handleMouseDown(e) {
        // Проверяем, не нажали ли мы на ручку или сам прямоугольник
        if (e.target.closest('.handle') || e.target.closest('.selection-rect')) {
            return;
        }
        
        // Начинаем новое выделение
        this.startSelection(e);
    }
    
    clearSelection() {
        console.log('Clearing selection');
        
        // Безопасная проверка и скрытие элементов
        if (this.selectionRect) {
            this.selectionRect.style.display = 'none';
            this.selectionRect.classList.remove('creating');
        }
        
        if (this.handles) {
            this.handles.style.display = 'none';
        }
        
        if (this.dimensionsLabel) {
            this.dimensionsLabel.style.display = 'none';
        }
        
        // СБРАСЫВАЕМ selection К НУЛЕВЫМ ЗНАЧЕНИЯМ
        this.selection = {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            scale: this.selection.scale || 1
        };
        
        console.log('Selection cleared:', this.selection);
        
        // Скрываем кнопку отправки выделения
        const convertBtn = document.getElementById('convertSelection');
        if (convertBtn) {
            convertBtn.style.display = 'none';
        }
        
        // Сбрасываем overlay
        if (this.overlay) {
            this.overlay.style.backgroundColor = 'transparent';
        }
    }

    getSelectionCanvas() {
    console.log('getSelectionCanvas called');
    
    // Проверяем, есть ли canvas и валидное выделение
    if (!this.canvas) {
        console.warn('Canvas not found');
        return null;
    }
    
    if (!this.ctx) {
        console.warn('Canvas context not available');
        return null;
    }
    
    if (this.selection.width === 0 || this.selection.height === 0) {
        console.warn('Selection has zero dimensions');
        return null;
    }
    
    try {
        // Получаем bounding rect canvas
        const canvasRect = this.canvas.getBoundingClientRect();
        console.log('Canvas rect:', canvasRect);
        
        // Рассчитываем масштаб
        const scaleX = this.canvas.width / canvasRect.width;
        const scaleY = this.canvas.height / canvasRect.height;
        console.log('Scale X:', scaleX, 'Scale Y:', scaleY);
        
        // Преобразуем координаты выделения в координаты canvas
        const sx = this.selection.x * scaleX;
        const sy = this.selection.y * scaleY;
        const sw = this.selection.width * scaleX;
        const sh = this.selection.height * scaleY;
        
        console.log('Selection coordinates:', {
            screen: { x: this.selection.x, y: this.selection.y, w: this.selection.width, h: this.selection.height },
            canvas: { sx, sy, sw, sh }
        });
        
        // Проверяем границы
        if (sx < 0 || sy < 0 || sx + sw > this.canvas.width || sy + sh > this.canvas.height) {
            console.warn('Selection outside canvas bounds:', {
                sx, sy, sw, sh,
                canvasWidth: this.canvas.width,
                canvasHeight: this.canvas.height
            });
            
            // Корректируем координаты, чтобы они не выходили за границы
            const adjustedSx = Math.max(0, Math.min(sx, this.canvas.width - 1));
            const adjustedSy = Math.max(0, Math.min(sy, this.canvas.height - 1));
            const adjustedSw = Math.min(sw, this.canvas.width - adjustedSx);
            const adjustedSh = Math.min(sh, this.canvas.height - adjustedSy);
            
            if (adjustedSw <= 0 || adjustedSh <= 0) {
                console.error('Adjusted selection has zero or negative dimensions');
                return null;
            }
            
            // Используем функцию для сохранения качества
            return cropCanvasWithQuality(this.canvas, adjustedSx, adjustedSy, adjustedSw, adjustedSh);
        }
        
        // Используем функцию для сохранения качества
        return cropCanvasWithQuality(this.canvas, sx, sy, sw, sh);
        
    } catch (error) {
        console.error('Error getting selection canvas:', error);
        return null;
    }
}
// Новый вспомогательный метод для извлечения области canvas
extractCanvasRegion(sx, sy, sw, sh) {
    try {
        // Округляем координаты до целых чисел
        sx = Math.round(sx);
        sy = Math.round(sy);
        sw = Math.round(sw);
        sh = Math.round(sh);
        
        // Проверяем размеры
        if (sw <= 0 || sh <= 0) {
            console.error('Invalid region dimensions:', { sx, sy, sw, sh });
            return null;
        }
        
        console.log('Extracting canvas region with high quality:', { sx, sy, sw, sh });
        
        // Используем функцию для сохранения качества
        return cropCanvasWithQuality(this.canvas, sx, sy, sw, sh);
        
    } catch (error) {
        console.error('Error extracting canvas region:', error);
        return null;
    }
}
    
    hasValidSelection() {
        return this.selection.width > 10 && this.selection.height > 10;
    }

    setupTouchListeners() {
    this.overlay.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    document.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    document.addEventListener('touchend', this.handleTouchEnd.bind(this));
}

    handleTouchStart(e) {
        if (e.touches.length !== 1) return;
        
        e.preventDefault();
        const touch = e.touches[0];
        
        // Преобразуем touch в mouse event
        const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        
        this.startSelection(mouseEvent);
    }

    debugHandles() {
    console.log('=== HANDLES DEBUG ===');
    console.log('Handles element:', this.handles);
    console.log('Handles children:', this.handles ? this.handles.children.length : 'no handles');
    
    if (this.handles) {
        Array.from(this.handles.children).forEach((handle, index) => {
            console.log(`Handle ${index}:`, {
                className: handle.className,
                style: handle.style.cssText,
                hasListeners: handle.hasAttribute('data-has-listener')
            });
        });
    }
}

logSelectionState() {
    console.log('=== SELECTION STATE ===');
    console.log('Selection object:', { ...this.selection });
    console.log('SelectionRect style:', {
        left: this.selectionRect?.style?.left,
        top: this.selectionRect?.style?.top,
        width: this.selectionRect?.style?.width,
        height: this.selectionRect?.style?.height,
        display: this.selectionRect?.style?.display
    });
    console.log('Flags:', {
        isSelecting: this.isSelecting,
        isResizing: this.isResizing,
        isDragging: this.isDragging,
        resizeHandle: this.resizeHandle
    });
}
}