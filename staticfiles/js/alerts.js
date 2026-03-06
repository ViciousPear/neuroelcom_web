// Функция для показа стилизованного alert
export function showCustomAlert(message, title = 'Уведомление') {
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
    button.addEventListener('click', closeCustomAlert);
    
    alert.appendChild(titleElement);
    alert.appendChild(messageElement);
    alert.appendChild(button);
    
    document.body.appendChild(overlay);
    document.body.appendChild(alert);
}

export function closeCustomAlert() {
    const overlay = document.querySelector('.custom-alert-overlay');
    const alert = document.querySelector('.custom-alert');
    
    if (overlay) overlay.remove();
    if (alert) alert.remove();
}

// Функция для toast уведомлений
export function showToast(message, type = 'info', title = '', duration = 5000) {
    const container = document.querySelector('.toast-container') || createToastContainer();
    
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
}

function getIcon(type) {
    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };
    return icons[type] || 'ℹ';
}

function createToastContainer() {
    const container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
}