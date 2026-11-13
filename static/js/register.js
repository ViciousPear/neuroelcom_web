document.addEventListener('DOMContentLoaded', function() {

    const inputs = document.querySelectorAll('.form-group input');
    
    // Для каждого поля обработчик события input
    inputs.forEach(input => {
        input.addEventListener('input', function() {
            // Родительский .form-group
            const formGroup = this.closest('.form-group');
            
            // Удаление класса ошибки
            formGroup.classList.remove('input-error');
            
            const errorMessages = formGroup.querySelectorAll('.error-message');
            errorMessages.forEach(msg => {
                msg.style.display = 'none';
            });
        });
        
        // Обработка фокуса для очистки ошибок
        input.addEventListener('focus', function() {
            const formGroup = this.closest('.form-group');
            formGroup.classList.remove('input-error');
            
            const errorMessages = formGroup.querySelectorAll('.error-message');
            errorMessages.forEach(msg => {
                msg.style.display = 'none';
            });
        });
    });
});