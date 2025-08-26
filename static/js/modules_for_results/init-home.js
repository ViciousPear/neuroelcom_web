
export function initHomeButton() {
    const homeButton = document.getElementById('back');
    if (homeButton) {
        homeButton.addEventListener('click', function() {
            // Переход на главную страницу
            window.location.href = '/';
            
            // Альтернативный вариант для Django:
            // window.location.href = "{% url 'home' %}"; 
            // (если используете шаблон Django)
        });
    }
}
