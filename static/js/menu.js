
// Функция для показа стилизованного confirm диалога (скопирована из alerts_for_history.js)
function confirmDialog(message, title = 'Подтверждение') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'custom-alert-overlay';
        
        const dialog = document.createElement('div');
        dialog.className = 'custom-confirm-dialog';
        
        const titleElement = document.createElement('div');
        titleElement.className = 'custom-alert-title';
        titleElement.textContent = title;
        
        const messageElement = document.createElement('div');
        messageElement.className = 'custom-alert-message';
        messageElement.textContent = message;
        
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'custom-alert-buttons';
        
        // Кнопка "Отмена" с вашими классами
        const cancelButton = document.createElement('button');
        cancelButton.className = 'custom-alert-button cancel'; 
        cancelButton.textContent = 'Отмена';
        cancelButton.addEventListener('click', () => {
            cleanup();
            resolve(false);
        });
        
        
        const confirmButton = document.createElement('button');
        confirmButton.className = 'custom-alert-button confirm'; 
        confirmButton.textContent = 'Подтвердить';
        confirmButton.addEventListener('click', () => {
            cleanup();
            resolve(true);
        });
        
        buttonsContainer.appendChild(cancelButton);
        buttonsContainer.appendChild(confirmButton);
        
        dialog.appendChild(titleElement);
        dialog.appendChild(messageElement);
        dialog.appendChild(buttonsContainer);
        
        document.body.appendChild(overlay);
        document.body.appendChild(dialog);
        
        // Фокусировка на кнопке "Отмена"
        cancelButton.focus();
        
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                cleanup();
                resolve(false);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        
        overlay.addEventListener('click', () => {
            cleanup();
            resolve(false);
        });
        
        function cleanup() {
            if (overlay.parentElement) overlay.remove();
            if (dialog.parentElement) dialog.remove();
            document.removeEventListener('keydown', handleKeyDown);
        }
    });
}

// Функция для инициализации меню
window.initMenu = function(options) {
    const menuButton = document.getElementById('menuButton');
    const dropdownMenu = document.getElementById('dropdownMenu');
    const menuIcon = document.getElementById('menuIcon');
    
    if (!menuButton || !dropdownMenu || !menuIcon) return;
    
    // Данные из шаблона
    const menuDownIcon = options.menuDownIcon;
    const menuUpIcon = options.menuUpIcon;
    const signupIcon = options.signupIcon;
    const isAuthenticated = options.isAuthenticated;
    
    let isOpen = false;
    
    // Функция обновления иконки
    function updateIcon() {
        if (!isAuthenticated) {
            menuIcon.src = signupIcon;
            return;
        }
        
        if (isOpen) {
            menuIcon.src = menuUpIcon;
        } else {
            menuIcon.src = menuDownIcon;
        }
    }
    
    // Открытие/закрытие меню
    menuButton.addEventListener('click', function(e) {
        e.stopPropagation();
        isOpen = !isOpen;
        
        if (isOpen) {
            dropdownMenu.classList.add('show');
        } else {
            dropdownMenu.classList.remove('show');
        }
        
        updateIcon();
    });
    
    // Закрытие меню при клике вне его
    document.addEventListener('click', function(e) {
        if (!menuButton.contains(e.target) && !dropdownMenu.contains(e.target)) {
            dropdownMenu.classList.remove('show');
            isOpen = false;
            updateIcon();
        }
    });
    
    // Закрытие меню при нажатии Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            dropdownMenu.classList.remove('show');
            isOpen = false;
            updateIcon();
        }
    });
    
    // Инициализация иконки
    updateIcon();
};

// Функция для инициализации формы выхода
window.initLogoutForm = function() {
    const logoutForm = document.getElementById('logoutForm');
    if (logoutForm) {
        logoutForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const confirmed = await confirmDialog('Вы действительно хотите выйти?', 'Выход');
            if (confirmed) {
                this.submit();
            }
        });
    }
};