import { getRecognitionData, shouldExclude } from './utils.js';
import { initComboboxesForGroup } from './comboboxes.js';
import { showToast } from '../alerts.js';

// Функция для удаления строки
export function initDeleteButtons() {
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const group = this.closest('.element-group');
            if (group) {
                const container = group.closest('.elements-container');
                group.remove();
                // Перенумерование оставшихся групп
                const groups = container.querySelectorAll('.element-group');
                groups.forEach((group, index) => {
                    const numberDiv = group.querySelector('.combobox-row > div:first-child, .combobox-row-grouped > div:first-child');
                    if (numberDiv) {
                        numberDiv.textContent = `${index + 1}.`;
                    }
                });
            }
        });
    });
}

// Инициализация кнопок добавления
export function initAddButtons() {
    const buttons = document.querySelectorAll('.add-btn');
    console.log('Найдено кнопок:', buttons.length);
    
    if (!buttons.length) return;

    buttons.forEach(btn => {
        btn.removeEventListener('click', addButtonHandler);
        btn.addEventListener('click', addButtonHandler);
    });
}

// Обработчик кнопки добавления
function addButtonHandler() {
    try {
        const container = this.closest('.elements-container');
        if (!container) return;

        const { originalData } = getRecognitionData();
        const categorySection = container.closest('.category-section');
        const categoryHeader = categorySection.querySelector('.category-header');
        const categoryName = categoryHeader.textContent;

        // Определение категории
        let componentType;
        let dataKey; 
        
        if (categoryName.includes('Автоматические')) {
            componentType = 'automatic';
            dataKey = 'automatic';
        } 
        else if (categoryName.includes('Трансформаторы')) {
            componentType = 'transformer';
            dataKey = 'transformer';
        } 
        else if (categoryName.includes('Счетчики') || categoryName.includes('Меркурий')) {
            componentType = 'counter';
            dataKey = 'counter';
        } 
        else {
            componentType = 'other';
            dataKey = 'other';
        }

        // Получение данных для конкретной категории
        const categoryData = originalData[dataKey] || [];
        console.log(`Данные для ${componentType}:`, categoryData);

        // Создание новой группы с соответствующими данными
        const newGroup = createGroupElement(categoryData, container, componentType);
        if (!newGroup) return;

        // Добавление в DOM
        const addButton = container.querySelector('.add-btn-container');
        if (addButton) {
            container.insertBefore(newGroup, addButton);
        } else {
            container.appendChild(newGroup);
        }

        // Инициализация группы (НО НЕ ТРОГАЕМ МАРКИРОВКУ В КОМБОБОКСАХ)
        initComboboxesForGroup(newGroup);
        initDeleteButtonForGroup(newGroup);
        initQuantityInputForGroup(newGroup);
        
        // Отдельно инициализируем маркировку, если она есть
        initMarkingForGroup(newGroup, categoryData, componentType);

    } catch (error) {
        console.error('Ошибка при добавлении группы:', error);
        showToast('Ошибка при добавлении группы', 'error', 'Ошибка');
    }
}

// Новая функция для инициализации маркировки
function initMarkingForGroup(group, categoryData, componentType) {
    if (componentType !== 'automatic') return;
    
    const markingInput = group.querySelector('.marking-input');
    if (!markingInput) return;
    
    // Если есть данные с маркировкой, устанавливаем их
    if (categoryData && categoryData.length > 0 && categoryData[0].marking) {
        markingInput.value = categoryData[0].marking;
    }
    
    // Добавляем обработчик для сохранения маркировки при изменении
    markingInput.addEventListener('change', function() {
        // Здесь можно добавить логику сохранения маркировки, если нужно
        console.log('Маркировка изменена:', this.value);
    });
}

