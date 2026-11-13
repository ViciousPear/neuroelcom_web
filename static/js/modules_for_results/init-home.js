
export function initEditButton() {
    const homeButton = document.getElementById('back');
    if (homeButton) {
        homeButton.addEventListener('click', function() {
            // Переход на страницу редактирования
            window.location.href = '/edit';
            
        });
    }
}

export function initHomeButton() {
    const homeButton = document.getElementById('home-button');
    if (homeButton) {
        homeButton.addEventListener('click', function() {
            // Переход на страницу редактирования
            window.location.href = '/';

        });
    }
}