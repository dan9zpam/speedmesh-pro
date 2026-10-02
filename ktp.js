(function() {
    console.log("🔥 MESH KTP Module v145: Native Clone Mode + Full Logging");

    try {
        if (!document.querySelector('script[src*="ktp_interceptor.js"]')) {
            const s = document.createElement('script');
            s.src = chrome.runtime.getURL('ktp_interceptor.js');
            s.onload = function() { this.remove(); };
            (document.head || document.documentElement).appendChild(s);
        }
    } catch (e) {}

    let isKtpRunning = false;

    setInterval(() => {
        if (!document.body || isKtpRunning) return; 

        chrome.storage.sync.get(null, (data) => {
            if (data.ktpModule !== false && window.location.href.includes('planning')) {
                if (!document.getElementById('mesh-ktp-panel')) drawKtpPanel();
                updatePanelUI();
            } else {
                const p = document.getElementById('mesh-ktp-panel');
                if (p) p.remove();
            }
        });
    }, 1000);

    function drawKtpPanel() {
        const panel = document.createElement('div');
        panel.id = 'mesh-ktp-panel';
        panel.style.cssText = 'position:fixed; bottom:30px; left:30px; background:#1e272e; color:white; padding:15px 25px; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.8); z-index:9999999; display:flex; flex-direction:column; gap:10px; font-family:sans-serif; border:2px solid #3498db; width:300px;';
        document.body.appendChild(panel);
    }

    function updatePanelUI() {
        const panel = document.getElementById('mesh-ktp-panel');
        if (!panel || isKtpRunning) return;

        let ids = [];
        let details = {};
        try {
            const stored = window.sessionStorage.getItem('MESH_KTP_IDS');
            if (stored) ids = JSON.parse(stored);
        } catch(e) {}
        try {
            details = JSON.parse(window.sessionStorage.getItem('MESH_KTP_DETAILS') || '{}');
        } catch(e) {}

        if (ids.length === 0) {
            panel.innerHTML = `
                <div style="font-size:16px; font-weight:bold; color:#3498db;">🗓️ Ассистент КТП</div>
                <div style="font-size:12px; color:#f39c12; margin-top:5px;">⏳ Ожидание данных...</div>
                <div style="font-size:11px; color:#bdc3c7; line-height:1.4; margin-top:5px; padding:8px; background:rgba(255,255,255,0.05); border-radius:6px;">
                    Разверните пункт 3 <b>"Календарно-тематическое планирование"</b>.
                </div>
            `;
        } else {
            panel.innerHTML = `
                <div style="font-size:16px; font-weight:bold; color:#3498db; display:flex; justify-content:space-between;">
                    <span>🗓️ Ассистент КТП</span>
                    <span style="color:#2ecc71;">${ids.length} шт.</span>
                </div>
                <button id="ktp-btn-run" style="background:#2ecc71; color:white; border:none; border-radius:6px; padding:10px; cursor:pointer; font-weight:bold; width:100%; transition:0.2s; margin-top:5px;">🚀 Запустить авто-обновление</button>
            `;
            setTimeout(() => {
                const btn = document.getElementById('ktp-btn-run');
                if (btn) btn.onclick = () => runApiProcess(ids, details);
            }, 50);
        }
    }

    const sleep = ms => new Promise(r => setTimeout(r, ms));

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[char]));
    }

    function getApiErrorMessage(response) {
        if (response.err) return response.err;
        if (!response.text) return 'Сервер не вернул описание ошибки';
        try {
            const data = JSON.parse(response.text);
            const message = data.message || data.error_text || data.error;
            return typeof message === 'string' ? message : response.text;
        } catch(e) {
            return response.text;
        }
    }

    // Функция отправки с перехватом текста ответа сервера
    async function apiRequest(planId, action) {
        let stolenHeaders = {};
        try {
            stolenHeaders = JSON.parse(window.sessionStorage.getItem('MESH_KTP_HEADERS') || "{}");
        } catch(e) {}

        if (Object.keys(stolenHeaders).length === 0) {
            let cookies = document.cookie.split('; ').reduce((acc, v) => {
                let parts = v.split('='); 
                if(parts[0]) acc[parts[0].trim()] = parts.slice(1).join('='); 
                return acc;
            }, {});
            stolenHeaders = {
                "Authorization": `Bearer ${decodeURIComponent(cookies['aupd_token'] || "")}`,
                "Profile-Id": decodeURIComponent(cookies['profile_id'] || ""),
                "x-mes-subsystem": "profeducation",
                "x-mes-role": "teacher"
            };
        }

        const headersToUse = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            ...stolenHeaders 
        };

        try {
            const res = await fetch(`https://school.mos.ru/api/profeducation/plan/teacher/v1/calendar_plans/${planId}/${action}?ignore_IA=true`, {
                method: 'POST',
                headers: headersToUse,
                body: JSON.stringify({})
            });
            // Сохраняем текстовый ответ сервера для логов
            return { ok: res.ok, status: res.status, text: await res.text().catch(()=>"") };
        } catch (e) {
            return { ok: false, status: "Network Error", err: e.message };
        }
    }

    async function runApiProcess(ids, details) {
        isKtpRunning = true;
        const panel = document.getElementById('mesh-ktp-panel');
        let success = 0; let fail = 0;
        let processLogs = []; // Хранилище ПОЛНОГО лога
        let failedPlans = [];
        const idsByKey = new Map(ids.map(id => [String(id), id]));
        const orderedIds = [];
        const orderedKeys = new Set();
        const rowsByKey = new Map();

        document.querySelectorAll('button[data-test-component^="editCTP-"]').forEach(button => {
            const match = button.getAttribute('data-test-component').match(/^editCTP-(\d+)/);
            const row = button.closest('tr');
            if (!match || !row) return;

            const key = match[1];
            rowsByKey.set(key, row);
            if (idsByKey.has(key) && !orderedKeys.has(key)) {
                orderedIds.push(idsByKey.get(key));
                orderedKeys.add(key);
            }
        });
        ids.forEach(id => {
            const key = String(id);
            if (!orderedKeys.has(key)) orderedIds.push(id);
        });
        const currentPage = Number(document.querySelector('[aria-current="page"]')?.textContent) || 1;
        const pageSizeText = document.querySelector('[data-test-component*="selectLimit-singleField"]')?.textContent || '';
        const pageSize = Number(pageSizeText.match(/\d+/)?.[0]) || rowsByKey.size || ids.length;

        for (let i = 0; i < orderedIds.length; i++) {
            const planId = orderedIds[i];
            
            let row = rowsByKey.get(String(planId));
            let listNumber = null;
            if (row) {
                const siblingRows = Array.from(row.parentElement.children).filter(element => element.tagName === 'TR');
                const rowIndex = siblingRows.indexOf(row);
                if (rowIndex !== -1) listNumber = (currentPage - 1) * pageSize + rowIndex + 1;
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                row.style.backgroundColor = "rgba(52, 152, 219, 0.2)";
            }
            const planNumber = listNumber === null ? 'КТП' : `КТП № ${listNumber} из ${ids.length}`;
            const planDetails = { ...(details[planId] || {}) };
            if (row) {
                const cells = Array.from(row.cells);
                if (!planDetails.discipline && cells[0]?.innerText.trim()) planDetails.discipline = cells[0].innerText.trim();
                if (!planDetails.group && cells[4]?.innerText.trim()) planDetails.group = cells[4].innerText.trim();
                if (!planDetails.specialty && cells[1]?.innerText.trim()) planDetails.specialty = cells[1].innerText.trim();
                if (!planDetails.course && cells[3]?.innerText.trim()) planDetails.course = cells[3].innerText.trim();
            }
            const detailsText = Object.entries(planDetails)
                .map(([key, value]) => `${{ group: 'Группа', discipline: 'Дисциплина', specialty: 'Специальность', course: 'Курс' }[key] || key}: ${value}`)
                .join('; ');

            panel.innerHTML = `<div style="text-align:center; font-size:14px;">КТП <b>${i+1} из ${ids.length}</b><br><span style="color:#f39c12;">⏳ Достроение...</span></div>`;
            let r1 = await apiRequest(planId, 'finish');
            await sleep(600);

            panel.innerHTML = `<div style="text-align:center; font-size:14px;">КТП <b>${i+1} из ${ids.length}</b><br><span style="color:#3498db;">⏳ Пересчет...</span></div>`;
            let r2 = await apiRequest(planId, 'recalc');

            let logMsg = `=======================================\n${planNumber}\n`;
            logMsg += detailsText ? `Данные КТП: ${detailsText}\n` : `Дополнительные сведения о КТП не найдены\n`;

            if (r1.ok && r2.ok) {
                success++;
                if (row) row.style.backgroundColor = "rgba(46, 204, 113, 0.4)";
                logMsg += `✅ Успешно (Достроение: ${r1.status}, Пересчет: ${r2.status})\n`;
            } else {
                fail++;
                if (row) row.style.backgroundColor = "rgba(231, 76, 60, 0.4)";
                logMsg += `❌ ОШИБКА\n`;
                const errorMessages = [];
                if (!r1.ok) {
                    const message = getApiErrorMessage(r1);
                    errorMessages.push(`Достроение (${r1.status}): ${message}`);
                    logMsg += `[Достроение] Статус: ${r1.status}. Ответ сервера: ${r1.text || r1.err}\n`;
                }
                if (!r2.ok) {
                    const message = getApiErrorMessage(r2);
                    errorMessages.push(`Пересчет (${r2.status}): ${message}`);
                    logMsg += `[Пересчет] Статус: ${r2.status}. Ответ сервера: ${r2.text || r2.err}\n`;
                }
                failedPlans.push({ planNumber, detailsText, errorMessages });
                
                console.error(`❌ Ошибка ${planNumber}: Достроение=${r1.status}, Пересчет=${r2.status}`);
            }
            
            processLogs.push(logMsg);
            await sleep(500); 
        }

        // Кнопка логов теперь появляется ВСЕГДА
        let logBtnColor = fail > 0 ? "#e74c3c" : "#f39c12"; // Красная, если есть ошибки, иначе оранжевая
        let logBtnHtml = `<button id="ktp-btn-log" style="background:${logBtnColor}; color:white; border:none; border-radius:6px; padding:8px; cursor:pointer; width:100%; font-weight:bold; margin-bottom:8px; transition:0.2s;">📄 Скачать лог процесса</button>`;
        const failedPlansHtml = failedPlans.length ? `
            <div style="font-size:12px; font-weight:bold; color:#ff7675;">КТП с ошибками:</div>
            <div style="max-height:200px; overflow-y:auto; font-size:11px; line-height:1.4;">
                ${failedPlans.map(plan => `
                    <div style="padding:7px 0; border-bottom:1px solid rgba(255,255,255,0.15); overflow-wrap:anywhere;">
                        <b>${escapeHtml(plan.planNumber)}</b><br>
                        ${escapeHtml(plan.detailsText || 'Данные группы и дисциплины не найдены')}<br>
                        ${plan.errorMessages.map(message => escapeHtml(message)).join('<br>')}
                    </div>
                `).join('')}
            </div>
        ` : '';

        panel.innerHTML = `
            <div style="font-size:16px; font-weight:bold; color:${fail > 0 ? '#e74c3c' : '#2ecc71'}; text-align:center;">${fail > 0 ? '⚠️ Завершено с ошибками' : '✅ Готово!'}</div>
            <div style="text-align:center; font-size:13px; margin: 5px 0 10px 0;">Успешно: ${success} | Ошибок: ${fail}</div>
            ${failedPlansHtml}
            ${logBtnHtml}
            <button id="ktp-btn-reload" style="background:#2ecc71; color:white; border:none; border-radius:6px; padding:10px; cursor:pointer; width:100%; font-weight:bold;">🔄 Обновить страницу</button>
        `;
        
        document.getElementById('ktp-btn-reload').onclick = () => window.location.reload();
        
        // Логика скачивания файла .txt
        document.getElementById('ktp-btn-log').onclick = () => {
            const header = `Лог обработки КТП МЭШ (Сгенерировано: ${new Date().toLocaleString()})\nУспешно: ${success} | Ошибок: ${fail}\n\n`;
            const blob = new Blob([header + processLogs.join('\n')], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `MESH_KTP_Log_${new Date().toISOString().slice(0,10)}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        };
    }
})();