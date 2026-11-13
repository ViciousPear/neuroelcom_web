import { cropCanvasWithQuality } from './processing-image.js';

export class SelectionHandler {
    constructor(selectionContainer) {
        this.selectionContainer = selectionContainer; // Контейнер с canvas
        this.parentContainer = selectionContainer.parentElement; // Родительский контейнер (pdfPreview или imagePreview)
        
        // Поиск canvas внутри контейнера
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
        
        // Сохранение смещение canvas при инициализации
        this.canvasOffset = { x: 0, y: 0 };
        
        this.init();
    }
    
    init() {
        this.createOverlay();
        this.setupEventListeners();
        this.updateCanvasContext();
        this.updateCanvasOffset();
    }

    updateCanvasOffset() {
        if (this.canvas && this.selectionContainer) {
            const canvasRect = this.canvas.getBoundingClientRect();
            const containerRect = this.selectionContainer.getBoundingClientRect();
            
            this.canvasOffset.x = canvasRect.left - containerRect.left;
            this.canvasOffset.y = canvasRect.top - containerRect.top;
        }
    }

    createOverlay() {
        // Удаление существующего overlay если есть
        const existingOverlays = document.querySelectorAll('.selection-overlay');
        existingOverlays.forEach(overlay => overlay.remove());
        
        // Удаление старых элементов выделения
        const oldElements = this.selectionContainer.querySelectorAll('.selection-rect, .selection-handles, .selection-dimensions');
        oldElements.forEach(el => el.remove());
        
        // Создание нового overlay ВНУТРИ selectionContainer
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
        
        // Создание прямоугольника выделения
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
        
        // Ручки
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
        
        // Угловые ручки
        const handleConfigs = [
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
        
        this.selectionRect.appendChild(this.handles);
        this.selectionRect.appendChild(this.dimensionsLabel);
        
        this.overlay.appendChild(this.selectionRect);
        this.selectionContainer.appendChild(this.overlay);
    }
    
    setupEventListeners() {
        this.overlay.addEventListener('mousedown', (e) => {
            if (e.target === this.overlay) {
                this.startSelection(e);
            }
        });
        
        this.handles.addEventListener('mousedown', (e) => {
            const handle = e.target.closest('.handle');
            if (handle) {
                e.stopPropagation();
                e.preventDefault();
                
                const classNames = handle.className.split(' ');
                const handleName = classNames.find(name => name.startsWith('handle-'));
                
                if (handleName) {
                    this.startResize(e, handleName);
                }
            }
        }, true);
        
        this.selectionRect.addEventListener('mousedown', (e) => {
            if (!e.target.closest('.handle')) {
                e.stopPropagation();
                e.preventDefault();
                this.startDrag(e);
            }
        }, true);
        
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
        
        // Обновление смещения при изменении размера окна
        window.addEventListener('resize', () => this.updateCanvasOffset());
    }
    
    startSelection(e) {
        e.preventDefault();
        e.stopPropagation();
        
        this.updateCanvasOffset();
        
        const canvasRect = this.canvas.getBoundingClientRect();
        
        // Координаты мыши относительно canvas
        const mouseX = e.clientX - canvasRect.left;
        const mouseY = e.clientY - canvasRect.top;
        
        // Ограничение координат границами canvas
        this.startX = Math.max(0, Math.min(mouseX, canvasRect.width));
        this.startY = Math.max(0, Math.min(mouseY, canvasRect.height));
        
        this.selection.x = this.startX;
        this.selection.y = this.startY;
        this.selection.width = 0;
        this.selection.height = 0;
        
        this.isSelecting = true;
        
        if (this.selectionRect) {
            this.selectionRect.style.display = 'block';
            this.selectionRect.classList.add('creating');
        }
        
        this.updateButtons('start');
        
        this.updateSelectionRect();
    }

    updateButtons(action) {
        const pdfModal = document.getElementById('pdfModal');
        const imageModal = document.getElementById('imageModal');
        
        if (imageModal && imageModal.style.display === 'block') {
            const toggleBtn = document.getElementById('imageToggleSelection');
            const convertBtn = document.getElementById('sendImageSelection');
            if (toggleBtn && action === 'start') {
                toggleBtn.innerHTML = '<i class="select-icon">✕</i> Отменить выделение';
                toggleBtn.classList.add('active');
            }
            if (convertBtn) {
                convertBtn.style.display = 'none';
            }
        } else if (pdfModal && pdfModal.style.display === 'block') {
            const toggleBtn = document.getElementById('toggleSelection');
            const convertBtn = document.getElementById('convertSelection');
            if (toggleBtn && action === 'start') {
                toggleBtn.innerHTML = '<i class="select-icon">✕</i> Отменить выделение';
                toggleBtn.classList.add('active');
            }
            if (convertBtn) {
                convertBtn.style.display = 'none';
            }
        }
    }

    updateCanvasContext() {
        if (!this.selectionContainer) {
            console.warn('selectionContainer не найден');
            return;
        }
        
        this.canvas = this.selectionContainer.querySelector('canvas');
        
        if (this.canvas) {
            this.ctx = this.canvas.getContext('2d');
            
            const canvasRect = this.canvas.getBoundingClientRect();
            
            if (canvasRect.width > 0 && canvasRect.height > 0) {
                this.selection.scale = this.canvas.width / canvasRect.width;
            } else {
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
        
        this.updateCanvasOffset();
        this.isResizing = true;
        this.resizeHandle = handleClass;
        
        const canvasRect = this.canvas.getBoundingClientRect();
        
        this.startX = e.clientX - canvasRect.left;
        this.startY = e.clientY - canvasRect.top;
        

        this.startX = Math.max(0, Math.min(this.startX, canvasRect.width));
        this.startY = Math.max(0, Math.min(this.startY, canvasRect.height));
        
        this.originalSelection = { 
            x: this.selection.x,
            y: this.selection.y,
            width: this.selection.width,
            height: this.selection.height
        };
        
        return false;
    }
    
    startDrag(e) {
        e.preventDefault();
        e.stopPropagation();
        
        this.updateCanvasOffset();
        this.isDragging = true;
        
        // Получение координат мыши относительно canvas
        const canvasRect = this.canvas.getBoundingClientRect();
        
        this.dragStartX = e.clientX - canvasRect.left;
        this.dragStartY = e.clientY - canvasRect.top;
        
        this.dragStartX = Math.max(0, Math.min(this.dragStartX, canvasRect.width));
        this.dragStartY = Math.max(0, Math.min(this.dragStartY, canvasRect.height));
        
        // Сохранение исходной позиции
        this.dragOriginalX = this.selection.x;
        this.dragOriginalY = this.selection.y;
    }
    
    handleMouseMove(e) {
        if (!this.isSelecting && !this.isResizing && !this.isDragging) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        // Получение координат мыши относительно canvas
        const canvasRect = this.canvas.getBoundingClientRect();
        
        this.currentX = e.clientX - canvasRect.left;
        this.currentY = e.clientY - canvasRect.top;
        
        this.currentX = Math.max(0, Math.min(this.currentX, canvasRect.width));
        this.currentY = Math.max(0, Math.min(this.currentY, canvasRect.height));
        
        if (this.isSelecting) {
            this.updateSelectionSize();
        } else if (this.isResizing) {
            this.updateResize();
        } else if (this.isDragging) {
            this.updateDrag();
        }
        
        this.updateSelectionRect();
    }

    handleMouseUp(e) {
        if (this.isSelecting || this.isResizing || this.isDragging) {
            const wasResizing = this.isResizing;
            const wasDragging = this.isDragging;
            
            this.isSelecting = false;
            this.isResizing = false;
            this.isDragging = false;
            
            if (this.selectionRect) {
                this.selectionRect.classList.remove('creating');
            }
            
            if (wasResizing || wasDragging) {
                this.updateSelectionRect();
            }
            
            const isValid = this.validateSelection();
            
            if (isValid) {
                if (this.handles) {
                    this.handles.style.display = 'block';
                    this.handles.style.pointerEvents = 'auto';
                }
                
                if (this.dimensionsLabel) {
                    this.dimensionsLabel.style.display = 'block';
                    this.updateDimensionsLabel();
                }
                
                this.showActionButtons();
            } else {
                this.clearSelection();
            }
            
            this.resizeHandle = null;
            this.originalSelection = null;
        }
    }

    showActionButtons() {
        const pdfModal = document.getElementById('pdfModal');
        const imageModal = document.getElementById('imageModal');
        
        if (imageModal && imageModal.style.display === 'block') {
            const imageConvertBtn = document.getElementById('sendImageSelection');
            if (imageConvertBtn) {
                imageConvertBtn.style.display = 'block';
                imageConvertBtn.disabled = false;
                
                setTimeout(() => {
                    imageConvertBtn.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                    imageConvertBtn.style.opacity = '1';
                    imageConvertBtn.style.transform = 'translateY(0)';
                }, 10);
            }
            
            const imageResetBtn = document.getElementById('imageResetSelection');
            if (imageResetBtn) {
                imageResetBtn.style.display = 'inline-block';
            }
        } else if (pdfModal && pdfModal.style.display === 'block') {
            const convertBtn = document.getElementById('convertSelection');
            if (convertBtn) {
                convertBtn.style.display = 'block';
                convertBtn.disabled = false;
                
                setTimeout(() => {
                    convertBtn.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                    convertBtn.style.opacity = '1';
                    convertBtn.style.transform = 'translateY(0)';
                }, 10);
            }
            
            const resetBtn = document.getElementById('resetSelection');
            if (resetBtn) {
                resetBtn.style.display = 'inline-block';
            }
        }
    }
        
    updateSelectionSize() {
        this.selection.width = this.currentX - this.startX;
        this.selection.height = this.currentY - this.startY;
        
        const canvasRect = this.canvas.getBoundingClientRect();
        
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
        
        this.selection.x = Math.max(0, Math.min(this.selection.x, canvasRect.width - 10));
        this.selection.y = Math.max(0, Math.min(this.selection.y, canvasRect.height - 10));
        this.selection.width = Math.min(this.selection.width, canvasRect.width - this.selection.x);
        this.selection.height = Math.min(this.selection.height, canvasRect.height - this.selection.y);
    }
    
    updateResize() {
        const dx = this.currentX - this.startX;
        const dy = this.currentY - this.startY;
        
        const original = {
            x: this.originalSelection.x,
            y: this.originalSelection.y,
            width: this.originalSelection.width,
            height: this.originalSelection.height
        };
        
        let newX = original.x;
        let newY = original.y;
        let newWidth = original.width;
        let newHeight = original.height;
        
        switch (this.resizeHandle) {
            case 'handle-nw':
                newX = original.x + dx;
                newY = original.y + dy;
                newWidth = original.width - dx;
                newHeight = original.height - dy;
                break;
                
            case 'handle-ne':
                newY = original.y + dy;
                newWidth = original.width + dx;
                newHeight = original.height - dy;
                break;
                
            case 'handle-sw':
                newX = original.x + dx;
                newWidth = original.width - dx;
                newHeight = original.height + dy;
                break;
                
            case 'handle-se':
                newWidth = original.width + dx;
                newHeight = original.height + dy;
                break;
        }
        
        if (newWidth < 0) {
            if (this.resizeHandle.includes('w')) {
                newX += newWidth;
            }
            newWidth = Math.abs(newWidth);
        }
        
        if (newHeight < 0) {
            if (this.resizeHandle.includes('n')) {
                newY += newHeight;
            }
            newHeight = Math.abs(newHeight);
        }
        
        const minSize = 20;
        const canvasRect = this.canvas.getBoundingClientRect();
        
        newWidth = Math.max(minSize, newWidth);
        newHeight = Math.max(minSize, newHeight);
        
        newX = Math.max(0, Math.min(newX, canvasRect.width - minSize));
        newY = Math.max(0, Math.min(newY, canvasRect.height - minSize));
        newWidth = Math.min(newWidth, canvasRect.width - newX);
        newHeight = Math.min(newHeight, canvasRect.height - newY);
        
        this.selection.x = newX;
        this.selection.y = newY;
        this.selection.width = newWidth;
        this.selection.height = newHeight;
        
        this.updateSelectionRect();
    }
    
    updateDrag() {
        const dx = this.currentX - this.dragStartX;
        const dy = this.currentY - this.dragStartY;
        
        this.selection.x = this.dragOriginalX + dx;
        this.selection.y = this.dragOriginalY + dy;
        
        const canvasRect = this.canvas.getBoundingClientRect();
        
        const maxX = canvasRect.width - this.selection.width;
        const maxY = canvasRect.height - this.selection.height;
        
        this.selection.x = Math.max(0, Math.min(this.selection.x, maxX));
        this.selection.y = Math.max(0, Math.min(this.selection.y, maxY));
    }
    
    updateSelectionRect() {
    if (!this.selectionRect) return;
    
    // Актуальное смещение canvas
    this.updateCanvasOffset();
    
    // Построение прямоугольника с учетом смещения canvas
    this.selectionRect.style.left = `${this.canvasOffset.x + this.selection.x}px`;
    this.selectionRect.style.top = `${this.canvasOffset.y + this.selection.y}px`;
    this.selectionRect.style.width = `${this.selection.width}px`;
    this.selectionRect.style.height = `${this.selection.height}px`;
    
    if (this.selection.width > 0 && this.selection.height > 0) {
        this.selectionRect.style.display = 'block';
        this.overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
        this.selectionRect.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
        this.selectionRect.style.boxShadow = 'inset 0 0 0 1px #2A7179';
        
        this.updateDimensionsLabel();
        
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
    
    this.selectionRect.offsetHeight;
}
    updateDimensionsLabel() {
        if (!this.dimensionsLabel) return;
        
        const widthPx = Math.round(this.selection.width);
        const heightPx = Math.round(this.selection.height);
        
        let dimensionsText = `${widthPx} × ${heightPx} px`;
        
        if (this.canvas && this.selection.scale) {
            const widthMm = Math.round((widthPx / this.selection.scale) / 3.78);
            const heightMm = Math.round((heightPx / this.selection.scale) / 3.78);
            dimensionsText += ` ≈ ${widthMm} × ${heightMm} мм`;
        }
        
        this.dimensionsLabel.textContent = dimensionsText;
        
        // Позиционируем метку относительно выделения
        this.dimensionsLabel.style.left = '50%';
        this.dimensionsLabel.style.transform = 'translateX(-50%)';
        this.dimensionsLabel.style.bottom = '-30px';
        
        // Если метка выходит за нижнюю границу canvas, показываем сверху
        if (this.selection.y + this.selection.height + 40 > this.canvas.getBoundingClientRect().height) {
            this.dimensionsLabel.style.bottom = 'auto';
            this.dimensionsLabel.style.top = '-30px';
        }
    }
    
    validateSelection() {
        if (this.selection.width < 10 || this.selection.height < 10) {
            this.clearSelection();
            return false;
        }
        return true;
    }
    
    show() {
        this.updateCanvasOffset();
        
        if (this.overlay) {
            this.overlay.style.display = 'block';
            this.overlay.style.cursor = 'crosshair';
            this.overlay.style.pointerEvents = 'auto';
        }
        
        this.isActive = true;
        this.bindEventListeners();
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
        this.unbindEventListeners();
        
        this.selection = {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            scale: this.selection.scale || 1
        };
        
        // Скрываем кнопки
        this.hideActionButtons();
    }

    hideActionButtons() {
        const pdfModal = document.getElementById('pdfModal');
        const imageModal = document.getElementById('imageModal');
        
        if (imageModal && imageModal.style.display === 'block') {
            const convertBtn = document.getElementById('sendImageSelection');
            if (convertBtn) convertBtn.style.display = 'none';
        } else if (pdfModal && pdfModal.style.display === 'block') {
            const convertBtn = document.getElementById('convertSelection');
            if (convertBtn) convertBtn.style.display = 'none';
        }
    }
    
    bindEventListeners() {
        this.parentContainer.addEventListener('mousedown', this.handleMouseDown.bind(this));
        
        this.handles.querySelectorAll('.handle').forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                this.startResize(e, handle.className);
            });
        });
        
        this.selectionRect.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            this.startDrag(e);
        });
        
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
    }
    
    unbindEventListeners() {
        this.parentContainer.removeEventListener('mousedown', this.handleMouseDown);
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);
    }
    
    handleMouseDown(e) {
        if (e.target.closest('.handle') || e.target.closest('.selection-rect')) {
            return;
        }
        
        this.startSelection(e);
    }
    
    clearSelection() {
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
        
        this.selection = {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            scale: this.selection.scale || 1
        };
        
        if (this.overlay) {
            this.overlay.style.backgroundColor = 'transparent';
        }
        
        this.hideActionButtons();
    }

    getSelectionCanvas() {
    console.log('getSelectionCanvas called');
    
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
        // Получаем размеры canvas в пикселях
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        
        // Получаем размеры canvas на экране (CSS)
        const canvasRect = this.canvas.getBoundingClientRect();
        
        console.log('Canvas debug:', {
            canvasSize: { width: canvasWidth, height: canvasHeight },
            canvasRect: { width: canvasRect.width, height: canvasRect.height },
            selection: { x: this.selection.x, y: this.selection.y, w: this.selection.width, h: this.selection.height }
        });
        
        // Рассчитываем масштаб между экранными пикселями и реальными пикселями canvas
        const scaleX = canvasWidth / canvasRect.width;
        const scaleY = canvasHeight / canvasRect.height;
        
        console.log('Scales:', { scaleX, scaleY });
        
        // Преобразование координат выделения (которые уже относительно canvas на экране)
        // в реальные пиксели canvas
        const sx = Math.round(this.selection.x * scaleX);
        const sy = Math.round(this.selection.y * scaleY);
        const sw = Math.round(this.selection.width * scaleX);
        const sh = Math.round(this.selection.height * scaleY);
        
        console.log('Canvas pixels:', { sx, sy, sw, sh });
        
        // Проверяем границы
        if (sx < 0 || sy < 0 || sx + sw > canvasWidth || sy + sh > canvasHeight) {
            console.warn('Selection outside canvas bounds, adjusting...');
            
            const adjustedSx = Math.max(0, Math.min(sx, canvasWidth - 1));
            const adjustedSy = Math.max(0, Math.min(sy, canvasHeight - 1));
            const adjustedSw = Math.min(sw, canvasWidth - adjustedSx);
            const adjustedSh = Math.min(sh, canvasHeight - adjustedSy);
            
            if (adjustedSw <= 0 || adjustedSh <= 0) {
                console.error('Adjusted selection has zero or negative dimensions');
                return null;
            }
            
            console.log('Adjusted canvas pixels:', { adjustedSx, adjustedSy, adjustedSw, adjustedSh });
            
            return cropCanvasWithQuality(this.canvas, adjustedSx, adjustedSy, adjustedSw, adjustedSh);
        }
        
        return cropCanvasWithQuality(this.canvas, sx, sy, sw, sh);
        
    } catch (error) {
        console.error('Error getting selection canvas:', error);
        return null;
    }
}
    
    hasValidSelection() {
        return this.selection.width > 10 && this.selection.height > 10;
    }
}