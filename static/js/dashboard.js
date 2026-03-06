// static/js/dashboard.js

// Глобальные переменные
let currentResultId = null;

// Функция для открытия confirm диалога
function confirmDelete(resultId) {
    currentResultId = resultId;
    document.getElementById('confirmDialog').style.display = 'block';
    document.getElementById('confirmOverlay').style.display = 'block';
}

// Функция для закрытия confirm диалога
function closeConfirmDialog() {
    document.getElementById('confirmDialog').style.display = 'none';
    document.getElementById('confirmOverlay').style.display = 'none';
    currentResultId = null;
}

// Функция для удаления результата
async function deleteResult(resultId, csrfToken) {
    try {
        // Используем правильный URL
        const url = `/results/delete/?result_id=${resultId}`;
        console.log('Sending delete request to:', url);
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'X-CSRFToken': csrfToken,
                'Content-Type': 'application/json',
            },
        });
        
        console.log('Response status:', response.status);
        
        // Проверяем тип ответа
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Non-JSON response:', text.substring(0, 200));
            
            if (response.status === 404) {
                throw new Error('URL для удаления не найден. Проверьте правильность пути.');
            } else {
                throw new Error('Сервер вернул некорректный ответ');
            }
        }
        
        const data = await response.json();
        
        if (data.success) {
            // Удаляем элемент из DOM
            const element = document.getElementById(`result-${resultId}`);
            if (element) {
                element.style.transition = 'opacity 0.3s';
                element.style.opacity = '0';
                
                setTimeout(() => {
                    element.remove();
                    
                    // Проверяем, остались ли еще элементы
                    const historyList = document.querySelector('.history-list');
                    if (historyList && historyList.children.length === 0) {
                        historyList.innerHTML = `
                            <div class="empty-state">
                                <p>У вас пока нет сохраненных результатов</p>
                                <a href="/upload/" class="nav-link">Загрузить первый файл</a>
                            </div>
                        `;
                    }
                }, 300);
            }
            
            // Показываем toast об успехе через новый менеджер
            if (window.toast) {
                window.toast.success('Результат успешно удален из истории');
            } else {
                // Fallback если toast.js еще не загружен
                alert('Результат успешно удален из истории');
            }
        } else {
            // Показываем toast об ошибке
            if (window.toast) {
                window.toast.error(data.error || 'Ошибка при удалении результата');
            } else {
                alert('Ошибка: ' + (data.error || 'Неизвестная ошибка'));
            }
        }
    } catch (error) {
        console.error('Error deleting result:', error);
        if (window.toast) {
            window.toast.error(error.message || 'Произошла ошибка при удалении');
        } else {
            alert('Ошибка: ' + (error.message || 'Произошла ошибка при удалении'));
        }
    } finally {
        closeConfirmDialog();
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard.js loaded');
    
    // Получаем CSRF токен
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value || '';
    console.log('CSRF Token exists:', !!csrfToken);
    
    // Инициализация меню
    if (typeof window.initMenu === 'function') {
        const menuIcon = document.getElementById('menuIcon');
        if (menuIcon) {
            window.initMenu({
                menuDownIcon: menuIcon.dataset.menuDownIcon || '/static/images/menudown_icon.png',
                menuUpIcon: menuIcon.dataset.menuUpIcon || '/static/images/menuup_icon.png',
                signupIcon: menuIcon.dataset.signupIcon || '/static/images/for_signup.png',
                isAuthenticated: document.body.classList.contains('user-authenticated')
            });
        }
    }
    
    // Обработчик подтверждения удаления
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', function() {
            if (currentResultId) {
                deleteResult(currentResultId, csrfToken);
            }
        });
    }
    
    // Показываем сообщения из Django
    if (window.djangoMessages) {
        window.djangoMessages.forEach(function(msg) {
            setTimeout(() => {
                if (window.toast) {
                    window.toast.show(msg.message, msg.tags, msg.tags, 4000);
                }
            }, 100);
        });
    }
});

// Экспортируем функции в глобальную область
window.confirmDelete = confirmDelete;
window.closeConfirmDialog = closeConfirmDialog;