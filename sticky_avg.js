// ==========================================
// 📌 MESH Sticky Average (Native CSS Sticky Engine)
// ==========================================
(function() {
    console.log("%c📌 [Sticky Average] V3.0: Native CSS Engine.", "color: #ffaa00; font-size: 16px; font-weight: bold;");

    function getInheritedBackgroundColor(el) {
        let current = el;
        while (current) {
            const bg = window.getComputedStyle(current).backgroundColor;
            if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
                return bg;
            }
            current = current.parentElement;
        }
        return '#ffffff';
    }

    function normalizeText(text) {
        return text.toLowerCase().replace(/c/g, 'с').replace(/p/g, 'р').trim();
    }

    function pinAverageColumns() {
        const allWrappers = document.querySelectorAll('.ant-table, .Dnevnik-grid, table[role="table"], table[role="grid"]');
        const wrappersToProcess = Array.from(allWrappers).filter(wrapper => {
            return !Array.from(allWrappers).some(parent => parent !== wrapper && parent.contains(wrapper));
        });

        wrappersToProcess.forEach(gridWrapper => {
            const ths = Array.from(gridWrapper.querySelectorAll('th, [role="columnheader"], .ant-table-thead .ant-table-cell'));
            if (ths.length === 0) return;

            const thData = ths.map(th => ({
                th,
                rect: th.getBoundingClientRect(),
                text: normalizeText(th.textContent || '')
            })).filter(d => d.rect.width > 0);

            if (thData.length === 0) return;

            thData.sort((a, b) => b.rect.right - a.rect.right);

            const columns = [];
            thData.forEach(d => {
                const lastCol = columns[columns.length - 1];
                if (!lastCol || Math.abs(lastCol.rightEdge - d.rect.right) > 5) {
                    columns.push({
                        rightEdge: d.rect.right,
                        width: d.rect.width,
                        headers: [d]
                    });
                } else {
                    lastCol.headers.push(d);
                    lastCol.width = Math.max(lastCol.width, d.rect.width);
                }
            });

            const targetColumns = [];
            for (const col of columns) {
                let colIsTarget = false;
                for (const h of col.headers) {
                    const txt = h.text;
                    const targetWords = [
                        'итог', 'средн', 'оценк', 'аттест', 'балл', 
                        'период', 'четверт', 'триместр', 'полугоди', 
                        'год', 'модул', 'экзамен', 'рубеж',
                        'i', 'ii', 'iii', 'iv', 'v'
                    ];
                    const hasSr = txt.includes('ср.') || txt.includes('ср балл') || txt.includes('ср.балл');
                    const isJustNumber = /^\d+$/.test(txt);
                    
                    if (targetWords.some(w => txt.includes(w)) || hasSr || isJustNumber) {
                        colIsTarget = true;
                    }
                }
                if (colIsTarget) {
                    targetColumns.push(col);
                }
            }

            if (targetColumns.length === 0) return;

            const allRows = Array.from(gridWrapper.querySelectorAll('tr, [role="row"], .Dnevnik-grid-row, .ant-table-row'));
            const bodyRows = allRows.filter(row => !row.closest('thead') && !row.closest('.ant-table-thead') && row.querySelectorAll('th').length === 0);

            let rightOffset = 0;
            targetColumns.forEach((col, index) => {
                col.headers.forEach(h => {
                    const el = h.th;
                    el.dataset.meshSticky = 'true';
                    el.style.setProperty('position', 'sticky', 'important');
                    el.style.setProperty('right', `${rightOffset}px`, 'important');
                    el.style.setProperty('z-index', '100', 'important');
                    el.style.setProperty('background-color', `var(--mesh-sticky-header-bg, ${getInheritedBackgroundColor(el)})`, 'important');
                    el.style.setProperty('box-shadow', '-5px 0 10px rgba(0,0,0,0.05)', 'important');
                });

                bodyRows.forEach(tr => {
                    const tds = Array.from(tr.querySelectorAll('td, [role="gridcell"], .ant-table-cell'));
                    if (tds.length < targetColumns.length) return;
                    
                    const targetTd = tds[tds.length - 1 - index];
                    if (targetTd) {
                        targetTd.dataset.meshSticky = 'true';
                        targetTd.style.setProperty('position', 'sticky', 'important');
                        targetTd.style.setProperty('right', `${rightOffset}px`, 'important');
                        targetTd.style.setProperty('z-index', '99', 'important');
                        targetTd.style.setProperty('background-color', `var(--mesh-sticky-bg, ${getInheritedBackgroundColor(targetTd)})`, 'important');
                    }
                });
                rightOffset += col.width;
            });
        });
    }

    // Слушаем глобальную шину событий вместо setInterval

    function unpinAverageColumns() {
        document.querySelectorAll('[data-mesh-sticky="true"]').forEach(el => {
            delete el.dataset.meshSticky;
            el.style.removeProperty('position');
            el.style.removeProperty('right');
            el.style.removeProperty('z-index');
            el.style.removeProperty('background-color');
            el.style.removeProperty('box-shadow');
        });
    }

    chrome.runtime.onMessage.addListener((req) => {
        if (req.action === "updateSettings" && req.settings && req.settings.stickyMode !== undefined) {
            if (req.settings.stickyMode !== false) pinAverageColumns();
            else unpinAverageColumns();
        }
    });

    function initSticky() {
        chrome.storage.sync.get(['stickyMode'], (data) => {
            if (data.stickyMode !== false) {
                pinAverageColumns();
            } else {
                unpinAverageColumns();
            }
        });
    }

    document.addEventListener('SpeedmeshDOMReady', initSticky);
    setTimeout(initSticky, 2000);
})();
