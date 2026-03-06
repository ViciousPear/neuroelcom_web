// Функция для показа стилизованного alert
window.showCustomAlert = function(message, title = 'Уведомление') {
    // Создаем overlay
    const overlay = document.createElement('div');
    overlay.className = 'custom-alert-overlay';
    
    // Создаем alert
    const alert = document.createElement('div');
    alert.className = 'custom-alert';
    
    // Создаем элементы через DOM вместо innerHTML
    const titleElement = document.createElement('div');
    titleElement.className = 'custom-alert-title';
    titleElement.textContent = title;
    
    const messageElement = document.createElement('div');
    messageElement.className = 'custom-alert-message';
    messageElement.textContent = message;
    
    const button = document.createElement('button');
    button.className = 'custom-alert-button';
    button.textContent = 'OK';
    button.addEventListener('click', window.closeCustomAlert);
    
    alert.appendChild(titleElement);
    alert.appendChild(messageElement);
    alert.appendChild(button);
    
    document.body.appendChild(overlay);
    document.body.appendChild(alert);
};

// Функция для закрытия alert
window.closeCustomAlert = function() {
    const overlay = document.querySelector('.custom-alert-overlay');
    const alert = document.querySelector('.custom-alert');
    
    if (overlay) overlay.remove();
    if (alert) alert.remove();
};

// Вспомогательная функция для получения иконки (не экспортируется)
function getIcon(type) {
    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };
    return icons[type] || 'ℹ';
}

// Вспомогательная функция для создания контейнера тостов
function createToastContainer() {
    const container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
}

// Функция для toast уведомлений
window.showToast = function(message, type = 'info', title = '', duration = 5000) {
    // Защита от рекурсии
    if (window._toastCallDepth === undefined) {
        window._toastCallDepth = 0;
    }
    
    if (window._toastCallDepth > 0) {
        console.warn('Preventing recursive toast call');
        return;
    }
    
    window._toastCallDepth++;
    
    try {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = createToastContainer();
        }
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const icon = document.createElement('div');
        icon.className = 'toast-icon';
        icon.textContent = getIcon(type);
        
        const content = document.createElement('div');
        content.className = 'toast-content';
        
        if (title) {
            const titleElement = document.createElement('div');
            titleElement.className = 'toast-title';
            titleElement.textContent = title;
            content.appendChild(titleElement);
        }
        
        const messageElement = document.createElement('div');
        messageElement.className = 'toast-message';
        messageElement.textContent = message;
        content.appendChild(messageElement);
        
        const closeButton = document.createElement('button');
        closeButton.className = 'toast-close';
        closeButton.textContent = '×';
        closeButton.addEventListener('click', function() {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        });
        
        toast.appendChild(icon);
        toast.appendChild(content);
        toast.appendChild(closeButton);
        
        container.appendChild(toast);
        
        if (duration > 0) {
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.style.animation = 'slideOut 0.3s ease';
                    setTimeout(() => toast.remove(), 300);
                }
            }, duration);
        }
    } catch (e) {
        console.error('Error showing toast:', e);
    } finally {
        window._toastCallDepth = 0;
    }
};

// Создаем контейнер для тостов при загрузке
document.addEventListener('DOMContentLoaded', function() {
    if (!document.querySelector('.toast-container')) {
        createToastContainer();
    }
});