import { PDFHandler } from './modules_for_main/pdf-handler.js';
import { FileUploadHandler } from './modules_for_main/upload-file.js';
import { showCustomAlert, showToast } from './alerts.js';

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
            // Проверяем, может библиотека уже загружена
            if (typeof pdfjsLib !== 'undefined' && pdfjsLib.getDocument) {
                resolve();
                return;
            }
            
            // Пытаемся загрузить библиотеку
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.12.313/pdf.worker.min.js';
            script.onload = resolve;
            script.onerror = () => reject(new Error('Не удалось загрузить библиотеку PDF'));
            document.head.appendChild(script);
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
            // ВАЛИДАЦИЯ ФАЙЛА ПЕРЕД ОТПРАВКОЙ
            validateFile(file);
            
        } catch (error) {
            fileUploadHandler.handleProcessError(error);
            return; // Прерываем отправку при ошибке валидации
        }
        
        fileUploadHandler.recognitionState.currentFile = file;
        
        // Сброс предыдущих результатов
        fileUploadHandler.recognitionState.previousResults = null;
        document.querySelector('.results-container')?.remove();
        
        // Обработка PDF
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
            try {
                await loadPdfJs();
                await pdfHandler.showPdfPageSelector(file);
            } catch (error) {
                console.error('Ошибка загрузки PDF библиотеки:', error);
                fileUploadHandler.showMessage('Не удалось открыть окно для работы с PDF. Проверьте интернет-соединение.', 'connection-error');
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
});