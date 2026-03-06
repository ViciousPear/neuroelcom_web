// static/js/edit_results.js

import { initImageZoom } from './modules_for_results/image-zoom.js';
import { showCustomAlert } from './alerts.js';

// КОНСТАНТЫ ДОЛЖНЫ БЫТЬ ОПРЕДЕЛЕНЫ ДО КЛАССА
const TYPE_TRANSLATIONS = {
    'QF': 'Автоматические выключатели',
    'transformer': 'Трансформаторы',
    'counter': 'Счетчики'
};

const CurrentUtils = {
    // Очистка значения: удаление всех нецифровых символов (кроме разрешенных)
    cleanCurrentValue: function(value, isClosingCurrent = false) {
        if (!value || typeof value !== 'string') return '';
        
        // Удаляем все буквы и лишние символы
        let cleaned = value.replace(/[^0-9.,\-\s]/g, '');
        
        // Для замыкающего тока: оставляем цифры, точку, запятую
        // Для обычного тока: оставляем цифры, точку, запятую, минус
        if (isClosingCurrent) {
            cleaned = cleaned.replace(/[^0-9.,\s]/g, '');
        } else {
            cleaned = cleaned.replace(/[^0-9.,\-\s]/g, '');
        }
        
        // Убираем лишние пробелы
        cleaned = cleaned.trim();
        
        return cleaned;
    },
    
    // Добавление единиц измерения для отображения
    formatForDisplay: function(value, isClosingCurrent = false) {
        if (!value) return '';
        
        // Убираем возможные единицы измерения, если они уже есть
        let cleaned = value.replace(/[АаAaКкKk]/g, '');
        
        // Если после очистки ничего не осталось, возвращаем пустую строку
        if (!cleaned.trim()) return '';
        
        // Добавляем единицы измерения
        if (isClosingCurrent) {
            return cleaned + 'кА';
        } else {
            return cleaned + 'А';
        }
    },
    
    // Удаление единиц измерения для хранения
    formatForStorage: function(value) {
        if (!value) return '';
        
        // Удаляем все единицы измерения и лишние пробелы
        let cleaned = value.replace(/[АаAaКкKk]/g, '');
        cleaned = cleaned.trim();
        
        return cleaned;
    },
    
    // Валидация ввода для поля тока
    validateCurrentInput: function(value, isClosingCurrent = false) {
        // Если пустое значение - разрешаем
        if (!value) return true;
        
        // Проверяем на разрешенные символы
        const pattern = isClosingCurrent ? /^[0-9.,\s]*$/ : /^[0-9.,\-\s]*$/;
        if (!pattern.test(value)) {
            return false;
        }
        
        return true;
    },
    
    // Проверяем, есть ли уже единицы измерения в строке
    hasUnit: function(value) {
        if (!value || typeof value !== 'string') return false;
        return /[АаAaКкKk]/.test(value);
    }
};

class EditManager {
    constructor() {
        this.elements = [];
        this.groups = {};
        this.elementCounter = 1;
        this.isInitialized = false; // Флаг инициализации
    }
    
    async init() {
        if (this.isInitialized) {
            console.warn('EditManager уже инициализирован');
            return;
        }
        
        console.log('EditManager: инициализация начата');
        
        try {
            this.setupEventListeners();
            await this.loadDetectedElements();
            this.isInitialized = true;
            console.log('EditManager успешно инициализирован');
        } catch (error) {
            console.error('Ошибка инициализации EditManager:', error);
            showCustomAlert('Произошла ошибка при загрузке страницы. Пожалуйста, обновите страницу.', 'Ошибка загрузки');
        }
    }
    
