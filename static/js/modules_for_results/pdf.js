import { getCSRFToken } from './utils.js';
import { showCustomAlert, showToast } from '../alerts.js';

export function createPDF() {
    // Подготовка структуры данных для PDF
    const pdfData = {
        categories: [], 
        total: "0.00 руб.",  
        total_without_vat: "0.00 руб.",
        vat_amount: "0.00 руб.",      
        total_with_vat: "0.00 руб."      
    };

    let grandTotal = 0; 
    let itemCount = 0; 
    let itemCounter = 1;     

    const groupedItems = {};

    // Для отладки
    const categories = document.querySelectorAll('.category-section');
    console.log('Найдено категорий:', categories.length);
    
    categories.forEach((section, catIndex) => {
        const categoryName = section.querySelector('.category-header')?.textContent.trim();
        console.log(`Категория ${catIndex + 1}: "${categoryName}"`);
        
        const regularGroups = section.querySelectorAll('.element-group');
        console.log(`  Обычных групп (.element-group): ${regularGroups.length}`);
        
        const breakerItems = section.querySelectorAll('.combobox-row-grouped');
        console.log(`  Групп выключателей (.combobox-row-grouped): ${breakerItems.length}`);
    });

    // Обработка всех категорий на странице
    document.querySelectorAll('.category-section').forEach(section => {
        const categoryName = section.querySelector('.category-header').textContent.trim();

        // Обработка обычных группы (.element-group) - для счетчиков и трансформаторов
        section.querySelectorAll('.element-group').forEach(group => {
            processElementGroup(group, categoryName, groupedItems);
        });

        // Обработка выключателей (.combobox-row-grouped)
        section.querySelectorAll('.combobox-row-grouped').forEach(breakerItem => {
            // Передача оригинального элементп
            processElementGroup(breakerItem, categoryName, groupedItems);
        });
    });

    console.log('Сгруппированные элементы:', groupedItems);

    // Группировка элементов по категориям
    const categoriesMap = {};
    
    Object.values(groupedItems).forEach(item => {
        if (!categoriesMap[item.category]) {
            categoriesMap[item.category] = [];
        }
        
        categoriesMap[item.category].push({
            number: itemCounter++,
            article: item.article,
            name: item.name,
            quantity: item.quantity,
            price: item.price.toFixed(2) + ' руб.',
            total: item.total + ' руб.'
        });
        
        grandTotal += parseFloat(item.total);
        itemCount += item.quantity;
    });

    console.log('Категории для отправки:', categoriesMap);

    // Преобразование map в массив категорий
    for (const [categoryName, elements] of Object.entries(categoriesMap)) {
        pdfData.categories.push({
            name: categoryName,
            elements: elements
        });
    }

    // Рассчет итоговой суммы
    if (itemCount > 0) {
        const totalWithoutVat = grandTotal;
        const vatAmount = grandTotal * 0.22;
        const totalWithVat = grandTotal + vatAmount;
        
        pdfData.total_without_vat = totalWithoutVat.toFixed(2) + ' руб.';
        pdfData.vat_amount = vatAmount.toFixed(2) + ' руб.';
        pdfData.total_with_vat = totalWithVat.toFixed(2) + ' руб.';
        pdfData.total = totalWithVat.toFixed(2) + ' руб.';
    }

    console.log('Отправляемые данные PDF:', JSON.stringify(pdfData, null, 2));

    // Отправка данных на сервер
    const pdfBtn = document.getElementById('create-pdf');
    if (!pdfBtn) {
        console.error('Кнопка создания PDF не найдена');
        return;
    }

    const originalText = pdfBtn.textContent;
    pdfBtn.disabled = true;
    pdfBtn.textContent = 'Генерация...';

    fetch('/create-pdf/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCSRFToken(),
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify(pdfData)
    })
    .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.blob();
    })
    .then(blob => {
        if (!blob || blob.size === 0) {
            throw new Error('Пустой ответ сервера');
        }
        downloadPDF(blob);
    })
    .catch(error => {
        console.error('Ошибка:', error);
        showToast('Ошибка создания PDF: ' + error.message, 'error', 'Ошибка');
    })
    .finally(() => {
        pdfBtn.disabled = false;
        pdfBtn.textContent = originalText;
    });
}

