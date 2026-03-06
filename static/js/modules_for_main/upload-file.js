import { createBlackAndWhiteImage, imageToBlob } from './processing-image.js';

export class FileUploadHandler {
    constructor() {
        this.recognitionState = {
            currentFile: null,
            previousResults: null,
            isProcessing: false
        };
    }

    // Функция для получения CSRF-токена
    getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    // Обработка изображений
    

        // Обработка изображений
    async processImageFile(file, form) {
        this.startProcessing();
        this.clearMessages();
        
        try {
            // Проверка доступности файла
            if (!file || file.size === 0) {
                throw new Error('Файл пустой или недоступен');
            }

            // Создание изображения и конвертация в ч/б
            const img = await createBlackAndWhiteImage(file);
            const blob = await imageToBlob(img, 'image/jpeg', 0.9);
            
            const formData = new FormData();
            formData.append('image', blob, file.name);
            formData.append('csrfmiddlewaretoken', this.getCookie('csrftoken'));
            
            // Отправка запроса с таймаутом
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 300000);
            
            const response = await fetch('/process-pdf/', {
                method: 'POST',
                body: formData,
                headers: {
                    'X-CSRFToken': this.getCookie('csrftoken')
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            // Проверка статуса ответа
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
            
            // Обработка успешного ответа
            const data = await response.json();
            
            if (data.redirect_url) {
                window.location.href = data.redirect_url;
            } else if (data.error === 'no_elements_detected') {
                throw new Error('NO_ELEMENTS_FOUND');
            } else {
                this.updateResults(data);
            }
            
        } catch (error) {
            this.handleProcessError(error);
        } finally {
            this.endProcessing();
        }
    }

    // Обработка PDF файла (новая функция)
    async processPdfFile(pdfHandler, outputFormat, processPdfUrl) {
        this.startProcessing();
        this.clearMessages();
        
        try {
            const bwCanvas = await pdfHandler.convertCurrentPage(outputFormat.value);
            
            const blob = await new Promise((resolve, reject) => {
                bwCanvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error('Ошибка создания blob из canvas'));
                        }
                    },
                    `image/${outputFormat.value}`,
                    0.9
                );
            });
            
            const formData = new FormData();
            formData.append('csrfmiddlewaretoken', this.getCookie('csrftoken'));
            formData.append('image', blob, `page_${pdfHandler.currentPageNum}.${outputFormat.value}`);
            
