const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const source = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const clone = data => JSON.parse(JSON.stringify(data));

async function worker() {
    const state = { data: {}, events: {}, alarms: {}, notifications: [], mini: [], tabs: [{ id: 1, windowId: 1, active: true, url: 'https://school.mos.ru/journal' }], focused: true, shown: true, response: { ok: true, snapshot: { scope: 'teacher:14:123', groupName: 'ИСП2311', day: '2026-11-05', entries: [{ key: 'old', name: 'Иванов Иван' }] } } };
    const event = key => ({ addListener: fn => { state.events[key] = fn; } });
    const chrome = {
        storage: { local: { get: async key => ({ [key]: clone(state.data[key] ?? null) }), set: async data => Object.assign(state.data, clone(data)), remove: async key => { delete state.data[key]; } } },
        alarms: { get: async key => state.alarms[key], create: async (key, data) => { state.alarms[key] = data; }, clear: async key => { delete state.alarms[key]; }, onAlarm: event('alarm') },
        runtime: { id: 'test', getURL: file => 'chrome-extension://test/' + file, onStartup: event('startup'), onInstalled: event('installed'), onMessage: event('message') },
        windows: { get: async () => ({ focused: state.focused }) },
        notifications: { create: async (id, data) => { if (state.notificationFailure) throw new Error('Notifications denied'); state.notifications.push(data); } },
        tabs: { query: async () => state.tabs, sendMessage: async (id, message) => {
            if (message.action === 'showAbsenceNotice') { state.mini.push(message); return { shown: state.shown }; }
            if (state.fail) return { ok: false, error: 'Нет авторизации' };
            return clone(state.response);
        } }
    };
    vm.runInNewContext(source('absence_background.js'), { chrome, URL, console, Date });
    state.flush = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); };
    state.poll = async () => { state.events.alarm({ name: 'mesh-absence-monitor' }); await state.flush(); };
    state.request = (action, settings) => new Promise(resolve => state.events.message({ action, settings }, { id: 'test', url: chrome.runtime.getURL('popup.html') }, resolve));
    state.snapshot = () => state.data.meshAbsenceMonitorState;
    state.add = key => state.response.snapshot.entries.push({ key, name: 'Петров Петр' });
    await state.flush(); return state;
}

test('monitor establishes a quiet baseline then notifies once across polls and restarts', async () => {
    const s = await worker();
    assert.equal(s.alarms['mesh-absence-monitor'].periodInMinutes, 1);
    await s.poll(); assert.equal(s.mini.length, 0); assert.deepEqual(s.snapshot().seen, ['old']);
    s.add('new'); await s.poll(); await s.poll();
    assert.equal(s.mini.length, 1); assert(s.mini[0].message.includes('Петров Петр'));
    s.events.startup(); await s.flush(); await s.poll(); assert.equal(s.mini.length, 1);
    s.response.snapshot.entries = []; await s.poll(); s.add('new'); await s.poll();
    assert.equal(s.mini.length, 1, 'removal and reappearance of the same cell is not duplicated');
});

test('a hidden or unfocused MESH tab produces a silent system notification', async () => {
    const s = await worker(); await s.poll();
    s.focused = false; s.add('new'); await s.poll();
    assert.equal(s.mini.length, 0); assert.equal(s.notifications.length, 1); assert.equal(s.notifications[0].silent, true);
    s.focused = true; s.shown = false; s.add('another'); await s.poll();
    assert.equal(s.notifications.length, 2); assert.equal(s.notifications[1].priority, 0);
});

test('failed polls and notification permissions preserve deduplication state', async () => {
    const s = await worker(); await s.poll();
    s.fail = true; s.add('new'); await s.poll();
    assert.deepEqual(s.snapshot().seen, ['old']); assert(s.snapshot().error.includes('авторизации'));
    s.fail = false; s.focused = false; s.notificationFailure = true; await s.poll();
    assert(s.snapshot().seen.includes('new'));
    s.notificationFailure = false; await s.poll(); assert.equal(s.notifications.length, 0);
});

