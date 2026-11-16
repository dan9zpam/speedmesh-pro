// ==========================================
// 🎨 MESH Themes (Полносайтовая темная тема + пресеты)
// ==========================================
(function() {
    console.log("🎨 MESH Themes: Движок стилей запущен");

    const PALETTES = {
        dark: {
            canvas: '#0d1117',
            surface: '#161b22',
            elevated: '#1f2630',
            hover: '#21262d',
            hoverStrong: '#30363d',
            todayBg: '#1c2128',
            lockedBg: '#090c10',
            lockedBorder: '#21262d',
            lockedText: '#9aa4b2',
            border: '#30363d',
            text: '#e6edf3',
            muted: '#8b949e',
            mutedDark: '#484f58',
            accent: '#58a6ff',
            accentHover: '#79c0ff',
            accentRing: 'rgba(88, 166, 255, 0.2)',
            primaryBg: '#238636',
            primaryBorder: '#2ea043',
            primaryHover: '#2ea043',
            primaryHoverBorder: '#3fb950',
            activeControlBg: '#1f6feb',
            dangerBorder: '#da3633',
            dangerText: '#f85149',
            dangerHoverBg: '#b62324',
            tagAccentBg: '#1c2738',
            tagAccentBorder: '#28476d',
            alertInfoBg: '#121d2f',
            alertInfoBorder: '#1f3b64',
            thumbHover: '#484f58',
            tintBase: [22, 26, 34]
        },
        crimson: {
            canvas: '#08080a',
            surface: '#120b0d',
            elevated: '#1d1014',
            hover: '#2a141a',
            hoverStrong: '#3b1822',
            todayBg: '#190d11',
            lockedBg: '#040405',
            lockedBorder: '#260d12',
            lockedText: '#b58d93',
            border: '#4a1821',
            text: '#f5e8ea',
            muted: '#b58c92',
            mutedDark: '#6e474d',
            accent: '#ef4444',
            accentHover: '#f87171',
            accentRing: 'rgba(239, 68, 68, 0.25)',
            primaryBg: '#b91c1c',
            primaryBorder: '#dc2626',
            primaryHover: '#dc2626',
            primaryHoverBorder: '#ef4444',
            activeControlBg: '#dc2626',
            dangerBorder: '#ef4444',
            dangerText: '#fca5a5',
            dangerHoverBg: '#991b1b',
            tagAccentBg: '#2b1016',
            tagAccentBorder: '#6b1d2a',
            alertInfoBg: '#1f0d12',
            alertInfoBorder: '#5c1824',
            thumbHover: '#6b222e',
            tintBase: [28, 12, 16]
        }
    };

    function buildAdaptiveThemeCss(p) {
        return `
        :root {
            color-scheme: dark !important;
            --mesh-sticky-bg: ${p.surface};
            --mesh-sticky-header-bg: ${p.canvas};
        }

        /* 1. Базовые контейнеры и разметка страницы */
        html, body, #root, #app, main,
        .ant-layout, .ant-layout-content, .ant-layout-sider, .ant-layout-header, .ant-layout-footer,
        header, [class*="Header-header"], [class*="mes-header"], [class*="topbar"], [class*="navBar"], [class*="navbar"] {
            background-color: ${p.canvas} !important;
            color: ${p.text} !important;
            border-color: ${p.border} !important;
        }

        /* 2. Адаптивные маркеры (из DOM-сканера) */
        [data-mesh-dark-bg="canvas"] { background-color: ${p.canvas} !important; background-image: none !important; }
        [data-mesh-dark-bg="surface"] { background-color: ${p.surface} !important; background-image: none !important; }
        [data-mesh-dark-bg="elevated"] { background-color: ${p.elevated} !important; background-image: none !important; }
        [data-mesh-dark-bg="tint"] { background-color: var(--mesh-dark-bg, ${p.elevated}) !important; }
        [data-mesh-dark-text="1"] { color: ${p.text} !important; }
        [data-mesh-dark-text="muted"] { color: ${p.muted} !important; }
        [data-mesh-dark-text="accent"] { color: ${p.accent} !important; }
        [data-mesh-dark-border="1"] { border-color: ${p.border} !important; }

        /* 3. Заблокированные клетки журнала (ATTENDANCE, readonly и др.) */
        [data-mesh-dark-locked="1"],
        td:has(> [data-mesh-dark-locked="1"]),
        [role="gridcell"]:has(> [data-mesh-dark-locked="1"]) {
            background-color: ${p.lockedBg} !important;
            border-color: ${p.lockedBorder} !important;
            color: ${p.lockedText} !important;
            cursor: not-allowed !important;
        }
        [data-mesh-dark-locked="1"] [data-test-component*="markCell"],
        [data-mesh-dark-locked="1"][data-test-component*="markCell"],
        [data-mesh-dark-locked="1"] * {
            color: ${p.lockedText} !important;
            filter: grayscale(0.85) !important;
            cursor: not-allowed !important;
            background-color: transparent !important;
        }

        /* 4. Таблицы и журнал МЭШ */
        .ant-table, .ant-table-container, .ant-table-content, .ant-table-cell,
        table, th, .Dnevnik-grid {
            background-color: ${p.surface} !important;
            color: ${p.text} !important;
            border-color: ${p.border} !important;
        }
        td, tr {
            color: ${p.text} !important;
            border-color: ${p.border} !important;
        }
        .ant-table-thead > tr > th, thead th {
            background-color: ${p.canvas} !important;
            color: ${p.text} !important;
            border-color: ${p.border} !important;
            font-weight: 600 !important;
        }
        .ant-table-cell-fix-left, .ant-table-cell-fix-right {
            background-color: ${p.surface} !important;
            z-index: 2 !important;
        }
        .ant-table-tbody > tr.ant-table-row:hover > td, tbody tr:hover > td,
        .ant-table-tbody > tr.ant-table-row-selected > td {
            background-color: ${p.hover} !important;
        }
        .ant-table-column-sorter, .ant-table-filter-trigger {
            color: ${p.muted} !important;
        }
        .ant-table-column-sorter-up.active, .ant-table-column-sorter-down.active,
        .ant-table-filter-trigger.active {
            color: ${p.accent} !important;
        }
        td[class*="today"], td[class*="current"], th[class*="today"], th[class*="current"],
        [class*="current-day"], [class*="is-today"] {
            background-color: ${p.todayBg} !important;
        }

        /* 5. Кнопки */
        .ant-btn-primary {
            background-color: ${p.primaryBg} !important;
            border-color: ${p.primaryBorder} !important;
            color: #ffffff !important;
            text-shadow: none !important;
            box-shadow: 0 1px 0 rgba(0, 0, 0, 0.2) !important;
        }
        .ant-btn-primary:hover, .ant-btn-primary:focus {
            background-color: ${p.primaryHover} !important;
            border-color: ${p.primaryHoverBorder} !important;
            color: #ffffff !important;
        }
        .ant-btn-primary[disabled], .ant-btn-primary.disabled {
            background-color: ${p.hover} !important;
            border-color: ${p.border} !important;
            color: ${p.mutedDark} !important;
        }
        .ant-btn:not(.ant-btn-primary):not(.ant-btn-dangerous):not(.ant-btn-link) {
            background-color: ${p.hover} !important;
            border-color: ${p.border} !important;
            color: ${p.text} !important;
            text-shadow: none !important;
        }
        .ant-btn:not(.ant-btn-primary):not(.ant-btn-dangerous):not(.ant-btn-link):hover,
        .ant-btn:not(.ant-btn-primary):not(.ant-btn-dangerous):not(.ant-btn-link):focus {
            background-color: ${p.hoverStrong} !important;
            border-color: ${p.muted} !important;
            color: #ffffff !important;
        }
        .ant-btn-link {
            color: ${p.accent} !important;
            background: transparent !important;
            border-color: transparent !important;
        }
        .ant-btn-link:hover {
            color: ${p.accentHover} !important;
        }
        .ant-btn-dangerous {
            background-color: ${p.hover} !important;
            border-color: ${p.dangerBorder} !important;
            color: ${p.dangerText} !important;
        }
        .ant-btn-dangerous:hover {
            background-color: ${p.dangerHoverBg} !important;
            color: #ffffff !important;
        }

        /* 6. Вкладки (Tabs) */
        .ant-tabs-nav, .ant-tabs-nav-wrap {
            background-color: transparent !important;
        }
        .ant-tabs-nav::before {
            border-bottom: 1px solid ${p.border} !important;
        }
        .ant-tabs-tab {
            color: ${p.muted} !important;
            background-color: transparent !important;
            border-color: transparent !important;
        }
        .ant-tabs-tab:hover {
            color: ${p.text} !important;
        }
        .ant-tabs-tab.ant-tabs-tab-active .ant-tabs-tab-btn,
        .ant-tabs-tab.ant-tabs-tab-active {
            color: ${p.text} !important;
            font-weight: 600 !important;
        }
        .ant-tabs-ink-bar {
            background-color: ${p.accent} !important;
        }
        .ant-tabs-card > .ant-tabs-nav .ant-tabs-tab {
            background-color: ${p.surface} !important;
            border-color: ${p.border} !important;
            color: ${p.muted} !important;
        }
        .ant-tabs-card > .ant-tabs-nav .ant-tabs-tab.ant-tabs-tab-active {
            background-color: ${p.hover} !important;
            border-color: ${p.border} !important;
            border-bottom-color: ${p.hover} !important;
            color: ${p.text} !important;
        }

        /* 7. Переключатели, радио-кнопки и сегменты */
        .ant-radio-button-wrapper {
            background-color: ${p.surface} !important;
            border-color: ${p.border} !important;
            color: ${p.muted} !important;
        }
        .ant-radio-button-wrapper:hover {
            color: ${p.text} !important;
        }
        .ant-radio-button-wrapper-checked:not(.ant-radio-button-wrapper-disabled) {
            background-color: ${p.hover} !important;
            border-color: ${p.accent} !important;
            color: ${p.text} !important;
            box-shadow: -1px 0 0 0 ${p.accent} !important;
        }
        .ant-segmented {
            background-color: ${p.canvas} !important;
            color: ${p.muted} !important;
        }
        .ant-segmented-item-selected {
            background-color: ${p.hover} !important;
            color: ${p.text} !important;
        }
        .ant-checkbox-inner {
            background-color: ${p.canvas} !important;
            border-color: ${p.border} !important;
        }
        .ant-checkbox-checked .ant-checkbox-inner {
            background-color: ${p.activeControlBg} !important;
            border-color: ${p.activeControlBg} !important;
        }
        .ant-switch {
            background-color: ${p.border} !important;
        }
        .ant-switch-checked {
            background-color: ${p.activeControlBg} !important;
        }

        /* 8. Инпуты, селекторы, выпадающие списки и пикеры */
        input:not([type="color"]):not([type="checkbox"]):not([type="radio"]),
        textarea, select,
        .ant-input, .ant-select-selector, .ant-picker {
            background-color: ${p.canvas} !important;
            color: ${p.text} !important;
            border-color: ${p.border} !important;
        }
        ::placeholder, .ant-input::placeholder {
            color: ${p.lockedText} !important;
        }
        .ant-input:focus, .ant-select-focused:not(.ant-select-disabled) .ant-select-selector,
        .ant-picker-focused {
            border-color: ${p.accent} !important;
            box-shadow: 0 0 0 2px ${p.accentRing} !important;
        }
        .ant-select-selection-item, .ant-select-selection-placeholder {
            color: ${p.text} !important;
        }
        .ant-select-arrow, .ant-select-clear {
            color: ${p.muted} !important;
            background-color: transparent !important;
        }
        .ant-select-dropdown {
            background-color: ${p.surface} !important;
            border: 1px solid ${p.border} !important;
            color: ${p.text} !important;
            box-shadow: 0 8px 24px rgba(0,0,0,0.5) !important;
        }
        .ant-select-item {
            background-color: transparent !important;
            color: ${p.text} !important;
        }
        .ant-select-item-option-selected:not(.ant-select-item-option-disabled) {
            background-color: ${p.hover} !important;
            color: ${p.accent} !important;
            font-weight: 600 !important;
        }
        .ant-select-item-option-active:not(.ant-select-item-option-disabled) {
            background-color: ${p.hoverStrong} !important;
            color: ${p.text} !important;
        }
        .ant-select-item-option-disabled {
            color: ${p.mutedDark} !important;
        }

        /* 9. Календарь и DatePicker */
        .ant-picker-dropdown, .ant-picker-panel-container, .ant-picker-panel {
            background-color: ${p.surface} !important;
            border-color: ${p.border} !important;
            color: ${p.text} !important;
        }
        .ant-picker-header {
            color: ${p.text} !important;
            border-bottom: 1px solid ${p.border} !important;
        }
        .ant-picker-header button {
            color: ${p.muted} !important;
        }
        .ant-picker-header button:hover {
            color: ${p.text} !important;
        }
        .ant-picker-content th {
            color: ${p.muted} !important;
        }
        .ant-picker-cell {
            color: ${p.mutedDark} !important;
        }
        .ant-picker-cell-in-view {
            color: ${p.text} !important;
        }
        .ant-picker-cell:hover:not(.ant-picker-cell-selected) .ant-picker-cell-inner {
            background-color: ${p.hover} !important;
        }
        .ant-picker-cell-in-view.ant-picker-cell-selected .ant-picker-cell-inner {
            background-color: ${p.activeControlBg} !important;
            color: #ffffff !important;
        }
        .ant-picker-cell-in-view.ant-picker-cell-today .ant-picker-cell-inner::before {
            border-color: ${p.accent} !important;
        }
        .ant-picker-footer {
            border-top: 1px solid ${p.border} !important;
            background-color: ${p.surface} !important;
        }
        .ant-picker-today-btn {
            color: ${p.accent} !important;
        }
        .ant-picker-input > input {
            color: ${p.text} !important;
        }
        .ant-picker-suffix {
            color: ${p.muted} !important;
        }

        /* 10. Карточки, модалки, меню и всплывающие окна */
        .ant-card, .ant-card-body, .ant-list-item, .ant-list-header, .ant-list-footer,
        .ant-descriptions-view, .ant-descriptions-row, .ant-descriptions-item-label, .ant-descriptions-item-content,
        .ant-empty, .ant-result, .ant-spin-container, .ant-spin-blur {
            background-color: ${p.surface} !important;
            border-color: ${p.border} !important;
            color: ${p.text} !important;
        }
        .ant-card-head {
            background-color: ${p.surface} !important;
            border-bottom-color: ${p.border} !important;
            color: ${p.text} !important;
        }
        .ant-card-head-title, .ant-empty-description, .ant-result-title, .ant-result-subtitle {
            color: ${p.text} !important;
        }
        .ant-collapse {
            background-color: ${p.surface} !important;
            border-color: ${p.border} !important;
        }
        .ant-collapse-item {
            border-bottom-color: ${p.border} !important;
        }
        .ant-collapse > .ant-collapse-item > .ant-collapse-header {
            background-color: ${p.surface} !important;
            color: ${p.text} !important;
        }
        .ant-collapse-content {
            background-color: ${p.canvas} !important;
            border-top-color: ${p.border} !important;
            color: ${p.text} !important;
        }
        .ant-menu, .ant-menu-dark, .ant-menu-light {
            background-color: ${p.surface} !important;
            color: ${p.text} !important;
            border-color: ${p.border} !important;
        }
        .ant-menu-item, .ant-menu-submenu-title {
            color: ${p.muted} !important;
        }
        .ant-menu-item:hover, .ant-menu-submenu-title:hover {
            color: ${p.text} !important;
            background-color: ${p.hover} !important;
        }
        .ant-menu-item-selected {
            background-color: ${p.hover} !important;
            color: ${p.text} !important;
        }
        [role="dialog"], [role="menu"], [role="listbox"], [role="tooltip"], [role="tabpanel"],
        .ant-modal-content, .ant-modal-header, .ant-modal-body, .ant-modal-footer,
        .ant-dropdown-menu, .ant-popover-inner, .ant-popover-arrow-content,
        .ant-drawer-content, .ant-drawer-header, .ant-drawer-body {
            background-color: ${p.surface} !important;
            color: ${p.text} !important;
            border-color: ${p.border} !important;
        }
        .ant-modal-title, .ant-drawer-title, .ant-popover-title {
            color: ${p.text} !important;
        }
        .ant-modal-close, .ant-drawer-close, .ant-popover-close {
            color: ${p.muted} !important;
        }
        .ant-modal-close:hover, .ant-drawer-close:hover {
            color: ${p.text} !important;
        }
        .ant-popover-inner-content {
            color: ${p.text} !important;
        }
        .ant-tooltip-inner {
            background-color: ${p.hover} !important;
            color: ${p.text} !important;
            border: 1px solid ${p.border} !important;
        }

        /* 11. Бейджи, теги, алерты, пагинация и хлебные крошки */
        .ant-tag {
            background-color: ${p.hover} !important;
            border-color: ${p.border} !important;
            color: ${p.text} !important;
        }
        .ant-tag-blue {
            background-color: ${p.tagAccentBg} !important;
            border-color: ${p.tagAccentBorder} !important;
            color: ${p.accentHover} !important;
        }
        .ant-alert {
            background-color: ${p.surface} !important;
            border-color: ${p.border} !important;
            color: ${p.text} !important;
        }
        .ant-alert-info {
            background-color: ${p.alertInfoBg} !important;
            border-color: ${p.alertInfoBorder} !important;
        }
        .ant-alert-message, .ant-alert-description {
            color: ${p.text} !important;
        }
        .ant-breadcrumb, .ant-breadcrumb a, .ant-breadcrumb-link {
            color: ${p.muted} !important;
        }
        .ant-breadcrumb a:hover {
            color: ${p.text} !important;
        }
        .ant-breadcrumb-separator {
            color: ${p.mutedDark} !important;
        }
        .ant-pagination-item {
            background-color: ${p.surface} !important;
            border-color: ${p.border} !important;
        }
        .ant-pagination-item a {
            color: ${p.text} !important;
        }
        .ant-pagination-item-active {
            background-color: ${p.hover} !important;
            border-color: ${p.accent} !important;
        }
        .ant-pagination-item-active a {
            color: ${p.accent} !important;
        }
        .ant-pagination-prev .ant-pagination-item-link,
        .ant-pagination-next .ant-pagination-item-link {
            background-color: ${p.surface} !important;
            border-color: ${p.border} !important;
            color: ${p.text} !important;
        }

        /* 12. Ссылки и типографика */
        a, .ant-typography a {
            color: ${p.accent} !important;
        }
        a:hover, .ant-typography a:hover {
            color: ${p.accentHover} !important;
        }

        /* 13. Скроллбары */
        ::-webkit-scrollbar { width: 10px; height: 10px; }
        ::-webkit-scrollbar-track { background: ${p.canvas}; }
        ::-webkit-scrollbar-thumb { background: ${p.border}; border-radius: 5px; }
        ::-webkit-scrollbar-thumb:hover { background: ${p.thumbHover}; }

        /* 14. Центр задач */
        #mesh-task-center {
            --mesh-tc-text: ${p.text};
            --mesh-tc-surface: ${p.surface};
            --mesh-tc-elevated: ${p.elevated};
            --mesh-tc-btn-bg: ${p.hover};
            --mesh-tc-btn-hover: ${p.hoverStrong};
            --mesh-tc-btn-text: ${p.text};
            --mesh-tc-border: ${p.border};
            --mesh-tc-border-subtle: ${p.border};
            --mesh-tc-accent: ${p.accent};
            --mesh-tc-progress: ${p.accent};
            --mesh-tc-muted: ${p.muted};
            --mesh-tc-message: ${p.text};
            --mesh-tc-error: ${p.dangerText};
            --mesh-tc-done: ${p.primaryHoverBorder};
            --mesh-tc-shadow: rgba(0, 0, 0, 0.55);
        }
        `;
    }

    const THEMES = {
        'default': { css: '' },
        'dark': { css: buildAdaptiveThemeCss(PALETTES.dark), adaptive: true, palette: PALETTES.dark },
        'crimson': { css: buildAdaptiveThemeCss(PALETTES.crimson), adaptive: true, palette: PALETTES.crimson }
    };

    let activePalette = PALETTES.dark;

    const SKIP_TAGS = new Set([
        'SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT',
        'IMG', 'SVG', 'PATH', 'CIRCLE', 'RECT', 'POLYGON', 'LINE', 'POLYLINE',
        'CANVAS', 'VIDEO', 'AUDIO', 'IFRAME', 'BR', 'HR'
    ]);

    let darkObserver = null;
    let pendingNodes = new Set();
    let pendingAttrs = new Set();
    let rafScheduled = false;
    let currentThemeKey = 'default';

    function setAttrIfChanged(el, attr, value) {
        if (el.getAttribute(attr) !== value) el.setAttribute(attr, value);
    }

    function parseRgba(colorStr) {
        if (!colorStr || colorStr === 'transparent') return null;
        const m = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (!m) return null;
        const a = m[4] === undefined ? 1 : parseFloat(m[4]);
        if (a <= 0.05) return null;
        return { r: +m[1], g: +m[2], b: +m[3], a };
    }

    function isExtensionElement(el) {
        if (!el || el.nodeType !== 1) return true;
        if (el.id && (el.id.startsWith('mesh-') || el.id.startsWith('speedmesh-'))) return true;
        if (typeof el.closest === 'function' && el.closest('[id^="mesh-"], [id^="speedmesh-"], [class^="mesh-"], [class*=" mesh-"]')) return true;
        return false;
    }

    function toDarkTint(r, g, b) {
        const min = Math.min(r, g, b);
        const max = Math.max(r, g, b);
        const spread = max - min || 1;
        const [br, bg, bb] = activePalette.tintBase || [22, 26, 34];
        const nr = Math.round(br + ((r - min) / spread) * 34);
        const ng = Math.round(bg + ((g - min) / spread) * 34);
        const nb = Math.round(bb + ((b - min) / spread) * 34);
        return `rgb(${nr}, ${ng}, ${nb})`;
    }

    function isLockedJournalCell(el, cs) {
        const dtc = el.getAttribute('data-test-component') || '';
        const isMarkCell = dtc.includes('markCell');
        const innerMarkCell = isMarkCell ? el : (el.tagName === 'TD' || el.getAttribute('role') === 'gridcell' ? el.querySelector('[data-test-component*="markCell"]') : null);
        if (!innerMarkCell) return false;

        const disabledBy = innerMarkCell.getAttribute('data-disabled-by');
        if (disabledBy && disabledBy !== 'NOT_DISABLED') return true;
        if (disabledBy === 'NOT_DISABLED') {
            const cellContainer = el.closest('td, [role="gridcell"]') || el;
            const cls = typeof cellContainer.className === 'string' ? cellContainer.className : '';
            if (/(disabled|locked|readonly|grey|not-participate)/i.test(cls)) return true;
            return false;
        }

        const cls = typeof el.className === 'string' ? el.className : '';
        if (/(disabled|locked|readonly|grey|not-participate)/i.test(cls)) return true;

        const bg = parseRgba(cs.backgroundColor);
        if (bg && bg.a > 0.12) {
            const sat = Math.max(bg.r, bg.g, bg.b) - Math.min(bg.r, bg.g, bg.b);
            if (bg.r >= 225 && bg.r <= 250 && sat <= 12) return true;
        }
        return false;
    }

    function adaptElement(el) {
        if (!el || el.nodeType !== 1 || SKIP_TAGS.has(el.tagName) || isExtensionElement(el)) return;
        const cs = getComputedStyle(el);

        if (isLockedJournalCell(el, cs)) {
            setAttrIfChanged(el, 'data-mesh-dark-locked', '1');
            const hostCell = el.closest('td, [role="gridcell"]');
            if (hostCell && hostCell !== el) setAttrIfChanged(hostCell, 'data-mesh-dark-locked', '1');
            return;
        }
        if (el.closest && el.closest('[data-mesh-dark-locked="1"]')) return;

        const bg = parseRgba(cs.backgroundColor);
        if (bg && bg.a > 0.12) {
            const lum = 0.299 * bg.r + 0.587 * bg.g + 0.114 * bg.b;
            const sat = Math.max(bg.r, bg.g, bg.b) - Math.min(bg.r, bg.g, bg.b);
            if (lum > 175) {
                // Избавляемся от МЭШ-расцветки: слабонасыщенные синевато-холодные фоны МЭШ
                // (колонки текущего дня, подложки списков и панелей) делаем нейтральными темными поверхностями
                const isMeshLightBlue = (bg.b >= bg.r && bg.b >= bg.g && sat <= 32);
                if (sat > 10 && !isMeshLightBlue) {
                    const tint = toDarkTint(bg.r, bg.g, bg.b);
                    if (el.style.getPropertyValue('--mesh-dark-bg') !== tint) {
                        el.style.setProperty('--mesh-dark-bg', tint);
                    }
                    setAttrIfChanged(el, 'data-mesh-dark-bg', 'tint');
                } else if (lum >= 250) {
                    setAttrIfChanged(el, 'data-mesh-dark-bg', 'surface');
                } else if (lum >= 238) {
                    setAttrIfChanged(el, 'data-mesh-dark-bg', 'canvas');
                } else {
                    setAttrIfChanged(el, 'data-mesh-dark-bg', 'elevated');
                }
            } else if (bg.b > bg.r && bg.b >= bg.g && sat > 40 && lum <= 175) {
                // Насыщенные МЭШ-синие кнопки/панели/шапки, не покрытые базовым CSS
                setAttrIfChanged(el, 'data-mesh-dark-bg', 'elevated');
            }
        } else if (cs.backgroundImage && cs.backgroundImage.includes('gradient(')) {
            const stops = cs.backgroundImage.match(/rgba?\(\d+,\s*\d+,\s*\d+(?:,\s*[\d.]+)?\)/g);
            if (stops && stops.some((s) => {
                const c = parseRgba(s);
                return c && (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) > 140;
            })) {
                setAttrIfChanged(el, 'data-mesh-dark-bg', 'elevated');
            }
        }

        const isColoredAvg = !!(el.dataset?.meshColored || (el.closest && el.closest('[data-mesh-colored]')));
        if (isColoredAvg) {
            if (el.hasAttribute('data-mesh-dark-text')) el.removeAttribute('data-mesh-dark-text');
        } else {
            const fg = parseRgba(cs.color);
            if (fg && fg.a > 0.2) {
                const lum = 0.299 * fg.r + 0.587 * fg.g + 0.114 * fg.b;
                const sat = Math.max(fg.r, fg.g, fg.b) - Math.min(fg.r, fg.g, fg.b);
                // Исправление бага нечитаемого текста: любой темный текст на темном фоне
                if (lum < 145) {
                    if (sat < 45) {
                        setAttrIfChanged(el, 'data-mesh-dark-text', lum > 75 ? 'muted' : '1');
                    } else if (fg.b > fg.r && fg.b > fg.g) {
                        // Темно-синий текст МЭШ (заголовки, ссылки, подписи)
                        setAttrIfChanged(el, 'data-mesh-dark-text', 'accent');
                    } else if (sat < 80) {
                        setAttrIfChanged(el, 'data-mesh-dark-text', '1');
                    }
                }
            }
        }

        if (parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderLeftWidth) > 0 || parseFloat(cs.borderBottomWidth) > 0 || parseFloat(cs.borderRightWidth) > 0) {
            const bc = parseRgba(cs.borderTopColor) || parseRgba(cs.borderLeftColor) || parseRgba(cs.borderBottomColor) || parseRgba(cs.borderRightColor);
            if (bc) {
                const lum = 0.299 * bc.r + 0.587 * bc.g + 0.114 * bc.b;
                const sat = Math.max(bc.r, bc.g, bc.b) - Math.min(bc.r, bc.g, bc.b);
                if ((lum > 175 && sat < 40) || (bc.b > bc.r && bc.b >= bc.g && sat > 35)) {
                    setAttrIfChanged(el, 'data-mesh-dark-border', '1');
                }
            }
        }
    }

    function scanTree(root) {
        if (!root || root.nodeType !== 1) return;
        adaptElement(root);
        const children = root.querySelectorAll('*');
        for (let i = 0; i < children.length; i++) {
            adaptElement(children[i]);
        }
    }

    function flushPending() {
        rafScheduled = false;
        const nodes = Array.from(pendingNodes);
        const attrs = Array.from(pendingAttrs);
        pendingNodes.clear();
        pendingAttrs.clear();
        for (const node of nodes) {
            if (node.isConnected) scanTree(node);
        }
        for (const el of attrs) {
            if (el.isConnected) adaptElement(el);
        }
    }

    function scheduleFlush() {
        if ((pendingNodes.size > 0 || pendingAttrs.size > 0) && !rafScheduled) {
            rafScheduled = true;
            (window.requestAnimationFrame || setTimeout)(flushPending, 16);
        }
    }

    function startAdaptiveDark() {
        if (document.body) scanTree(document.body);
        if (darkObserver) return;
        darkObserver = new MutationObserver((mutations) => {
            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (node.nodeType === 1 && !isExtensionElement(node)) {
                        pendingNodes.add(node);
                    }
                }
            }
            scheduleFlush();
        });
        darkObserver.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    }

    function stopAdaptiveDark() {
        if (darkObserver) {
            darkObserver.disconnect();
            darkObserver = null;
        }
        pendingNodes.clear();
        pendingAttrs.clear();
        rafScheduled = false;
        document.querySelectorAll('[data-mesh-dark-bg], [data-mesh-dark-text], [data-mesh-dark-border], [data-mesh-dark-locked]').forEach((el) => {
            el.removeAttribute('data-mesh-dark-bg');
            el.removeAttribute('data-mesh-dark-text');
            el.removeAttribute('data-mesh-dark-border');
            el.removeAttribute('data-mesh-dark-locked');
            el.style.removeProperty('--mesh-dark-bg');
        });
    }

    function applyTheme(themeKey) {
        if (!THEMES[themeKey]) themeKey = 'default';
        currentThemeKey = themeKey;
        activePalette = THEMES[themeKey].palette || PALETTES.dark;
        let styleEl = document.getElementById('mesh-theme-preset-styles');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'mesh-theme-preset-styles';
            (document.head || document.documentElement).appendChild(styleEl);
        }
        styleEl.innerHTML = THEMES[themeKey].css;

        if (THEMES[themeKey].adaptive) {
            startAdaptiveDark();
        } else {
            stopAdaptiveDark();
        }
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
