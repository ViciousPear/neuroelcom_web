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
            formGroup.classList.remove('input-error');
            
            const errorMessages = formGroup.querySelectorAll('.error-message');
            errorMessages.forEach(msg => {
                msg.style.display = 'none';
            });
        });
    });
});