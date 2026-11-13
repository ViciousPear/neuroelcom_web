document.addEventListener('DOMContentLoaded', function() {
    
    const inputs = document.querySelectorAll('.form-group input');
    
    // Для каждого поля обработчик события input
    inputs.forEach(input => {
        input.addEventListener('input', function() {
            // Родительский .form-group
            const formGroup = this.closest('.form-group');
            
            // Удаление класса ошибки
            formGroup.classList.remove('input-error');
            
            // Сокрытие сообщения об ошибке для этого поля
            const errorMessages = formGroup.querySelectorAll('.error-message');
            errorMessages.forEach(msg => {
                msg.style.display = 'none';
            });
        });
        
        // Обработка фокуса для очистки ошибок
        input.addEventListener('focus', function() {
            const formGroup = this.closest('.form-group');
            
            // Удаление красной подсветки только для этого поля
            formGroup.classList.remove('input-error');
            
            const errorMessages = formGroup.querySelectorAll('.error-message');
            errorMessages.forEach(msg => {
                msg.style.display = 'none';
            });
            
            // Сокрытие общих ошибок формы при фокусе на любом поле
            const formErrors = document.querySelector('.form-errors');
            if (formErrors) {
                formErrors.style.display = 'none';
            }
        });
    });
    
    // Показ ошибок при отправке формы
    const form = document.querySelector('form');
    if (form) {
        form.addEventListener('submit', function() {
            const errorMessages = document.querySelectorAll('.error-message');
            errorMessages.forEach(msg => {
                msg.style.display = 'block';
            });
        });
    }
});