// A single service-worker queue owns snapshots and notification deduplication across tabs.
(function () {
    const ALARM = 'mesh-absence-monitor';
    const KEY = 'meshAbsenceMonitor';
    const STATE = 'meshAbsenceMonitorState';
    let queue = Promise.resolve();
    const serial = job => { const result = queue.then(job); queue = result.catch(() => {}); return result; };
    const meshUrl = value => { try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && ['school.mos.ru', 'dnevnik.mos.ru'].some(host => url.hostname === host || url.hostname.endsWith('.' + host)); } catch { return false; } };
    async function settings() {
        const data = (await chrome.storage.local.get(KEY))[KEY] || {};
        return { enabled: data.enabled !== false, groupName: typeof data.groupName === 'string' && data.groupName.trim() ? data.groupName.trim() : 'ИСП2311', minutes: [1, 2, 5, 10].includes(data.minutes) ? data.minutes : 1 };
    }
    async function schedule() {
        const config = await settings();
        const alarm = await chrome.alarms.get(ALARM);
        if (!config.enabled) { await chrome.alarms.clear(ALARM); return; }
        if (!alarm || alarm.periodInMinutes !== config.minutes) await chrome.alarms.create(ALARM, { delayInMinutes: 1, periodInMinutes: config.minutes });
    }
    function notice(snapshot, entries) {
        const names = new Map();
        for (const item of entries) names.set(item.name, (names.get(item.name) || 0) + 1);
        const lines = [...names].slice(0, 3).map(([name, count]) => name + (count > 1 ? ` — ${count} «н»` : ' — «н»'));
        if (names.size > 3) lines.push(`Ещё студентов: ${names.size - 3}`);
        return { title: `Новые «н» · ${snapshot.groupName}`, message: lines.join('\n') };
    }
    async function poll() {
        const config = await settings();
        if (!config.enabled) return;
        const previous = (await chrome.storage.local.get(STATE))[STATE] || {};
        let current = previous;
        try {
            const tabs = (await chrome.tabs.query({})).filter(tab => meshUrl(tab.url) && !tab.discarded);
            tabs.sort((a, b) => Number(b.active) - Number(a.active));
            if (!tabs.length) throw new Error('Для проверки нужна открытая вкладка МЭШ');
            let result, chosen;
            for (const tab of tabs.slice(0, 2)) {
                try { result = await chrome.tabs.sendMessage(tab.id, { action: 'collectAbsences', groupName: config.groupName, context: previous.groupName === config.groupName ? previous.context : undefined }, { frameId: 0 }); }
                catch { continue; }
                if (result?.ok) { chosen = tab; break; }
            }
            if (!chosen) throw new Error(result?.error || 'Обновите вкладку МЭШ после обновления расширения');
            const snapshot = result.snapshot;
            if (!snapshot || typeof snapshot.scope !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(snapshot.day) || !Array.isArray(snapshot.entries) || snapshot.entries.some(item => typeof item.key !== 'string' || typeof item.name !== 'string')) throw new Error('Получен неполный ответ монитора');
            const same = previous.scope === snapshot.scope && previous.groupName === config.groupName;
            const seen = new Set(same && previous.day === snapshot.day ? previous.seen || [] : []);
            const added = snapshot.entries.filter(item => !seen.has(item.key));
            for (const item of snapshot.entries) seen.add(item.key);
            // Save before notifying: multiple tabs, reloads and worker restarts cannot repeat a notice.
            current = { context: snapshot.context, scope: snapshot.scope, groupName: config.groupName, day: snapshot.day, seen: [...seen], checkedAt: Date.now(), baselineAt: same ? previous.baselineAt : Date.now(), count: snapshot.entries.length, error: null };
            await chrome.storage.local.set({ [STATE]: current });
            if (!same || !added.length) return;
            const info = notice(snapshot, added);
            let shown = false;
            if (chosen.active) {
                let focused = false;
                try { focused = (await chrome.windows.get(chosen.windowId)).focused; } catch {}
                if (focused) {
                    try { shown = (await chrome.tabs.sendMessage(chosen.id, { action: 'showAbsenceNotice', ...info }, { frameId: 0 }))?.shown === true; } catch {}
                }
            }
            if (!shown) await chrome.notifications.create('mesh-absence-update', { type: 'basic', iconUrl: chrome.runtime.getURL('icons/icon128.png'), ...info, silent: true, priority: 0 });
        } catch (error) {
            await chrome.storage.local.set({ [STATE]: { ...current, error: error.message, attemptedAt: Date.now() } });
        }
    }
    chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === ALARM) serial(poll).catch(console.error); });
    chrome.runtime.onStartup.addListener(() => serial(schedule).catch(console.error));
    chrome.runtime.onInstalled.addListener(() => serial(schedule).catch(console.error));
    chrome.runtime.onMessage.addListener((message, sender, reply) => {
        if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL('popup.html')) return;
        if (!['getAbsenceMonitor', 'setAbsenceMonitor', 'checkAbsenceMonitor'].includes(message?.action)) return;
        serial(async () => {
            if (message.action === 'setAbsenceMonitor') {
                const old = await settings();
                const data = message.settings;
                if (!data || typeof data.enabled !== 'boolean' || typeof data.groupName !== 'string' || !/^[\p{L}\p{N} ._-]{2,60}$/u.test(data.groupName.trim()) || ![1, 2, 5, 10].includes(data.minutes)) throw new Error('Проверьте название группы и интервал');
                const config = { enabled: data.enabled, groupName: data.groupName.trim(), minutes: data.minutes };
                await chrome.storage.local.set({ [KEY]: config });
                if (old.groupName !== config.groupName || old.enabled !== config.enabled) await chrome.storage.local.remove(STATE);
                await schedule();
                if (config.enabled) await poll();
            }
            if (message.action === 'checkAbsenceMonitor') await poll();
            return { ok: true, settings: await settings(), state: (await chrome.storage.local.get(STATE))[STATE] || {} };
        }).then(reply, error => reply({ ok: false, error: error.message }));
        return true;
    });
    serial(schedule).catch(console.error);
})();
