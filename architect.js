// ==========================================
// 🛠️ MESH Architect v2.1 (Dynamic Load & Safe Exit)
// ==========================================
(async function() {
    console.log("🛠️ MESH Architect v2.1: Менеджер стилей загружен");

    let isActive = false;
    let hoveredEl = null;
    let rules = {}; 
    let overlay = null;
    let toolbar = null;

    // Загружаем сохраненные правила
    try {
        const result = await chrome.storage.local.get(['MESH_ARCHITECT_RULES']);
        if (result.MESH_ARCHITECT_RULES) {
            rules = result.MESH_ARCHITECT_RULES;
        } else {
            const saved = localStorage.getItem('MESH_ARCHITECT_RULES');
            if (saved) rules = JSON.parse(saved);
        }
        applyRules(); // Применяем правила сразу после загрузки
    } catch(e) {}

    // Функция сохранения и применения правил
    async function saveRules() {
        try {
            const result = await chrome.storage.local.get(['MESH_ARCHITECT_RULES']);
            if (result.MESH_ARCHITECT_RULES) {
                rules = { ...result.MESH_ARCHITECT_RULES, ...rules };
            }
        } catch(e) {}
        localStorage.setItem('MESH_ARCHITECT_RULES', JSON.stringify(rules));
        await chrome.storage.local.set({ 'MESH_ARCHITECT_RULES': rules });
        applyRules();
        if (isActive) renderManagerPanel(); 
    }

    // Генератор уникального CSS-селектора для элемента
    function getCssSelector(el) {
        if (el.id) return '#' + el.id;
        if (el.className && typeof el.className === 'string') {
            const classes = el.className.split(' ').filter(c => c && !c.includes('mesh-') && !c.includes('ant-')).join('.');
            if (classes) return el.tagName.toLowerCase() + '.' + classes;
        }
        return el.tagName.toLowerCase();
    }

    // Применение стилей на страницу
    function applyRules() {
        let styleEl = document.getElementById('mesh-architect-styles');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'mesh-architect-styles';
            (document.head || document.documentElement).appendChild(styleEl);
        }
        
        let css = '';
        for (let sel in rules) {
            if (rules[sel].hide) css += `${sel} { display: none !important; opacity: 0 !important; }\n`;
            if (rules[sel].bg) css += `${sel} { background-color: ${rules[sel].bg} !important; }\n`;
        }
        styleEl.innerHTML = css;
    }

    applyRules(); // Применяем стили сразу

    // Безопасная инициализация HTML-элементов Архитектора (чтобы не падало при ранней загрузке)
    function initDOM() {
        if (document.getElementById('mesh-architect-overlay')) return;
        
        overlay = document.createElement('div');
        overlay.id = 'mesh-architect-overlay';
        overlay.style.cssText = 'position:fixed; pointer-events:none; z-index:9999998; background:rgba(230, 126, 34, 0.2); border:2px dashed #e67e22; transition:all 0.05s; display:none; border-radius:4px;';
        document.body.appendChild(overlay);

        toolbar = document.createElement('div');
        toolbar.id = 'mesh-architect-toolbar';
        toolbar.style.cssText = 'position:fixed; background:#2c3e50; padding:10px; border-radius:8px; display:none; z-index:9999999; box-shadow:0 8px 25px rgba(0,0,0,0.6); gap:10px; align-items:center; border: 1px solid #34495e;';
        document.body.appendChild(toolbar);
    }

    // Отрисовка боковой панели Менеджера
    function renderManagerPanel() {
        initDOM();
        let panel = document.getElementById('mesh-architect-manager');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'mesh-architect-manager';
            panel.style.cssText = 'position:fixed; top:80px; right:20px; width:280px; background:rgba(20, 25, 30, 0.65); backdrop-filter: blur(16px); border:1px solid rgba(255,255,255,0.15); border-radius:16px; padding:15px; color:white; z-index:9999999; font-family:sans-serif; box-shadow:0 10px 30px rgba(0,0,0,0.5); transition: 0.3s;';
            document.body.appendChild(panel);
        }

        let html = `
            <div style="font-weight:bold; color:#e67e22; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:14px;">🛠️ Менеджер</span>
                <span style="background:#e74c3c; border-radius:6px; padding:4px 8px; font-size:10px; cursor:pointer; font-weight:bold; transition:0.2s;" id="mesh-arch-clear-all" onmouseover="this.style.background='#c0392b'" onmouseout="this.style.background='#e74c3c'">Сбросить всё</span>
            </div>
        `;

        if (Object.keys(rules).length === 0) {
            html += `<div style="font-size:12px; color:#bdc3c7; margin-bottom:15px;">Нет активных изменений.<br>Кликайте по элементам на сайте, чтобы изменить их!</div>`;
        } else {
            html += `<div style="max-height:280px; overflow-y:auto; font-size:12px; display:flex; flex-direction:column; gap:8px; padding-right:5px; margin-bottom:15px;">`;
            for (let sel in rules) {
                let rule = rules[sel];
                let desc = rule.hide ? 'Скрыто 👁️‍🗨️' : 'Цвет фона 🎨';
                let colorIndicator = rule.bg ? `<span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${rule.bg}; margin-left:5px;"></span>` : '';
                let shortSel = sel.length > 25 ? sel.substring(0, 25) + '...' : sel;
                
                html += `
                    <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:8px 10px; border-radius:6px; border-left: 3px solid ${rule.hide ? '#e74c3c' : '#3498db'};">
                        <div style="display:flex; flex-direction:column; overflow:hidden;" title="${sel}">
                            <div style="color:#ecf0f1; font-weight:bold; display:flex; align-items:center;">${desc} ${colorIndicator}</div>
                            <span style="color:#7f8c8d; font-size:10px; white-space:nowrap; margin-top:2px;">${shortSel}</span>
                        </div>
                        <button class="mesh-arch-del-btn" data-sel="${sel}" style="background:transparent; color:#e74c3c; border:1px solid #e74c3c; border-radius:4px; width:26px; height:26px; cursor:pointer; font-weight:bold; transition:0.2s;" onmouseover="this.style.background='#e74c3c'; this.style.color='white';" onmouseout="this.style.background='transparent'; this.style.color='#e74c3c';">×</button>
                    </div>
                `;
            }
            html += `</div>`;
        }

        // НОВАЯ КНОПКА: Сохранить и выйти
        html += `<button id="mesh-arch-finish" style="width:100%; background:#2ecc71; color:white; border:none; padding:10px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:13px; transition:0.2s;" onmouseover="this.style.background='#27ae60'" onmouseout="this.style.background='#2ecc71'">💾 Сохранить и обновить</button>`;

        panel.innerHTML = html;

        document.getElementById('mesh-arch-clear-all').onclick = () => {
            if (confirm("Точно удалить ВСЕ изменения дизайна?")) { rules = {}; saveRules(); }
        };

        panel.querySelectorAll('.mesh-arch-del-btn').forEach(btn => {
            btn.onclick = (e) => {
                let s = e.target.getAttribute('data-sel');
                delete rules[s];
                saveRules();
            };
        });

        // Обработчик кнопки финального сохранения
        document.getElementById('mesh-arch-finish').onclick = () => {
            // Выключаем тумблер в настройках расширения и перезагружаем страницу
            chrome.storage.sync.set({ architectMode: false }, () => {
                window.location.reload();
            });
        };
    }

    // ЛОГИКА ВЫДЕЛЕНИЯ И КЛИКОВ
    function mouseMoveHandler(e) {
        if (!isActive || !overlay) return;
        const target = e.target;
        
        if (target.closest('#mesh-architect-manager') || target.closest('#mesh-architect-toolbar') || target.closest('#mesh-robot-panel') || target.closest('#mesh-spy-panel')) {
            overlay.style.display = 'none'; return;
        }

        const rect = target.getBoundingClientRect();
        overlay.style.width = rect.width + 'px';
        overlay.style.height = rect.height + 'px';
        overlay.style.top = rect.top + 'px';
        overlay.style.left = rect.left + 'px';
        overlay.style.display = 'block';
        hoveredEl = target;
    }

    function clickHandler(e) {
        if (!isActive || !toolbar) return;
        if (e.target.closest('#mesh-architect-manager') || e.target.closest('#mesh-architect-toolbar') || e.target.closest('#mesh-robot-panel') || e.target.closest('#mesh-spy-panel')) return;
        
        e.preventDefault();
        e.stopPropagation();

        if (hoveredEl) {
            const sel = getCssSelector(hoveredEl);
            toolbar.style.left = Math.min(e.clientX, window.innerWidth - 250) + 'px';
            toolbar.style.top = Math.min(e.clientY, window.innerHeight - 60) + 'px';
            toolbar.style.display = 'flex';

            toolbar.innerHTML = `
                <button id="mesh-arch-hide" style="background:#e74c3c; color:white; border:none; padding:8px 12px; border-radius:6px; cursor:pointer; font-weight:bold; transition:0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">👁️‍🗨️ Скрыть блок</button>
                <div style="display:flex; align-items:center; gap:5px; background:rgba(0,0,0,0.2); padding:4px 8px; border-radius:6px;">
                    <span style="font-size:12px; color:white;">Фон:</span>
                    <input type="color" id="mesh-arch-bg" value="#3498db" title="Выбрать цвет" style="cursor:pointer; background:none; border:none; width:24px; height:24px; padding:0;">
                </div>
                <button id="mesh-arch-cancel" style="background:transparent; color:#bdc3c7; border:none; padding:8px; cursor:pointer; font-size:14px; transition:0.2s;" onmouseover="this.style.color='white'" onmouseout="this.style.color='#bdc3c7'">✖</button>
            `;

            document.getElementById('mesh-arch-hide').onclick = () => { rules[sel] = { hide: true }; saveRules(); toolbar.style.display = 'none'; overlay.style.display = 'none'; };
            document.getElementById('mesh-arch-bg').onchange = (ev) => { rules[sel] = { bg: ev.target.value }; saveRules(); toolbar.style.display = 'none'; overlay.style.display = 'none'; };
            document.getElementById('mesh-arch-cancel').onclick = () => { toolbar.style.display = 'none'; };
        }
    }

    // Запуск и Остановка "на лету" (без обновления страницы)
    function toggleArchitectMode(state) {
        isActive = state;
        if (isActive) {
            // Ждем, пока браузер отрисует body, прежде чем внедрять панели
            let ivl = setInterval(() => {
                if (document.body) {
                    clearInterval(ivl);
                    initDOM();
                    document.addEventListener('mousemove', mouseMoveHandler, true);
                    document.addEventListener('click', clickHandler, true);
                    renderManagerPanel();
                }
            }, 100);
        } else {
            document.removeEventListener('mousemove', mouseMoveHandler, true);
            document.removeEventListener('click', clickHandler, true);
            if (overlay) overlay.style.display = 'none';
            if (toolbar) toolbar.style.display = 'none';
            let p = document.getElementById('mesh-architect-manager');
            if (p) p.remove();
        }
    }

    // Слушатель команд от всплывающего меню расширения
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.action === "toggleArchitect") {
            toggleArchitectMode(msg.state);
        } else if (msg.action === "resetDesign") {
            rules = {}; saveRules();
        }
    });

    // При загрузке страницы проверяем, был ли включен тумблер
    chrome.storage.sync.get(['architectMode'], (data) => {
        if (data && data.architectMode) {
            toggleArchitectMode(true);
        }
    });

})();