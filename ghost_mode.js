(function() {
    console.log("%c👻 MESH Ghost Mode: Активирован. Телеметрия и трекеры заблокированы.", "color: #10b981; font-weight: bold; background: #0f172a; padding: 4px 8px; border-radius: 4px;");

    // Черный список шпионских доменов и эндпоинтов МЭШ
    const blockedSignatures = [
        'mc.yandex.ru',           
        'metrika.yandex',         
        'google-analytics.com',   
        'stats.g.doubleclick.net',
        '/api/telemetry',         
        '/api/metrics',           
        '/api/logs/client',       
        '/log/action',            
        'sentry.io'               
    ];

    // 1. ПЕРЕХВАТ СОВРЕМЕННЫХ ЗАПРОСОВ (FETCH)
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
        
        if (blockedSignatures.some(signature => url.includes(signature))) {
            console.log(`%c🛡️ Ghost Mode убил трекер: ${url.split('?')[0]}`, "color: #94a3b8; font-size: 10px;");
            // Отдаем фейковый успешный ответ, чтобы МЭШ не ругался красными ошибками в консоли
            return new Response(JSON.stringify({ status: "blocked", success: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        return originalFetch.apply(this, args);
    };

    // 2. ПЕРЕХВАТ СТАРЫХ ЗАПРОСОВ (XHR)
    const originalXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        const urlStr = typeof url === 'string' ? url : String(url || '');
        this._isBlocked = blockedSignatures.some(signature => urlStr.includes(signature));
        if (this._isBlocked) {
            console.log(`%c🛡️ Ghost Mode убил XHR трекер: ${urlStr.split('?')[0]}`, "color: #94a3b8; font-size: 10px;");
            // Направляем запрос в пустоту
            return originalXHROpen.apply(this, [method, 'about:blank', ...rest]);
        }
        return originalXHROpen.apply(this, [method, url, ...rest]);
    };

    const originalXHRSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function(...args) {
        if (this._isBlocked) {
            // Эмулируем успешное завершение XHR-запроса
            Object.defineProperty(this, 'readyState', { value: 4, writable: false });
            Object.defineProperty(this, 'status', { value: 200, writable: false });
            Object.defineProperty(this, 'responseText', { value: '{"success": true}', writable: false });
            if (typeof this.onreadystatechange === 'function') this.onreadystatechange();
            if (typeof this.onload === 'function') this.onload();
            return;
        }
        return originalXHRSend.apply(this, args);
    };
})();