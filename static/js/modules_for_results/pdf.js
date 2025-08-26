import { getCSRFToken } from './utils.js';
import { showCustomAlert, showToast } from '../alerts.js';

export function createPDF() {
    //  Подготовка структуры данных для PDF
    const pdfData = {
        // Массив для хранения категорий и их элементов
        categories: [], 
        // Общая сумма (с "руб.")      
        total: "0.00 руб.",  
        // Сумма без НДС (с "руб.")
        total_without_vat: "0.00 руб.",
        // Сумма НДС (с "руб.")  
        vat_amount: "0.00 руб.",
        // Сумма с НДС (с "руб.")        
        total_with_vat: "0.00 руб."      
    };

    // Общая сумма для расчетов
    let grandTotal = 0; 
    // Общее количество элементов     
    let itemCount = 0; 
    // Счетчик для сквозной нумерации элементов      
    let itemCounter = 1;     

    // Словарь для группировки одинаковых позиций по артикулу
    const groupedItems = {};

    //  Обработка всех категорий на странице
    document.querySelectorAll('.category-section').forEach(section => {
        // Получение названия категории
        const categoryName = section.querySelector('.category-header').textContent.trim();

        // Обработка всех элементов в текущей категории
        section.querySelectorAll('.element-group').forEach(group => {
            // Получение DOM-элементов для текущего товара
            const articleSelect = group.querySelector('.combobox-art');
            const nameSelect = group.querySelector('.combobox-name');
            const priceSelect = group.querySelector('.combobox-price');
            const quantityInput = group.querySelector('.group-count-input');

            // Проверка, что элемент выбран 
            if (articleSelect && articleSelect.selectedIndex >= 0) {
                try {
                    // Извлечение данных о товаре
                    const article = articleSelect.options[articleSelect.selectedIndex].text;
                    const name = nameSelect ? nameSelect.options[nameSelect.selectedIndex]?.text : '';
                    
                    // Обработка цен (удаление все нечисловых символов и замена запятой на точку)
                    const priceText = priceSelect ? priceSelect.options[priceSelect.selectedIndex]?.text : '0';
                    const priceValue = parseFloat(
                        priceText.replace(/[^\d.,]/g, '')
                               .replace(',', '.')
                    ) || 0;

                    // Получение количества (по умолчанию 1)
                    const quantity = quantityInput ? parseInt(quantityInput.value) || 1 : 1;

                    // Группировка одинаковых позиций по артикулу
                    const itemKey = `${article}|${name}|${priceValue.toFixed(2)}`;
                    
                    if (groupedItems[itemKey]) {
                        // Если позиция уже существует, увеличиваем количество
                        groupedItems[itemKey].quantity += quantity;
                        groupedItems[itemKey].total = (groupedItems[itemKey].price * groupedItems[itemKey].quantity).toFixed(2);
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
                    }

                } catch (e) {
                    console.error('Ошибка обработки элемента:', e);
                }
            }
        });
    });

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
            price: item.price.toFixed(2),
            total: item.total
        });
        
        grandTotal += parseFloat(item.total);
        itemCount += item.quantity;
    });

    // Преобразование map в массив категорий
    for (const [categoryName, elements] of Object.entries(categoriesMap)) {
        pdfData.categories.push({
            name: categoryName,
            elements: elements
        });
    }

    //  Рассчет итоговой суммы
    if (itemCount > 0) {
        const totalWithoutVat = grandTotal;
        const vatAmount = grandTotal * 0.2;  // НДС 20%
        const totalWithVat = grandTotal + vatAmount;
        
        // Форматирование суммы для отображения (с "руб.")
        pdfData.total_without_vat = totalWithoutVat.toFixed(2) + ' руб.';
        pdfData.vat_amount = vatAmount.toFixed(2) + ' руб.';
        pdfData.total_with_vat = totalWithVat.toFixed(2) + ' руб.';
        pdfData.total = totalWithVat.toFixed(2) + ' руб.';
    }

    // Подготовка к отправке данных на сервер
    const pdfBtn = document.getElementById('create-pdf');
    if (!pdfBtn) {
        console.error('Кнопка создания PDF не найдена');
        return;
    }

    // Изменение состояния кнопки на время обработки
    const originalText = pdfBtn.textContent;
    pdfBtn.disabled = true;
    pdfBtn.textContent = 'Генерация...';

    // Отправка данных на сервер для генерации PDF
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
        // showCustomAlert('Ошибка создания PDF: ' + error.message, "Уведомление об ошибке")
        showToast('Ошибка создания PDF: ' + error.message, 'error', 'Ошибка');
    })
    .finally(() => {
        pdfBtn.disabled = false;
        pdfBtn.textContent = originalText;
    });
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