/**
 * 📊 MESH Absences & Dossier (v9.1 - Compact)
 * Исправлено: компактный вид, удалены даты пропусков.
 */
(function() {
    console.log("📊 MESH Absences v9.1: Компактный режим");

    let isEnabled = true;
    const syncSettings = () => {
        chrome.storage.sync.get(['calcAttendance'], (data) => {
            if (data && data.calcAttendance !== undefined) isEnabled = data.calcAttendance;
        });
    };
    syncSettings();

    chrome.runtime.onMessage.addListener((req) => {
        if (req.action === "updateSettings") syncSettings();
    });

    const tooltip = document.createElement('div');
    tooltip.style.cssText = `
        position: fixed; display: none; z-index: 1000001;
        background: rgba(17, 24, 39, 0.95); border: 1px solid #4b5563; border-radius: 8px;
        padding: 10px 14px; color: white; font-family: -apple-system, system-ui, sans-serif;
        box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3); pointer-events: none;
        min-width: 160px; border-left: 3px solid #3b82f6; backdrop-filter: blur(4px);
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
            if (attr.includes('_average') || attr.includes('internalMark')) return;

            let clone = cell.cloneNode(true);
            clone.querySelectorAll('.visually-hidden, [aria-hidden="true"], [style*="display: none"]').forEach(el => el.remove());
            const text = clone.textContent.trim().toLowerCase();

            if (text === 'н') { 
                stats.n++; 
                return; 
            }
            if (['б', 'у', 'п'].includes(text)) { stats.sick++; return; }

            const spans = cell.querySelectorAll('span');
            if (spans.length >= 1) {
                const grade = parseInt(spans[0].innerText.trim());
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
        const nameSpan = row.querySelector('span[title]');
        if (nameSpan) return nameSpan.getAttribute('title');

        const spans = row.querySelectorAll('span');
        for (let s of spans) {
            const t = s.innerText.trim();
            if (t.length > 3 && isNaN(t)) return t;
        }
        return "Ученик";
    }

    document.addEventListener('mouseover', (e) => {
        if (!isEnabled) return;

        const row = e.target.closest('tr, [role="row"]');
        if (!row) return;

        const isNameArea = e.target.closest('td:first-child') || e.target.hasAttribute('title');
        
        if (isNameArea) {
            const stats = parseStudentRow(row, e.target);
            if (stats.count === 0 && stats.n === 0 && stats.sick === 0) return;

            const name = getStudentName(row);

            tooltip.innerHTML = `
                <div style="font-weight:600; font-size:13px; margin-bottom:8px; color:#fff; border-bottom:1px solid #374151; padding-bottom:6px;">${name}</div>
                
                <div style="display:grid; grid-template-columns: 1fr auto; gap:4px 12px; font-size:12px;">
                    <span style="color:#d1d5db;">Ср. балл:</span>
                    <b style="color:${stats.avg >= 4.5 ? '#10b981' : (stats.avg >= 3.5 ? '#fbbf24' : '#f87171')};">${stats.avg}</b>
                    
                    <span style="color:#d1d5db;">Н (Пропуски):</span>
                    <b style="color:#ef4444;">${stats.n}</b>
                    
                    <span style="color:#d1d5db;">Б (Полезнь):</span>
                    <b style="color:#3b82f6;">${stats.sick}</b>
                </div>
            `;
            tooltip.style.display = 'block';
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (tooltip.style.display === 'block') {
            tooltip.style.left = (e.clientX + 15) + 'px';
            tooltip.style.top = (e.clientY + 15) + 'px';
        }
    });

    document.addEventListener('mouseout', (e) => {
        if (!e.relatedTarget) {
            tooltip.style.display = 'none';
            return;
        }
        const wasNameArea = e.target.closest('td:first-child') || e.target.hasAttribute('title');
        const isNowNameArea = e.relatedTarget.closest('td:first-child') || e.relatedTarget.hasAttribute('title');
        
        if (wasNameArea && !isNowNameArea) {
            tooltip.style.display = 'none';
        }
    });
})();