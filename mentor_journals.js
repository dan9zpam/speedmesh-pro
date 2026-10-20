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

        if (groups.length > 0) {
            let btn = document.createElement('button');
            btn.innerText = '⬇️ Скачать все журналы (' + groups.length + ')';
            btn.style.cssText = "background:#27ae60; color:white; border:none; padding:8px 12px; border-radius:6px; cursor:pointer; font-weight:bold; transition:0.2s;";
            btn.onmouseover = () => btn.style.transform = 'scale(1.05)';
            btn.onmouseout = () => btn.style.transform = 'scale(1)';
            
            btn.onclick = async () => {
                btn.innerText = '⏳ Подготовка...';
                btn.style.pointerEvents = 'none';
                
                // Fetch authorization tokens and session headers
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

                // Fallback from sessionStorage if cookies were empty
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

                let downloaded = 0;
                let failed = 0;

                let currentYear = new Date().getFullYear();
                let month = new Date().getMonth(); 
                let yearStart = month < 7 ? currentYear - 1 : currentYear;
                let yearEnd = yearStart + 1;
                let startAt = `${yearStart}-09-01T00:00:00.000Z`;
                let stopAt = `${yearEnd}-08-31T00:00:00.000Z`;

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
})();
