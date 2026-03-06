
// куки для генерации pdf
export function getCSRFToken() {
    return document.cookie
        .split('; ')
        .find(row => row.startsWith('csrftoken='))
        ?.split('=')[1] || '';
}


// Ограничения значений для добавления
export function shouldExclude(value, text) {
    const excludedValues = [
        "14.01.?", 
        "Текст не распознан(выберете ниже подходящий автоматический выключатель ESQ)", 
        "0.0 руб.",
        "",
        "undefined",
        "null"
    ];
    return excludedValues.includes(value) || excludedValues.includes(text);
}

// Получение всех данных от API для удобного добавления
export function getRecognitionData() {
    try {
        if (window.recognitionData) {
            console.log("Используем window.recognitionData");
            return { originalData: window.recognitionData };
        }

        const dataElement = document.getElementById('recognition-data');
        if (!dataElement) {
            console.warn("Элемент с данными не найден");
            return { originalData: {} };
        }

        const rawData = dataElement.dataset.original;
        if (!rawData) {
            return { originalData: {} };
        }

        const cleanData = rawData
            .replace(/\\u0022/g, '"')
            .replace(/\\"/g, '"');

        try {
            const parsed = JSON.parse(cleanData);
            return { originalData: parsed };
        } catch (e) {
            console.error("Ошибка парсинга:", {
                error: e,
                cleanData: cleanData.substring(0, 100)
            });
            return { originalData: {} };
        }
    } catch (error) {
        console.error("Ошибка в getRecognitionData:", error);
        return { originalData: {} };
    }
}