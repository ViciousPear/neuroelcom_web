
export function initHomeButton() {
    const homeButton = document.getElementById('back');
    if (homeButton) {
        homeButton.addEventListener('click', function() {
            // Переход на страницу редактирования
            window.location.href = '/edit';
            
            // Альтернативный вариант для Django:
            // window.location.href = "{% url 'home' %}"; 
            // (если используете шаблон Django)
        });
    }
}
