// ==========================================
// 🔮 MESH Grade Calculator (v4.0 - Анти-Конфликт)
// ==========================================
(function() {
    console.log("🔮 [Калькулятор] Загружен. Включена защита от автооценок и фантомных букв.");

    // 1. Изолируем ячейки среднего балла от модуля Автооценок (CSS инъекция)
    const style = document.createElement('style');
    style.textContent = `
        .mesh-avg-cell *[class*="auto-grade"], .mesh-avg-cell *[id*="auto-grade"] { display: none !important; }
        .mesh-avg-cell { position: relative; z-index: 50; }
        /* ВАЖНО: Отключаем перехват мыши у самого окна калькулятора, чтобы оно не моргало */
        #mesh-grade-calculator { pointer-events: none !important; } 
    `;
    document.head.appendChild(style);

    let tooltip = null;
    let isCalcEnabled = true;

    function createTooltip() {
        if (tooltip) return;
        tooltip = document.createElement('div');
        tooltip.id = 'mesh-grade-calculator';
        tooltip.style.cssText = `
            position: absolute; background: rgba(15, 23, 42, 0.95); color: #fff;
            padding: 10px 14px; border-radius: 8px; border-left: 4px solid #8b5cf6;
            font-family: 'Inter', sans-serif; font-size: 12px; z-index: 9999999;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3); backdrop-filter: blur(5px); 
            opacity: 0; transition: opacity 0.2s; white-space: nowrap;
        `;
        document.body.appendChild(tooltip);
    }

    function calculateNeeded(currentAvg, totalWeight, targetAvg, gradeValue) {
        let currentSum = currentAvg * totalWeight;
        let needed = (targetAvg * totalWeight - currentSum) / (gradeValue - targetAvg);
        return Math.ceil(needed);
    }

    function showTooltip(e, avgStr, row) {
        let avg = parseFloat(avgStr.replace(',', '.'));
        if (isNaN(avg)) return;

        let totalWeight = 0; 
        
        let markCells = row.querySelectorAll('[data-test-component*="markCell-"], .mark-text');
        
        markCells.forEach(cell => {
            let clone = cell.cloneNode(true);
            
            // Жестко вырезаем весь скрытый мусор МЭШ (невидимые "Б", "Н" и прочее)
            clone.querySelectorAll('.visually-hidden, [aria-hidden="true"], [style*="display: none"]').forEach(el => el.remove());

            let text = clone.textContent.trim().toUpperCase();
            
            // Превращаем маленькие индексы-веса в нормальные цифры
            text = text.replace(/[₁₂₃₄₅₆₇₈₉]/g, char => '123456789'['₁₂₃₄₅₆₇₈₉'.indexOf(char)]);

            // Бронебойная регулярка: ищем только ОЦЕНКУ (2-5) и сразу за ней возможный ВЕС (любая цифра)
            // Игнорирует "Н", "Б", пробелы и любой другой текст
            let regex = /([2345])\s*(\d)?/g;
            let match;
            
            // Проходимся циклом, так как в одной ячейке может стоять сразу две оценки (например "5 4")
            while ((match = regex.exec(text)) !== null) {
                let weight = match[2] ? parseInt(match[2]) : 1; // Если веса нет, он равен 1
                totalWeight += weight; // Плюсуем ВЕС, а не просто количество
            }
        });

        if (totalWeight === 0) totalWeight = 10; // Предохранитель от деления на ноль

        let text = `<div style="font-weight:bold; margin-bottom:6px; color:#8b5cf6;">🔮 Прогноз оценок</div>`;
        
        if (avg >= 4.5) {
            text += `🏆 <b>Уже отлично!</b> (Пятёрка в кармане)`;
        } else if (avg >= 3.5 && avg < 4.5) {
            let fives = calculateNeeded(avg, totalWeight, 4.5, 5);
            text += `До твердой <b>"5"</b> нужно: <b>${fives}</b> пятёрок<br>`;
            text += `<span style="color:#94a3b8; font-size:10px;">(Учтенный вес оценок: ${totalWeight})</span>`;
        } else if (avg >= 2.5 && avg < 3.5) {
            let fours = calculateNeeded(avg, totalWeight, 3.5, 4);
            let fives = calculateNeeded(avg, totalWeight, 3.5, 5);
            text += `До <b>"4"</b> нужно: <b>${fives}</b> пятёрок ИЛИ <b>${fours}</b> четвёрок<br>`;
            text += `<span style="color:#94a3b8; font-size:10px;">(Учтенный вес оценок: ${totalWeight})</span>`;
        } else {
            let threes = calculateNeeded(avg, totalWeight, 2.5, 3);
            text += `Для спасения на <b>"3"</b> нужно: <b>${threes}</b> троек (или выше)<br>`;
            text += `<span style="color:#94a3b8; font-size:10px;">(Учтенный вес оценок: ${totalWeight})</span>`;
        }

        tooltip.innerHTML = text;
        tooltip.style.opacity = '1';
        
        // Умное позиционирование с защитой краев экрана
        const rect = e.target.getBoundingClientRect();
        let topPos = window.scrollY + rect.top - tooltip.offsetHeight - 10;
        let leftPos = window.scrollX + rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2);

        if (leftPos + tooltip.offsetWidth > window.innerWidth - 20) leftPos = window.innerWidth - tooltip.offsetWidth - 20;
        if (leftPos < 20) leftPos = 20;
        if (topPos < window.scrollY + 20) topPos = window.scrollY + rect.bottom + 10;

        tooltip.style.top = topPos + 'px';
        tooltip.style.left = leftPos + 'px';
    }

    function hideTooltip() { if (tooltip) tooltip.style.opacity = '0'; }

    function attachListeners() {
        createTooltip();
        const cells = document.querySelectorAll('span, div, td');
        
        cells.forEach(cell => {
            if (cell.dataset.calcAttached) return;
            
            let text = cell.innerText.trim();
            // Ищем ячейку со средним баллом (формат 4.50)
            if (/^\d[.,]\d{2}$/.test(text) && cell.closest('tr')) { 
                cell.dataset.calcAttached = "true";
                cell.style.cursor = "help";
                cell.style.borderBottom = "1px dashed #8b5cf6";
                
                // ЗАЩИТА ОТ КОНФЛИКТА:
                let parentTd = cell.closest('td');
                if (parentTd) {
                    parentTd.classList.add('mesh-avg-cell'); // Вешаем метку для CSS
                    // Запрещаем событиям мыши пробиваться к Автооценкам
                    parentTd.addEventListener('mouseenter', (e) => e.stopPropagation());
                }
                
                cell.addEventListener('mouseenter', (e) => {
                    if (!isCalcEnabled) return;
                    e.stopPropagation();
                    showTooltip(e, text, cell.closest('tr'));
                });
                
                cell.addEventListener('mouseleave', hideTooltip);
            }
        });
    }

    function applyCalcState(enabled) {
        isCalcEnabled = enabled;
        if (enabled) {
            document.querySelectorAll('[data-calc-attached]').forEach(cell => {
                cell.style.cursor = "help";
                cell.style.borderBottom = "1px dashed #8b5cf6";
            });
            attachListeners();
        } else {
            hideTooltip();
            document.querySelectorAll('[data-calc-attached]').forEach(cell => {
                cell.style.cursor = "";
                cell.style.borderBottom = "";
            });
        }
    }

    chrome.runtime.onMessage.addListener((req) => {
        if (req.action === "updateSettings" && req.settings && req.settings.calculatorMode !== undefined) {
            applyCalcState(req.settings.calculatorMode !== false);
        }
    });

    function initCalc() {
        chrome.storage.sync.get(['calculatorMode'], (data) => {
            applyCalcState(data.calculatorMode !== false);
        });
    }

    document.addEventListener('SpeedmeshDOMReady', initCalc);
    setTimeout(initCalc, 2000); 
})();
