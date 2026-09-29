console.log("⚡ MESH Core Pro: Модуль Оценок (v15.1 - Strict URL Lock & Sniper)");

const SELECTORS = { tableRows: 'tr, [role="row"], .Dnevnik-grid-row' };

try {
    const s = document.createElement('script');
    s.src = chrome.runtime.getURL('interceptor.js');
    s.onload = function() { this.remove(); };
    (document.head || document.documentElement).appendChild(s);
} catch (e) {}

let extSettings = { autoGrader: true, highlightGrades: true };
let isRobotActive = false;
let globalGradeMode = "AUTO";
let isColumnPickerActive = false;
let meshAbortProcess = false; 
const cellStylesCache = new WeakMap(); 
let undoHistoryStack = []; 

let initInterval = setInterval(() => {
    if (document.body) {
        clearInterval(initInterval);
        injectMainCSS();
        chrome.storage.sync.get(null, (data) => {
            if (data) {
                if (data.autoGrader !== undefined) extSettings.autoGrader = data.autoGrader;
                if (data.highlightGrades !== undefined) extSettings.highlightGrades = data.highlightGrades;
            }
        });
        
        let speedmeshDebounceTimer = null;
        const triggerSpeedmeshUpdate = () => {
            if (!isRobotActive) { 
                if (!window.meshHasResumedAutoGrades) {
                    window.meshHasResumedAutoGrades = true;
                    let pendingStr = sessionStorage.getItem('SPEEDMESH_PENDING_GRADES');
                    if (pendingStr) {
                        try {
                            let pending = JSON.parse(pendingStr);
                            if (pending && pending.length > 0) {
                                setTimeout(() => {
                                    let restored = 0;
                                    pending.forEach(p => {
                                        let cell = document.querySelector(`[data-test-component="${p.attr}"]`);
                                        if (cell) {
                                            cell.dataset.robotTargetGrade = p.grade;
                                            restored++;
                                        }
                                    });
                                    if (restored > 0) {
                                        window.meshAutoResumeWeight = pending[0].weight;
                                        startSmartMatrixAPI(true);
                                    } else {
                                        sessionStorage.removeItem('SPEEDMESH_PENDING_GRADES');
                                    }
                                }, 2500);
                            }
                        } catch(e) {}
                    }
                }
                runCoreLogic(); 
                colorizeAverageGrades(); 
                document.dispatchEvent(new CustomEvent('SpeedmeshDOMReady'));
            }
        };

        const globalObserver = new MutationObserver(() => {
            clearTimeout(speedmeshDebounceTimer);
            speedmeshDebounceTimer = setTimeout(triggerSpeedmeshUpdate, 500);
        });
        globalObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
        triggerSpeedmeshUpdate();
    }
}, 50);

chrome.runtime.onMessage.addListener((req) => {
    if (req.action === "updateSettings") {
        extSettings = { ...extSettings, ...req.settings };
        if (extSettings.autoGrader === false) removePhantomsAndPanel();
    }
    if (req.action === "rollbackData") {
        localStorage.removeItem('MESH_ACHIEVEMENTS_PRO');
        localStorage.removeItem('MESH_ARCHITECT_RULES');
    }
});

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (undoHistoryStack.length > 0 && !isRobotActive) {
            e.preventDefault();
            let lastAction = undoHistoryStack[undoHistoryStack.length - 1]; 
            executeUndoDelete(lastAction.id, lastAction.badge, lastAction.cell);
        }
    }
});

