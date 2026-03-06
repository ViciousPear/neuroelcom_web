document.addEventListener('DOMContentLoaded', function() {
    // Находим все поля ввода
    const inputs = document.querySelectorAll('.form-group input');
    
    // Для каждого поля добавляем обработчик события input
    inputs.forEach(input => {
        input.addEventListener('input', function() {
            // Находим родительский .form-group
            const formGroup = this.closest('.form-group');
            
            // Удаляем класс ошибки
            formGroup.classList.remove('input-error');
            
            // Находим и скрываем сообщение об ошибке для этого поля
            const errorMessages = formGroup.querySelectorAll('.error-message');
            errorMessages.forEach(msg => {
                msg.style.display = 'none';
            });
        });
        
        // Также обрабатываем фокус для очистки ошибок
        input.addEventListener('focus', function() {
            const formGroup = this.closest('.form-group');
            
            // Убираем красную подсветку только для этого поля
            formGroup.classList.remove('input-error');
            
            const errorMessages = formGroup.querySelectorAll('.error-message');
            errorMessages.forEach(msg => {
                msg.style.display = 'none';
            });
            
            // Скрываем общие ошибки формы при фокусе на любом поле
            const formErrors = document.querySelector('.form-errors');
            if (formErrors) {
                formErrors.style.display = 'none';
            }
        });
    });
    
    // При отправке формы показываем все ошибки
    const form = document.querySelector('form');
    if (form) {
        form.addEventListener('submit', function() {
            // Показываем все скрытые ошибки перед отправкой
            const errorMessages = document.querySelectorAll('.error-message');
            errorMessages.forEach(msg => {
                msg.style.display = 'block';
            });
        });
    }
});