test('day rollover alerts on new marks, account changes start a fresh quiet baseline', async () => {
    const s = await worker(); await s.poll();
    s.response.snapshot.day = '2026-11-06'; s.response.snapshot.entries = [{ key: 'today', name: 'Петров Петр' }];
    await s.poll(); assert.equal(s.mini.length, 1); assert.deepEqual(s.snapshot().seen, ['today']);
    s.response.snapshot.scope = 'another-teacher:14:123'; s.add('new-account'); await s.poll(); assert.equal(s.mini.length, 1);
});

test('settings disable polling, validate input, and resume with a fresh baseline', async () => {
    const s = await worker(); await s.poll();
    let result = await s.request('setAbsenceMonitor', { enabled: false, groupName: 'ИСП2311', minutes: 2 });
    assert.equal(result.settings.enabled, false); assert.equal(s.alarms['mesh-absence-monitor'], undefined);
    s.add('disabled'); await s.poll(); assert.equal(s.mini.length, 0);
    result = await s.request('setAbsenceMonitor', { enabled: true, groupName: 'ИСП2311', minutes: 2 });
    assert.equal(result.ok, true); assert.equal(s.alarms['mesh-absence-monitor'].periodInMinutes, 2); assert.equal(s.mini.length, 0);
    result = await s.request('setAbsenceMonitor', { enabled: true, groupName: '', minutes: 0 }); assert.equal(result.ok, false);
    s.tabs = [{ id: 2, url: 'https://evil-school.mos.ru/' }]; await s.poll(); assert(s.snapshot().error.includes('вкладка МЭШ'));
});

function collector(t) {
    const dom = new JSDOM('', { url: 'https://school.mos.ru/journal', runScripts: 'outside-only' }); t.after(() => dom.window.close());
    const w = dom.window; w.Headers = Headers; w.AbortSignal = AbortSignal;
    let listener;
    w.chrome = { runtime: { id: 'test', onMessage: { addListener: fn => { listener = fn; } } } };
    w.document.cookie = 'aupd_token=test'; w.document.cookie = 'profile_id=teacher';
    const group = { id: 7, name: 'ОП.09 Сети ИСП2311.9 ИСП2311', class_unit_name: 'ИСП2311-25', class_unit_ids: [123], class_unit_id: 123, academic_year_id: 14, class_level_id: 15 };
    w.sessionStorage.setItem('MESH_MENTOR_GROUPS', JSON.stringify([group]));
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const date = day.split('-').reverse().join('.');
    const state = { w, requests: [], group, day, rows: [
        { student_profile_id: 1, schedule_lesson_id: 5, absence_reason_id: 2, date },
        { student_profile_id: 1, schedule_lesson_id: 6, absence_reason_id: 1, date },
        { student_profile_id: 999, schedule_lesson_id: 7, absence_reason_id: 2, date },
        { student_profile_id: 1, schedule_lesson_id: 8, absence_reason_id: 2, date: '2000-01-01' }
    ] };
    w.fetch = async (input, options) => {
        const url = new URL(input); state.requests.push({ url, options });
        if (state.fail) return { ok: false, status: 401 };
        let data;
        if (url.pathname.endsWith('/groups')) data = [group];
        else if (url.pathname.endsWith('/student_profiles')) data = [{ id: 1, last_name: null, first_name: null, middle_name: null, user_name: 'Иванов Иван Иванович' }];
        else data = state.rows;
        return { ok: true, json: async () => data };
    };
    w.eval(source('absence_monitor.js'));
    state.collect = context => new Promise(resolve => listener({ action: 'collectAbsences', groupName: 'ИСП2311', context }, { id: 'test' }, resolve));
    state.notice = data => new Promise(resolve => listener({ action: 'showAbsenceNotice', ...data }, { id: 'test' }, resolve));
    return state;
}