document.addEventListener('click', (e) => {
    if (isRobotActive) return;

    const cell = e.target.closest('td, th, [role="gridcell"], [role="rowheader"]');
    
    // --- ВЫДЕЛЕНИЕ ПО ФИО (ЛАЗЕР) ---
    if (cell && !e.altKey) {
        const text = cell.innerText.trim();
        if (/^(?:\d+\s+)?[А-ЯЁ][а-яё\-]+\s+[А-ЯЁ][а-яё\-]+/.test(text) && !text.includes('Тема') && !text.includes('Итог')) {
            e.preventDefault(); 
            e.stopPropagation();

            let rect = cell.getBoundingClientRect();
            let centerY = rect.top + rect.height / 2;

            let allPhantoms = Array.from(document.querySelectorAll('.mesh-phantom-grade'));
            
            let rowPhantoms = allPhantoms.filter(ph => {
                let pr = ph.getBoundingClientRect();
                return Math.abs((pr.top + pr.height / 2) - centerY) < 5; 
            });

            if (rowPhantoms.length === 0) return;

            let leftBound = rect.right;
            let rightBound = window.innerWidth;
            
            let visiblePhantoms = rowPhantoms.filter(ph => {
                let pr = ph.getBoundingClientRect();
                return pr.left >= leftBound && pr.right <= rightBound;
            });

            visiblePhantoms.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);

            if (visiblePhantoms.length === 0) return;

            let allCells = Array.from(document.querySelectorAll('td, [role="gridcell"]')).filter(c => {
                let r = c.getBoundingClientRect();
                return r.width > 0 && Math.abs((r.top + r.height / 2) - centerY) < 5 && r.left >= leftBound && r.right <= rightBound;
            });
            allCells.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);

            let rightLimitX = rightBound; 
            
            for (let c of allCells) {
                let bgNode = c.querySelector('div') || c;
                let bg = window.getComputedStyle(bgNode).backgroundColor;
                if (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') {
                    bg = window.getComputedStyle(c).backgroundColor;
                }
                let m = bg.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                if (m) {
                    let r = parseInt(m[1]), g = parseInt(m[2]), b = parseInt(m[3]);
                    if (r > 220 && g > 220 && b < 200) {
                        rightLimitX = c.getBoundingClientRect().right; 
                        break;
                    }
                }
            }

            let validPhantoms = visiblePhantoms.filter(ph => ph.getBoundingClientRect().left <= rightLimitX);

            let targetPhantoms = validPhantoms.slice(-5);
            if (targetPhantoms.length === 0) return;

            const allActive = targetPhantoms.every(ph => ph.dataset.active === 'true');
            
            let gradeRow = targetPhantoms[0].closest('tr, [role="row"]');
            let suggested = gradeRow ? Math.round(getSuggestedFromRow(gradeRow)) : 5;
            if (suggested < 2) suggested = 2; if (suggested > 5) suggested = 5;

            targetPhantoms.forEach(ph => {
                ph.dataset.active = allActive ? 'false' : 'true';
                if (ph.dataset.active === 'true') {
                    ph.dataset.grade = globalGradeMode === "AUTO" ? suggested.toString() : globalGradeMode;
                }
                updatePhantomVisuals(ph, ph.parentElement);
            });
            
            let activeCount = document.querySelectorAll('.mesh-phantom-grade[data-active="true"]').length;
            drawRobotPanel(activeCount);
            return;
        }
    }

    // --- УДАЛЕНИЕ ОЦЕНКИ (ALT+CLICK) ---
    if (e.altKey) {
        let cellAlt = e.target.closest('[data-test-component*="markCell"]');
        if (cellAlt) {
            e.preventDefault(); e.stopPropagation();
            let attr = cellAlt.getAttribute('data-test-component');
            let parts = attr.replace('markCell-', '').split('_');
            const studentId = parts[0]; const lessonId = parts[1];
            let map = JSON.parse(window.sessionStorage.getItem('MESH_MARKS_MAP') || '{}');
            let markId = map[`${studentId}_${lessonId}`];
            
            if (markId) {
                let visualTarget = cellAlt.querySelector('div, span, p') || cellAlt;
                executeUndoDelete(markId, visualTarget, cellAlt);
            } else {
                alert("🕵️‍♂️ ID этой оценки не найден в кэше браузера.\nПожалуйста, удалите её штатным способом МЭШ.");
            }
        }
    }
}, true);

async function executeUndoDelete(markId, visualElement, cell) {
    if(!confirm('СбросТочно удалить эту оценку?')) return;
    let originalHTML = visualElement.innerHTML; let originalBg = visualElement.style.background;
    visualElement.innerHTML = "⏳"; visualElement.style.background = "#f39c12"; visualElement.style.color = "white";

    const tk = document.cookie.match(/(?:^|; )aupd_token=([^;]*)/); const pr = document.cookie.match(/(?:^|; )profile_id=([^;]*)/);
    const aupd_token = tk ? decodeURIComponent(tk[1]) : null; const profile_id = pr ? decodeURIComponent(pr[1]) : null;
    if (!aupd_token || !profile_id) return alert("Ошибка авторизации. Обновите страницу.");

    try {
        const res = await fetch(`https://school.mos.ru/api/profeducation/core/teacher/v1/marks/${markId}`, {
            method: "DELETE", headers: { "Accept": "application/json", "Authorization": `Bearer ${aupd_token}`, "Profile-Id": profile_id, "x-mes-subsystem": "journalw" }
        });
        if (res.ok) {
            visualElement.innerHTML = "🗑️"; visualElement.style.background = "#7f8c8d";
            undoHistoryStack = undoHistoryStack.filter(item => item.id !== markId);
            setTimeout(() => { visualElement.remove(); runCoreLogic(); }, 1000);
        } else {
            visualElement.innerHTML = "❌"; visualElement.style.background = "#e74c3c";
            setTimeout(() => { visualElement.innerHTML = originalHTML; visualElement.style.background = originalBg; }, 2000);
        }
    } catch(e) {
        visualElement.innerHTML = "❌"; setTimeout(() => { visualElement.innerHTML = originalHTML; visualElement.style.background = originalBg; }, 2000);
    }
}

function removePhantomsAndPanel() {
    document.querySelectorAll('.mesh-phantom-grade').forEach(el => el.remove());
    document.querySelectorAll('.mesh-col-selectable').forEach(el => el.classList.remove('mesh-col-selectable', 'mesh-col-selected'));
    document.querySelectorAll('[data-robot-target-grade]').forEach(el => el.removeAttribute('data-robot-target-grade'));
    let p = document.getElementById('mesh-robot-panel'); if (p) p.style.display = 'none';
    isColumnPickerActive = false;
}

function colorizeAverageGrades() {
    if (!extSettings.highlightGrades) return;
    document.querySelectorAll('td, [role="cell"], [role="gridcell"]').forEach(cell => {
        const text = cell.innerText.trim();
        if (/^[2-5][.,]\d{1,2}$/.test(text) && !cell.dataset.meshColored) {
            let fAvg = parseFloat(text.replace(',', '.'));
            let color = '#c0392b'; 
            if (fAvg >= 4.5) color = '#27ae60'; else if (fAvg >= 3.5) color = '#3498db'; else if (fAvg >= 2.5) color = '#f39c12'; 
            let target = cell.querySelector('div, span') || cell;
            target.style.setProperty('color', color, 'important'); target.style.setProperty('font-weight', 'bold', 'important'); cell.dataset.meshColored = "true";
        }
    });
}

