import { initComboboxes, syncComboboxes } from './modules_for_results/comboboxes.js';
import { initDeleteButtons, initAddButtons } from './modules_for_results/groups.js';
import { initImageZoom } from './modules_for_results/image-zoom.js';
import { createPDF } from './modules_for_results/pdf.js';
import { initHomeButton } from './modules_for_results/init-home.js';
import { showCustomAlert } from './alerts.js';



document.addEventListener('DOMContentLoaded', function() {
    // Назначение обработчика для всех комбобоксов
    document.querySelectorAll('.combobox').forEach(combobox => {
        combobox.addEventListener('change', function() {
            // При изменении сначала синхронизируются связанные поля
            if (this.dataset.linked) {
                const linkedFields = this.dataset.linked.split(' ');
                linkedFields.forEach(field => {
                    const targetCombobox = this.closest('.combobox-row')
                        .querySelector(`.combobox-${field}`);
                    if (targetCombobox && targetCombobox.value !== this.value) {
                        targetCombobox.value = this.value;
                    }
                });
            }
            
            // Выполнение полной синхронизации
            syncComboboxes(this);
        });
        
        // Синхронизация начальных значений
        if (combobox.value) {
            syncComboboxes(combobox);
        }
    });
    initComboboxes();
    initHomeButton();
    initImageZoom();
    initDeleteButtons();
    initAddButtons();
    // Обработчик кнопки создания PDF
    document.getElementById('create-pdf')?.addEventListener('click', createPDF);
});