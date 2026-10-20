(function() {
    console.log("🎲 MESH Randomizer: Загружен (Строгая привязка к Журналу)");

    if (!document.getElementById('mesh-randomizer-styles')) {
        const s = document.createElement('style');
        s.id = 'mesh-randomizer-styles';
        s.innerHTML = `
            @keyframes mesh-pulse-overlay {
                0% { background-color: rgba(155, 89, 182, 0.4); box-shadow: inset 0 2px 0 #9b59b6, inset 0 -2px 0 #9b59b6; }
                100% { background-color: rgba(155, 89, 182, 0); box-shadow: inset 0 0 0 transparent; }
            }
            html body .mesh-highlight-winner { position: relative !important; }
            html body .mesh-highlight-winner::after {
                content: "" !important; position: absolute !important;
                top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important;
                pointer-events: none !important; z-index: 99 !important;
                animation: mesh-pulse-overlay 4s ease-out forwards !important;
            }
            html body td.mesh-highlight-winner:first-child::after,
            html body th.mesh-highlight-winner:first-child::after {
                border-left: 5px solid #9b59b6 !important;
            }
        `;
        document.head.appendChild(s);
    }

    let isEnabled = true;
    let lastTargetCells = []; 
    let resetTimeout = null;
    let removeClassTimeout = null;

    chrome.storage.sync.get(['randomizerMode'], (data) => {
        if (data && data.randomizerMode === false) isEnabled = false;
    });

    chrome.runtime.onMessage.addListener((req) => {
        if (req.action === "updateSettings" && req.settings.randomizerMode !== undefined) {
            isEnabled = req.settings.randomizerMode;
        }
    });

    // ⚡ Постоянно проверяем URL, чтобы кнопка показывалась ТОЛЬКО в журнале
    document.addEventListener('SpeedmeshDOMReady', () => {
        const btn = document.getElementById('mesh-randomizer-btn');
        const isJournal = window.location.href.includes('journal');

        if (isEnabled && isJournal) {
            if (!btn) initRandomizer();
            else btn.style.display = 'flex';
        } else {
            if (btn) btn.style.display = 'none';
        }
    });

    function initRandomizer() {
        if (document.getElementById('mesh-randomizer-btn')) return;
        
        const btn = document.createElement('div');
        btn.id = 'mesh-randomizer-btn';
        
        btn.style.cssText = `
            position: fixed; bottom: 30px; left: 30px; background: rgba(20, 25, 30, 0.65); backdrop-filter: blur(16px);
            color: white; border: 1px solid rgba(255,255,255,0.15); border-radius: 16px;
            padding: 12px 24px; font-size: 14px; font-weight: bold;
            font-family: "Segoe UI", sans-serif; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            cursor: pointer; z-index: 2147483646; display: flex; align-items: center; justify-content: center;
            gap: 10px; transition: all 0.3s ease; user-select: none;
        `;
        
        btn.innerHTML = `<span id="mesh-randomizer-text" style="pointer-events: none; display: flex; gap: 10px;"><span>🎲</span> Кого спросить?</span>`;
        
        btn.onmouseover = () => { btn.style.transform = 'scale(1.05)'; };
        btn.onmouseout = () => { btn.style.transform = 'scale(1)';  };

        btn.onclick = (e) => {
            const allNameCells = Array.from(document.querySelectorAll('td, th, [role="gridcell"], [role="rowheader"]')).filter(c => {
                const t = c.innerText.trim();
                return /^(?:\d+\s+)?[А-ЯЁ][а-яё\-]+\s+[А-ЯЁ][а-яё\-]+/.test(t) && !t.includes('Тема') && !t.includes('Итог');
            });

            if (allNameCells.length > 0) {
                if (lastTargetCells.length > 0) {
                    clearTimeout(removeClassTimeout);
                    lastTargetCells.forEach(c => c.classList.remove('mesh-highlight-winner'));
                    lastTargetCells = [];
                }

                // УМНАЯ ЛОГИКА ОЦЕНКИ
                let candidates = [];
                let hasSmartMatch = false;

                allNameCells.forEach(cell => {
                    let weight = 10;
                    let row = cell.closest('tr');
                    let isBorderline = false;
                    let reason = "";

                    if (row) {
                        // 1. Ищем средний балл (наш кастомный атрибут или текст)
                        let avgText = row.getAttribute('data-mesh-average') || "";
                        if (!avgText) {
                            let avgEl = row.querySelector('.mesh-sticky-avg');
                            if (avgEl) avgText = avgEl.innerText;
                        }
                        
                        if (avgText) {
                            let avg = parseFloat(avgText.replace(',', '.'));
                            // Если балл спорный (например, 2.5-2.65, 3.5-3.65, 4.5-4.65)
                            if ((avg >= 2.50 && avg <= 2.65) || (avg >= 3.50 && avg <= 3.65) || (avg >= 4.50 && avg <= 4.65)) {
                                weight += 50;
                                isBorderline = true;
                                reason = `Спорная оценка (${avgText})`;
                                hasSmartMatch = true;
                            }
                        }

                        // 2. Ищем пустые ячейки за последние 3-4 урока
                        let cells = Array.from(row.querySelectorAll('td'));
                        let recentEmpty = 0;
                        for (let i = cells.length - 1; i >= Math.max(0, cells.length - 5); i--) {
                            if (cells[i].innerText.trim() === '') recentEmpty++;
                        }
                        if (recentEmpty >= 3) {
                            weight += 20;
                            if (!reason) reason = "Мало оценок";
                        }
                    }

                    candidates.push({ cell, weight, reason });
                });

                // Взвешенный рандом
                let totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
                let rand = Math.random() * totalWeight;
                let winner = candidates[0];
                for (let c of candidates) {
                    if (rand < c.weight) { winner = c; break; }
                    rand -= c.weight;
                }

                const winnerCell = winner.cell;
                winnerCell.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                let row = winnerCell.closest('tr');
                let rowKey = row ? row.getAttribute('data-row-key') : null;
                let targetRows = rowKey ? Array.from(document.querySelectorAll(`tr[data-row-key="${rowKey}"]`)) : [row];

                targetRows.forEach(tr => {
                    Array.from(tr.querySelectorAll('td, th')).forEach(td => lastTargetCells.push(td));
                });
                if (lastTargetCells.length === 0) lastTargetCells = [winnerCell];

                lastTargetCells.forEach(c => void c.offsetWidth); 
                lastTargetCells.forEach(c => c.classList.add('mesh-highlight-winner'));
                
                const nameText = winnerCell.innerText.replace(/^\d+\s+/, '').trim();
                const textSpan = document.getElementById('mesh-randomizer-text');
                
                if (textSpan) {
                    if (winner.reason) {
                        textSpan.innerHTML = `<div style="display:flex; flex-direction:column; line-height:1.2;"><span style="color: #e056fd;">🎯 ${nameText}</span><span style="font-size:10px; color:#f39c12; font-weight:normal;">🧠 ${winner.reason}</span></div>`;
                    } else {
                        textSpan.innerHTML = `<span style="color: #e056fd;">🎯 ${nameText}</span>`;
                    }
                }
                
                clearTimeout(resetTimeout);
                resetTimeout = setTimeout(() => { if(textSpan) textSpan.innerHTML = `<span>🎲</span> Кого спросить?`; }, winner.reason ? 4500 : 3000);

                const currentCells = lastTargetCells;
                removeClassTimeout = setTimeout(() => { currentCells.forEach(c => c.classList.remove('mesh-highlight-winner')); }, winner.reason ? 5000 : 4000);

            } else {
                const textSpan = document.getElementById('mesh-randomizer-text');
                if (textSpan) textSpan.innerHTML = `❌ Ученики не найдены`;
                clearTimeout(resetTimeout);
                resetTimeout = setTimeout(() => { if(textSpan) textSpan.innerHTML = `<span>🎲</span> Кого спросить?`; }, 2000);
            }
        };

        document.body.appendChild(btn);
        
        // Подключаем Window Manager для перемещения и сворачивания!
        setTimeout(() => { if (window.makeMeshDraggable) window.makeMeshDraggable(btn, "🎲"); }, 500);
    }
})();