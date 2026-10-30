// Separate local settings: cookie cleanup is specific to this browser.
const CLEANUP_ALARM = 'mesh-cookie-cleanup';
const SETTINGS_KEY = 'meshCookieCleanup';
const ALLOWED_HOURS = [0, 1, 6, 12, 24, 168];
const MESH_DOMAINS = ['school.mos.ru', 'dnevnik.mos.ru'];
let queue = Promise.resolve();

function serial(task) {
    const result = queue.then(task);
    queue = result.catch(() => {});
    return result;
}

async function getSettings() {
    const stored = (await chrome.storage.local.get(SETTINGS_KEY))[SETTINGS_KEY];
    return {
        hours: ALLOWED_HOURS.includes(stored?.hours) ? stored.hours : 24,
        nextAt: stored?.nextAt || null,
        last: stored?.last || null
    };
}

async function saveSettings(settings) {
    await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

async function schedule(settings) {
    if (!settings.hours) {
        await chrome.alarms.clear(CLEANUP_ALARM);
        return;
    }
    if (!settings.nextAt) {
        settings.nextAt = Date.now() + settings.hours * 3600000;
        await saveSettings(settings);
    }
    const alarm = await chrome.alarms.get(CLEANUP_ALARM);
    if (!alarm || alarm.scheduledTime !== settings.nextAt) {
        await chrome.alarms.create(CLEANUP_ALARM, {
            when: Math.max(Date.now() + 1000, settings.nextAt)
        });
    }
}

async function clearCookies(settings) {
    let removed = 0;
    let failed = 0;
    for (const domain of MESH_DOMAINS) {
        let cookies;
        try {
            cookies = await chrome.cookies.getAll({ domain });
        } catch (error) {
            failed++;
            continue;
        }
        // Do not remove shared .mos.ru cookies belonging to other services.
        cookies = cookies.filter(cookie => {
            const host = cookie.domain.replace(/^\./, '');
            return host === domain || host.endsWith('.' + domain);
        });
        // The API removes the matching cookie with the longest path first.
        cookies.sort((a, b) => b.path.length - a.path.length);
        for (const cookie of cookies) {
            const details = {
                url: `https://${cookie.domain.replace(/^\./, '')}${cookie.path}`,
                name: cookie.name,
                storeId: cookie.storeId
            };
            if (cookie.partitionKey) details.partitionKey = cookie.partitionKey;
            try {
                if (await chrome.cookies.remove(details)) removed++;
                else failed++;
            } catch (error) {
                failed++;
            }
        }
    }
    settings.last = { at: Date.now(), removed, failed };
    settings.nextAt = settings.hours ? Date.now() + settings.hours * 3600000 : null;
    await saveSettings(settings);
    await schedule(settings);
    return settings;
}

chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name !== CLEANUP_ALARM) return;
    serial(async () => {
        const settings = await getSettings();
        if (settings.hours) await clearCookies(settings);
    }).catch(error => console.error('MESH cookie cleanup failed:', error));
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL('popup.html')) return;
    if (!['getCookieCleanup', 'setCookieCleanup', 'clearMeshCookies'].includes(message?.action)) return;
    serial(async () => {
        let settings = await getSettings();
        if (message.action === 'setCookieCleanup') {
            if (!ALLOWED_HOURS.includes(message.hours)) throw new Error('Недопустимый интервал');
            settings.hours = message.hours;
            settings.nextAt = settings.hours ? Date.now() + settings.hours * 3600000 : null;
            await saveSettings(settings);
        }
        if (message.action === 'clearMeshCookies') settings = await clearCookies(settings);
        else await schedule(settings);
        return { ok: true, ...settings };
    }).then(sendResponse, error => sendResponse({ ok: false, error: error.message }));
    return true;
});

// Recreate a lost alarm after restarting Chrome or reloading the extension.
function restoreSchedule() {
    serial(async () => schedule(await getSettings()))
        .catch(error => console.error('MESH cookie schedule failed:', error));
}
chrome.runtime.onStartup.addListener(restoreSchedule);
chrome.runtime.onInstalled.addListener(restoreSchedule);
restoreSchedule();