function injectMainCSS() {
    if (document.getElementById('mesh-injected-styles')) return;
    const style = document.createElement('style'); style.id = 'mesh-injected-styles';
    style.innerHTML = `
        .mesh-phantom-grade { background-color: #3498db !important; color: white !important; border-radius: 4px !important; padding: 3px 7px !important; font-weight: bold !important; font-size: 11px !important; box-shadow: 0 0 10px rgba(52, 152, 219, 0.6) !important; position: absolute !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) !important; z-index: 10 !important; cursor: pointer; user-select: none; }
        .mesh-phantom-grade:hover { transform: translate(-50%, -50%) scale(1.15) !important; }
        .mesh-phantom-dormant { background-color: transparent !important; color: transparent !important; box-shadow: none !important; border: 1px dashed rgba(52, 152, 219, 0.4) !important; opacity: 0; transition: 0.2s; }
        td:hover .mesh-phantom-dormant, [data-test-component]:hover .mesh-phantom-dormant { opacity: 1; color: #3498db !important; background-color: rgba(52, 152, 219, 0.1) !important; }
        th.mesh-col-selectable { cursor: cell !important; box-shadow: inset 0 0 0 3px #3498db !important; background-color: rgba(52, 152, 219, 0.1) !important; transition: 0.2s; position: relative !important; }
        th.mesh-col-selectable:hover { background-color: rgba(52, 152, 219, 0.25) !important; }
        th.mesh-col-selected { box-shadow: inset 0 0 0 3px #2ecc71 !important; background-color: rgba(46, 204, 113, 0.25) !important; }
        #mesh-robot-panel { position: fixed !important; bottom: 30px !important; left: 50% !important; transform: translateX(-50%) !important; background: #1e272e !important; color: white !important; padding: 15px 25px !important; border-radius: 12px !important; box-shadow: 0 10px 30px rgba(0,0,0,0.6) !important; z-index: 2147483647 !important; display: flex !important; align-items: center !important; gap: 20px !important; font-family: "Segoe UI", sans-serif !important; border: 1px solid #34495e !important; transition: 0.3s !important; }
        .api-success-badge { background:#27ae60 !important; color:#fff !important; border-radius:6px !important; padding:4px 8px !important; font-weight:bold !important; font-size:12px !important; box-shadow: 0 0 10px rgba(46,204,113,0.6) !important; position: absolute !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) !important; z-index: 99 !important; display:inline-block !important; }
        .api-error-badge { background:#e74c3c !important; color:#fff !important; border-radius:6px !important; padding:4px 8px !important; font-weight:bold !important; font-size:11px !important; position: absolute !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) !important; z-index: 99 !important; cursor:help;}
    `;
    document.head.appendChild(style);
}

function findDateColumnHeaders() {
    const results = [];
    document.querySelectorAll('th, [role="columnheader"], [class*="HeaderCell"], [data-test-component*="header"]').forEach(cell => {
        const rect = cell.getBoundingClientRect();
        if (rect.width === 0) return;
        if (/\d{1,2}/.test(cell.textContent) && !/итог|ср|тем/i.test(cell.textContent)) results.push(cell);
    });
    return results;
}

function startColumnPicker() {
    let headers = findDateColumnHeaders();
    if (headers.length === 0) return alert("Не удалось найти столбцы с датами.");
    isColumnPickerActive = true;
    headers.forEach(h => { h.classList.add('mesh-col-selectable'); h.onclick = (e) => { e.preventDefault(); e.stopPropagation(); h.classList.toggle('mesh-col-selected'); }; });
    runCoreLogic(); 
}

function cancelColumnPicker() {
    document.querySelectorAll('.mesh-col-selectable').forEach(h => { h.classList.remove('mesh-col-selectable', 'mesh-col-selected'); h.onclick = null; });
    isColumnPickerActive = false; runCoreLogic();
}

function applyColumnPicker() {
    let selectedHeaders = Array.from(document.querySelectorAll('.mesh-col-selected'));
    let activeColumnsX = selectedHeaders.map(th => { let r = th.getBoundingClientRect(); return { x: r.left + r.width / 2, width: r.width }; });
    cancelColumnPicker();

    if (activeColumnsX.length > 0) {
        document.querySelectorAll('.mesh-phantom-grade').forEach(ph => {
            let targetForPhantom = ph.parentElement;
            let c = targetForPhantom.closest('td, [role="gridcell"]') || targetForPhantom;
            
            let r = targetForPhantom.getBoundingClientRect();
            if (r.width > 0) {
                let cx = r.left + r.width / 2;
                let match = activeColumnsX.some(col => Math.abs(cx - col.x) < col.width * 0.45);
                if (match) {
                    let row = c.closest('tr, [role="row"], .Dnevnik-grid-row') || c.closest('div.TableRow') || c.parentElement.closest('tr');
                    let fAvg = row ? getSuggestedFromRow(row) : 0;
                    let suggested = Math.round(fAvg); if (suggested < 2) suggested = 2; if (suggested > 5) suggested = 5;
                    
                    ph.dataset.active = 'true';
                    ph.dataset.grade = globalGradeMode === "AUTO" ? suggested.toString() : globalGradeMode;
                    updatePhantomVisuals(ph, c);
                }
            }
        });
        runCoreLogic();
    }
}

