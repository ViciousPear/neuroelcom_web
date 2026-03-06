
   // Метод showMessage с разными стилями
   export function showMessage(message, type = 'error') {
        this.clearMessages();
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `upload-message ${type}-message`;
        messageDiv.innerHTML = `
            <div class="message-icon">${getMessageIcon(type)}</div>
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

    function getMessageIcon(type) {
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
    export function clearMessages() {
        const messages = document.querySelectorAll('.upload-message');
        messages.forEach(message => message.remove());
    }