// Создание новой группы элементов
function createGroupElement(categoryData, container, componentType) {
    try {
        const existingGroups = container.querySelectorAll('.element-group');
        let newGroup;

        if (existingGroups.length > 0) {
            newGroup = existingGroups[existingGroups.length - 1].cloneNode(true);
            
            // Обновление номера в новом элементе
            const nextNumber = existingGroups.length + 1;
            const numberDiv = newGroup.querySelector('.combobox-row > div:first-child, .combobox-row-grouped > div:first-child');
            if (numberDiv) {
                numberDiv.textContent = `${nextNumber}.`;
            }
            
            // Сброс значений комбобоксов (но не маркировки)
            resetComboboxesOnly(newGroup);
        } else {
            // Создание новой группы с номером 1
            newGroup = document.createElement('div');
            newGroup.className = 'element-group';
            
            const template = componentType === 'counter' || componentType === 'transformer' 
                ? getComboboxRowTemplate(1, true) 
                : getComboboxRowGroupedTemplate(1);
                
            newGroup.innerHTML = template;
        }

        // Заполнение данных комбобоксов
        fillComboboxesOnly(newGroup, categoryData, componentType);
        
        // Отдельно устанавливаем маркировку, если это автоматические выключатели
        if (componentType === 'automatic') {
            const markingInput = newGroup.querySelector('.marking-input');
            if (markingInput && categoryData && categoryData.length > 0 && categoryData[0].marking) {
                markingInput.value = categoryData[0].marking;
            }
        }

        return newGroup;
    } catch (error) {
        console.error('Ошибка создания группы:', error);
        showToast('Ошибка создания группы', 'error', 'Ошибка');
        return null;
    }
}

// Новая функция для сброса только комбобоксов
function resetComboboxesOnly(groupElement) {
    if (!groupElement) return;
    
    // Сброс только комбобоксов, не трогаем marking-input
    groupElement.querySelectorAll('.combobox').forEach(select => {
        select.selectedIndex = 0;
    });
    
    // Сброс текстовых инпутов (кроме маркировки)
    groupElement.querySelectorAll('.text-input:not(.marking-input)').forEach(input => {
        input.value = '';
    });
    
    // Сброс количества
    const quantityInput = groupElement.querySelector('.group-count-input');
    if (quantityInput) quantityInput.value = 1;
}

// Новая функция для заполнения только комбобоксов
function fillComboboxesOnly(groupElement, data, componentType) {
    if (!groupElement || !data) return;

    console.log(`Filling comboboxes for ${componentType}`, data);
    if (!validateData(data, componentType)) {
        console.error(`Невозможно заполнить комбобоксы для ${componentType} - невалидные данные`);
        showToast('Ошибка заполнения данных для ' + componentType, 'error', 'Ошибка');
        return;
    }

    // Функция для фильтрации "мусорных" значений
    const filterValidItems = (items, getValueFn) => {
        return items.filter(item => {
            const value = String(getValueFn(item));
            return !shouldExclude(value, value);
        });
    };

    // Фильтрация исходные данные
    const validData = filterValidItems(data, item => item.id);
    if (validData.length === 0) {
        console.warn(`Нет валидных данных для ${componentType}`);
        return;
    }

    // Заполнение артикулов
    const artCombo = groupElement.querySelector('.combobox-art');
    if (artCombo) {
        artCombo.innerHTML = '<option value="">-- Выберите --</option>';
        const uniqueArticles = [...new Set(validData.map(item => item.id))];
        
        uniqueArticles.forEach(article => {
            if (!shouldExclude(article, article)) {
                const option = document.createElement('option');
                option.value = article;
                option.textContent = article;
                artCombo.appendChild(option);
            }
        });
    }

    // Заполнение названия
    const nameCombo = groupElement.querySelector('.combobox-name');
    if (nameCombo) {
        nameCombo.innerHTML = '<option value="">-- Выберите --</option>';
        const uniqueNames = [...new Set(validData.map(item => item.name))];
        
        uniqueNames.forEach(name => {
            const strName = String(name);
            if (!shouldExclude(strName, strName)) {
                const option = document.createElement('option');
                option.value = strName;
                option.textContent = strName;
                nameCombo.appendChild(option);
            }
        });
    }

    // Заполнение цены
    const priceCombo = groupElement.querySelector('.combobox-price');
    if (priceCombo) {
        priceCombo.innerHTML = '<option value="">-- Выберите --</option>';
        const uniquePrices = [...new Set(validData.map(item => 
            item.price ? `${item.price}.0 руб.` : '0.0 руб.'
        ))];
        
        uniquePrices.forEach(price => {
            if (!shouldExclude(price, price)) {
                const option = document.createElement('option');
                option.value = price;
                option.textContent = price;
                priceCombo.appendChild(option);
            }
        });
    }

    // Сохранение очищенных данных в комбобоксах
    [artCombo, nameCombo, priceCombo].forEach(combo => {
        if (combo) combo.dataset.items = JSON.stringify(validData);
    });
}

