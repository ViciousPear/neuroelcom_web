
export function initImageZoom() {
    const zoomBtn = document.querySelector('.zoom-btn');
    const modal = document.getElementById('image-modal');
    const modalContent = document.querySelector('.modal-content');
    const modalImg = document.getElementById('modal-image');
    const closeBtn = document.querySelector('.close-modal');
    const zoomControls = document.querySelector('.zoom-controls');
    
    if (!zoomBtn || !modal) return;
    
    // Настройки масштабирования
    let currentScale = 1.1;
    const scaleStep = 0.1;
    const maxScale = 5;
    const minScale = 0.1;
    const dragThreshold = 0.4;
    
    // фиксированный размер модального окна
    const FIXED_MODAL_WIDTH = 900;
    const FIXED_MODAL_HEIGHT = 600;
    
    // Перетаскивание
    let isDragging = false;
    let startPos = { x: 0, y: 0 };
    let translatePos = { x: 0, y: 0 };
    let animationFrameId = null;

    // Применение трансформации
    function applyTransform() {
        modalImg.style.transform = `translate(${translatePos.x}px, ${translatePos.y}px) scale(${currentScale})`;
        modalImg.style.cursor = currentScale >= dragThreshold ? 'grab' : 'default';
    }
    
    // Подгонка изображения под окно
    function fitImageToWindow() {
        const containerWidth = FIXED_MODAL_WIDTH;
        const containerHeight = FIXED_MODAL_HEIGHT;
        
        const widthRatio = containerWidth / modalImg.naturalWidth;
        const heightRatio = containerHeight / modalImg.naturalHeight;
        currentScale = Math.min(widthRatio, heightRatio, 1);
        translatePos = { x: 0, y: 0 };
        
        applyTransform();
        centerImage();
    }

    // Центрирование изображения
    function centerImage() {
        const imgWidth = modalImg.naturalWidth * currentScale;
        const imgHeight = modalImg.naturalHeight * currentScale;
        const containerWidth = FIXED_MODAL_WIDTH;
        const containerHeight = FIXED_MODAL_HEIGHT;
        
        translatePos.x = (containerWidth - imgWidth) / 2;
        translatePos.y = (containerHeight - imgHeight) / 2;
        applyTransform();
    }

    // Ограничение позиции
    function constrainPosition() {
        const imgWidth = modalImg.naturalWidth * currentScale;
        const imgHeight = modalImg.naturalHeight * currentScale;
        const containerWidth = FIXED_MODAL_WIDTH;
        const containerHeight = FIXED_MODAL_HEIGHT;

        // Рассчитывание максимальное смещение
        const maxX = (imgWidth - containerWidth) * 1.2;
        const maxY = (imgHeight - containerHeight) * 0.9;
        
        
        if (imgWidth <= containerWidth) {
            translatePos.x = (containerWidth - imgWidth) / 2; 
        } else {
            translatePos.x = Math.max(-maxX, Math.min(translatePos.x, maxX));
        }
        
        if (imgHeight <= containerHeight) {
            translatePos.y = (containerHeight - imgHeight) / 2; 
        } else {
            translatePos.y = Math.max(-maxY, Math.min(translatePos.y, maxY));
        }
        
        applyTransform();
    }

    // Обработчики перетаскивания
    modalImg.addEventListener('mousedown', function(e) {
        if (currentScale >= dragThreshold) {
            isDragging = true;
            startPos = { x: e.clientX, y: e.clientY };
            modalImg.style.cursor = 'grabbing';
            e.preventDefault();
        }
    });
    
    document.addEventListener('mousemove', function(e) {
        if (isDragging) {
            const dx = e.clientX - startPos.x;
            const dy = e.clientY - startPos.y;
            
            
            translatePos.x += dx * 1.4;
            translatePos.y += dy * 1.4;
            
            startPos = { x: e.clientX, y: e.clientY };
            constrainPosition();
            e.preventDefault();
        }
    });
    
    document.addEventListener('mouseup', function() {
        if (isDragging) {
            isDragging = false;
            modalImg.style.cursor = currentScale >= dragThreshold ? 'grab' : 'default';
        }
    });

    // Открытие модального окна
    zoomBtn.addEventListener('click', function() {
        const imgSrc = document.querySelector('.zoomable-image').src;
        modal.style.display = 'flex';
        modalImg.src = imgSrc;
        
        // Установка фиксированного размера
        modalContent.style.width = `${FIXED_MODAL_WIDTH}px`;
        modalContent.style.height = `${FIXED_MODAL_HEIGHT}px`;
        
        // Центрирование модального окна 
        modalContent.style.position = 'absolute';
        modalContent.style.left = '50%';
        modalContent.style.top = '50%';
        modalContent.style.transform = 'translate(-50%, -50%)';
        
        modalImg.onload = function() {
            // Сбрасывание трансформации перед расчетами
            modalImg.style.transform = 'none';
            
            // Небольшая задержка для корректного отображения
            setTimeout(() => {
                fitImageToWindow();
            }, 50);
        };
        
        // Обработка уже загруженного изображения
        if (modalImg.complete) {
            setTimeout(() => {
                fitImageToWindow();
            }, 50);
        }
    });

    // Кнопки масштабирования
    document.querySelector('.zoom-in-btn').addEventListener('click', function(e) {
        e.stopPropagation();
        if (currentScale < maxScale) {
            currentScale = Math.min(currentScale + scaleStep, maxScale);
            applyTransform();
            constrainPosition();
        }
    });
    
    document.querySelector('.zoom-out-btn').addEventListener('click', function(e) {
        e.stopPropagation();
        const newScale = currentScale - scaleStep;
        
        // Исправление минимального масштаба
        currentScale = Math.max(0.1, newScale);
        applyTransform();
        constrainPosition();
    });
    
    document.querySelector('.zoom-reset-btn').addEventListener('click', function(e) {
        e.stopPropagation();
        currentScale = 1;
        applyTransform();
        fitImageToWindow();
    });

    // Масштабирование колесиком мыши
    modalContent.addEventListener('wheel', function(e) {
        if (!e.ctrlKey) return;
        e.preventDefault();
        
        const delta = Math.sign(e.deltaY) * -1;
        const newScale = currentScale + delta * scaleStep;
        
        if (newScale <= maxScale) {
            const rect = modalContent.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            currentScale = Math.max(0.1, newScale);
            
            const transformOriginX = mouseX - FIXED_MODAL_WIDTH / 2;
            const transformOriginY = mouseY - FIXED_MODAL_HEIGHT / 2;
            
            translatePos.x -= transformOriginX * (delta * scaleStep);
            translatePos.y -= transformOriginY * (delta * scaleStep);
            
            applyTransform();
            constrainPosition();
        }
    });

    // Закрытие модального окна
    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', function(e) {
        if (e.target === modal) closeModal();
    });
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.style.display === 'flex') closeModal();
    });
    
    function closeModal() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        modal.style.display = 'none';
        currentScale = 1.1;
        translatePos = { x: 0, y: 0 }; 
    }

    // Обработка изменения размеров окна
    window.addEventListener('resize', function() {
        if (modal.style.display === 'flex') {
            // Пересчет ограничений
            constrainPosition();
        }
    });
}