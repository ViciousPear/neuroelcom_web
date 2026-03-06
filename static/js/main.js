import { PDFHandler } from './modules_for_main/pdf-handler.js';
import { FileUploadHandler } from './modules_for_main/upload-file.js';
import { showCustomAlert, showToast } from './alerts.js';
import { convertCanvasToBlackAndWhite, convertToBlackAndWhiteWithQuality } from './modules_for_main/processing-image.js';

document.addEventListener('DOMContentLoaded', function() {
    // Основные элементы
    const dropArea = document.getElementById('dropArea');
    const form = document.querySelector('.upload-form');
    const fileInput = dropArea.querySelector('input[type="file"]');
    
    // Проверка существования элементов
    if (!dropArea || !form || !fileInput) {
        console.error('Не найдены необходимые элементы!');
        return;
    }

    fileInput.accept = '.jpg,.jpeg,.png,.bmp,.webp, application/pdf';

    // Инициализация обработчиков
    const pdfHandler = new PDFHandler();
    const fileUploadHandler = new FileUploadHandler();

    // Drag and Drop обработчики
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, fileUploadHandler.highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, fileUploadHandler.unhighlight, false);
    });

    // Функция валидации файла
    function validateFile(file) {
        // Проверка наличия файла
        if (!file) {
            throw new Error('Файл не выбран');
        }

        // Проверка расширения
        const ext = file.name.split('.').pop().toLowerCase();
        const allowedExtensions = ['png', 'jpg', 'jpeg', 'pdf', 'bmp', 'webp'];
        
        if (!allowedExtensions.includes(ext)) {
            throw new Error('INVALID_FORMAT');
        }

        // Проверка размера (10MB)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            throw new Error('FILE_TOO_LARGE');
        }

        // Дополнительная проверка типа
        if (file.type && file.type !== 'application/octet-stream') {
            const allowedTypes = [
                'image/png', 
                'image/jpeg', 
                'image/jpg', 
                'image/bmp',
                'image/webp',
                'application/pdf'
            ];
            
            if (!allowedTypes.includes(file.type)) {
                throw new Error('INVALID_TYPE');
            }
        }

        return true;
    }

    // Обработка сброса файлов
    function handleDrop(e) {
        const files = e.dataTransfer.files;
        if (files.length) {
            try {
                validateFile(files[0]);
                
                // Создание нового FileList
                const dataTransfer = new DataTransfer();
                for (let i = 0; i < files.length; i++) {
                    dataTransfer.items.add(files[i]);
                }
                fileInput.files = dataTransfer.files;
                
                // Обновление UI
                fileUploadHandler.updateFileText(files[0].name);
                fileUploadHandler.clearMessages();
                
            } catch (error) {
                fileUploadHandler.handleProcessError(error);
                // Очищаем input при ошибке
                fileInput.value = '';
            }
        }
    }
    dropArea.addEventListener('drop', handleDrop, false);

    

    // Обработка выбора файла через диалог
    fileInput.addEventListener('change', function() {
        if (this.files.length) {
            try {
                validateFile(this.files[0]);
                fileUploadHandler.updateFileText(this.files[0].name);
                fileUploadHandler.clearMessages();
            } catch (error) {
                fileUploadHandler.handleProcessError(error);
                this.value = ''; // Очищаем input при ошибке
            }
        }
    });

    // Обработка клика по dropArea
    dropArea.addEventListener('click', function(e) {
        // Игнорируем клики по дочерним элементам
        if (e.target !== dropArea && !e.target.classList.contains('drop-text')) {
            return;
        }
        fileInput.click();
    });

    // Функция для загрузки PDF.js с обработкой ошибок
   function loadPdfJs() {
    return new Promise((resolve, reject) => {
        // Если библиотека уже загружена
        if (typeof pdfjsLib !== 'undefined' && pdfjsLib.getDocument) {
            // Настраиваем worker если не настроен
            if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
                pdfjsLib.GlobalWorkerOptions.workerSrc = 
                    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
            }
            resolve();
            return;
        }
        
        // Если библиотека не загружена, пробуем загрузить
        const existingScript = document.querySelector('script[src*="pdf.min.js"]');
        if (existingScript) {
            // Если скрипт уже есть, ждем его загрузки
            const checkLoaded = setInterval(() => {
                if (typeof pdfjsLib !== 'undefined' && pdfjsLib.getDocument) {
                    clearInterval(checkLoaded);
                    if (pdfjsLib.GlobalWorkerOptions) {
                        pdfjsLib.GlobalWorkerOptions.workerSrc = 
                            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
                    }
                    resolve();
                }
            }, 100);
            
            // Таймаут
            setTimeout(() => {
                clearInterval(checkLoaded);
                resolve(); // Разрешаем даже если не загрузилось
            }, 3000);
        } else {
            // Пытаемся загрузить библиотеку
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
            
            script.onload = () => {
                // Даем время на инициализацию
                setTimeout(() => {
                    if (pdfjsLib.GlobalWorkerOptions) {
                        pdfjsLib.GlobalWorkerOptions.workerSrc = 
                            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
                    }
                    resolve();
                }, 100);
            };
            
            script.onerror = () => {
                console.error('Не удалось загрузить PDF.js');
                reject(new Error('Не удалось загрузить библиотеку PDF'));
            };
            
            document.head.appendChild(script);
        }
    });
}

    // Обработка отправки формы
    form.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    if (fileUploadHandler.recognitionState.isProcessing) return;
    
    if (!fileInput.files.length) {
        fileUploadHandler.showMessage('Пожалуйста, выберите файл', 'error');
        showToast('Пожалуйста, выберите файл', 'warning', 'Предупреждение');
        return;
    }
    
    const file = fileInput.files[0];
    
    try {
        validateFile(file);
    } catch (error) {
        fileUploadHandler.handleProcessError(error);
        return;
    }
    
    fileUploadHandler.recognitionState.currentFile = file;
    fileUploadHandler.recognitionState.previousResults = null;
    document.querySelector('.results-container')?.remove();
    
    // Обработка PDF
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        try {
            // Загружаем PDF.js с worker
            await loadPdfJs();
            await pdfHandler.showPdfPageSelector(file);
        } catch (error) {
            console.error('Ошибка загрузки PDF библиотеки:', error);
            
            // Более детальное сообщение об ошибке
            let errorMessage = 'Не удалось открыть окно для работы с PDF. ';
            if (error.message.includes('UnknownErrorException')) {
                errorMessage += 'Файл может быть поврежден или иметь неверный формат.';
            } else if (error.message.includes('network') || error.message.includes('connection')) {
                errorMessage += 'Проверьте интернет-соединение.';
            } else {
                errorMessage += 'Причина: ' + error.message;
            }
            
            fileUploadHandler.showMessage(errorMessage, 'connection-error');
            showToast('Ошибка загрузки PDF: ' + error.message, 'error', 'Ошибка');
        }
        return;
    }
    
    // Обработка изображений
    await fileUploadHandler.processImageFile(file, form);
});

    // Обработчики для модального окна PDF
    const closeModal = document.querySelector('.close-modal');
    const rotateBtn = document.getElementById('rotateLeft');
    const convertFullPageBtn = document.getElementById('convertFullPage');
    const outputFormat = document.getElementById('outputFormat');

    if (closeModal) {
        closeModal.addEventListener('click', () => pdfHandler.closeModalHandler());
    }

    if (rotateBtn) {
        rotateBtn.addEventListener('click', () => {
            pdfHandler.currentRotation = (pdfHandler.currentRotation - 90) % 360;
            pdfHandler.renderPage();
        });
    }

    if (convertFullPageBtn) {
    convertFullPageBtn.addEventListener('click', async function() {
        if (!pdfHandler.currentPdf || fileUploadHandler.recognitionState.isProcessing) return;
        
        // ВЫХОДИМ ИЗ РЕЖИМА ВЫДЕЛЕНИЯ ПЕРЕД ОТПРАВКОЙ
        pdfHandler.deactivateSelectionAndReset();
        
        fileUploadHandler.startProcessing();
        
        try {
            const bwCanvas = await pdfHandler.convertCurrentPage(outputFormat.value);
            
            bwCanvas.toBlob(async (blob) => {
                const formData = new FormData();
                formData.append('csrfmiddlewaretoken', fileUploadHandler.getCookie('csrftoken'));
                formData.append('image', blob, `page_${pdfHandler.currentPageNum}.${outputFormat.value}`);
                
                try {
                    const response = await fetch(PROCESS_PDF_URL, {
                        method: 'POST',
                        body: formData,
                        headers: {
                            'X-CSRFToken': fileUploadHandler.getCookie('csrftoken')
                        }
                    });
                    
                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        
                        switch (response.status) {
                            case 400:
                                if (errorData.error === 'no_elements_detected') {
                                    throw new Error('NO_ELEMENTS_FOUND');
                                }
                                throw new Error(errorData.message || 'Неверный запрос к серверу');
                            
                            case 413:
                                throw new Error('Размер файла слишком большой');
                            
                            case 500:
                                if (errorData.error === 'no_elements_detected') {
                                    throw new Error('NO_ELEMENTS_FOUND');
                                }
                                throw new Error('Внутренняя ошибка сервера');
                            
                            case 502:
                            case 503:
                            case 504:
                                throw new Error('CONNECTION_ERROR');
                            default:
                                throw new Error(`Ошибка сервера: ${response.status}`);
                        }
                    }
                    
                    const data = await response.json();
                    if (data.redirect_url) {
                        window.location.href = data.redirect_url;
                    } else {
                        fileUploadHandler.updateResults(data);
                    }
                } catch (error) {
                    console.error('Ошибка загрузки:', error);
                    fileUploadHandler.handleProcessError(error);
                } finally {
                    fileUploadHandler.endProcessing();
                }
            }, `image/${outputFormat.value}`, 0.9);

            pdfHandler.closeModalHandler();
        } catch (error) {
            console.error('Ошибка конвертации:', error);
            fileUploadHandler.handleProcessError(error);
            fileUploadHandler.endProcessing();
            pdfHandler.closeModalHandler();
        }
    });
}

    // Закрытие модального окна при клике вне его
    window.addEventListener('click', function(event) {
        if (event.target === pdfHandler.modal) {
            pdfHandler.closeModalHandler();
        }
    });

    // Пытаемся предзагрузить PDF.js при инициализации
    loadPdfJs().catch(error => {
        console.warn('Не удалось предзагрузить PDF.js:', error);
    });

     // Функция проверки доступа к результатам
    function checkResultsAccess() {
    fetch(window.API_URLS.checkResultsAccess, {
        method: 'GET',
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        }
    })
    .then(response => response.json())
    .then(data => {
        const resultsButton = document.getElementById('return-to-results');
                const resultsAlert = document.querySelector('.alert-info');
                
                if (data.has_access) {
                    // Показываем кнопку и уведомление
                    if (resultsButton) resultsButton.style.display = 'block';
                    if (resultsAlert) resultsAlert.style.display = 'block';
                } else {
                    // Скрываем кнопку и уведомление
                    if (resultsButton) resultsButton.style.display = 'none';
                    if (resultsAlert) resultsAlert.style.display = 'none';
                }
    })
    .catch(error => console.log('Ошибка при проверке доступа:', error));
}
    // Проверяем при загрузке страницы
    checkResultsAccess();

    const toggleSelectionBtn = document.getElementById('toggleSelection');