// Вспомогательная функция для обработки группы элементов
function processElementGroup(container, categoryName, groupedItems) {
    const articleSelect = container.querySelector('.combobox-art');
    const nameSelect = container.querySelector('.combobox-name');
    const priceSelect = container.querySelector('.combobox-price');
    const quantityInput = container.querySelector('.group-count-input');
    
    // Проверка, что комбобоксы существуют и имеют выбранное значение
    const hasSelectedArticle = articleSelect && 
                              articleSelect.selectedIndex >= 0 && 
                              articleSelect.options[articleSelect.selectedIndex] && 
                              articleSelect.options[articleSelect.selectedIndex].value;
    
    const hasSelectedName = nameSelect && 
                           nameSelect.selectedIndex >= 0 && 
                           nameSelect.options[nameSelect.selectedIndex] && 
                           nameSelect.options[nameSelect.selectedIndex].value;
    
    const hasSelectedPrice = priceSelect && 
                            priceSelect.selectedIndex >= 0 && 
                            priceSelect.options[priceSelect.selectedIndex] && 
                            priceSelect.options[priceSelect.selectedIndex].value;
    
    // Для отладки - логирование выбранных значений
    console.log('Обработка элемента в категории:', categoryName);
    if (articleSelect && hasSelectedArticle) {
        console.log('  Выбранный article:', articleSelect.options[articleSelect.selectedIndex].text);
    }
    if (nameSelect && hasSelectedName) {
        console.log('  Выбранный name:', nameSelect.options[nameSelect.selectedIndex].text);
    }
    if (priceSelect && hasSelectedPrice) {
        console.log('  Выбранный price:', priceSelect.options[priceSelect.selectedIndex].text);
    }
    if (quantityInput) {
        console.log('  quantity:', quantityInput.value);
    }
    
    // Для добавления в PDF нужно ИЛИ название И цена (минимально)
    if (hasSelectedName && hasSelectedPrice) {
        try {
            const article = hasSelectedArticle ? articleSelect.options[articleSelect.selectedIndex].text : '';
            const name = nameSelect.options[nameSelect.selectedIndex].text;
            
            const priceText = priceSelect.options[priceSelect.selectedIndex].text;
            
            // Очитка цен от символов, оставляем только число
            const priceValue = parseFloat(
                priceText.replace(/[^\d.,]/g, '')
                       .replace(',', '.')
            ) || 0;

            const quantity = quantityInput ? parseInt(quantityInput.value) || 1 : 1;

            // Уникальный ключ для группировки одинаковых позиций
            const itemKey = `${article}|${name}|${priceValue.toFixed(2)}`;
            
            if (groupedItems[itemKey]) {
                // Если позиция уже есть - увеличение количества
                groupedItems[itemKey].quantity += quantity;
                groupedItems[itemKey].total = (groupedItems[itemKey].price * groupedItems[itemKey].quantity).toFixed(2);
                console.log(`  Обновлена существующая позиция: ${name}, новое количество: ${groupedItems[itemKey].quantity}`);
            } else {
                // Новая позиция
                groupedItems[itemKey] = {
                    article: article,
                    name: name,
                    price: priceValue,
                    quantity: quantity,
                    total: (priceValue * quantity).toFixed(2),
                    category: categoryName
                };
                console.log(`  Добавлена новая позиция: ${name}, количество: ${quantity}, цена: ${priceValue}`);
            }

        } catch (e) {
            console.error('Ошибка обработки элемента:', e);
        }
    } else {
        console.log('  Пропущена группа - нет выбранных названия и цены');
        if (!hasSelectedName) console.log('    Нет выбранного названия');
        if (!hasSelectedPrice) console.log('    Нет выбранной цены');
    }
}

// Вспомогательная функция для скачивания PDF
function downloadPDF(blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ТКП_${new Date().toISOString().slice(0,10)}.pdf`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}
