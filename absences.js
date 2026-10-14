/*
 📊 MESH Absences & Dossier (v9.0)
 */
(function() {
    console.log("📊 MESH Absences v9.0: Режим взвешенного среднего балла");

    let isEnabled = true;
    const syncSettings = () => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
            chrome.storage.sync.get(['calcAttendance'], (data) => {
                if (data && data.calcAttendance !== undefined) isEnabled = data.calcAttendance;
            });
        }
    };
    syncSettings();

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((req) => {
            if (req.action === "updateSettings") syncSettings();
        });
    }

    const tooltip = document.createElement('div');
    tooltip.style.cssText = `
        position: fixed; display: none; z-index: 1000001;
        background: #111827; border: 1px solid #4b5563; border-radius: 12px;
        padding: 16px; color: white; font-family: -apple-system, system-ui, sans-serif;
        box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3); pointer-events: none;
        min-width: 260px; border-left: 4px solid #3b82f6;
    `;
    document.body.appendChild(tooltip);

    function parseStudentRow(row, targetElement) {
        let stats = { 
            n: 0, 
            sick: 0, 
            weightedSum: 0, 
            weightTotal: 0, 
            count: 0 
        };
        
        let cells = Array.from(row.querySelectorAll('[data-test-component*="markCell"]'));
        
        if (cells.length === 0 && targetElement) {
            const rect = targetElement.getBoundingClientRect();
            const centerY = rect.top + rect.height / 2;
            const allCells = Array.from(document.querySelectorAll('[data-test-component*="markCell"]'));
            cells = allCells.filter(c => {
                const r = c.getBoundingClientRect();
                return Math.abs((r.top + r.height / 2) - centerY) < 20; 
            });
        }
        
        cells.forEach(cell => {
            const attr = cell.getAttribute('data-test-component') || '';
            // Пропускаем системные ячейки итогов
            if (attr.includes('_average') || attr.includes('internalMark')) return;

            let clone = cell.cloneNode(true);
            clone.querySelectorAll('.visually-hidden, [aria-hidden="true"], [style*="display: none"]').forEach(el => el.remove());
            const text = clone.textContent.trim().toLowerCase();

            // Проверка на пропуски (н) или болезнь
            if (text.includes('н')) { stats.n++; return; }
            if (['б', 'у', 'п'].some(v => text.includes(v))) { stats.sick++; return; }

            // Логика взвешенной оценки:
            // Обычно первый span - оценка, второй - коэффициент (вес)
            const spans = cell.querySelectorAll('span');
            if (spans.length >= 1) {
                const grade = parseInt(spans[0].innerText.trim());
                // Если есть второй span - это вес, если нет - вес 1
                const weight = spans.length >= 2 ? parseInt(spans[spans.length - 1].innerText.trim()) : 1;

                if (!isNaN(grade) && grade >= 2 && grade <= 5) {
                    const finalWeight = isNaN(weight) ? 1 : weight;
                    stats.weightedSum += (grade * finalWeight);
                    stats.weightTotal += finalWeight;
                    stats.count++;
                }
            }
        });

        const avg = stats.weightTotal > 0 
            ? (stats.weightedSum / stats.weightTotal).toFixed(2) 
            : "0.00";

        return { ...stats, avg };
    }

    function getStudentName(row) {
        // Ищем span с атрибутом title
        const nameSpan = row.querySelector('span[title]');
        if (nameSpan) return nameSpan.getAttribute('title');

        // Иначе ищем span с текстом, игнорируя короткие цифры
        const spans = row.querySelectorAll('span');
        for (let s of spans) {
            const t = s.innerText.trim();
            if (t.length > 3 && isNaN(t)) return t;
        }
        return "Ученик";
    }

    function getStudentProfileId(row) {
        const cells = row.querySelectorAll('[data-test-component*="markCell"]');
        for (let cell of cells) {
            const attr = cell.getAttribute('data-test-component') || '';
            const match = attr.match(/markCell-(\d+)_/);
            if (match && match[1]) return match[1];
        }
        const rowAttrs = ['data-student-profile-id', 'data-student-id', 'data-profile-id'];
        for (let a of rowAttrs) {
            const val = row.getAttribute(a);
            if (val) return val;
        }
        return null;
    }

    let activeTooltipStudentId = null;

    document.addEventListener('mouseover', async (e) => {
        if (!isEnabled) return;

        const row = e.target.closest('tr, [role="row"]');
        if (!row) return;

        // Показываем тултип при наведении на имя или начало строки
        const isNameArea = e.target.closest('td:first-child') || e.target.hasAttribute('title');
        
        if (isNameArea) {
            const stats = parseStudentRow(row, e.target);
            if (stats.count === 0 && stats.n === 0 && stats.sick === 0) return;

            const name = getStudentName(row);
            const studentId = getStudentProfileId(row);
            activeTooltipStudentId = studentId;

            tooltip.innerHTML = `
                <div style="font-size:10px; text-transform:uppercase; color:#9ca3af; margin-bottom:8px; letter-spacing:1px;">Профиль ученика</div>
                <div style="font-weight:700; font-size:15px; margin-bottom:12px; color:#fff; border-bottom:1px solid #374151; padding-bottom:8px;">${name}</div>
                
                <div style="display:grid; grid-template-columns: 1fr auto; gap:8px; font-size:13px;">
                    <span style="color:#d1d5db;">Взвешенный балл:</span>
                    <b style="color:${stats.avg >= 4.5 ? '#10b981' : (stats.avg >= 3.5 ? '#fbbf24' : '#f87171')}; font-size:15px;">${stats.avg}</b>
                    
                    <span style="color:#d1d5db;">Пропуски (Н):</span>
                    <b style="color:#ef4444;">${stats.n}</b>
                    
                    <span style="color:#d1d5db;">По болезни / ЕМИАС:</span>
                    <b style="color:#3b82f6;">${stats.sick}</b>
                    
                    <span style="color:#d1d5db;">Сумма весов:</span>
                    <b style="color:#fff;">${stats.weightTotal}</b>
                </div>

                <div id="mesh-tooltip-attendance-row" style="margin-top:10px; padding-top:8px; border-top:1px solid #374151; font-size:12px; display:flex; justify-content:space-between; align-items:center;">
                    <span style="color:#9ca3af;">Сегодня в МЭШ:</span>
                    <b id="mesh-tooltip-visits-status" style="color:#10b981; font-size:12px;">Присутствует</b>
                </div>
                <div style="font-size:9px; color:#60a5fa; margin-top:4px; text-align:right;">Shift + Клик: полное досье пропусков</div>
                
                <div style="margin-top:8px; padding-top:8px; border-top:1px dashed #374151; font-size:10px; color:#6b7280; line-height:1.2;">
                    Расчет: (Оценка × Вес) / Сумма весов.<br>Игнорируются системные итоги.
                </div>
            `;
            tooltip.style.display = 'block';

            // Проверяем официальные пропуски и ЕМИАС из МЭШ
            if (studentId && window.MeshVisitsAPI) {
                const summary = window.MeshVisitsAPI.getStudentAttendanceSummary(studentId);
                const statusEl = document.getElementById('mesh-tooltip-visits-status');
                if (statusEl && summary) {
                    statusEl.innerText = summary.todayStatusText;
                    statusEl.style.color = summary.todayStatusColor;
                }
            }
        }
    });

    // Обработка Shift + Клик по имени ученика для открытия модального окна истории
    document.addEventListener('click', (e) => {
        if (!e.shiftKey) return;
        const row = e.target.closest('tr, [role="row"]');
        if (!row) return;

        const isNameArea = e.target.closest('td:first-child') || e.target.hasAttribute('title');
        if (isNameArea && window.MeshVisitsAPI) {
            const studentId = getStudentProfileId(row);
            const name = getStudentName(row);
            if (studentId) {
                e.preventDefault();
                e.stopPropagation();
                window.MeshVisitsAPI.showStudentVisitsHistory(studentId, name);
            }
        }
    }, true);

    document.addEventListener('mousemove', (e) => {
        if (tooltip.style.display === 'block') {
            tooltip.style.left = (e.clientX + 20) + 'px';
            tooltip.style.top = (e.clientY + 10) + 'px';
        }
    });

    document.addEventListener('mouseout', (e) => {
        if (e.target.tagName === 'TD' || e.target.tagName === 'SPAN') {
            activeTooltipStudentId = null;
            tooltip.style.display = 'none';
        }
    });
})();