    setupEventListeners() {
        console.log('EditManager: настройка обработчиков событий');
        
        // Удаляем старые обработчики перед добавлением новых
        this.removeEventListeners();
        
        // Кнопка добавления элемента
        const addElementBtn = document.getElementById('add-element');
        if (addElementBtn) {
            addElementBtn.addEventListener('click', this.handleAddElement.bind(this));
        } else {
            console.warn('EditManager: кнопка add-element не найдена');
        }
        
        // Кнопка добавления трансформатора
        const addTransformerBtn = document.getElementById('add-transformer');
        if (addTransformerBtn) {
            addTransformerBtn.addEventListener('click', this.handleAddTransformer.bind(this));
        }
        
        // Кнопка добавления счетчика
        const addCounterBtn = document.getElementById('add-counter');
        if (addCounterBtn) {
            addCounterBtn.addEventListener('click', this.handleAddCounter.bind(this));
        }
        
        // Кнопка добавления первого элемента
        const addFirstBtn = document.getElementById('add-first-element');
        if (addFirstBtn) {
            addFirstBtn.addEventListener('click', this.handleAddElement.bind(this));
        }
        
        // Кнопка сохранения и поиска
        const saveBtn = document.getElementById('save-and-search');
        if (saveBtn) {
            saveBtn.addEventListener('click', this.handleSaveAndSearch.bind(this));
        } else {
            console.warn('EditManager: кнопка save-and-search не найдена');
        }
        
        // Кнопка отмены
        const cancelBtn = document.getElementById('cancel-edit');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', this.handleCancel.bind(this));
        }
    }
    
    removeEventListeners() {
        // Удаляем обработчики чтобы избежать дублирования
        const buttons = [
            'add-element', 'add-transformer', 'add-counter', 
            'add-first-element', 'save-and-search', 'cancel-edit'
        ];
        
        buttons.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.replaceWith(btn.cloneNode(true));
            }
        });
    }
    
    // Обработчики событий
    handleAddElement() {
        console.log('Кнопка "Добавить элемент" нажата');
        this.addElement('QF');
    }
    
    handleAddTransformer() {
        console.log('Кнопка "Добавить трансформатор" нажата');
        this.addOrUpdateElement('transformer');
    }
    
    handleAddCounter() {
        console.log('Кнопка "Добавить счетчик" нажата');
        this.addOrUpdateElement('counter');
    }
    
    handleSaveAndSearch() {
        console.log('Кнопка "Сохранить и искать в БД" нажата');
        this.saveAndSearch();
    }
    
    handleCancel() {
        console.log('Кнопка "Отмена" нажата');
        this.showConfirmDialog(
            'Отменить редактирование и вернуться к загрузке?',
            'Подтверждение отмены',
            () => {
                window.location.href = '/';
            }
        );
    }
    
    async loadDetectedElements() {
        console.log('EditManager: загрузка данных из window.DETECTED_DATA');
        console.log('window.DETECTED_DATA:', window.DETECTED_DATA);
        
        try {
            let detectedData = window.DETECTED_DATA;
            
            if (!detectedData) {
                console.warn('window.DETECTED_DATA пустой или undefined');
                this.showEmptyState();
                return;
            }
            
            // Если это строка, пытаемся распарсить
            if (typeof detectedData === 'string') {
                try {
                    detectedData = JSON.parse(detectedData);
                    console.log('Данные распарсены из строки:', detectedData);
                } catch (error) {
                    console.error('Ошибка парсинга JSON:', error);
                    console.log('Содержимое строки:', detectedData);
                    this.showEmptyState();
                    return;
                }
            }
            
            // Проверяем что это массив
            if (!Array.isArray(detectedData)) {
                console.warn('detectedData не массив:', detectedData);
                // Попробуем преобразовать если это словарь
                if (typeof detectedData === 'object' && detectedData !== null) {
                    detectedData = [detectedData];
                    console.log('Преобразовали объект в массив:', detectedData);
                } else {
                    this.showEmptyState();
                    return;
                }
            }
            
            console.log('Обрабатываем данные, количество элементов:', detectedData.length);
            
            // Сбрасываем элементы
            this.elements = [];
            this.elementCounter = 1;
            
            // Группируем элементы по типу
            const elementGroups = {
                QF: [],
                transformer: { elements: [], count: 0 },
                counter: { elements: [], count: 0 }
            };
            
            // Считаем количество элементов каждого типа
            detectedData.forEach((element) => {
                const elementType = element.type || 'QF';
                const params = element.parameters || {};
                
                if (elementType === 'QF') {
                    elementGroups.QF.push({
                        type: 'QF',
                        parameters: {
                            name: params.name || '',
                            current: params.current || '',
                            voltage: params.voltage || '',
                            current_close: params.current_close || '',
                            mounting_type: params.mounting_type || '',
                            polus: params.polus || ''
                        }
                    });
                } 
                else if (elementType === 'transformer') {
                    elementGroups.transformer.count += 1;
                }
                else if (elementType === 'counter') {
                    elementGroups.counter.count += 1;
                }
            });
            
            console.log('ИТОГИ ГРУППИРОВКИ:');
            console.log('- QF элементов:', elementGroups.QF.length);
            console.log('- Трансформаторов: элементов =', elementGroups.transformer.count);
            console.log('- Счетчиков: элементов =', elementGroups.counter.count);
            
            // Добавляем QF элементы
            elementGroups.QF.forEach((element) => {
                this.elements.push({
                    type: 'QF',
                    elementNumber: this.elementCounter++,
                    parameters: element.parameters
                });
            });
            
            // Добавляем трансформатор (один элемент с количеством ЭЛЕМЕНТОВ)
            if (elementGroups.transformer.count > 0) {
                this.elements.push({
                    type: 'transformer',
                    elementNumber: this.elementCounter++,
                    parameters: { 
                        quantity: elementGroups.transformer.count
                    }
                });
            }
            
            // Добавляем счетчик (один элемент с количеством ЭЛЕМЕНТОВ)
            if (elementGroups.counter.count > 0) {
                this.elements.push({
                    type: 'counter',
                    elementNumber: this.elementCounter++,
                    parameters: { 
                        quantity: elementGroups.counter.count
                    }
                });
            }
            
            console.log('ЗАГРУЖЕНО ЭЛЕМЕНТОВ:', this.elements.length);
            this.elements.forEach((elem, idx) => {
                console.log(`  [${idx}] ${elem.type}: quantity=${elem.parameters.quantity}`);
            });
            
            if (this.elements.length > 0) {
                this.renderElements();
            } else {
                this.showEmptyState();
            }
            
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
            console.error('Стек ошибки:', error.stack);
            this.showEmptyState();
            showCustomAlert('Ошибка при загрузке данных. Пожалуйста, обновите страницу.', 'Ошибка');
        }
    }
    
    prepareElementsForAPI() {
        console.log('Подготовка элементов для API');
        
        return this.elements.map(element => {
            const params = element.parameters || {};
            
            console.log(`Подготовка элемента ${element.type}:`, params);
            
            if (element.type === 'QF') {
                // ГАРАНТИРОВАННО добавляем единицы измерения к току и замыкающему току
                let current = params.current || '';
                let current_close = params.current_close || '';
                
                // Если значение есть и еще нет единиц измерения - добавляем
                if (current && !CurrentUtils.hasUnit(current)) {
                    current = CurrentUtils.formatForDisplay(current, false);
                }
                
                if (current_close && !CurrentUtils.hasUnit(current_close)) {
                    current_close = CurrentUtils.formatForDisplay(current_close, true);
                }
                
                console.log(`Ток: ${current}, Замыкающий ток: ${current_close}`);
                
                return {
                    type: 'QF',
                    parameters: {
                        current: current,
                        voltage: params.voltage || '',
                        current_close: current_close,
                        mounting_type: params.mounting_type || '',
                        name: params.name || '',
                        polus: params.polus || ''
                    }
                };
            } else {
                return {
                    type: element.type,
                    parameters: {
                        quantity: params.quantity || 1
                    }
                };
            }
        });
    }
    
    renderElements() {
        console.log('EditManager: рендеринг элементов, количество:', this.elements.length);
        
        // Группируем элементы по типу
        this.groupElementsByTypeForDisplay();
        
        const groupsContainer = document.getElementById('groups-container');
        const emptyState = document.getElementById('empty-state');
        
        if (!groupsContainer) {
            console.error('Контейнер групп не найден');
            return;
        }
        
        groupsContainer.innerHTML = '';
        
        // Показываем/скрываем пустое состояние
        if (this.elements.length === 0) {
            this.showEmptyState();
            return;
        } else {
            if (emptyState) emptyState.style.display = 'none';
            groupsContainer.style.display = 'block';
        }
        
        // Порядок отображения групп
        const groupOrder = ['QF', 'transformer', 'counter'];
        
        // Создаем группы в заданном порядке
        groupOrder.forEach(type => {
            if (this.groups[type]) {
                const group = this.groups[type];
                this.createGroupElement(type, group, groupsContainer);
            }
        });
    }
    
    groupElementsByTypeForDisplay() {
        console.log('EditManager: группировка элементов по типам для отображения');
        this.groups = {};
        
        this.elements.forEach((element, index) => {
            const type = element.type || 'QF';
            
            if (!this.groups[type]) {
                this.groups[type] = {
                    elements: [],
                    name: TYPE_TRANSLATIONS[type] || type
                };
                console.log(`Создана новая группа для типа: ${type}`);
            }
            
            this.groups[type].elements.push({
                ...element,
                originalIndex: index,
                // Сохраняем элемент как есть
                data: element
            });
        });
        
        console.log('Группы созданы:', Object.keys(this.groups));
        for (const [type, group] of Object.entries(this.groups)) {
            console.log(`  ${type}: ${group.elements.length} элементов`);
        }
        
        return this.groups;
    }
    
   createGroupElement(type, groupData, container) {
    console.log(`Создание группы для типа: ${type}`);
    console.log(`Количество элементов в группе: ${groupData.elements.length}`);
    
    const template = document.getElementById('group-template');
    if (!template) {
        console.error('Шаблон группы не найден');
        return;
    }
    
    const clone = template.content.cloneNode(true);
    const groupElement = clone.querySelector('.category-group');
    
    groupElement.dataset.type = type;
    
    const title = groupElement.querySelector('.category-title');
    const count = groupElement.querySelector('.category-count');
    
    if (title) title.textContent = groupData.name;
    
    const elementCount = groupData.elements.length;
    if (count) {
        count.textContent = `${elementCount} элемент(ов)`;
    }
    
        const groupElementsContainer = groupElement.querySelector('.group-elements');
        
        // ОТЛАДКА: показываем элементы в группе
        console.log(`Элементы в группе ${type}:`);
        groupData.elements.forEach((element, idx) => {
            console.log(`  [${idx}] элемент:`, element);
        });
        
        // Для каждого элемента в группе передаем его индекс в группе
        groupData.elements.forEach((element, elementIndex) => {
            console.log(`Рендеринг элемента ${elementIndex + 1} в группе ${type}`);
            this.createElementCard(element, element.originalIndex, elementIndex + 1, groupElementsContainer);
        });
        
        container.appendChild(groupElement);
    }
        
    createElementCard(element, globalIndex, groupIndex, container) {
    console.log(`createElementCard: type=${element.type}, globalIndex=${globalIndex}, groupIndex=${groupIndex}`);
    
    const templateId = this.getTemplateIdForType(element.type);
    const template = document.getElementById(templateId);
    
    if (!template) {
        console.error(`Шаблон для типа ${element.type} не найден`);
        return;
    }
    
    const clone = template.content.cloneNode(true);
    const card = clone.querySelector('.element-card');
    
    card.dataset.type = element.type;
    card.dataset.index = globalIndex;
    
    // Номер элемента В ГРУППЕ (начинается с 1)
    const elementNumber = card.querySelector('.element-number');
    console.log(`Найден элемент .element-number:`, elementNumber);
    
    if (elementNumber) {
        console.log(`Устанавливаем номер: ${groupIndex}`);
        elementNumber.textContent = groupIndex;
    }
    
    // Заголовок элемента
    const elementTitle = card.querySelector('.element-title');
    if (elementTitle) {
        const titleSpan = elementTitle.querySelector('span:not(.element-number)') || elementTitle;
        if (element.type === 'QF') {
            titleSpan.textContent = 'Автоматический выключатель';
        } else if (element.type === 'transformer') {
            titleSpan.textContent = 'Трансформатор';
        } else if (element.type === 'counter') {
            titleSpan.textContent = 'Счетчик';
        }
    }
    
    // Заполняем данные в зависимости от типа
    this.fillElementForm(element, card);
    
    // Обработчики событий
    const deleteBtn = card.querySelector('.btn-delete');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            this.showConfirmDialog(
                'Удалить этот элемент?',
                'Подтверждение удаления',
                () => this.removeElement(globalIndex)
            );
        });
    }
    
    // Для QF элементов настраиваем обработчики всех полей
    if (element.type === 'QF') {
        this.setupQFEventHandlers(element, globalIndex, card);
    } else {
        this.setupSimpleEventHandlers(element, globalIndex, card);
    }
    
    container.appendChild(card);
}
    
    getTemplateIdForType(type) {
        switch (type) {
            case 'QF':
                return 'qf-element-template';
            case 'transformer':
                return 'transformer-element-template';
            case 'counter':
                return 'counter-element-template';
            default:
                return 'qf-element-template';
        }
    }
    
    fillElementForm(element, card) {
        const params = element.parameters || {};
        
        console.log(`Заполняем форму для элемента ${element.type}:`, params);
        
        if (element.type === 'QF') {
            const nameInput = card.querySelector('.name-input');
            const currentInput = card.querySelector('.current-input');
            const voltageInput = card.querySelector('.voltage-input');
            const currentCloseInput = card.querySelector('.current-close-input');
            const mountingSelect = card.querySelector('.mounting-select');
            const polusInput = card.querySelector('.polus-input');
            
            if (nameInput) nameInput.value = params.name || '';
            if (voltageInput) voltageInput.value = params.voltage || '';
            if (polusInput) polusInput.value = params.polus || '';
            
            // Очищаем ток и замыкающий ток от единиц измерения при загрузке
            if (currentInput) {
                const cleanedCurrent = CurrentUtils.formatForStorage(params.current || '');
                currentInput.value = cleanedCurrent;
            }
            
            if (currentCloseInput) {
                const cleanedCurrentClose = CurrentUtils.formatForStorage(params.current_close || '');
                currentCloseInput.value = cleanedCurrentClose;
            }
            
            // Тип монтажа (селект)
            if (mountingSelect) {
                mountingSelect.value = params.mounting_type || '';
            }
        } else {
            const quantityInput = card.querySelector('.quantity-input');
            if (quantityInput) {
                quantityInput.value = params.quantity || 1;
            }
        }
    }
    
    setupQFEventHandlers(element, index, card) {
        const nameInput = card.querySelector('.name-input');
        const currentInput = card.querySelector('.current-input');
        const voltageInput = card.querySelector('.voltage-input');
        const currentCloseInput = card.querySelector('.current-close-input');
        const mountingSelect = card.querySelector('.mounting-select');
        const polusInput = card.querySelector('.polus-input');
        
        const inputs = [
            { element: nameInput, field: 'name' },
            { element: currentInput, field: 'current' },
            { element: voltageInput, field: 'voltage' },
            { element: currentCloseInput, field: 'current_close' },
            { element: polusInput, field: 'polus' }
        ];
        
        inputs.forEach(({ element: input, field }) => {
            if (input) {
                if (field === 'current' || field === 'current_close') {
                    const isClosingCurrent = field === 'current_close';
                    
                    input.addEventListener('input', (e) => {
                        const value = e.target.value;
                        
                        // Валидация ввода
                        if (!CurrentUtils.validateCurrentInput(value, isClosingCurrent)) {
                            e.target.value = value.slice(0, -1);
                            return;
                        }
                        
                        const cleanedValue = CurrentUtils.formatForStorage(value);
                        this.updateElementParameter(index, field, cleanedValue);
                    });
                    
                    input.addEventListener('blur', (e) => {
                        const value = e.target.value;
                        if (value) {
                            let displayValue = value;
                            if (!CurrentUtils.hasUnit(value)) {
                                displayValue = CurrentUtils.formatForDisplay(value, isClosingCurrent);
                            }
                            e.target.value = displayValue;
                        }
                    });
                    
                    input.addEventListener('focus', (e) => {
                        const value = e.target.value;
                        if (value) {
                            const cleanedValue = CurrentUtils.formatForStorage(value);
                            e.target.value = cleanedValue;
                        }
                    });
                } else {
                    input.addEventListener('input', (e) => {
                        this.updateElementParameter(index, field, e.target.value);
                    });
                }
            }
        });
        
        if (mountingSelect) {
            mountingSelect.addEventListener('change', (e) => {
                this.updateElementParameter(index, 'mounting_type', e.target.value);
            });
        }
    }
    
    setupSimpleEventHandlers(element, index, card) {
        const quantityInput = card.querySelector('.quantity-input');
        
        if (quantityInput) {
            quantityInput.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                if (!isNaN(value)) {
                    this.updateElementParameter(index, 'quantity', value);
                }
            });
            
            quantityInput.addEventListener('change', (e) => {
                const value = parseInt(e.target.value);
                if (value < 1) {
                    e.target.value = 1;
                    this.updateElementParameter(index, 'quantity', 1);
                }
            });
        }
    }
    
    addElement(type = 'QF') {
        console.log(`Добавление нового элемента типа: ${type}`);
        
        const newElement = {
            type: type,
            elementNumber: 0, // Будет установлено при рендеринге
            parameters: this.getDefaultParametersForType(type)
        };
        
        this.elements.push(newElement);
        this.renderElements();
        
        setTimeout(() => {
            const elementsContainer = document.getElementById('elements-container');
            if (elementsContainer) {
                elementsContainer.scrollTop = elementsContainer.scrollHeight;
            }
        }, 100);
    }
    
    addOrUpdateElement(type) {
        console.log(`Добавление или обновление элемента типа: ${type}`);
        
        if (type !== 'transformer' && type !== 'counter') {
            this.addElement(type);
            return;
        }
        
        // Ищем существующий элемент этого типа
        const existingElementIndex = this.elements.findIndex(e => e.type === type);
        
        if (existingElementIndex !== -1) {
            const existingQuantity = this.elements[existingElementIndex].parameters.quantity || 1;
            this.elements[existingElementIndex].parameters.quantity = existingQuantity + 1;
            console.log(`Увеличено количество ${type}: ${existingQuantity} -> ${existingQuantity + 1}`);
        } else {
            const newElement = {
                type: type,
                elementNumber: this.elementCounter++,
                parameters: { quantity: 1 }
            };
            this.elements.push(newElement);
            console.log(`Создан новый элемент ${type} с количеством: 1`);
        }
        
        this.renderElements();
    }
    
    getDefaultParametersForType(type) {
        switch (type) {
            case 'QF':
                return {
                    name: '',
                    current: '',
                    voltage: '',
                    current_close: '',
                    mounting_type: '',
                    polus: ''
                };
            case 'transformer':
            case 'counter':
                return {
                    quantity: 1
                };
            default:
                return {};
        }
    }
    
    // Метод для показа кастомного confirm
    showConfirmDialog(message, title, onConfirm) {
        // Проверяем, не открыт ли уже диалог
        if (document.querySelector('.custom-alert-overlay')) {
            console.warn('Диалог уже открыт');
            return;
        }
        
        // Создаем overlay
        const overlay = document.createElement('div');
        overlay.className = 'custom-alert-overlay';
        
        // Создаем диалог
        const dialog = document.createElement('div');
        dialog.className = 'custom-alert';
        
        // Создаем элементы
        const titleElement = document.createElement('div');
        titleElement.className = 'custom-alert-title';
        titleElement.textContent = title || 'Подтверждение';
        
        const messageElement = document.createElement('div');
        messageElement.className = 'custom-alert-message';
        messageElement.textContent = message;
        
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'custom-alert-buttons';
        
        const confirmButton = document.createElement('button');
        confirmButton.className = 'custom-alert-button confirm';
        confirmButton.textContent = 'Да';
        confirmButton.addEventListener('click', () => {
            this.closeCustomDialog();
            if (onConfirm) onConfirm();
        });
        
        const cancelButton = document.createElement('button');
        cancelButton.className = 'custom-alert-button cancel';
        cancelButton.textContent = 'Нет';
        cancelButton.addEventListener('click', () => {
            this.closeCustomDialog();
        });
        
        buttonsContainer.appendChild(confirmButton);
        buttonsContainer.appendChild(cancelButton);
        
        dialog.appendChild(titleElement);
        dialog.appendChild(messageElement);
        dialog.appendChild(buttonsContainer);
        
        document.body.appendChild(overlay);
        document.body.appendChild(dialog);
    }
    
    // Метод для закрытия кастомного диалога
    closeCustomDialog() {
        const overlay = document.querySelector('.custom-alert-overlay');
        const dialog = document.querySelector('.custom-alert');
        
        if (overlay) overlay.remove();
        if (dialog) dialog.remove();
    }
    
    removeElement(index) {
    console.log(`Удаление элемента с индексом: ${index}`);
    
    if (index >= 0 && index < this.elements.length) {
        const elementType = this.elements[index].type;
        
        if ((elementType === 'transformer' || elementType === 'counter') && 
            this.elements[index].parameters.quantity > 1) {
            
            const currentQuantity = this.elements[index].parameters.quantity;
            this.elements[index].parameters.quantity = currentQuantity - 1;
            console.log(`Уменьшено количество ${elementType}: ${currentQuantity} -> ${currentQuantity - 1}`);
            
        } else {
            this.elements.splice(index, 1);
            // Обновляем индексы оставшихся элементов
            for (let i = index; i < this.elements.length; i++) {
                // Обновляем только оригинальный индекс
                if (this.elements[i].originalIndex !== undefined) {
                    this.elements[i].originalIndex = i;
                }
            }
        }
        
            // Обновляем нумерацию
            this.updateElementNumbers();
            this.renderElements();
        }
    }
    
    updateElementNumbers() {
        // Нумерация будет обновляться при рендеринге на основе положения элемента в группе
        // Поэтому нам нужно только обновить группировку
        this.groupElementsByTypeForDisplay();
    }

    updateElementParameter(index, field, value) {
        if (this.elements[index] && this.elements[index].parameters) {
            console.log(`Обновление параметра ${field} элемента ${index} на значение: ${value}`);
            this.elements[index].parameters[field] = value;
        }
    }
    
    showEmptyState() {
        console.log('Показываем пустое состояние');
        
        const groupsContainer = document.getElementById('groups-container');
        const emptyState = document.getElementById('empty-state');
        
        if (groupsContainer) {
            groupsContainer.innerHTML = '';
            groupsContainer.style.display = 'none';
        }
        
        if (emptyState) {
            emptyState.style.display = 'block';
        }
    }
    
    saveAndSearch() {
        console.log('Сохранение и поиск в БД');
        
        // Проверяем, есть ли элементы
        if (this.elements.length === 0) {
            showCustomAlert('Добавьте хотя бы один элемент для поиска', 'Внимание');
            return;
        }
        
        // Подготавливаем данные для отправки
        const data = {
            result_id: window.RESULT_ID,
            edited_elements: this.prepareElementsForAPI()
        };
        
        console.log('Отправляемые данные:', data);
        
        // Показываем индикатор загрузки
        const saveBtn = document.getElementById('save-and-search');
        if (!saveBtn) {
            showCustomAlert('Кнопка сохранения не найдена', 'Ошибка');
            return;
        }
        
        const originalText = saveBtn.textContent;
        saveBtn.textContent = 'Поиск в БД...';
        saveBtn.disabled = true;
        
        fetch('/search-db/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': this.getCookie('csrftoken')
            },
            body: JSON.stringify(data)
        })
        .then(response => {
            console.log('Ответ от сервера:', response.status, response.statusText);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Ответ JSON:', data);
            if (data.success) {
                console.log('Успешный ответ от сервера:', data);
                if (data.redirect_url) {
                    window.location.href = data.redirect_url;
                } else {
                    window.location.href = '/results/';
                }
            } else {
                console.error('Ошибка от сервера:', data.error);
                showCustomAlert('Ошибка при поиске в БД: ' + (data.error || 'Неизвестная ошибка'), 'Ошибка');
                saveBtn.textContent = originalText;
                saveBtn.disabled = false;
            }
        })
        .catch(error => {
            console.error('Ошибка сети:', error);
            showCustomAlert('Ошибка соединения с сервером. Проверьте подключение к интернету.', 'Ошибка сети');
            saveBtn.textContent = originalText;
            saveBtn.disabled = false;
        });
    }
    
    getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('DOM загружен, инициализируем EditManager');
        console.log('Проверка глобальных переменных:');
        console.log('- DETECTED_DATA:', window.DETECTED_DATA);
        console.log('- IMAGE_BASE64:', window.IMAGE_BASE64 ? 'Есть' : 'Нет');
        console.log('- RESULT_ID:', window.RESULT_ID);
        console.log('- TYPE_TRANSLATIONS:', TYPE_TRANSLATIONS);
        
        // Инициализация зума
        initImageZoom();
        
        // Создаем и инициализируем EditManager
        window.editManager = new EditManager();
        await window.editManager.init();
        
        console.log('EditManager успешно инициализирован');
    } catch (error) {
        console.error('Ошибка инициализации EditManager:', error);
        showCustomAlert('Произошла ошибка при загрузке страницы. Пожалуйста, обновите страницу.', 'Ошибка');
    }
});