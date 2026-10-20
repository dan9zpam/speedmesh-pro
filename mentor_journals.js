// mentor_journals.js
(function() {
    let initInterval = setInterval(() => {
        if (!document.body) return;
        const isMentorJournals = window.location.href.includes('spo/teacher/mentor/journals');
        
        let p = document.getElementById('speedmesh-mentor-panel');
        if (!isMentorJournals) {
            if (p) p.remove();
            return;
        }

        if (p) {
            // Update group count if it changed
            let groupsStr = window.sessionStorage.getItem('MESH_MENTOR_GROUPS');
            if (groupsStr && p.dataset.groups !== groupsStr) {
                p.remove(); // Force recreate to update count
            } else {
                return;
            }
        }

        // Try to read groups from sessionStorage (saved by interceptor)
        let groupsStr = window.sessionStorage.getItem('MESH_MENTOR_GROUPS');
        let groups = [];
        if (groupsStr) {
            try { 
                let rawGroups = JSON.parse(groupsStr); 
                groups = rawGroups.filter(g => {
                    // 1. Официальный флаг метагруппы
                    if (g.is_metagroup) return false;
                    // 2. Если привязано больше одного класса
                    if (g.class_unit_ids && g.class_unit_ids.length > 1) return false;
                    
                    // 3. Проверка по названию на несколько номеров ИСП или РУПО
                    let normName = (g.name || "").toUpperCase().replace(/\s+/g, '');
                    let matches = normName.match(/(?:ИСП|РУПО)\d+/g) || [];
                    let uniqueGroups = new Set(matches);
                    if (uniqueGroups.size > 1) return false;
                    
                    return true;
                });
            } catch(e){}
        }

        const panel = document.createElement('div');
        panel.id = 'speedmesh-mentor-panel';
        panel.dataset.groups = groupsStr || '';
        panel.style.cssText = "position:fixed; bottom:20px; left:20px; z-index:9999999; background:rgba(20, 25, 30, 0.85); border: 1px solid #9b59b6; color:white; padding:15px; border-radius:12px; display:flex; flex-direction:column; gap:10px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); backdrop-filter: blur(10px); font-family: sans-serif;";
        
        let title = document.createElement('div');
        title.innerHTML = `📚 Журналы куратора <br><span style="font-size:11px; color:#bdc3c7;">Найдено групп: ${groups.length}</span>`;
        title.style.cssText = "font-size:14px; font-weight:bold; color:#9b59b6; text-align:center; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:5px;";
        panel.appendChild(title);

        function getMentorAuthContext() {
            let aupd_token = null;
            let profile_id = localStorage.getItem('MES_API_PROFILE_ID') || null;
            let aid = localStorage.getItem('MES_API_YEAR_ID') || null;
            let hostId = "63";
            let roleId = "30";

            const tk = document.cookie.match(/(?:^|; )aupd_token=([^;]*)/); 
            if (tk) aupd_token = decodeURIComponent(tk[1]); 

            const pr = document.cookie.match(/(?:^|; )profile_id=([^;]*)/);
            if (pr && !profile_id) profile_id = decodeURIComponent(pr[1]);

            const aidCookie = document.cookie.match(/(?:^|; )aid=([^;]*)/);
            if (aidCookie && !aid) aid = decodeURIComponent(aidCookie[1]);

            const roleMatch = document.cookie.match(/(?:^|; )aupd_current_role=([^;]*)/);
            if (roleMatch) {
                let parts = decodeURIComponent(roleMatch[1]).split(":");
                if (parts.length === 2) {
                    hostId = parts[0];
                    roleId = parts[1];
                }
            }

            try {
                let meshStolenHeaders = JSON.parse(window.sessionStorage.getItem('MESH_KTP_HEADERS') || "{}");
                let auth = meshStolenHeaders['Authorization'] || meshStolenHeaders['authorization'];
                if (!aupd_token && auth && auth.includes('Bearer ')) aupd_token = auth.replace('Bearer ', '');
                let pId = meshStolenHeaders['Profile-Id'] || meshStolenHeaders['profile-id'] || meshStolenHeaders['Profile-id'];
                if (!profile_id && pId) profile_id = pId;
            } catch(e) {}
            
            let reqHeaders = { 
                "Accept": "application/json, text/plain, */*", 
                "x-mes-subsystem": "teacherspow",
                "x-mes-hostid": hostId,
                "X-Mes-RoleId": roleId
            };
            if (aupd_token) reqHeaders["Authorization"] = `Bearer ${aupd_token}`;
            if (profile_id) reqHeaders["Profile-Id"] = profile_id;
            if (aid) reqHeaders["aid"] = aid;

            let currentYear = new Date().getFullYear();
            let month = new Date().getMonth(); 
            let yearStart = month < 7 ? currentYear - 1 : currentYear;
            let yearEnd = yearStart + 1;
            let startAt = `${yearStart}-09-01T00:00:00.000Z`;
            let stopAt = `${yearEnd}-08-31T00:00:00.000Z`;

            return { reqHeaders, yearStart, yearEnd, startAt, stopAt };
        }

        if (groups.length > 0) {
            let btn = document.createElement('button');
            btn.innerText = '⬇️ Скачать все журналы (' + groups.length + ')';
            btn.style.cssText = "background:#27ae60; color:white; border:none; padding:8px 12px; border-radius:6px; cursor:pointer; font-weight:bold; transition:0.2s;";
            btn.onmouseover = () => btn.style.transform = 'scale(1.05)';
            btn.onmouseout = () => btn.style.transform = 'scale(1)';
            
            btn.onclick = async () => {
                btn.innerText = '⏳ Подготовка...';
                btn.style.pointerEvents = 'none';
                
                const { reqHeaders, yearStart, yearEnd, startAt, stopAt } = getMentorAuthContext();

                let debugLog = {
                    hasJSZip: typeof JSZip !== 'undefined',
                    hasWindowJSZip: typeof window.JSZip !== 'undefined',
                    downloaded: 0,
                    failed: 0,
                    errors: []
                };

                // Инициализируем архиватор
                let zip = null;
                if (typeof JSZip !== 'undefined') {
                    zip = new JSZip();
                } else if (typeof window.JSZip !== 'undefined') {
                    zip = new window.JSZip();
                } else {
                    debugLog.errors.push("JSZip is not defined in content script scope");
                    console.warn("JSZip не найден в текущем контексте, переключаемся на пофайловое скачивание.");
                }

                for (let i = 0; i < groups.length; i++) {
                    const g = groups[i];
                    btn.innerText = `⏳ Скачиваем ${i+1}/${groups.length}`;
                    try {
                        const url = `https://school.mos.ru/api/profeducation/core/teacher/v1/journals/export?group_ids=${g.id}&start_at=${startAt}&stop_at=${stopAt}`;
                        let res = await fetch(url, { headers: reqHeaders });
                        // Fallback на journalw, если teacherspow отклонен
                        if (!res.ok && (res.status === 401 || res.status === 403)) {
                            reqHeaders["x-mes-subsystem"] = "journalw";
                            res = await fetch(url, { headers: reqHeaders });
                        }
                        if (res.ok) {
                            const blob = await res.blob();
                            const safeName = g.name.replace(/[\/\\:\*\?"<>\|]/g, '').trim();
                            window._meshDownloadedBlobs = window._meshDownloadedBlobs || new Map();
                            window._meshDownloadedBlobs.set(g.id, { name: safeName, blob });
                            if (zip) {
                                zip.file(`Журнал_${safeName}.xlsx`, blob);
                            } else {
                                const a = document.createElement('a');
                                a.href = URL.createObjectURL(blob);
                                a.download = `Журнал_${safeName}.xlsx`;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                            }
                            downloaded++;
                            debugLog.downloaded = downloaded;
                        } else {
                            failed++;
                            debugLog.failed = failed;
                            debugLog.errors.push(`Group ${g.id} failed with HTTP ${res.status}`);
                        }
                    } catch(e) {
                        failed++;
                        debugLog.failed = failed;
                        debugLog.errors.push(`Group ${g.id} error: ${e.message}`);
                    }
                    await new Promise(r => setTimeout(r, 200));
                }
                
                if (zip && downloaded > 0) {
                    btn.innerText = `📦 Сборка ZIP архива...`;
                    try {
                        const zipBlob = await zip.generateAsync({ type: "blob" });
                        debugLog.zipBlobSize = zipBlob.size;
                        const blobUrl = URL.createObjectURL(zipBlob);
                        
                        let courseName = "Журналы_Куратора";
                        let match = (groups[0].name || "").match(/(?:ИСП|РУПО)\d+(\.\d+)?/);
                        if (match) courseName = match[0];
                        const fileName = `${courseName}_Журналы_${yearStart}-${yearEnd}.zip`;
                        
                        // Попытка автоматического скачивания
                        const a = document.createElement('a');
                        a.href = blobUrl;
                        a.download = fileName;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        debugLog.autoDownloadClicked = true;

                        // Всегда добавляем явную кнопку скачивания в панель на случай блокировки popup/download браузером
                        let dlLink = document.getElementById('speedmesh-zip-download-link');
                        if (dlLink) dlLink.remove();
                        dlLink = document.createElement('a');
                        dlLink.id = 'speedmesh-zip-download-link';
                        dlLink.href = blobUrl;
                        dlLink.download = fileName;
                        dlLink.innerText = `💾 Скачать архив (${(zipBlob.size / 1024).toFixed(0)} КБ)`;
                        dlLink.style.cssText = "display:block; text-align:center; background:#2980b9; color:white; padding:8px 12px; border-radius:6px; font-weight:bold; text-decoration:none; margin-top:5px;";
                        panel.appendChild(dlLink);
                    } catch(e) {
                        debugLog.errors.push("ZIP generation error: " + e.message);
                        console.error("Ошибка при создании ZIP", e);
                    }
                }
                
                window.sessionStorage.setItem('SPEEDMESH_MENTOR_DEBUG', JSON.stringify(debugLog));
                btn.innerText = `✅ Успешно: ${downloaded}` + (failed > 0 ? `, ❌ Ошибок: ${failed}` : '');
                setTimeout(() => { btn.innerText = '⬇️ Скачать все журналы (' + groups.length + ')'; btn.style.pointerEvents = 'auto'; }, 4000);
            };
            panel.appendChild(btn);

            let summaryBtn = document.createElement('button');
            summaryBtn.id = 'mesh-mentor-summary-btn';
            summaryBtn.innerText = '📊 Сводная ведомость группы';
            summaryBtn.style.cssText = "background:#8e44ad; color:white; border:none; padding:8px 12px; border-radius:6px; cursor:pointer; font-weight:bold; transition:0.2s; box-shadow:0 4px 12px rgba(142,68,173,0.3);";
            summaryBtn.onmouseover = () => summaryBtn.style.transform = 'scale(1.05)';
            summaryBtn.onmouseout = () => summaryBtn.style.transform = 'scale(1)';
            summaryBtn.onclick = () => buildAndShowSummarySheet(groups, summaryBtn);
            panel.appendChild(summaryBtn);

            let listBtn = document.createElement('button');
            listBtn.innerText = '📋 Список предметов (' + groups.length + ')';
            listBtn.style.cssText = "background:#34495e; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600; transition:0.2s;";
            listBtn.onclick = () => {
                let existingModal = document.getElementById('mesh-mentor-groups-modal');
                if (existingModal) { existingModal.remove(); return; }
                let m = document.createElement('div');
                m.id = 'mesh-mentor-groups-modal';
                m.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#1e293b; color:#fff; border:1px solid #475569; border-radius:12px; padding:20px; z-index:99999999; max-width:500px; width:90vw; max-height:75vh; overflow-y:auto; box-shadow:0 20px 40px rgba(0,0,0,0.7); font-family:sans-serif;';
                m.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid #334155; padding-bottom:8px;">
                        <b style="font-size:14px; color:#93c5fd;">Предметы группы (${groups.length})</b>
                        <button id="mesh-close-groups-modal" style="background:transparent; border:none; color:#94a3b8; font-size:18px; cursor:pointer;">&times;</button>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:6px;">
                        ${groups.map((g, idx) => `
                            <div style="font-size:12px; padding:6px 8px; background:#0f172a; border-radius:6px; border:1px solid #1e293b; display:flex; justify-content:space-between;">
                                <span>${idx + 1}. ${g.name}</span>
                                <span style="color:#64748b; font-size:10px;">ID: ${g.id}</span>
                            </div>
                        `).join('')}
                    </div>
                `;
                document.body.appendChild(m);
                m.querySelector('#mesh-close-groups-modal').onclick = () => m.remove();
            };
            panel.appendChild(listBtn);
        } else {
            let info = document.createElement('div');
            info.innerHTML = "<i>Выберите курс и подождите<br>загрузки списка предметов...</i>";
            info.style.cssText = "font-size:12px; color:#bdc3c7; text-align:center;";
            panel.appendChild(info);
        }

        document.body.appendChild(panel);
        
        // Make draggable if Window Manager is loaded
        if (window.makeMeshDraggable) {
            setTimeout(() => {
                if (window.makeMeshDraggable) window.makeMeshDraggable(panel, "📚");
            }, 1000);
        }

    }, 1500); // Check every 1.5s for page change

    // --- ПАРСИНГ ЖУРНАЛОВ И ПОСТРОЕНИЕ СВОДНОЙ ВЕДОМОСТИ ---

    function isStudentName(str) {
        if (!str || str.length < 5 || str.length > 70) return false;
        const words = str.split(/\s+/).filter(Boolean);
        if (words.length < 2 || words.length > 4) return false;
        const invalidKeywords = ['тема', 'итог', 'оценка', 'средн', 'групп', 'дисциплин', 'преподават', 'период', 'семестр', 'форма', 'контрол', 'дата', 'часы', 'всего', 'п/п', 'номер', 'урок', 'заняти', 'неаттест', 'экзамен', 'зачет'];
        const lower = str.toLowerCase();
        if (invalidKeywords.some(k => lower.includes(k))) return false;
        return words.every(w => /^[А-ЯЁ][а-яё\-]+$/.test(w));
    }

    async function parseJournalXlsx(blob) {
        if (typeof JSZip === 'undefined' && typeof window.JSZip === 'undefined') {
            throw new Error("JSZip не загружен");
        }
        const zip = typeof JSZip !== 'undefined' ? new JSZip() : new window.JSZip();
        const zipInst = await zip.loadAsync(blob);
        
        let sharedStrings = [];
        const sstFile = zipInst.file('xl/sharedStrings.xml');
        if (sstFile) {
            const sstText = await sstFile.async('text');
            const doc = new DOMParser().parseFromString(sstText, 'application/xml');
            const siList = doc.getElementsByTagName('si');
            for (let i = 0; i < siList.length; i++) {
                const tList = siList[i].getElementsByTagName('t');
                let str = '';
                for (let j = 0; j < tList.length; j++) str += tList[j].textContent;
                sharedStrings.push(str);
            }
        }

        const sheetFile = zipInst.file('xl/worksheets/sheet1.xml');
        if (!sheetFile) return [];
        const sheetText = await sheetFile.async('text');
        const sheetDoc = new DOMParser().parseFromString(sheetText, 'application/xml');
        const rowNodes = sheetDoc.getElementsByTagName('row');

        const students = [];

        for (let r = 0; r < rowNodes.length; r++) {
            const rowNode = rowNodes[r];
            const cellNodes = rowNode.getElementsByTagName('c');
            if (cellNodes.length < 2) continue;

            let rowCells = [];
            for (let c = 0; c < cellNodes.length; c++) {
                const cell = cellNodes[c];
                const ref = cell.getAttribute('r') || '';
                const type = cell.getAttribute('t') || '';
                const vEl = cell.getElementsByTagName('v')[0];
                let val = vEl ? vEl.textContent.trim() : '';
                if (type === 's') {
                    const idx = parseInt(val, 10);
                    val = sharedStrings[idx] !== undefined ? sharedStrings[idx].trim() : '';
                } else if (type === 'inlineStr') {
                    const isEl = cell.getElementsByTagName('is')[0];
                    val = isEl ? isEl.textContent.trim() : '';
                }
                const colMatch = ref.match(/^([A-Z]+)/);
                const colLetter = colMatch ? colMatch[1] : '';
                rowCells.push({ col: colLetter, val });
            }

            let studentName = null;
            let nameColIdx = -1;
            for (let i = 0; i < Math.min(rowCells.length, 4); i++) {
                const candidate = rowCells[i].val.replace(/\s+/g, ' ').trim();
                if (isStudentName(candidate)) {
                    studentName = candidate;
                    nameColIdx = i;
                    break;
                }
            }
            if (!studentName) continue;

            // Оценки студента
            const afterCells = rowCells.slice(nameColIdx + 1);
            let marks = [];
            let explicitAvg = null;

            for (let cell of afterCells) {
                let str = cell.val.replace(',', '.').trim();
                let num = parseFloat(str);
                if (!isNaN(num) && num >= 1.0 && num <= 5.0) {
                    if (str.includes('.') && num !== 2.0 && num !== 3.0 && num !== 4.0 && num !== 5.0) {
                        explicitAvg = num;
                    } else if (num >= 2.0 && num <= 5.0) {
                        marks.push(Math.round(num));
                    }
                }
            }

            let avg = explicitAvg !== null ? explicitAvg : (marks.length > 0 ? parseFloat((marks.reduce((a, b) => a + b, 0) / marks.length).toFixed(2)) : null);

            students.push({
                name: studentName,
                avg: avg,
                marksCount: marks.length
            });
        }

        return students;
    }

    async function buildAndShowSummarySheet(groups, triggerBtn) {
        if (!groups || groups.length === 0) return alert("Список предметов пуст");
        
        const origBtnText = triggerBtn.innerText;
        triggerBtn.innerText = '⏳ Подготовка...';
        triggerBtn.style.pointerEvents = 'none';

        const { reqHeaders, yearStart, yearEnd, startAt, stopAt } = getMentorAuthContext();
        window._meshDownloadedBlobs = window._meshDownloadedBlobs || new Map();

        // 1. Загрузка недостающих файлов
        for (let i = 0; i < groups.length; i++) {
            const g = groups[i];
            if (!window._meshDownloadedBlobs.has(g.id)) {
                triggerBtn.innerText = `⏳ Загрузка ${i + 1}/${groups.length}`;
                try {
                    const url = `https://school.mos.ru/api/profeducation/core/teacher/v1/journals/export?group_ids=${g.id}&start_at=${startAt}&stop_at=${stopAt}`;
                    let res = await fetch(url, { headers: reqHeaders });
                    if (!res.ok && (res.status === 401 || res.status === 403)) {
                        reqHeaders["x-mes-subsystem"] = "journalw";
                        res = await fetch(url, { headers: reqHeaders });
                    }
                    if (res.ok) {
                        const blob = await res.blob();
                        const safeName = g.name.replace(/[\/\\:\*\?"<>\|]/g, '').trim();
                        window._meshDownloadedBlobs.set(g.id, { name: safeName, blob });
                    }
                } catch(e) {}
                await new Promise(r => setTimeout(r, 150));
            }
        }

        triggerBtn.innerText = '⏳ Парсинг оценок...';

        // 2. Парсинг каждого журнала и построение матрицы
        const subjectsList = [];
        const studentMap = new Map();

        for (let g of groups) {
            const item = window._meshDownloadedBlobs.get(g.id);
            if (!item || !item.blob) continue;

            const safeName = item.name;
            subjectsList.push(safeName);

            try {
                const parsedStudents = await parseJournalXlsx(item.blob);
                for (let ps of parsedStudents) {
                    if (!studentMap.has(ps.name)) {
                        studentMap.set(ps.name, {});
                    }
                    studentMap.get(ps.name)[safeName] = ps.avg;
                }
            } catch(e) {
                console.error("Ошибка парсинга журнала:", safeName, e);
            }
        }

        triggerBtn.innerText = origBtnText;
        triggerBtn.style.pointerEvents = 'auto';

        if (studentMap.size === 0) {
            return alert("Не удалось извлечь данные обучающихся из выгруженных журналов.");
        }

        // 3. Подготовка итоговых данных по студентам
        let courseName = "Группа";
        let match = (groups[0].name || "").match(/(?:ИСП|РУПО)\d+(\.\d+)?/);
        if (match) courseName = match[0];

        const allStudents = Array.from(studentMap.keys()).sort((a, b) => a.localeCompare(b, 'ru'));
        const processedStudents = allStudents.map(name => {
            const subData = studentMap.get(name) || {};
            let validAvgs = [];
            let failedCount = 0;

            for (let s of subjectsList) {
                const avg = subData[s];
                if (avg !== undefined && avg !== null) {
                    validAvgs.push(avg);
                    if (avg < 3.0) failedCount++;
                }
            }

            const overallAvg = validAvgs.length > 0
                ? parseFloat((validAvgs.reduce((a, b) => a + b, 0) / validAvgs.length).toFixed(2))
                : null;

            let status = "Аттестован";
            if (failedCount > 0) status = "Задолженность";
            else if (overallAvg !== null && overallAvg >= 4.5) status = "Отличник";
            else if (overallAvg !== null && overallAvg >= 3.5) status = "Хорошист";

            return {
                name,
                subjects: subData,
                overallAvg,
                failedCount,
                status
            };
        });

        // 4. Отрисовка модального окна сводной ведомости
        renderSummaryModalUI(courseName, yearStart, yearEnd, subjectsList, processedStudents);
    }

    function renderSummaryModalUI(courseName, yearStart, yearEnd, subjectsList, students) {
        let existing = document.getElementById('speedmesh-summary-modal');
        if (existing) existing.remove();

        const totalStudents = students.length;
        const failedStudents = students.filter(s => s.failedCount > 0);
        const excellentStudents = students.filter(s => s.status === "Отличник");
        const goodStudents = students.filter(s => s.status === "Хорошист");
        
        let validOverallAvgs = students.map(s => s.overallAvg).filter(a => a !== null);
        const groupMeanAvg = validOverallAvgs.length > 0
            ? (validOverallAvgs.reduce((a, b) => a + b, 0) / validOverallAvgs.length).toFixed(2)
            : "—";

        let currentFilter = 'all';
        let currentSearch = '';

        const modal = document.createElement('div');
        modal.id = 'speedmesh-summary-modal';
        modal.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(10,15,25,0.85); backdrop-filter:blur(8px); z-index:99999999; display:flex; align-items:center; justify-content:center; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; color:#f8fafc;';

        const renderTableRows = () => {
            let list = students.filter(s => {
                if (currentFilter === 'failed' && s.failedCount === 0) return false;
                if (currentFilter === 'excellent' && s.status !== "Отличник") return false;
                if (currentFilter === 'good' && s.status !== "Хорошист") return false;
                if (currentSearch && !s.name.toLowerCase().includes(currentSearch.toLowerCase())) return false;
                return true;
            });

            if (list.length === 0) {
                return `<tr><td colspan="${subjectsList.length + 5}" style="padding:24px; text-align:center; color:#94a3b8;">По выбранным фильтрам ничего не найдено</td></tr>`;
            }

            return list.map((st, idx) => {
                const statusColor = st.status === "Отличник" ? "#10b981" : (st.status === "Хорошист" ? "#3b82f6" : (st.status === "Задолженность" ? "#ef4444" : "#94a3b8"));
                return `
                    <tr style="border-bottom:1px solid #1e293b; transition:background 0.15s;" onmouseover="this.style.background='rgba(51,65,85,0.3)'" onmouseout="this.style.background='transparent'">
                        <td style="padding:8px 10px; text-align:center; color:#64748b; font-size:11px;">${idx + 1}</td>
                        <td style="padding:8px 12px; font-weight:600; color:#f1f5f9; font-size:12px; white-space:nowrap; position:sticky; left:0; background:#1e293b; z-index:3; border-right:1px solid #334155;">${st.name}</td>
                        ${subjectsList.map(subj => {
                            const val = st.subjects[subj];
                            let cellText = '—';
                            let cellColor = '#64748b';
                            let cellBg = 'transparent';
                            if (val !== undefined && val !== null) {
                                cellText = val.toFixed(2);
                                if (val >= 4.5) { cellColor = '#10b981'; }
                                else if (val >= 3.5) { cellColor = '#60a5fa'; }
                                else if (val >= 3.0) { cellColor = '#fbbf24'; }
                                else { cellColor = '#ef4444'; cellBg = 'rgba(239,68,68,0.15)'; }
                            }
                            return `<td style="padding:8px 8px; text-align:center; font-weight:600; font-size:11px; color:${cellColor}; background:${cellBg}; white-space:nowrap;" title="${subj}: ${cellText}">${cellText}</td>`;
                        }).join('')}
                        <td style="padding:8px 10px; text-align:center; font-weight:700; font-size:12px; color:${st.failedCount > 0 ? '#ef4444' : '#10b981'}; background:${st.failedCount > 0 ? 'rgba(239,68,68,0.1)' : 'transparent'};">${st.failedCount}</td>
                        <td style="padding:8px 10px; text-align:center; font-weight:700; font-size:13px; color:${st.overallAvg >= 4.0 ? '#10b981' : (st.overallAvg >= 3.0 ? '#fbbf24' : '#ef4444')};">${st.overallAvg !== null ? st.overallAvg.toFixed(2) : '—'}</td>
                        <td style="padding:8px 12px; text-align:center; font-size:11px; font-weight:600; color:${statusColor}; white-space:nowrap;">${st.status}</td>
                    </tr>
                `;
            }).join('');
        };

        modal.innerHTML = `
            <div style="background:#1e293b; border:1px solid #334155; border-radius:16px; width:95vw; max-width:1400px; height:92vh; display:flex; flex-direction:column; box-shadow:0 30px 60px rgba(0,0,0,0.8); overflow:hidden;">
                <div style="padding:16px 24px; border-bottom:1px solid #334155; display:flex; justify-content:space-between; align-items:center; background:#0f172a;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <span style="font-size:26px;">📊</span>
                        <div>
                            <div style="font-size:17px; font-weight:700; color:#fff;">Сводная ведомость успеваемости: <span style="color:#60a5fa;">${courseName}</span></div>
                            <div style="font-size:11px; color:#94a3b8; margin-top:2px;">Учебный год ${yearStart}–${yearEnd} · Дисциплин: ${subjectsList.length} · Студентов: ${totalStudents}</div>
                        </div>
                    </div>
                    <button id="mesh-close-summary-btn" style="background:transparent; border:none; color:#94a3b8; font-size:26px; cursor:pointer; padding:0 6px; line-height:1;">&times;</button>
                </div>

                <div style="padding:12px 24px; background:#111827; border-bottom:1px solid #1e293b; display:grid; grid-template-columns:repeat(5, 1fr); gap:12px;">
                    <div style="background:#1e293b; border:1px solid #334155; border-radius:10px; padding:10px; text-align:center;">
                        <div style="font-size:11px; color:#94a3b8; text-transform:uppercase;">Всего студентов</div>
                        <div style="font-size:20px; font-weight:700; color:#fff; margin-top:2px;">${totalStudents}</div>
                    </div>
                    <div style="background:#1e293b; border:1px solid #334155; border-radius:10px; padding:10px; text-align:center;">
                        <div style="font-size:11px; color:#94a3b8; text-transform:uppercase;">Без задолженностей</div>
                        <div style="font-size:20px; font-weight:700; color:#10b981; margin-top:2px;">${totalStudents - failedStudents.length} <span style="font-size:11px; color:#94a3b8;">(${Math.round(((totalStudents - failedStudents.length)/totalStudents)*100)}%)</span></div>
                    </div>
                    <div style="background:#1e293b; border:1px solid #334155; border-radius:10px; padding:10px; text-align:center;">
                        <div style="font-size:11px; color:#94a3b8; text-transform:uppercase;">С задолженностями</div>
                        <div style="font-size:20px; font-weight:700; color:#ef4444; margin-top:2px;">${failedStudents.length}</div>
                    </div>
                    <div style="background:#1e293b; border:1px solid #334155; border-radius:10px; padding:10px; text-align:center;">
                        <div style="font-size:11px; color:#94a3b8; text-transform:uppercase;">Отличники / Хорошисты</div>
                        <div style="font-size:20px; font-weight:700; color:#60a5fa; margin-top:2px;">${excellentStudents.length} / ${goodStudents.length}</div>
                    </div>
                    <div style="background:#1e293b; border:1px solid #334155; border-radius:10px; padding:10px; text-align:center;">
                        <div style="font-size:11px; color:#94a3b8; text-transform:uppercase;">Ср. балл группы</div>
                        <div style="font-size:20px; font-weight:700; color:#fbbf24; margin-top:2px;">${groupMeanAvg}</div>
                    </div>
                </div>

                <div style="padding:10px 24px; background:#1e293b; border-bottom:1px solid #334155; display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <input id="mesh-summary-search" type="text" placeholder="🔍 Поиск по ФИО..." style="background:#0f172a; border:1px solid #475569; color:#fff; padding:6px 12px; border-radius:6px; font-size:12px; outline:none; width:180px;">
                        <button id="mesh-flt-all" style="background:#3b82f6; color:#fff; border:none; padding:6px 10px; border-radius:6px; font-size:11px; font-weight:600; cursor:pointer;">Все (${totalStudents})</button>
                        <button id="mesh-flt-failed" style="background:#334155; color:#94a3b8; border:none; padding:6px 10px; border-radius:6px; font-size:11px; font-weight:600; cursor:pointer;">⚠️ Должники (${failedStudents.length})</button>
                        <button id="mesh-flt-exc" style="background:#334155; color:#94a3b8; border:none; padding:6px 10px; border-radius:6px; font-size:11px; font-weight:600; cursor:pointer;">⭐ Отличники (${excellentStudents.length})</button>
                    </div>

                    <div style="display:flex; align-items:center; gap:8px;">
                        <button id="mesh-summary-copy-debtors" style="background:#475569; color:#fff; border:none; padding:7px 12px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer;">📋 Список долгов</button>
                        <button id="mesh-summary-export-csv" style="background:#10b981; color:#fff; border:none; padding:7px 14px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer;">💾 Скачать ведомость (Excel)</button>
                    </div>
                </div>

                <div style="flex:1; overflow:auto; position:relative;">
                    <table style="width:100%; border-collapse:collapse; font-size:12px; text-align:left;">
                        <thead>
                            <tr style="background:#0f172a; position:sticky; top:0; z-index:10; border-bottom:2px solid #334155;">
                                <th style="padding:10px 10px; text-align:center; color:#94a3b8; font-size:11px; width:35px;">№</th>
                                <th style="padding:10px 12px; color:#94a3b8; font-size:12px; position:sticky; left:0; background:#0f172a; z-index:12; border-right:1px solid #334155; min-width:200px;">Обучающийся</th>
                                ${subjectsList.map(subj => {
                                    let short = subj.length > 14 ? subj.slice(0, 12) + '...' : subj;
                                    return `<th style="padding:10px 8px; text-align:center; color:#cbd5e1; font-size:11px; white-space:nowrap; max-width:110px;" title="${subj}">${short}</th>`;
                                }).join('')}
                                <th style="padding:10px 10px; text-align:center; color:#ef4444; font-size:11px; white-space:nowrap;">Долги</th>
                                <th style="padding:10px 10px; text-align:center; color:#fbbf24; font-size:11px; white-space:nowrap;">Ср. балл</th>
                                <th style="padding:10px 12px; text-align:center; color:#94a3b8; font-size:11px; white-space:nowrap;">Статус</th>
                            </tr>
                        </thead>
                        <tbody id="mesh-summary-tbody">
                            ${renderTableRows()}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const updateTable = () => {
            const tbody = modal.querySelector('#mesh-summary-tbody');
            if (tbody) tbody.innerHTML = renderTableRows();
        };

        const setActiveFilterBtn = (btnId) => {
            ['mesh-flt-all', 'mesh-flt-failed', 'mesh-flt-exc'].forEach(id => {
                const b = modal.querySelector('#' + id);
                if (b) {
                    b.style.background = id === btnId ? '#3b82f6' : '#334155';
                    b.style.color = id === btnId ? '#fff' : '#94a3b8';
                }
            });
        };

        modal.querySelector('#mesh-flt-all').onclick = () => { currentFilter = 'all'; setActiveFilterBtn('mesh-flt-all'); updateTable(); };
        modal.querySelector('#mesh-flt-failed').onclick = () => { currentFilter = 'failed'; setActiveFilterBtn('mesh-flt-failed'); updateTable(); };
        modal.querySelector('#mesh-flt-exc').onclick = () => { currentFilter = 'excellent'; setActiveFilterBtn('mesh-flt-exc'); updateTable(); };

        const searchInput = modal.querySelector('#mesh-summary-search');
        searchInput.oninput = (e) => {
            currentSearch = e.target.value.trim();
            updateTable();
        };

        const closeModal = () => modal.remove();
        modal.querySelector('#mesh-close-summary-btn').onclick = closeModal;
        modal.onclick = (e) => { if (e.target === modal) closeModal(); };

        modal.querySelector('#mesh-summary-export-csv').onclick = () => {
            let csv = '\uFEFF';
            let headers = ['№', 'ФИО обучающегося', ...subjectsList, 'Задолженностей', 'Средний балл', 'Статус'];
            csv += headers.map(h => `"${h.replace(/"/g, '""')}"`).join(';') + '\r\n';

            students.forEach((st, idx) => {
                let row = [
                    idx + 1,
                    st.name,
                    ...subjectsList.map(subj => {
                        const val = st.subjects[subj];
                        return (val !== undefined && val !== null) ? val.toFixed(2).replace('.', ',') : '';
                    }),
                    st.failedCount,
                    st.overallAvg !== null ? st.overallAvg.toFixed(2).replace('.', ',') : '',
                    st.status
                ];
                csv += row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';') + '\r\n';
            });

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `Сводная_ведомость_${courseName}_${yearStart}-${yearEnd}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        };

        modal.querySelector('#mesh-summary-copy-debtors').onclick = () => {
            let text = `📋 Список академических задолженностей (${courseName}):\n`;
            if (failedStudents.length === 0) {
                text += `В группе нет студентов с академическими задолженностями! Все аттестованы.`;
            } else {
                failedStudents.forEach((st, idx) => {
                    let debts = [];
                    for (let subj of subjectsList) {
                        const v = st.subjects[subj];
                        if (v !== undefined && v !== null && v < 3.0) {
                            debts.push(`${subj}: ${v.toFixed(2)}`);
                        }
                    }
                    text += `${idx + 1}. ${st.name} — Долгов: ${st.failedCount} (${debts.join('; ')})\n`;
                });
            }

            navigator.clipboard.writeText(text).then(() => {
                const b = modal.querySelector('#mesh-summary-copy-debtors');
                if (b) {
                    b.innerText = '✅ Скопировано!';
                    setTimeout(() => { if (b) b.innerText = '📋 Список долгов'; }, 2000);
                }
            });
        };
    }
})();
