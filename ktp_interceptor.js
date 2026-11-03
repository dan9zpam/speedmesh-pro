(function() {
    if (window.__KTP_INTERCEPTOR_HOOKED__) return;
    window.__KTP_INTERCEPTOR_HOOKED__ = true;

    let ktpIds = new Set();
    let stolenHeaders = {}; // Хранилище для украденных заголовков

    function saveData() {
        try { 
            window.sessionStorage.setItem('MESH_KTP_IDS', JSON.stringify(Array.from(ktpIds))); 
            // Сохраняем идеальный слепок заголовков
            if (Object.keys(stolenHeaders).length > 0) {
                window.sessionStorage.setItem('MESH_KTP_HEADERS', JSON.stringify(stolenHeaders));
            }
        } catch(e) {}
    }

    function scanKtp(data) {
        try {
            let list = Array.isArray(data) ? data : (data.items || data.data);
            if (!Array.isArray(list)) return;
            ktpIds = new Set();
            list.forEach(item => {
                if (item && item.id) {
                    ktpIds.add(item.id);
                }
            });
            saveData();
        } catch(e) {}
    }

    const _origFetch = window.fetch;
    window.fetch = async function(...args) {
        const reqUrl = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
        const options = args[1] || {};

        // 1. ВОРУЕМ ЗАГОЛОВКИ (Только те, где есть авторизация)
        if (reqUrl.includes('/api/') && options.headers) {
            try {
                let h = options.headers;
                let tempHeaders = {};
                // Обработка разных форматов Headers
                if (typeof h.entries === 'function') {
                    for (let [k, v] of h.entries()) tempHeaders[k] = v;
                } else {
                    tempHeaders = { ...h };
                }
                
                // Проверяем, есть ли там токен и системные ключи
                if (tempHeaders['Authorization'] || tempHeaders['authorization']) {
                    stolenHeaders = { ...tempHeaders };
                    saveData();
                }
            } catch(e) {}
        }

        const res = await _origFetch.apply(this, args);
        
        // 2. ВОРУЕМ ID ПРОГРАММ
        try {
            if (reqUrl.includes('/api/profeducation/plan/teacher/v1/calendar_plans') && !reqUrl.includes('finish') && !reqUrl.includes('recalc')) {
                res.clone().json().then(data => scanKtp(data)).catch(()=>{});
            }
        } catch(e) {}
        return res;
    };

    console.log("🕵️ Шпион КТП запущен (Кража ID и Headers активна).");
})();