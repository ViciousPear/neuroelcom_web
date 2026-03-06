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

// Функция для инициализации формы выхода (если нужна)
window.initLogoutForm = function() {
    const logoutForm = document.getElementById('logoutForm');
    if (logoutForm) {
        logoutForm.addEventListener('submit', function(e) {
            e.preventDefault();
            if (confirm('Вы действительно хотите выйти?')) {
                this.submit();
            }
        });
    }
};