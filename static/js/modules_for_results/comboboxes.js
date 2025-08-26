
// Глобальный объект для хранения соответствий между полями
const fieldRelations = {
    'art': { 
        linked: ['name', 'price'],
        matchBy: 'id' // Связь по полю id в данных
    },
    'name': {
        linked: ['art', 'price'],
        matchBy: 'name' // Связь по полю name в данных
    },
    'price': {
        linked: ['art', 'name'],
        matchBy: 'price' // Связь по полю price в данных
    }
};

// Универсальная функция синхронизации комбобоксов
export function syncComboboxes(sourceCombobox) {
    const row = sourceCombobox.closest('.combobox-row, .combobox-row-grouped');
    if (!row) return;

    const selectedValue = sourceCombobox.value;
    const sourceClass = Array.from(sourceCombobox.classList).find(c => 
        c.startsWith('combobox-')
    );
    
    if (!sourceClass || !selectedValue) return;

    // Определение типа источника (art, name или price)
    const sourceType = sourceClass.replace('combobox-', '');
    
    // Для всех комбобоксов в строке, кроме источника
    row.querySelectorAll('.combobox').forEach(targetCombobox => {
        if (targetCombobox === sourceCombobox) return;
        
        const targetClass = Array.from(targetCombobox.classList).find(c => 
            c.startsWith('combobox-')
        );
        if (!targetClass) return;
        
        const targetType = targetClass.replace('combobox-', '');
        
        // Проверка связей между полями
        const sourceLinked = sourceCombobox.dataset.linked || '';
        const targetLinked = targetCombobox.dataset.linked || '';
        
        const areLinked = sourceLinked.includes(targetType) || targetLinked.includes(sourceType);
        
        if (areLinked) {
            // Поиск варианта с таким же value в целевом комбобоксе
            const optionExists = Array.from(targetCombobox.options).some(
                opt => opt.value === selectedValue
            );
            
            if (optionExists) {
                targetCombobox.value = selectedValue;
            } else {
                // Для текстовых значений поиск соответствия по тексту
                const sourceText = sourceCombobox.options[sourceCombobox.selectedIndex].text;
                
                Array.from(targetCombobox.options).forEach(opt => {
                    if (opt.text === sourceText) {
                        targetCombobox.value = opt.value;
                    }
                });
            }
        }
    });
}

// Инициализация обработчиков событий
export function initComboboxes() {
    // Удаляем все существующие обработчики
    document.querySelectorAll('.combobox').forEach(combobox => {
        const newCombobox = combobox.cloneNode(true);
        combobox.parentNode.replaceChild(newCombobox, combobox);
    });

    // Добавляем новые обработчики
    document.querySelectorAll('.combobox').forEach(combobox => {
        combobox.addEventListener('change', function() {
            syncComboboxes(this);
        });
        
        // Синхронизация начальных значений
        if (combobox.value) {
            syncComboboxes(combobox);
        }
    });
}

export function handleComboboxChange() {
    if (!this.classList.contains('combobox')) return;
    try {
        const changedComboBox = this;
        const row = changedComboBox.closest('[class*="combobox-row"]');
        if (!row) return;

        const selectedValue = changedComboBox.value;
        const selectedOption = changedComboBox.options[changedComboBox.selectedIndex];
        if (!selectedOption || !selectedValue) return;

        // Определение типа измененного комбобокса
        const changedType = changedComboBox.classList.contains('combobox-art') ? 'art' :
                          changedComboBox.classList.contains('combobox-name') ? 'name' :
                          changedComboBox.classList.contains('combobox-price') ? 'price' : null;
        if (!changedType) return;

        // Получение данных из атрибута data-items
        const itemsData = JSON.parse(changedComboBox.dataset.items || '[]');
        
        // Нахождение выбранного элемента данных
        const selectedItem = itemsData.find(item => {
            const itemValue = String(item[fieldRelations[changedType].matchBy]);
            return itemValue === selectedValue || 
                  (changedType === 'price' && itemValue === selectedValue.replace('.0 руб.', ''));
        });

        if (!selectedItem) return;

        // Обновление связанных комбобоксов
        fieldRelations[changedType].linked.forEach(relatedType => {
            const targetComboBox = row.querySelector(`.combobox-${relatedType}`);
            if (!targetComboBox) return;

            // Получение значения с учетом типа поля
            let relatedValue = String(selectedItem[fieldRelations[relatedType].matchBy]);
            
            // Специальная обработка для цен
            if (relatedType === 'price') {
                relatedValue = relatedValue.endsWith('.0 руб.') ? relatedValue : `${relatedValue}.0 руб.`;
            }

            // Поиск совпадения в options
            let foundIndex = -1;
            Array.from(targetComboBox.options).forEach((opt, index) => {
                if (opt.value === relatedValue) {
                    foundIndex = index;
                }
            });

            if (foundIndex >= 0) {
                targetComboBox.selectedIndex = foundIndex;
            } else {
                targetComboBox.selectedIndex = 0;
            }
        });

    } catch (error) {
        console.error('Ошибка при синхронизации комбобоксов:', error);
    }
}

// Инициализация комбобоксов для группы
export function initComboboxesForGroup(group) {
    try {
        // Инициализация комбобоксов
        const comboboxes = group.querySelectorAll('.combobox');
        comboboxes.forEach(combobox => {
            const newCombobox = combobox.cloneNode(true);
            combobox.parentNode.replaceChild(newCombobox, combobox);
            newCombobox.addEventListener('change', handleComboboxChange);
            
            if (newCombobox.value) {
                handleComboboxChange.call(newCombobox);
            }
        });
        
        // Инициализация текстовых инпутов
        const nameInput = group.querySelector('.name-input');
        const priceInput = group.querySelector('.price-input');
        
        if (nameInput) {
            nameInput.removeEventListener('change', handleInputChange);
            nameInput.addEventListener('change', handleInputChange);
        }
        if (priceInput) {
            priceInput.removeEventListener('change', handleInputChange);
            priceInput.addEventListener('change', handleInputChange);
        }
    } catch (error) {
        console.error('Ошибка при инициализации группы:', error);
    }
}
