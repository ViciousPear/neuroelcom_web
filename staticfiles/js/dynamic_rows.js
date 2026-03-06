// Управление динамическими строками
document.addEventListener('DOMContentLoaded', function() {
    // Добавление новой строки
    document.querySelectorAll('.add-row-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const categoryId = this.getAttribute('data-category');
            const container = document.getElementById(`category-${categoryId}`);
            
            // Создаем новую строку
            const newRow = document.createElement('div');
            newRow.className = 'item-row';
            newRow.innerHTML = `
                <select class="item-art">
                    <option value="">Выберите артикул</option>
                    <!-- Опции будут добавлены динамически -->
                </select>
                <select class="item-name">
                    <option value="">Выберите наименование</option>
                </select>
                <select class="item-price">
                    <option value="">Выберите цену</option>
                </select>
                <button class="remove-row-btn">×</button>
            `;
            
            container.appendChild(newRow);
            setupRowEvents(newRow);
        });
    });
    
    // Удаление строки
    function setupRowEvents(row) {
        row.querySelector('.remove-row-btn').addEventListener('click', function() {
            row.remove();
        });
        
        // Синхронизация комбобоксов
        const artSelect = row.querySelector('.item-art');
        const nameSelect = row.querySelector('.item-name');
        const priceSelect = row.querySelector('.item-price');
        
        function syncSelects(source, target1, target2) {
            const selectedValue = source.value;
            if (selectedValue) {
                const optionData = JSON.parse(selectedValue);
                target1.value = optionData.name;
                target2.value = optionData.price;
            }
        }
        
        artSelect.addEventListener('change', () => syncSelects(artSelect, nameSelect, priceSelect));
        nameSelect.addEventListener('change', () => syncSelects(nameSelect, artSelect, priceSelect));
        priceSelect.addEventListener('change', () => syncSelects(priceSelect, artSelect, nameSelect));
    }
    
    // Инициализация существующих строк
    document.querySelectorAll('.item-row').forEach(row => {
        setupRowEvents(row);
    });
    
    // Кнопка создания PDF
    document.getElementById('create-pdf').addEventListener('click', function() {
        // Реализуйте создание PDF здесь
        console.log('Создание PDF...');
    });
});