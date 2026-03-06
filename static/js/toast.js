// static/js/toast.js

// Класс для управления toast уведомлениями
class ToastManager {
    constructor() {
        this.container = null;
        this.toasts = [];
        this.init();
    }

    init() {
        // Создаем контейнер для тостов, если его нет
        if (!this.container) {
            this.container = document.querySelector('.toast-container');
            if (!this.container) {
                this.container = document.createElement('div');
                this.container.className = 'toast-container';
                document.body.appendChild(this.container);
            }
        }
    }

    // Иконки для разных типов уведомлений
    getIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    }

    // Показать toast
    show(message, type = 'info', title = '', duration = 4000) {
        this.init();

        // Создаем элемент toast
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        // Заголовок по умолчанию, если не указан
        if (!title) {
            const titles = {
                success: 'Успех',
                error: 'Ошибка',
                warning: 'Внимание',
                info: 'Информация'
            };
            title = titles[type] || 'Информация';
        }

        // HTML структура toast
        toast.innerHTML = `
            <div class="toast-icon">${this.getIcon(type)}</div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close" onclick="this.closest('.toast').remove()">×</button>
        `;

        // Добавляем в контейнер
        this.container.appendChild(toast);

        // Удаляем через указанное время
        const timeoutId = setTimeout(() => {
            this.remove(toast);
        }, duration);

        // Сохраняем ссылку на toast и timeout
        this.toasts.push({
            element: toast,
            timeoutId: timeoutId
        });

        return toast;
    }

    // Удалить конкретный toast
    remove(toast) {
        if (!toast || !toast.parentElement) return;

        // Находим индекс toast в массиве
        const index = this.toasts.findIndex(t => t.element === toast);
        if (index !== -1) {
            clearTimeout(this.toasts[index].timeoutId);
            this.toasts.splice(index, 1);
        }

        // Анимация исчезновения
        toast.style.animation = 'slideOut 0.3s ease forwards';
        
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 300);
    }

    // Удалить все toast
    removeAll() {
        this.toasts.forEach(toast => {
            clearTimeout(toast.timeoutId);
            this.remove(toast.element);
        });
        this.toasts = [];
    }

    // Успех
    success(message, title = 'Успех', duration = 4000) {
        return this.show(message, 'success', title, duration);
    }

    // Ошибка
    error(message, title = 'Ошибка', duration = 5000) {
        return this.show(message, 'error', title, duration);
    }

    // Предупреждение
    warning(message, title = 'Внимание', duration = 4000) {
        return this.show(message, 'warning', title, duration);
    }

    // Информация
    info(message, title = 'Информация', duration = 4000) {
        return this.show(message, 'info', title, duration);
    }
}

// Создаем глобальный экземпляр
window.toast = new ToastManager();

// Для обратной совместимости с существующим кодом
window.showToast = function(message, type, title, duration) {
    return window.toast.show(message, type, title, duration);
};