function isTotalColumn(td) {
    let cache = window.currentHeaderCache || [];
    let tdRect = td.getBoundingClientRect();
    if (tdRect.width === 0) return false;
    let tdCenter = tdRect.left + tdRect.width / 2;
    let matchedHeader = cache.find(h => tdCenter >= h.left && tdCenter <= h.right);
    if (matchedHeader) {
        let txt = matchedHeader.text;
        if (txt.includes('итог') || txt.includes('ср. балл') || txt.includes('по теме') || txt.includes('ср.') || txt === 'ср') {
            return true;
        }
    }
    return false;
}

function isCellUnlocked(el) {
    let innerDiv = el.hasAttribute('data-test-component') ? el : el.querySelector('[data-test-component*="markCell"]');
    if (innerDiv) {
        let disabledAttr = innerDiv.getAttribute('data-disabled-by');
        if (disabledAttr === 'NOT_DISABLED') return true;
        if (disabledAttr) return false;
    }

    if (el.className && typeof el.className === 'string' && el.className.match(/(disabled|locked|readonly|grey|not-participate)/i)) return false;
    if (isTotalColumn(el)) return false;

    if (!cellStylesCache.has(el)) {
        let locked = false;
        let targetBg = innerDiv ? window.getComputedStyle(innerDiv).backgroundColor : window.getComputedStyle(el).backgroundColor;
        if (targetBg) {
            const rgbMatch = targetBg.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            if (rgbMatch) {
                const r = parseInt(rgbMatch[1]), g = parseInt(rgbMatch[2]), b = parseInt(rgbMatch[3]);
                if (r >= 230 && r <= 250 && Math.abs(r-g) <= 10 && Math.abs(g-b) <= 10) locked = true;
                if (r === 242 && g === 242 && b === 242) locked = true;
            }
        }
        cellStylesCache.set(el, locked);
    }
    return !cellStylesCache.get(el); 
}

function getSuggestedFromRow(row) {
    let fAvg = 0;
    row.querySelectorAll('span, div, p, td').forEach(cell => { const text = cell.textContent.trim(); if (/^[2-5][.,]\d{1,2}$/.test(text)) fAvg = parseFloat(text.replace(',', '.')); });
    return fAvg;
}

function isAbsenceModeActive() {
    const activeToggles = document.querySelectorAll('.ant-radio-button-wrapper-checked, .ant-segmented-item-selected');
    for (let toggle of activeToggles) {
        const text = toggle.innerText ? toggle.innerText.toLowerCase() : '';
        if (text.includes('отсутстви')) return true;
        if (text.includes('расширенный')) return false;
    }
    return false;
}

function runCoreLogic() {
    // ⚡ МЯГКАЯ ПРИВЯЗКА (учитываем изменения URL в МЭШ)
    if (!extSettings.autoGrader || !window.location.href.includes('/journal') || isAbsenceModeActive()) { 
        removePhantomsAndPanel(); 
        return; 
    }

    let headers = Array.from(document.querySelectorAll('th, [role="columnheader"]'));
    window.currentHeaderCache = headers.map(h => ({ left: h.getBoundingClientRect().left, right: h.getBoundingClientRect().right, text: h.innerText.toLowerCase() }));

    const markCells = Array.from(document.querySelectorAll('[data-test-component*="markCell"]'));
    if (markCells.length === 0) {
        // Фоллбек на старый селектор, если нет маркселлов
        const rowsOld = document.querySelectorAll(SELECTORS.tableRows);
        if (rowsOld.length === 0) { removePhantomsAndPanel(); return; }
    }

    // Собираем уникальные строки по родителям ячеек
    let rowSet = new Set();
    markCells.forEach(c => {
        let row = c.closest('tr, [role="row"], .Dnevnik-grid-row') || c.closest('div.TableRow') || c.parentElement.closest('tr');
        if (row) rowSet.add(row);
    });
    
    // Если строки через маркселлы не нашлись, пробуем старый метод
    let rowsToProcess = Array.from(rowSet);
    if (rowsToProcess.length === 0) {
        rowsToProcess = Array.from(document.querySelectorAll(SELECTORS.tableRows));
    }

    let activePhantomsCount = 0;

    rowsToProcess.forEach(row => {
        // Убрана проверка row.offsetHeight, так как React может давать 0
        let fAvg = getSuggestedFromRow(row);
        let suggested = Math.round(fAvg); if (suggested < 2) suggested = 2; if (suggested > 5) suggested = 5;

        // Ищем ячейки внутри строки
        let cells = Array.from(row.querySelectorAll('td, [role="gridcell"]'));
        if (cells.length === 0) cells = Array.from(row.querySelectorAll('[data-test-component*="markCell"]')).map(mc => mc.parentElement);
        
        cells.forEach(c => {
            let hasRealContent = false;
            let markCell = c.hasAttribute('data-test-component') ? c : c.querySelector('[data-test-component*="markCell"]');
            if (markCell) {
                if (/[2-5НнБбОо]/.test(markCell.textContent)) hasRealContent = true;
            } else {
                for (let node of c.childNodes) {
                    if (node.nodeType === 3 && node.nodeValue.trim() !== '') { hasRealContent = true; break; }
                    if (node.nodeType === 1 && !node.classList.contains('mesh-phantom-grade') && !node.classList.contains('api-success-badge') && node.textContent.trim() !== '') { hasRealContent = true; break; }
                }
            }

            if (hasRealContent) {
                let existing = c.querySelector('.mesh-phantom-grade');
                if (existing) existing.remove(); c.removeAttribute('data-robot-target-grade'); return;
            }

            if (!isCellUnlocked(c)) return;

            let targetForPhantom = c; // КРЕПИМ К TD, Т.К. markCell МОЖЕТ БЫТЬ 0x0
            let ph = targetForPhantom.querySelector('.mesh-phantom-grade');
            if (!ph) {
                ph = document.createElement('div'); ph.className = 'mesh-phantom-grade mesh-phantom-dormant'; ph.textContent = '+'; ph.dataset.active = 'false'; 
                ph.style.pointerEvents = 'auto'; // Гарантируем кликабельность
                ph.style.zIndex = '2147483647'; // Поверх любых прозрачных щитов МЭШ
                if (window.getComputedStyle(targetForPhantom).position === 'static') targetForPhantom.style.position = 'relative';
                targetForPhantom.appendChild(ph);
            }
            if (ph.dataset.active === 'true') activePhantomsCount++;
        });
    });

    drawRobotPanel(activePhantomsCount);
}