// Шаблон для combobox-row(трансформаторы/счетчики)
function getComboboxRowTemplate(number, withQuantity = false) {
    return `
        <div class="combobox-row">
            <div>${number}.</div>
            <div class="combobox-group">
                <label>Артикул</label>
                <select class="combobox combobox-art" data-linked="name price">
                    <option value="">-- Выберите --</option>
                </select>
            </div>
            <div class="combobox-group">
                <label>Название</label>
                <select class="combobox combobox-name" data-linked="article price">
                    <option value="">-- Выберите --</option>
                </select>
            </div>
            ${withQuantity ? `
            <div class="combobox-group">
                <label>Количество</label>
                <input type="number" min="1" value="1" class="group-count-input">
            </div>
            ` : ''}
            <div class="combobox-group">
                <label>Цена</label>
                <select class="combobox combobox-price" data-linked="article name">
                    <option value="">-- Выберите --</option>
                </select>
            </div>
            <div class="actions">
                <button class="delete-btn">x</button>
            </div>
        </div>
    `;
}

// Шаблон для combobox-row-grouped(выключатели)
function getComboboxRowGroupedTemplate(number) {
    return `
        <div class="combobox-row-grouped">
            <div>${number}.</div>
            <div class="combobox-group">
                <label>Маркировка</label>
                <input type="text" class="text-input marking-input" readonly placeholder="Например: QF1">
            </div>
            <div class="combobox-group">
                <label>Артикул</label>
                <select class="combobox combobox-art" data-linked="name price">
                    <option value="">-- Выберите --</option>
                </select>
            </div>
            <div class="combobox-group">
                <label>Название</label>
                <select class="combobox combobox-name" data-linked="article price">
                    <option value="">-- Выберите --</option>
                </select>
            </div>
            <div class="combobox-group">
                <label>Цена</label>
                <select class="combobox combobox-price" data-linked="article name">
                    <option value="">-- Выберите --</option>
                </select>
            </div>
            <div class="actions">
                <button class="delete-btn">x</button>
            </div>
        </div>
    `;
}

function validateData(data, componentType) {
    if (!Array.isArray(data)) {
        console.error(`Данные для ${componentType} не являются массивом`);
        return false;
    }

    if (data.length === 0) {
        console.warn(`Пустые данные для ${componentType}`);
        return false;
    }

    const sampleItem = data[0];
    if (!sampleItem || typeof sampleItem !== 'object') {
        console.error(`Некорректная структура данных для ${componentType}`);
        return false;
    }

    const requiredFields = ['id', 'name', 'price'];
    const missingFields = requiredFields.filter(field => !(field in sampleItem));
    
    if (missingFields.length > 0) {
        console.error(`Отсутствуют обязательные поля (${missingFields.join(', ')}) для ${componentType}`);
        return false;
    }

    return true;
}

// Инициализация кнопки удаления для группы
function initDeleteButtonForGroup(group) {
    const deleteBtn = group.querySelector('.delete-btn');
    if (deleteBtn) {
        deleteBtn.removeEventListener('click', handleDelete);
        deleteBtn.addEventListener('click', handleDelete);
    }
}

// Инициализация поля количества для группы
function initQuantityInputForGroup(group) {
    const quantityInput = group.querySelector('.group-count-input');
    if (quantityInput) {
        quantityInput.removeEventListener('change', handleQuantityChange);
        quantityInput.addEventListener('change', handleQuantityChange);
    }
}

// Обработчик кнопки удаления
function handleDelete() {
    const group = this.closest('.element-group');
    if (group) {
        const container = group.closest('.elements-container');
        group.remove();
        
        // Перенумеровывание оставшихся групп
        const groups = container.querySelectorAll('.element-group');
        groups.forEach((group, index) => {
            const numberDiv = group.querySelector('.combobox-row > div:first-child, .combobox-row-grouped > div:first-child');
            if (numberDiv) {
                numberDiv.textContent = `${index + 1}.`;
            }
        });
    }
}

// Обработчик изменения количества
function handleQuantityChange() {
    console.log('Количество изменено:', this.value);
}