// ==========================================
// 🎨 MESH Themes (Только движок, без кнопок)
// ==========================================
(function() {
    console.log("🎨 MESH Themes: Движок стилей запущен");

    const THEMES = {
        'default': { css: '' },
        'dark': { css: `
            body, #root, .ant-layout, .ant-layout-content, main { background-color: #0d1117 !important; color: #c9d1d9 !important; }
            .ant-table, .ant-table-container, .ant-table-cell, th, td, tr, .Dnevnik-grid { background-color: #161b22 !important; color: #c9d1d9 !important; border-color: #30363d !important; }
            .ant-table-thead > tr > th { background-color: #0d1117 !important; color: #58a6ff !important; border-color: #30363d !important; }
            .ant-table-cell-fix-left, .ant-table-cell-fix-right { background-color: #161b22 !important; z-index: 2 !important; }
            .ant-table-tbody > tr.ant-table-row:hover > td { background-color: #21262d !important; }
        `},
        'matrix': { css: `
            body, #root, .ant-layout, .ant-layout-content, main { background-color: #000000 !important; color: #00FF41 !important; }
            .ant-table, .ant-table-container, .ant-table-cell, th, td, tr, .Dnevnik-grid { background-color: #001100 !important; color: #00FF41 !important; border-color: #008F11 !important; font-family: "Courier New", monospace !important; }
            .ant-table-thead > tr > th { background-color: #000000 !important; color: #00FF41 !important; border-color: #008F11 !important; }
            .ant-table-cell-fix-left, .ant-table-cell-fix-right { background-color: #001100 !important; z-index: 2 !important; }
            .ant-table-tbody > tr.ant-table-row:hover > td { background-color: #002200 !important; }
        `},
        'synthwave': { css: `
            body, #root, .ant-layout, .ant-layout-content, main { background-color: #1a1525 !important; color: #01cdfe !important; }
            .ant-table, .ant-table-container, .ant-table-cell, th, td, tr, .Dnevnik-grid { background-color: #2b213a !important; color: #01cdfe !important; border-color: #ff71ce !important; }
            .ant-table-thead > tr > th { background-color: #1a1525 !important; color: #b967ff !important; border-color: #ff71ce !important; }
            .ant-table-cell-fix-left, .ant-table-cell-fix-right { background-color: #2b213a !important; z-index: 2 !important; }
            .ant-table-tbody > tr.ant-table-row:hover > td { background-color: #3b2d50 !important; }
        `}
    };

    function applyTheme(themeKey) {
        if (!THEMES[themeKey]) themeKey = 'default';
        let styleEl = document.getElementById('mesh-theme-preset-styles');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'mesh-theme-preset-styles';
            (document.head || document.documentElement).appendChild(styleEl);
        }
        styleEl.innerHTML = THEMES[themeKey].css;
    }

    // Применяем сохраненную тему при загрузке
    chrome.storage.sync.get(['activeTheme'], (data) => {
        applyTheme(data.activeTheme || 'default');
    });

    // Слушаем сигналы из popup-меню
    chrome.runtime.onMessage.addListener((req) => {
        if (req.action === "updateTheme") {
            applyTheme(req.theme);
        }
    });

    // Жесткий фикс: следим, чтобы React не удалил наши стили
    document.addEventListener('SpeedmeshDOMReady', () => {
        if (document.body && !document.getElementById('mesh-theme-preset-styles')) {
            chrome.storage.sync.get(['activeTheme'], (data) => applyTheme(data.activeTheme || 'default'));
        }
    });
})();