            // Отправка запроса с таймаутом
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 300000);
            
            const response = await fetch(processPdfUrl, {
                method: 'POST',
                body: formData,
                headers: {
                    'X-CSRFToken': this.getCookie('csrftoken')
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            // Проверка статуса ответа
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
            
            // Обработка успешного ответа
            const data = await response.json();
            
            if (data.redirect_url) {
                window.location.href = data.redirect_url;
            } else if (data.error === 'no_elements_detected') {
                throw new Error('NO_ELEMENTS_FOUND');
            } else {
                this.updateResults(data);
            }
            
            pdfHandler.closeModalHandler();
            
        } catch (error) {
            this.handleProcessError(error);
            throw error; // Пробрасываем ошибку дальше для обработки в основном коде
        } finally {
            this.endProcessing();
        }
    }

    // Функции для управления UI
    highlight() {
        document.getElementById('dropArea').classList.add('highlight');
    }

    unhighlight() {
        document.getElementById('dropArea').classList.remove('highlight');
    }

    startProcessing() {
        document.getElementById('dropArea').classList.add('processing');
        this.recognitionState.isProcessing = true;
    }

    endProcessing() {
        document.getElementById('dropArea').classList.remove('processing');
        this.recognitionState.isProcessing = false;
    }

    updateFileText(filename) {
        const dropText = document.getElementById('dropArea').querySelector('.drop-text p:first-child');
        if (dropText) {
            dropText.textContent = `Выбран файл: ${filename}`;
        }
    }

    // Метод для обработки ошибок
    handleProcessError(error) {
        console.error('Ошибка обработки:', error);
        
        let errorMessage = 'Неизвестная ошибка';
        let errorType = 'error';
        
        switch (error.message) {
            case 'NO_ELEMENTS_FOUND':
                errorMessage = 'На изображении не обнаружено соответствующих элементов. Пожалуйста, попробуйте другое изображение.';
                errorType = 'no-elements';
                break;

            case 'INVALID_TYPE':
            case 'INVALID_FORMAT':
                errorMessage = 'Неверный тип файла. Принимаются изображения формата .png, .jpg, .jpeg, а также файлы .pdf';
                errorType = 'file-error';
                break;
                
            case 'CONNECTION_ERROR':
                errorMessage = 'Отсутствует интернет-соединение или сервер недоступен. Проверьте подключение к интернету и попробуйте снова.';
                errorType = 'connection-error';
                break;
                
            case 'Failed to fetch':
                errorMessage = 'Ошибка соединения с сервером. Проверьте интернет-соединение и попробуйте снова.';
                errorType = 'connection-error';
                break;
                
            case 'NetworkError when attempting to fetch resource.':
                errorMessage = 'Сетевая ошибка. Проверьте интернет-соединение.';
                errorType = 'connection-error';
                break;
                
            case 'Размер файла слишком большой':
            case 'FILE_TOO_LARGE':
                errorMessage = 'Размер файла превышает допустимый лимит. Пожалуйста, выберите файл меньше 10 МБ.';
                errorType = 'file-error';
                break;
                
            case 'Файл пустой или недоступен':
                errorMessage = 'Выбранный файл пустой или поврежден. Пожалуйста, выберите другой файл.';
                errorType = 'file-error';
                break;
                
            case 'TimeoutError':
            case 'AbortError':
                errorMessage = 'Время ожидания ответа от сервера истекло. Проверьте интернет-соединение и попробуйте снова.';
                errorType = 'timeout-error';
                break;
                
            default:
                if (error.name === 'AbortError') {
                    errorMessage = 'Время обработки истекло. Попробуйте снова.';
                    errorType = 'timeout-error';
                } else if (error.message.includes('network') || error.message.includes('connection')) {
                    errorMessage = 'Проблемы с интернет-соединением. Проверьте сеть и попробуйте снова.';
                    errorType = 'connection-error';
                }  else if (error.message.includes('image') || error.message.includes('file')) {
                    errorMessage = 'Невозможно обработать изображение. Убедитесь, что файл является корректным изображением или содержит распознаваемые элементы.';
                    errorType = 'no-elements';
                } else {
                    errorMessage = `Ошибка обработки: ${error.message || 'неизвестная ошибка'}`;
                    errorType = 'error';
                }
        }
        
        this.showMessage(errorMessage, errorType);
    }

    // Метод showMessage с разными стилями
    showMessage(message, type = 'error') {
        this.clearMessages();
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `upload-message ${type}-message`;
        messageDiv.innerHTML = `
            <div class="message-icon">${this.getMessageIcon(type)}</div>
            <div class="message-text">${message}</div>
        `;
        
        const uploadContainer = document.querySelector('.upload-container');
        const button = uploadContainer.querySelector('button[type="submit"]');
        
        button.parentNode.insertBefore(messageDiv, button.nextSibling);
        
        if (!type.includes('connection')) {
            setTimeout(() => {
                if (messageDiv.parentElement) {
                    messageDiv.remove();
                }
            }, 10000);
        }
    }

    getMessageIcon(type) {
        const icons = {
            'error': '❌',
            'no-elements': '🔍',
            'connection-error': '📡',
            'timeout-error': '⏰',
            'file-error': '📁'
        };
        return icons[type] || '❌';
    }

    // Метод для очистки сообщений
    clearMessages() {
        const messages = document.querySelectorAll('.upload-message');
        messages.forEach(message => message.remove());
    }

    // Общая функция загрузки файла
    async uploadFile(form) {
        try {
            const response = await fetch(form.action, {
                method: 'POST',
                body: new FormData(form),
                headers: {
                    'X-CSRFToken': this.getCookie('csrftoken')
                },
                redirect: 'manual'
            });
            
            if (response.type === 'opaqueredirect' || response.status === 302 || response.status === 0) {
                const redirectUrl = response.headers.get('Location') || '/edit_results/';
                window.location.href = redirectUrl;
                return;
            }
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            const data = await response.json();
            this.endProcessing();
            
            if (data.redirect_url) {
                window.location.href = data.redirect_url;
            }
        } catch (error) {
            this.endProcessing();
            console.error('Ошибка при загрузке:', error);
            alert('Произошла ошибка при загрузке файла: ' + error.message);
        }
    }
}