(function() {
    console.log("💉 MESH Spy Injector: Загрузка связи...");
    
    // Передаем настройку при старте страницы
    chrome.storage.sync.get(['apiSpyMode'], (data) => {
        window.sessionStorage.setItem('MESH_SPY_ENABLED', data.apiSpyMode ? 'true' : 'false');
    });

    // Слушаем тумблер в реальном времени
    chrome.runtime.onMessage.addListener((req) => {
        if (req.action === "updateSettings" && req.settings && req.settings.apiSpyMode !== undefined) {
            window.sessionStorage.setItem('MESH_SPY_ENABLED', req.settings.apiSpyMode ? 'true' : 'false');
            // Сигнализируем шпиону, что настройка изменилась
            window.dispatchEvent(new CustomEvent('MESH_SPY_TOGGLE'));
        }
    });

    try {
        const s = document.createElement('script');
        s.src = chrome.runtime.getURL('api_spy.js');
        s.onload = function() { this.remove(); };
        (document.head || document.documentElement).appendChild(s);
    } catch (e) {}
})();