function updatePhantomVisuals(ph, cell) {
    let isActive = ph.dataset.active === 'true';
    ph.className = 'mesh-phantom-grade ' + (isActive ? '' : 'mesh-phantom-dormant'); ph.textContent = isActive ? ph.dataset.grade : '+';
    if (isActive) cell.dataset.robotTargetGrade = ph.dataset.grade; else cell.removeAttribute('data-robot-target-grade');
}

function updateGlobalGrades() {
    document.querySelectorAll('.mesh-phantom-grade').forEach(ph => {
        if (ph.dataset.active === 'true') {
            if (globalGradeMode !== "AUTO") ph.dataset.grade = globalGradeMode;
            else { let row = ph.closest('tr, [role="row"]'); let fAvg = getSuggestedFromRow(row); let suggested = Math.round(fAvg); if (suggested < 2) suggested = 2; if (suggested > 5) suggested = 5; ph.dataset.grade = suggested.toString(); }
            updatePhantomVisuals(ph, ph.parentElement);
        }
    });
}

function bindReloadButtons(panel) {
    panel.querySelectorAll('.mesh-panel-reload-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.preventDefault();
            window.location.reload();
        };
    });
}

function drawRobotPanel(count) {
    let p = document.getElementById('mesh-robot-panel');
    if (!p) { p = document.createElement('div'); p.id = 'mesh-robot-panel'; document.body.appendChild(p); }
    p.style.display = 'flex';

    const reloadBtnHtml = `
        <div style="width:1px; height:30px; background:rgba(255,255,255,0.1); margin: 0 5px;"></div>
        <button class="mesh-panel-reload-btn" title="Обновить страницу" style="background:#27ae60; color:white; border:none; border-radius:8px; padding:10px 15px; cursor:pointer; font-weight:bold; transition:0.2s; box-shadow:0 4px 15px rgba(39, 174, 96, 0.4);" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">Обновить</button>
    `;

    if (isColumnPickerActive) {
        p.innerHTML = `
            <div style="font-size:15px; font-weight:bold; color:#f1c40f;">🎯 Кликайте по датам (заголовкам) в таблице</div>
            <div style="display:flex; gap:10px; margin-left:15px;">
                <button id="mesh-cp-apply" style="background:#27ae60; color:white; border:none; padding:8px 15px; border-radius:6px; cursor:pointer; font-weight:bold;">✅ Применить авто-оценки</button>
                <button id="mesh-cp-cancel" style="background:#e74c3c; color:white; border:none; padding:8px 15px; border-radius:6px; cursor:pointer; font-weight:bold;">❌ Отмена</button>
                ${reloadBtnHtml}
            </div>
        `;
        document.getElementById('mesh-cp-apply').onclick = applyColumnPicker; 
        document.getElementById('mesh-cp-cancel').onclick = cancelColumnPicker; 
        bindReloadButtons(p);
        return;
    }

    if (count === 0) {
        p.innerHTML = `
            <div style="font-size:13px; display:flex; flex-direction:column; gap:4px; padding-right:15px; border-right: 1px solid rgba(255,255,255,0.1);">
                <div style="color:#bdc3c7;">Кликните по <b>ФИО</b> или нажмите +</div>
            </div>
            <div style="display:flex; gap:10px; align-items:center;">
                <button id="mesh-cp-start" style="background:#34495e; color:white; border:none; padding:8px 15px; border-radius:6px; cursor:pointer; font-weight:bold; margin-left:10px;">📅 Выбрать столбцы</button>
                ${reloadBtnHtml}
            </div>
        `;
        document.getElementById('mesh-cp-start').onclick = startColumnPicker;
        bindReloadButtons(p);
    } else {
        // Если панель УЖЕ отрисована для count > 0, просто обновляем цифру!
        let countEl = document.getElementById('mesh-robot-count');
        if (countEl && document.getElementById('mesh-global-grade')) {
            countEl.innerText = count;
            return; // НЕ ПЕРЕРИСОВЫВАЕМ ИНТЕРФЕЙС, ИНАЧЕ ЗАКРОЕТСЯ ВЫПАДАЮЩЕЕ МЕНЮ
        }

        p.innerHTML = `
            <div style="font-size:13px; display:flex; flex-direction:column; gap:4px; padding-right:15px; border-right: 1px solid rgba(255,255,255,0.1);">
                <div>К отправке: <b id="mesh-robot-count" style="color:#3498db; font-size:16px;">${count}</b></div>
            </div>
            <div style="display:flex; gap:10px; align-items:center; margin-left:10px;">
                <button id="mesh-cp-start" title="Добавить столбцы" style="background:#34495e; color:white; border:none; border-radius:6px; padding:8px 10px; cursor:pointer;">Столбцы</button>
                <select id="mesh-global-grade" title="Применить ко всем выделенным" style="background:#2c2c2e; color:white; border:1px solid #3498db; border-radius:8px; padding:8px; outline:none; cursor:pointer; font-weight:bold;">
                    <option value="AUTO" ${globalGradeMode==="AUTO"?"selected":""}>Средний балл</option> <option value="5" ${globalGradeMode==="5"?"selected":""}>Всем 5</option> <option value="4" ${globalGradeMode==="4"?"selected":""}>Всем 4</option> <option value="3" ${globalGradeMode==="3"?"selected":""}>Всем 3</option> <option value="2" ${globalGradeMode==="2"?"selected":""}>Всем 2</option>
                </select>
                <select id="mesh-global-weight" title="Вес оценки" style="background:#2c2c2e; color:white; border:1px solid #9b59b6; border-radius:8px; padding:8px; outline:none; cursor:pointer; font-weight:bold;">
                    <option value="2" selected>Вес 2 (Практ. работа)</option>
                    <option value="1">Вес 1 (Ответ на уроке)</option>
                </select>
                <button id="mesh-robot-btn" style="background:#3498db; color:white; border:none; border-radius:6px; padding:10px 15px; cursor:pointer; font-weight:bold;">Отправить в МЭШ</button>
                <button id="mesh-reset-btn" title="Сбросить выделение" style="background:#e74c3c; color:white; border:none; border-radius:6px; padding:8px 10px; cursor:pointer;">Сброс</button>
                ${reloadBtnHtml}
            </div>
        `;
        document.getElementById('mesh-cp-start').onclick = startColumnPicker;
        document.getElementById('mesh-reset-btn').onclick = () => { document.querySelectorAll('.mesh-phantom-grade').forEach(ph => { ph.dataset.active = 'false'; updatePhantomVisuals(ph, ph.parentElement); }); runCoreLogic(); };
        document.getElementById('mesh-global-grade').onchange = (e) => { globalGradeMode = e.target.value; updateGlobalGrades(); };
        document.getElementById('mesh-robot-btn').onclick = startSmartMatrixAPI;
        bindReloadButtons(p);
    }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function startSmartMatrixAPI(isAutoResume = false) {
    if (isAutoResume instanceof Event) isAutoResume = false;

    let cells = Array.from(document.querySelectorAll('[data-robot-target-grade]'));
    if (cells.length === 0) {
        sessionStorage.removeItem('SPEEDMESH_PENDING_GRADES');
        if (!isAutoResume) alert("Нет выбранных оценок!");
        return;
    }

    const wDropdown = document.getElementById('mesh-global-weight');
    const selectedWeight = wDropdown ? parseInt(wDropdown.value, 10) : (window.meshAutoResumeWeight || 2);

    if (isAutoResume !== true) {
        if (!confirm(`🚀 Отправить оценки в МЭШ?\n\nВыбранный вес: ${selectedWeight}\n\nПродолжить?`)) return;
    }

    isRobotActive = true; 
    meshAbortProcess = false; 

    let pendingToSave = cells.map(c => {
        let attrNode = c.hasAttribute('data-test-component') ? c : c.querySelector('[data-test-component*="markCell"]');
        return { attr: attrNode ? attrNode.getAttribute('data-test-component') : null, grade: c.dataset.robotTargetGrade, weight: selectedWeight };
    }).filter(x => x.attr);
    sessionStorage.setItem('SPEEDMESH_PENDING_GRADES', JSON.stringify(pendingToSave));
    
    const p = document.getElementById('mesh-robot-panel');
    if(p) { 
        p.innerHTML = `
            <div style="font-size:15px; text-align:center; width:100%; display:flex; align-items:center; justify-content:center; gap:15px;">
                <span>Отправка... <b id="mesh-robot-count" style="color:#2ecc71;">0 / ${cells.length}</b></span>
                <button id="mesh-robot-btn-stop" style="background:#e74c3c; color:white; border:none; border-radius:8px; padding:6px 15px; cursor:pointer; font-weight:bold; transition:0.2s;">Остановить</button>
                <div style="width:1px; height:30px; background:rgba(255,255,255,0.1); margin: 0 5px;"></div>
                <button class="mesh-panel-reload-btn" title="Обновить страницу" style="background:#27ae60; color:white; border:none; border-radius:8px; padding:6px 15px; cursor:pointer; font-weight:bold; transition:0.2s;">Обновить</button>
            </div>`;
        document.getElementById('mesh-robot-btn-stop').addEventListener('click', function() {
            meshAbortProcess = true; this.innerText = "🛑 Остановка..."; this.style.background = "#c0392b"; this.style.pointerEvents = "none";
        });
        bindReloadButtons(p);
    }

    let ok = 0; let err = 0; let firstFatalErrorLog = null; let winningGsId = null; 
    let aupd_token = null; let profile_id = null; let meshStolenHeaders = {};
    const tk = document.cookie.match(/(?:^|; )aupd_token=([^;]*)/); const pr = document.cookie.match(/(?:^|; )profile_id=([^;]*)/);
    if(tk) aupd_token = decodeURIComponent(tk[1]); if(pr) profile_id = decodeURIComponent(pr[1]);
    try { meshStolenHeaders = JSON.parse(window.sessionStorage.getItem('MESH_KTP_HEADERS') || "{}"); let auth = meshStolenHeaders['Authorization'] || meshStolenHeaders['authorization']; if(auth && auth.includes('Bearer ')) aupd_token = auth.replace('Bearer ', ''); let pId = meshStolenHeaders['Profile-Id'] || meshStolenHeaders['profile-id'] || meshStolenHeaders['Profile-id']; if(pId) profile_id = pId; } catch(e) {}

    if (!aupd_token || !profile_id) { alert("❌ Ошибка авторизации. Перехват токена не удался. Обновите страницу (F5)."); isRobotActive = false; return; }

    let stolenWeight2CfId = null; let stolenWeight1CfId = null; let allPageCfIds = new Set();
    document.querySelectorAll('[data-test-component*="markCell"]').forEach(cell => {
        let attr = cell.getAttribute('data-test-component');
        let match = attr.match(/markCell[-_]\d+_\d+_(\d+)/);
        if (match) {
            let cfId = parseInt(match[1], 10);
            allPageCfIds.add(cfId);
            let text = cell.innerText.replace(/\s+/g, '');
            if (/[2-5НнБб]2$/.test(text) || cell.querySelector('sub, [class*="weight"]')?.innerText.includes('2')) stolenWeight2CfId = cfId;
            else stolenWeight1CfId = cfId;
        }
    });

    let localDb = { grade_system_ids: [], control_forms: [] };
    try { const stored = window.sessionStorage.getItem('MESH_GLOBAL_DB'); if (stored) localDb = JSON.parse(stored); } catch(e) {}

    for (let i = 0; i < cells.length; i++) {
        if (meshAbortProcess) break;

        const cell = cells[i]; const gradeStr = cell.dataset.robotTargetGrade;
        if(p) { let counter = document.getElementById('mesh-robot-count'); if (counter) counter.innerText = `${i+1} / ${cells.length}`; }
        
        cell.scrollIntoView({ behavior: "smooth", block: "center" });
        const ph = cell.querySelector('.mesh-phantom-grade'); if (ph) ph.style.display = 'none';
        
        let attrNode = cell.hasAttribute('data-test-component') ? cell : cell.querySelector('[data-test-component*="markCell"]');
        let attr = attrNode ? attrNode.getAttribute('data-test-component') : null;

        if (attr) {
            let parts = attr.replace('markCell-', '').split('_');
            const studentId = parseInt(parts[0], 10); const lessonId = parseInt(parts[1], 10);
            let domCfId = parts[2] !== "null" && parts[2] !== "undefined" ? parseInt(parts[2], 10) : null;

            let cfs = []; 
            let currentWeightToUse = selectedWeight;
            if (isAutoResume === true && typeof pendingToSave !== 'undefined') {
                let savedEntry = pendingToSave.find(p => p.attr === attr);
                if (savedEntry && savedEntry.weight) currentWeightToUse = savedEntry.weight;
            }

            // ПРИОРИТЕТ 1: Точно известная форма контроля для выбранного веса
            if (currentWeightToUse === 2 && stolenWeight2CfId) cfs.push(stolenWeight2CfId);
            if (currentWeightToUse === 1 && stolenWeight1CfId) cfs.push(stolenWeight1CfId);
            
            // ПРИОРИТЕТ 2: Дефолтная форма, привязанная к ячейке (если не добавлена ранее)
            if (domCfId && !cfs.includes(domCfId)) cfs.push(domCfId);
            
            // ПРИОРИТЕТ 3: Все остальные формы на странице
            Array.from(allPageCfIds).forEach(id => { if (!cfs.includes(id)) cfs.push(id); });
            if (localDb.control_forms) { [...localDb.control_forms].reverse().forEach(cf => { if (!cfs.includes(cf)) cfs.push(cf); }); }
            
            // ПРИОРИТЕТ 4: null (иногда МЭШ сам назначает)
            if (currentWeightToUse === 1 && !cfs.includes(null)) cfs.push(null); 

            let gsIds = [...new Set([...localDb.grade_system_ids, 50365, 35133, 40166])]; 
            if (winningGsId !== null) gsIds = [winningGsId, ...gsIds.filter(id => id !== winningGsId)];

            let combosToTry = [];
            for (let cf of cfs) { for (let gs of gsIds) combosToTry.push({ w: currentWeightToUse, gs: gs, c: cf }); } 

            let success = false; let lastErrTxt = ""; let returnedMarkId = null;

            for (let combo of combosToTry) {
                if (meshAbortProcess) break; 
                try {
                    let reqHeaders = { "Accept": "application/json", "Content-Type": "application/json", "Authorization": `Bearer ${aupd_token}`, "Profile-Id": profile_id, ...meshStolenHeaders, "x-mes-subsystem": "journalw" };
                    const payload = { "comment": "", "is_exam": false, "is_criterion": false, "is_point": false, "point_date": "", "schedule_lesson_id": lessonId, "student_profile_id": studentId, "teacher_id": parseInt(profile_id, 10), "control_form_id": combo.c, "weight": combo.w, "theme_frame_integration_id": null, "course_lesson_topic_id": null, "grade_origins": [{"grade_origin": gradeStr, "grade_system_id": combo.gs}], "grade_system_type": false };
                    const res = await fetch("https://school.mos.ru/api/profeducation/core/teacher/v1/marks", { method: "POST", headers: reqHeaders, body: JSON.stringify(payload) });
                    if (res.ok) { 
                        success = true; winningGsId = combo.gs; 
                        try { const resData = await res.json(); returnedMarkId = resData.id || (Array.isArray(resData) && resData[0] ? resData[0].id : null); } catch(e) {}
                        break; 
                    } else { 
                        lastErrTxt = await res.text(); 
                        if (res.status === 401 || res.status === 403 || res.status === 500 || res.status === 502) {
                            console.warn("Auto-reloading page due to API error...", res.status);
                            window.location.reload();
                            return;
                        }
                    }
                } catch (e) { 
                    lastErrTxt = e.message; 
                    console.warn("Network error, reloading...", e);
                    window.location.reload();
                    return; 
                }
            }

            if (success) { 
                ok++; 
                try {
                    pendingToSave = pendingToSave.filter(p => p.attr !== attr);
                    sessionStorage.setItem('SPEEDMESH_PENDING_GRADES', JSON.stringify(pendingToSave));
                } catch(e) {}
                let badge = document.createElement('div'); 
                badge.className = 'api-success-badge'; 
                badge.innerHTML = `✅ ${gradeStr}`;
                
                if (window.getComputedStyle(cell).position === 'static') cell.style.position = 'relative';
                
                Array.from(cell.children).forEach(child => { if (child.style) child.style.opacity = '0'; });
                
                if (returnedMarkId) {
                    badge.title = "Кликните, чтобы удалить (Отмена)"; 
                    badge.style.cursor = "pointer";
                    badge.onclick = (e) => { e.preventDefault(); e.stopPropagation(); executeUndoDelete(returnedMarkId, badge, cell); };
                    undoHistoryStack.push({ id: returnedMarkId, badge: badge, cell: cell });
                }
                
                cell.appendChild(badge);
            } 
            else { 
                err++; 
                let errBadge = document.createElement('div');
                errBadge.className = 'api-error-badge';
                errBadge.title = lastErrTxt;
                errBadge.innerHTML = '❌';
                if (window.getComputedStyle(cell).position === 'static') cell.style.position = 'relative';
                cell.appendChild(errBadge);
                if (err === 1) firstFatalErrorLog = { server_response: lastErrTxt }; 
            }
        } else { err++; (cell.querySelector('div') || cell).innerHTML = `<div class="api-error-badge">❌ Сбой</div>`; }
        cell.removeAttribute('data-robot-target-grade'); if (ph) ph.remove(); 
        await sleep(10); // Сверхбыстрая отправка
    }
    
    isRobotActive = false;
    sessionStorage.removeItem('SPEEDMESH_PENDING_GRADES');

    if (err > 0 && firstFatalErrorLog && ok === 0) {
        let logText = JSON.stringify(firstFatalErrorLog, null, 2); console.error("🔥 Ошибка сервера:\n", logText); prompt(`Сервер отклонил оценки. Лог ошибки:\n\n`, logText);
    } else if (p) {
        p.innerHTML = `
            <div style="font-size:16px; font-weight:bold; color:#2ecc71; margin-right: 10px;">✅ Выставлено: ${ok} шт.</div>
            <button class="mesh-panel-reload-btn" style="background:#2ecc71; color:white; border:none; border-radius:8px; padding:10px 20px; cursor:pointer; font-weight:bold; font-size:14px; box-shadow: 0 4px 15px rgba(46, 204, 113, 0.4); transition: 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">ОбновитьОбновить (Синхронизация с МЭШ)</button>
        `;
        bindReloadButtons(p);
    }
}
// === ГЛОБАЛЬНЫЙ ПЕРЕХВАТЧИК КЛИКОВ (EVENT DELEGATION) ===
// Позволяет обойти любые блокировки React и z-index
document.addEventListener('mousedown', (e) => {
    let ph = e.target.closest('.mesh-phantom-grade');
    if (!ph) return;
    
    e.preventDefault(); 
    e.stopPropagation(); 
    
    let c = ph.closest('td, [role="gridcell"]') || ph.parentElement;
    let row = c.closest('tr, [role="row"], .Dnevnik-grid-row') || c.closest('div.TableRow') || c.parentElement.closest('tr');
    let fAvg = row ? getSuggestedFromRow(row) : 0;
    let suggested = Math.round(fAvg); if (suggested < 2) suggested = 2; if (suggested > 5) suggested = 5;

    if (e.button === 0) { 
        if (ph.dataset.active === 'false') { 
            ph.dataset.active = 'true'; 
            ph.dataset.grade = globalGradeMode === "AUTO" ? suggested.toString() : globalGradeMode; 
        } else { 
            let g = parseInt(ph.dataset.grade); 
            g--; 
            if (g < 2) g = 5; 
            ph.dataset.grade = g.toString(); 
        } 
    } else if (e.button === 2) { 
        ph.dataset.active = 'false'; 
    }
    updatePhantomVisuals(ph, c); 
    runCoreLogic(); 
}, { capture: true });

document.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.mesh-phantom-grade')) e.preventDefault();
}, { capture: true });


// --- АВТО-ПЕРЕИМЕНОВАНИЕ ВКЛАДКИ ---
setInterval(() => {
    if (!window.location.href.includes('/journal')) return;

    const fullText = document.body.innerText || "";
    // Захватываем основную часть в match[1], а хвост вроде "-25" игнорируем
    const match = fullText.match(/([А-ЯЁA-Z]{2,5}-?\d{2,4})(?:-\d{1,2})?|\b(\d{1,2}\s*["']?[А-ЯЁA-Z]["']?)\b/);
    
    if (match) {
        const newTitle = match[1] || match[2];
        if (document.title !== newTitle) {
            document.title = newTitle;
        }
    }
}, 3000);
