(function() {
    if (window.top !== window.self) return;
    if (window.__MESH_HOMEWORK_SELECTOR__) return;
    window.__MESH_HOMEWORK_SELECTOR__ = true;

    const cardSelector = '[data-test-component^="scheduleDay-"][data-test-component*="-Card-"]';
    const lessonLinkSelector = '[data-test-component="buttonToLesson"]';
    const noHomeworkSelector = '[data-test-component="LILessonInfoHomeworkOpenAbsencesCalendar"]';
    const calendarSaveSelector = '[data-test-component="LIHomeworkAbsencesSave"]';
    const selectedPairs = new Map();
    const boundCards = new WeakSet();
    let featureEnabled = false;
    let isProcessing = false;

    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const monthTokens = [
        ['янв', 0], ['фев', 1], ['мар', 2], ['апр', 3], ['май', 4], ['мая', 4],
        ['июн', 5], ['июл', 6], ['авг', 7], ['сен', 8], ['окт', 9], ['ноя', 10], ['дек', 11]
    ];

    const style = document.createElement('style');
    style.textContent = `
        .mesh-homework-selectable { cursor: pointer !important; }
        .mesh-homework-selected { outline: 2px solid #10b981 !important; outline-offset: -2px; box-shadow: 0 0 14px 3px rgba(16, 185, 129, .65) !important; }
        #mesh-homework-panel button { border: 0; border-radius: 5px; padding: 8px; font-weight: 600; cursor: pointer; }
        #mesh-homework-panel button:disabled { opacity: .5; cursor: default; }
    `;
    document.head.appendChild(style);

    const panel = document.createElement('section');
    panel.id = 'mesh-homework-panel';
    panel.style.cssText = 'position:fixed; top:90px; right:20px; width:230px; max-width:calc(100vw - 32px); padding:10px; box-sizing:border-box; display:none; flex-direction:column; gap:7px; background:#1e293b; color:#f8fafc; border:1px solid #334155; border-left:3px solid #10b981; border-radius:8px; box-shadow:0 8px 24px rgba(15,23,42,.35); z-index:9999999; font:13px Inter, sans-serif;';
    panel.innerHTML = `
        <div style="font-size:14px;font-weight:bold;color:#f1f5f9">Без домашнего задания</div>
        <div id="mesh-homework-count">Выбрано: 0</div>
        <div style="display:flex;gap:6px">
            <button id="mesh-homework-clear" type="button" style="flex:1;background:#334155;color:#e2e8f0">Сбросить</button>
            <button id="mesh-homework-apply" type="button" style="flex:2;background:#10b981;color:white" disabled>Применить</button>
        </div>
        <div id="mesh-homework-status" role="status" style="max-height:80px;overflow:auto;color:#d5dbdb;font-size:11px;line-height:1.4"></div>
    `;
    document.body.appendChild(panel);

    function getMonthIndex(text) {
        const month = text.trim().toLowerCase();
        return monthTokens.find(([token]) => month.startsWith(token))?.[1] ?? -1;
    }

    function getLessonDate(card) {
        let ancestor = card.parentElement;
        let dateText = '';
        while (ancestor && ancestor !== document.body && !dateText) {
            const dateHeader = Array.from(ancestor.children).find(child =>
                Array.from(child.querySelectorAll('span')).some(span =>
                    /^\d{1,2}\s+[а-яё]+$/i.test(span.textContent.trim())
                )
            );
            dateText = dateHeader && Array.from(dateHeader.querySelectorAll('span'))
                .map(span => span.textContent.trim())
                .find(text => /^\d{1,2}\s+[а-яё]+$/i.test(text)) || '';
            if (!dateText) ancestor = ancestor.parentElement;
        }

        const dateMatch = dateText.match(/^(\d{1,2})\s+([а-яё]+)$/i);
        const weekText = document.querySelector('[data-test-component="scheduleHeaderPopperDateLeftOn"]')?.textContent || '';
        const weekMatch = weekText.match(/(\d{1,2})\s*-\s*(\d{1,2})\s+([а-яё]+)\s+(\d{4})/i);
        if (!dateMatch || !weekMatch) return null;

        const dateMonth = getMonthIndex(dateMatch[2]);
        const weekEndMonth = getMonthIndex(weekMatch[3]);
        if (dateMonth < 0 || weekEndMonth < 0) return null;

        let year = Number(weekMatch[4]);
        if (Number(weekMatch[1]) > Number(weekMatch[2]) && dateMonth > weekEndMonth) year--;
        return { day: Number(dateMatch[1]), month: dateMonth, year };
    }

    function getCalendarRoot() {
        const nextMonth = document.querySelector('[data-test-component="LIHomeworkCalendarAbsences-NextMonth"]');
        let ancestor = nextMonth;
        while (ancestor && !ancestor.querySelector(calendarSaveSelector)) ancestor = ancestor.parentElement;
        return ancestor;
    }

    function getCalendarMonth(root) {
        const heading = root?.querySelector('header h4')?.textContent || '';
        const match = heading.match(/([а-яё]+)\s+(\d{4})/i);
        if (!match) return null;
        const month = getMonthIndex(match[1]);
        return month < 0 ? null : { month, year: Number(match[2]) };
    }

    async function setNoHomeworkDate(card) {
        const targetDate = getLessonDate(card);
        if (!targetDate) return 'Не удалось определить дату урока';

        const root = await waitFor(getCalendarRoot, 5000);
        if (!root) return 'Календарь дат не открылся';

        const saveButton = root.querySelector(calendarSaveSelector);
        if (!saveButton || !saveButton.disabled) return 'Календарь уже изменён; пропускаю, чтобы не снять отметку';

        for (let attempt = 0; attempt < 24; attempt++) {
            const current = getCalendarMonth(root);
            if (!current) return 'Не удалось определить месяц календаря';
            const monthDelta = (targetDate.year - current.year) * 12 + targetDate.month - current.month;
            if (monthDelta === 0) break;

            const direction = monthDelta > 0 ? 'Next' : 'Prev';
            const monthButton = root.querySelector(`[data-test-component="LIHomeworkCalendarAbsences-${direction}Month"]`);
            if (!monthButton) return 'Не найдена кнопка смены месяца';
            monthButton.click();
            await sleep(120);
        }

        const current = getCalendarMonth(root);
        if (!current || current.month !== targetDate.month || current.year !== targetDate.year) {
            return 'Не удалось перейти к месяцу урока';
        }

        const availableDay = Array.from(root.querySelectorAll('[data-test-component="AvailableDate"]'))
            .find(element => element.textContent.trim() === String(targetDate.day));
        if (!availableDay) return 'Дата урока недоступна для выбора';

        availableDay.click();
        const enabledSaveButton = await waitFor(() => {
            const currentSaveButton = root.querySelector(calendarSaveSelector);
            return currentSaveButton && !currentSaveButton.disabled ? currentSaveButton : null;
        }, 4000);
        if (!enabledSaveButton) return 'МЭШ не разрешил сохранить выбранную дату';

        enabledSaveButton.click();
        const saved = await waitFor(() => {
            const currentSaveButton = root.querySelector(calendarSaveSelector);
            return !root.isConnected || (currentSaveButton && currentSaveButton.disabled);
        }, 10000);
        if (!saved) return 'Календарь не подтвердил сохранение';
        return 'Дата сохранена';
    }

    function getCourseKey(card) {
        return card.querySelector('.cdISCvPwy4Q2oujR [data-test-component="undefined-TooltipContainer"] span')
            ?.textContent.replace(/\s+/g, ' ').trim() || '';
    }

    function getDayCards(card) {
        let ancestor = card.parentElement;
        while (ancestor && ancestor !== document.body) {
            const hasDate = Array.from(ancestor.querySelectorAll('span'))
                .some(span => /^\d{1,2}\s+[а-яё]+$/i.test(span.textContent.trim()));
            const cards = Array.from(ancestor.querySelectorAll(cardSelector));
            if (hasDate && cards.length) return cards;
            ancestor = ancestor.parentElement;
        }
        return [card];
    }

    function getPairCards(card) {
        const cards = getDayCards(card);
        const index = cards.indexOf(card);
        const courseKey = getCourseKey(card);
        if (index < 0 || !courseKey) return [card];

        let segmentStart = index;
        while (segmentStart > 0 && getCourseKey(cards[segmentStart - 1]) === courseKey) segmentStart--;
        const pairStart = segmentStart + Math.floor((index - segmentStart) / 2) * 2;
        return cards.slice(pairStart, pairStart + 2).filter(item => getCourseKey(item) === courseKey);
    }

    function getPairKey(pairCards) {
        return pairCards[0]?.getAttribute('data-test-component') || '';
    }

    function togglePair(card) {
        const pairCards = getPairCards(card);
        const pairKey = getPairKey(pairCards);
        if (!pairKey) return;
        if (selectedPairs.has(pairKey)) selectedPairs.delete(pairKey);
        else selectedPairs.set(pairKey, pairCards.map(item => item.getAttribute('data-test-component')));
        syncLessonCards();
    }

    function renderSelection() {
        const count = panel.querySelector('#mesh-homework-count');
        const applyButton = panel.querySelector('#mesh-homework-apply');
        const clearButton = panel.querySelector('#mesh-homework-clear');
        count.textContent = `Выбрано пар: ${selectedPairs.size}`;
        applyButton.disabled = isProcessing || !featureEnabled || selectedPairs.size === 0;
        clearButton.disabled = isProcessing || selectedPairs.size === 0;
    }

    function syncLessonCards() {
        const onSchedulePage = window.location.pathname.includes('/spo/teacher/account/schedule');
        const cards = onSchedulePage ? Array.from(document.querySelectorAll(cardSelector)) : [];
        const scheduleAvailable = onSchedulePage && cards.length > 0;
        panel.style.display = featureEnabled && scheduleAvailable ? 'flex' : 'none';
        if (!scheduleAvailable) selectedPairs.clear();
        const selectedCardIds = new Set(Array.from(selectedPairs.values()).flat());

        cards.forEach(card => {
            const id = card.getAttribute('data-test-component');
            if (!id) return;
            card.classList.toggle('mesh-homework-selectable', featureEnabled);
            card.classList.toggle('mesh-homework-selected', featureEnabled && selectedCardIds.has(id));
            if (boundCards.has(card)) return;
            boundCards.add(card);
            card.addEventListener('click', event => {
                if (!featureEnabled || isProcessing) return;
                const target = event.target instanceof Element ? event.target : event.target.parentElement;
                if (!target || target.closest('#mesh-homework-panel, button, a, [data-test-component="buttonToMagazine"], [data-test-component="buttonToLesson"]')) return;
                event.preventDefault();
                event.stopPropagation();
                togglePair(card);
            }, true);
        });

        renderSelection();
    }

    function waitFor(getValue, timeoutMs) {
        const startedAt = Date.now();
        return new Promise(resolve => {
            const check = () => {
                const value = getValue();
                if (value) return resolve(value);
                if (Date.now() - startedAt >= timeoutMs) return resolve(null);
                setTimeout(check, 150);
            };
            check();
        });
    }

    async function closeLessonModal(modal) {
        if (!modal) return false;
        const closeButton = modal?.querySelector('[data-test-component="LIModal-Close"]');
        if (closeButton) closeButton.click();
        const isClosed = () => !modal.isConnected ||
            getComputedStyle(modal).display === 'none' ||
            modal.getBoundingClientRect().width === 0;
        if (await waitFor(isClosed, 2500)) return true;

        modal.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        return waitFor(isClosed, 2500);
    }

    async function processLesson(card) {
        const openLesson = card.querySelector(lessonLinkSelector);
        if (!openLesson) return 'Не найдена кнопка «К занятию»';

        openLesson.click();
        const actionButton = await waitFor(() => {
            const button = document.querySelector(noHomeworkSelector);
            return button && !button.disabled ? button : null;
        }, 8000);
        if (!actionButton) {
            const disabledButton = document.querySelector(noHomeworkSelector);
            await closeLessonModal(disabledButton?.closest('section'));
            return disabledButton
                ? 'Кнопка «Без домашнего задания» осталась недоступна после загрузки'
                : 'Не удалось открыть окно урока';
        }

        const modal = actionButton.closest('section');
        actionButton.click();
        const result = await setNoHomeworkDate(card);
        await closeLessonModal(modal);
        return result;
    }

    async function applyToSelectedLessons() {
        if (isProcessing || selectedPairs.size === 0) return;
        const selected = Array.from(selectedPairs.entries());
        if (!window.confirm(`Отметить «Без домашнего задания» для ${selected.length} пар уроков?`)) return;

        isProcessing = true;
        panel.querySelector('#mesh-homework-status').textContent = '';
        syncLessonCards();
        const results = [];
        let stoppedEarly = false;

        for (let index = 0; index < selected.length; index++) {
            const [pairKey, lessonIds] = selected[index];
            const card = Array.from(document.querySelectorAll(cardSelector))
                .find(item => item.getAttribute('data-test-component') === lessonIds[0]);
            if (!card) {
                results.push(`Пара ${index + 1}: больше не отображается`);
                continue;
            }

            panel.querySelector('#mesh-homework-status').textContent = `Обработка пары ${index + 1} из ${selected.length}...`;
            const result = await processLesson(card);
            results.push(`Пара ${index + 1}: ${result}`);
            if (result === 'Дата сохранена') selectedPairs.delete(pairKey);
            if (result.includes('не открылся') || result.includes('не удалось')) {
                stoppedEarly = true;
                break;
            }
            await sleep(300);
        }

        isProcessing = false;
        syncLessonCards();
        panel.querySelector('#mesh-homework-status').textContent = results.join('\n');
        if (!stoppedEarly && results.length === selected.length) {
            panel.querySelector('#mesh-homework-status').textContent += '\nГотово. Обновляю расписание...';
            await sleep(900);
            window.location.reload();
        }
    }

    panel.querySelector('#mesh-homework-clear').addEventListener('click', () => {
        selectedPairs.clear();
        syncLessonCards();
        panel.querySelector('#mesh-homework-status').textContent = '';
    });
    panel.querySelector('#mesh-homework-apply').addEventListener('click', applyToSelectedLessons);

    const observer = new MutationObserver(mutations => {
        if (mutations.some(mutation => !panel.contains(mutation.target))) syncLessonCards();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    function updateFeatureState(enabled) {
        featureEnabled = enabled;
        if (!enabled) selectedPairs.clear();
        syncLessonCards();
    }

    chrome.storage.sync.get(['homeworkMode'], data => updateFeatureState(data.homeworkMode === true));
    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'sync' && changes.homeworkMode) {
            updateFeatureState(changes.homeworkMode.newValue === true);
        }
    });
})();