test('collector uses only current-day н, verified roster, cohort disciplines and stable lesson IDs', async t => {
    const s = collector(t); const result = await s.collect();
    assert.equal(result.ok, true); assert.equal(result.snapshot.entries.length, 1);
    assert.equal(result.snapshot.entries[0].name, 'Иванов Иван Иванович');
    assert.equal(result.snapshot.entries[0].key, `1:5:${s.day}`);
    assert.equal(s.requests.length, 3, 'no school-wide journal scan');
    const attendance = s.requests[2]; assert.equal(attendance.url.searchParams.get('group_ids'), '7');
    assert.equal(attendance.url.searchParams.get('start_at'), attendance.url.searchParams.get('stop_at'));
    assert(s.requests.every(req => req.options.cache === 'no-store'));
    assert(!JSON.stringify(result).includes('Bearer'));
    s.w.sessionStorage.removeItem('MESH_MENTOR_GROUPS');
    const restored = await s.collect(result.snapshot.context); assert.equal(restored.ok, true);
});

test('collector never trusts the previous account context or reports auth failure as empty attendance', async t => {
    const s = collector(t); s.fail = true;
    let result = await s.collect(); assert.equal(result.ok, false); assert(result.error.includes('входа'));
    s.fail = false; s.w.sessionStorage.removeItem('MESH_MENTOR_GROUPS');
    result = await s.collect({ profile: 'other', class_unit_id: 123, academic_year_id: 14 }); assert.equal(result.ok, false);
});

test('mini notification uses literal text, closes manually and only displays in a visible document', async t => {
    const s = collector(t);
    Object.defineProperty(s.w.document, 'visibilityState', { value: 'visible', configurable: true });
    let result = await s.notice({ title: '<Новая н>', message: '<img src=x onerror=alert(1)> Иванов Иван' });
    assert.equal(result.shown, true);
    const note = s.w.document.getElementById('mesh-absence-notice'); assert.equal(note.querySelector('img'), null); assert(note.textContent.includes('<img'));
    note.querySelector('button').click(); assert(!note.isConnected);
    Object.defineProperty(s.w.document, 'visibilityState', { value: 'hidden', configurable: true });
    result = await s.notice({ title: 'Новая н', message: 'Иванов' }); assert.equal(result.shown, false);
});

test('collector paginates attendance instead of accepting an incomplete snapshot', async t => {
    const s = collector(t); const original = s.w.fetch;
    s.w.fetch = async (url, options) => {
        const parsed = new URL(url);
        if (!parsed.pathname.endsWith('/attendances')) return original(url, options);
        s.requests.push({ url: parsed, options });
        return { ok: true, json: async () => parsed.searchParams.get('page') === '1'
            ? Array.from({ length: 1000 }, () => ({ student_profile_id: 1, schedule_lesson_id: 10, absence_reason_id: 1, date: s.day }))
            : [{ student_profile_id: 1, schedule_lesson_id: 20, absence_reason_id: 2, date: s.day }] };
    };
    const result = await s.collect(); assert.equal(result.ok, true); assert.equal(result.snapshot.entries.length, 1);
    assert(result.snapshot.entries[0].key.includes(':20:'));
    assert.equal(s.requests.filter(req => req.url.pathname.endsWith('/attendances')).length, 2);
});

test('school-year suffix in the cohort name matches the configured base group', async t => {
    const s = collector(t); s.group.name = 'ОП.09 Компьютерные сети';
    s.w.sessionStorage.setItem('MESH_MENTOR_GROUPS', JSON.stringify([s.group]));
    const result = await s.collect(); assert.equal(result.ok, true);
});

test('incomplete replies do not erase the known baseline or announce old absences later', async () => {
    const s = await worker(); await s.poll();
    const old = clone(s.response.snapshot); s.response.snapshot = { scope: old.scope, day: old.day, entries: null };
    await s.poll(); assert.deepEqual(s.snapshot().seen, ['old']); assert(s.snapshot().error.includes('неполный'));
    s.response.snapshot = old; await s.poll(); assert.equal(s.mini.length, 0);
});
