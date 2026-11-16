// ==========================================
// ⚡ MESH SpeedUp (Модуль отключения анимаций)
// ==========================================
(function() {
    console.log("⚡ MESH SpeedUp: Турбо-режим загружен");

    const STYLE_ID = 'mesh-turbo-styles';

    function toggleTurboMode(enable) {
        let styleEl = document.getElementById(STYLE_ID);
        
        if (enable) {
            if (!styleEl) {
                styleEl = document.createElement('style');
                styleEl.id = STYLE_ID;
                // Агрессивный CSS: сводим длительность всех анимаций к 0 секундам
                styleEl.innerHTML = `
                    *, *::before, *::after {
                        transition-duration: 0s !important;
                        transition-delay: 0s !important;
                        animation-duration: 0s !important;
                        animation-delay: 0s !important;
                        scroll-behavior: auto !important;
                    }
                    /* Убираем плавное появление белой пелены загрузки */
                    .ant-spin-container::after {
                        transition: none !important;
                    }
                    /* Ускоряем всплывающие окна и тултипы */
                    .ant-tooltip, .ant-popover, .ant-modal-mask, .ant-modal-wrap {
                        animation-duration: 0s !important;
                        transition-duration: 0s !important;
                    }
                `;
                (document.head || document.documentElement).appendChild(styleEl);
            }
        } else {
            // Если выключили тумблер - удаляем стили, возвращаем плавность
            if (styleEl) styleEl.remove();
        }
    }

    // 1. Проверяем настройку при загрузке страницы
    chrome.storage.sync.get(['speedUp'], (data) => {
        if (data && data.speedUp) {
            toggleTurboMode(true);
        }
    });

    // 2. Слушаем переключатель из меню расширения в реальном времени
    chrome.runtime.onMessage.addListener((req) => {
        if (req.action === "updateSettings" && req.settings && req.settings.speedUp !== undefined) {
            toggleTurboMode(Boolean(req.settings.speedUp));
        }
    });
})();