const resetSelectionBtn = document.getElementById('resetSelection');
const convertSelectionBtn = document.getElementById('convertSelection');

if (toggleSelectionBtn) {
    toggleSelectionBtn.addEventListener('click', () => {
    console.log('=== TOGGLE SELECTION MODE DEBUG ===');
    console.log('Current isSelectionMode:', pdfHandler.isSelectionMode);
    console.log('canvasContainer exists:', !!pdfHandler.canvasContainer);
    console.log('selectionHandler exists:', !!pdfHandler.selectionHandler);
    
    if (pdfHandler.selectionHandler) {
        console.log('selectionHandler properties:', {
            isActive: pdfHandler.selectionHandler.isActive,
            overlay: pdfHandler.selectionHandler.overlay,
            selectionContainer: pdfHandler.selectionHandler.selectionContainer
        });
    }
    
    pdfHandler.toggleSelectionMode();
});
}

if (resetSelectionBtn) {
    resetSelectionBtn.addEventListener('click', () => {
        pdfHandler.resetSelection();
    });
}

if (convertSelectionBtn) {
    convertSelectionBtn.addEventListener('click', async function() {
        console.log('Convert selection button clicked');
        
        if (!pdfHandler.currentPdf || fileUploadHandler.recognitionState.isProcessing) {
            console.log('Cannot process: no PDF or already processing');
            return;
        }
        
        // Проверяем валидность выделения
        if (!pdfHandler.selectionHandler || !pdfHandler.selectionHandler.hasValidSelection()) {
            console.log('No valid selection');
            showToast('Выделите область для отправки', 'warning', 'Предупреждение');
            return;
        }
        
        console.log('Starting selection conversion...');
        
        // 1. СНАЧАЛА ПОЛУЧАЕМ ВЫДЕЛЕННУЮ ОБЛАСТЬ
        let selectionCanvas = null;
        try {
            console.log('Getting selection canvas...');
            selectionCanvas = pdfHandler.selectionHandler.getSelectionCanvas();
            
            if (!selectionCanvas) {
                throw new Error('Не удалось получить выделенную область');
            }
            
            console.log('Selection canvas obtained:', {
                width: selectionCanvas.width,
                height: selectionCanvas.height
            });
        } catch (error) {
            console.error('Error getting selection:', error);
            showToast('Ошибка получения выделенной области', 'error', 'Ошибка');
            return;
        }
        
        // 2. СОХРАНЯЕМ ВАЖНЫЕ ДАННЫЕ ПЕРЕД ЗАКРЫТИЕМ
        const currentPageNum = pdfHandler.currentPageNum;
        const outputFormatValue = outputFormat.value;
        
        // 3. ОТКЛЮЧАЕМ РЕЖИМ ВЫДЕЛЕНИЯ ПЕРЕД ЗАКРЫТИЕМ
        console.log('Deactivating selection mode...');
        pdfHandler.deactivateSelectionAndReset();
        
        // Восстанавливаем нормальный курсор
        document.body.style.cursor = '';
        
        // 4. ЗАКРЫВАЕМ МОДАЛЬНОЕ ОКНО
        console.log('Closing modal...');
        pdfHandler.closeModalHandler();
        
        // 5. НАЧИНАЕМ ОБРАБОТКУ
        fileUploadHandler.startProcessing();
        
        try {
            // 6. КОНВЕРТИРУЕМ В Ч/Б
            console.log('Converting to black and white...');
            const bwCanvas = await convertCanvasToBlackAndWhite(selectionCanvas);
            
            if (!bwCanvas) {
                throw new Error('Не удалось конвертировать выделенную область');
            }
            
            console.log('Black and white canvas created:', {
                width: bwCanvas.width,
                height: bwCanvas.height
            });
            
            // 7. СОЗДАЕМ BLOB
            console.log('Creating blob...');
            const blob = await new Promise((resolve, reject) => {
                bwCanvas.toBlob((blob) => {
                    if (blob) {
                        console.log('Blob created, size:', blob.size);
                        resolve(blob);
                    } else {
                        reject(new Error('Не удалось создать blob'));
                    }
                }, `image/${outputFormatValue}`, 0.9);
            });
            
            // 8. ПОДГОТОВКА ФОРМЫ
            console.log('Preparing form data...');
            const formData = new FormData();
            const csrfToken = fileUploadHandler.getCookie('csrftoken');
            
            if (!csrfToken) {
                throw new Error('CSRF токен не найден');
            }
            
            formData.append('csrfmiddlewaretoken', csrfToken);
            
            // Создаем имя файла
            const fileName = `selection_page${currentPageNum}_${Date.now()}.${outputFormatValue}`;
            formData.append('image', blob, fileName);
            
            console.log('File name:', fileName);
            
            // 9. ОТПРАВКА НА СЕРВЕР
            console.log('Sending to server...');
            const response = await fetch(PROCESS_PDF_URL, {
                method: 'POST',
                body: formData,
                headers: {
                    'X-CSRFToken': csrfToken
                }
            });
            
            console.log('Response status:', response.status);
            
            if (!response.ok) {
                let errorMessage = `Ошибка сервера: ${response.status}`;
                try {
                    const errorData = await response.json();
                    if (errorData.message) {
                        errorMessage = errorData.message;
                    } else if (errorData.error === 'no_elements_detected') {
                        throw new Error('NO_ELEMENTS_FOUND');
                    }
                } catch (e) {
                    // Игнорируем ошибки парсинга JSON
                }
                
                throw new Error(errorMessage);
            }
            
            // 10. ОБРАБОТКА ОТВЕТА
            const data = await response.json();
            console.log('Response data:', data);
            
            if (data.redirect_url) {
                console.log('Redirecting to:', data.redirect_url);
                window.location.href = data.redirect_url;
            } else {
                console.log('Updating results...');
                fileUploadHandler.updateResults(data);
            }
            
        } catch (error) {
            console.error('Ошибка при обработке выделения:', error);
            
            // Обработка специфических ошибок
            if (error.message === 'NO_ELEMENTS_FOUND') {
                showToast('На изображении не найдено текстовых элементов для распознавания', 'warning', 'Ничего не найдено');
            } else if (error.message.includes('CONNECTION_ERROR') || error.message.includes('network')) {
                showToast('Проблемы с соединением. Проверьте интернет и попробуйте снова', 'error', 'Ошибка сети');
            } else {
                showToast(`Ошибка: ${error.message}`, 'error', 'Ошибка обработки');
            }
            
            fileUploadHandler.handleProcessError(error);
        } finally {
            console.log('Processing ended');
            fileUploadHandler.endProcessing();
            
            // Гарантированно сбрасываем курсор
            document.body.style.cursor = '';
        }
    });
}
// Временный скрипт для отладки отображения выделения
function debugSelection() {
    // Создаем отладочный элемент
    const debugDiv = document.createElement('div');
    debugDiv.className = 'selection-debug';
    debugDiv.id = 'selectionDebug';
    debugDiv.innerHTML = 'Отладка выделения...';
    document.body.appendChild(debugDiv);
    
    // Обновляем информацию каждые 500мс
    setInterval(() => {
        const debugDiv = document.getElementById('selectionDebug');
        const selectionRect = document.querySelector('.selection-rect');
        
        if (selectionRect && debugDiv) {
            const rect = selectionRect.getBoundingClientRect();
            const style = window.getComputedStyle(selectionRect);
            
            debugDiv.innerHTML = `
                <strong>Статус выделения:</strong><br>
                Видим: ${rect.width > 0 && rect.height > 0 ? 'ДА' : 'НЕТ'}<br>
                Display: ${style.display}<br>
                Left: ${style.left}<br>
                Top: ${style.top}<br>
                Width: ${style.width}<br>
                Height: ${style.height}<br>
                Z-index: ${style.zIndex}<br>
                Позиция: (${rect.left}, ${rect.top})<br>
                Размер: ${rect.width}×${rect.height}
            `;
        }
    }, 500);
}

// Вызовите эту функцию после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(debugSelection, 1000);
});

});
