// ==========================================
// 🕵️‍♂️ MESH API SPY v4 (Безопасный + Предохранитель памяти)
// ==========================================
(function() {
    if (window._meshApiSpyInjected) return;
    window._meshApiSpyInjected = true;

    const originalFetch = window.fetch;
    let apiLog = {};

    // Безопасное чтение памяти
    try {
        const existing = window.sessionStorage.getItem('MESH_API_DUMP');
        if (existing) apiLog = JSON.parse(existing);
    } catch(e) {
        apiLog = {}; // Если память повреждена, начинаем с чистого листа
    }

    window.fetch = function(...args) {
        const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');
        const method = args[1] && args[1].method ? args[1].method.toUpperCase() : 'GET';

        return originalFetch.apply(this, args).then(response => {
            if (window.sessionStorage.getItem('MESH_SPY_ENABLED') === 'true') {
            if (url.includes('/api/')) { 
                try {
                    const clone = response.clone();
                    clone.json().then(data => {
                        const shortUrl = url.split('?')[0].replace(/\/\d+/g, '/{id}');
                        const key = `[${method}] ${shortUrl}`;

                        if (!apiLog[key]) {
                            let requestPayload = null;
                            if (args[1] && args[1].body) {
                                try { requestPayload = JSON.parse(args[1].body); } catch(e) { requestPayload = args[1].body; }
                            }
                            // 🛡️ ПРЕДОХРАНИТЕЛЬ: Ограничиваем лог 15 последними запросами
                            const keys = Object.keys(apiLog);
                            if (keys.length > 25) {
                                const keyToRemove = keys.find(k => !k.includes('thematic_frames') && !k.includes('didactic-themes') && !k.includes('lesson_plans'));
                                if (keyToRemove) delete apiLog[keyToRemove];
                                else delete apiLog[keys[0]];
                            }
                            
                            apiLog[key] = {
                                url: url,
                                request_body: requestPayload,
                                response: data
                            };
                            
                            // 🛡️ ПРЕДОХРАНИТЕЛЬ: Безопасная запись с перехватом переполнения
                            try {
                                window.sessionStorage.setItem('MESH_API_DUMP', JSON.stringify(apiLog));
                                updateRecordCount();
                            } catch (error) {
                                console.warn("🕵️‍♂️ [Шпион] Память переполнена! Очищаю лог.");
                                apiLog = {}; // Экстренный сброс
                                window.sessionStorage.removeItem('MESH_API_DUMP');
                            }
                        }
                    }).catch(() => {}); 
                } catch(e) {}
            }
        }
        return response;
        });
    };

    let spyPanel = null;

    function drawSpyPanel() {
        if (spyPanel) return;
        spyPanel = document.createElement('div');
        spyPanel.id = 'mesh-spy-panel';
        spyPanel.style.cssText = "position:fixed; bottom:20px; right:20px; z-index:9999999; background:rgba(20, 25, 30, 0.65); border: 1px solid rgba(255,255,255,0.15); color:white; padding:15px; border-radius:16px; display:flex; flex-direction:column; gap:12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); backdrop-filter: blur(16px); transition: 0.3s; font-family: sans-serif;";
        
        let title = document.createElement('div');
        title.id = 'mesh-spy-title';
        title.innerHTML = `🕵️‍♂️ Шпион активен <br><span style="font-size:10px; color:#bdc3c7;">Поймано пакетов: </span><span id="mesh-spy-count" style="color:#2ecc71; font-weight:bold;">${Object.keys(apiLog).length}</span>`;
        title.style.cssText = "font-size:13px; font-weight:bold; color:#9b59b6; text-align:center; padding-bottom:6px; border-bottom:1px solid rgba(255,255,255,0.1); line-height:1.4;";
        spyPanel.appendChild(title);

        let btnWrap = document.createElement('div');
        btnWrap.style.cssText = "display:flex; gap:6px; justify-content:center;";

        let dlBtn = document.createElement('button');
        dlBtn.innerHTML = "💾 Скачать";
        dlBtn.style.cssText = "background:#8e44ad; color:white; border:none; padding:7px 12px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:12px; transition:0.2s;";
        dlBtn.onclick = () => {
            if (Object.keys(apiLog).length === 0) return alert("Лог пуст!");
            const blob = new Blob([JSON.stringify(apiLog, null, 4)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `MESH_SpyLog.json`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
        };
        
        let clearBtn = document.createElement('button');
        clearBtn.innerHTML = "🗑️ Сброс";
        clearBtn.style.cssText = "background:#e74c3c; color:white; border:none; padding:7px 12px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:12px; transition:0.2s;";
        clearBtn.onclick = () => {
            apiLog = {};
            window.sessionStorage.removeItem('MESH_API_DUMP');
            updateRecordCount();
        };

        btnWrap.appendChild(dlBtn); btnWrap.appendChild(clearBtn); spyPanel.appendChild(btnWrap);
        document.body.appendChild(spyPanel);
        
        // Подключаем Window Manager для перемещения и сворачивания!
        setTimeout(() => { if (window.makeMeshDraggable) window.makeMeshDraggable(spyPanel, "🏴‍☠️"); }, 500);
    }

    function updateRecordCount() {
        let c = document.getElementById('mesh-spy-count');
        if (c) c.innerText = Object.keys(apiLog).length;
    }

    function checkPanelVisibility() {
        if (window.sessionStorage.getItem('MESH_SPY_ENABLED') === 'true') {
            drawSpyPanel(); spyPanel.style.display = 'flex';
        } else if (spyPanel) spyPanel.style.display = 'none';
    }

    window.addEventListener('MESH_SPY_TOGGLE', checkPanelVisibility);
    let initIvl = setInterval(() => { if (document.body) { clearInterval(initIvl); checkPanelVisibility(); } }, 500);
})();