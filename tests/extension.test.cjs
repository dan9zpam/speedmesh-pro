const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const JSZip = require('../jszip.min.js');
const source = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

function setup(t, url = 'https://school.mos.ru/journal') {
    const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url, runScripts: 'outside-only', pretendToBeVisual: true });
    const w = dom.window;
    w.Headers = Headers;
    t.after(() => w.close());
    Object.defineProperty(w.HTMLElement.prototype, 'innerText', { get() { return this.textContent; }, set(v) { this.textContent = v; } });
    w.HTMLElement.prototype.scrollIntoView = () => {};
    const intervals = new Map(), timeouts = new Map();
    let id = 0;
    w.setInterval = (fn, delay) => { intervals.set(++id, { fn, delay }); return id; };
    w.clearInterval = key => intervals.delete(key);
    w.setTimeout = (fn, delay) => { timeouts.set(++id, { fn, delay }); return id; };
    w.clearTimeout = key => timeouts.delete(key);
    const changes = [], messages = [], alerts = [], logs = [], requests = [];
    const settings = {};
    w.console = { log() {}, warn() {}, error: (...args) => logs.push(args) };
    w.confirm = () => true;
    w.alert = text => alerts.push(text);
    w.prompt = text => alerts.push(text);
    w.chrome = {
        storage: {
            local: { get: (keys, cb) => cb({}), set() {} },
            sync: { get: (keys, cb) => cb(settings) },
            onChanged: { addListener: fn => changes.push(fn) }
        },
        runtime: { getURL: file => 'chrome-extension://test/' + file, onMessage: { addListener: fn => messages.push(fn) } }
    };
    w.fetch = async (...args) => { requests.push(args); return { ok: false, status: 503, text: async () => 'Unavailable' }; };
    w.document.cookie = 'aupd_token=test';
    w.document.cookie = 'profile_id=123';
    const tick = delay => [...intervals.values()].filter(v => v.delay === delay).forEach(v => v.fn());
    const flush = async (rounds = 10) => {
        for (let n = 0; n < rounds; n++) {
            await new Promise(resolve => setImmediate(resolve));
            const ready = [...timeouts.entries()].filter(([, v]) => v.delay <= 1000);
            ready.forEach(([key, { fn }]) => { timeouts.delete(key); fn(); });
        }
    };
    const load = (file, hook = '') => {
        let code = source(file);
        if (hook) code = code.replace(/\}\)\(\);?\s*$/, hook + '\n})();');
        if (file === 'content.js') code += '\nwindow.coreTest = { isRunning: () => isRobotActive };';
        w.eval(code);
    };
    return { w, tick, flush, load, settings, changes, alerts, logs, requests, timeouts };
}

function gradeCells(w, count = 1) {
    w.document.body.innerHTML = '<table><tbody>' + Array.from({ length: count }, (_, i) => `<tr><td data-test-component="markCell-${i + 1}_100_200" data-robot-target-grade="5"></td></tr>`).join('') + '</tbody></table>';
}

test('legacy pending grades never replay; SPA navigation removes the panel despite important CSS', async t => {
    const s = setup(t);
    s.w.sessionStorage.setItem('SPEEDMESH_PENDING_GRADES', JSON.stringify([{ attr: 'markCell-1_100_200', grade: '5' }]));
    s.load('content.js'); s.tick(50);
    s.w.eval('drawRobotPanel(0)');
    assert.equal(s.w.getComputedStyle(s.w.document.getElementById('mesh-robot-panel')).display, 'flex');
    s.w.history.pushState({}, '', '/schedule'); s.tick(300);
    await s.flush();
    assert.equal(s.w.document.getElementById('mesh-robot-panel'), null);
    assert.equal(s.w.sessionStorage.getItem('SPEEDMESH_PENDING_GRADES'), null);
    assert.equal(s.requests.length, 0);
});

for (const failure of [401, 403, 429, 500, 502, 'network']) {
    test(`grade failure ${failure} stops without reload or automatic retries`, async t => {
        const s = setup(t); s.load('content.js'); s.tick(50); gradeCells(s.w, 2);
        let calls = 0;
        s.w.fetch = async () => {
            calls++;
            if (failure === 'network') throw new Error('Disconnected');
            return { ok: false, status: failure, text: async () => 'Error' };
        };
        const pending = s.w.eval('startSmartMatrixAPI(false)');
        await s.flush(); await pending;
        assert.equal(calls, 1);
        assert.equal(s.w.coreTest.isRunning(), false);
        assert.equal(s.w.sessionStorage.getItem('SPEEDMESH_PENDING_GRADES'), null);
        assert.equal(s.logs.some(args => String(args).includes('Not implemented')), false);
    });
}

test('leaving the journal during a request stops subsequent marks and removes the progress panel', async t => {
    const s = setup(t); s.load('content.js'); s.tick(50); gradeCells(s.w, 2); s.w.eval('drawRobotPanel(2)');
    let resolveRequest, calls = 0;
    s.w.fetch = () => { calls++; return new Promise(resolve => { resolveRequest = resolve; }); };
    const pending = s.w.eval('startSmartMatrixAPI(false)');
    s.w.history.pushState({}, '', '/schedule'); s.tick(300);
    resolveRequest({ ok: true, json: async () => ({ id: 1 }) });
    await s.flush(); await pending;
    assert.equal(calls, 1);
    assert.equal(s.w.document.getElementById('mesh-robot-panel'), null);
    assert.equal(s.w.coreTest.isRunning(), false);
});

test('widget updates do not scan the journal; real page mutations are throttled', async t => {
    const s = setup(t); s.load('content.js'); s.tick(50); await s.flush();
    const card = s.w.document.createElement('div'); card.id = 'mesh-timer-card'; s.w.document.body.append(card);
    await s.flush();
    for (let i = 0; i < 10; i++) { card.textContent = String(i); await Promise.resolve(); }
    assert.equal([...s.timeouts.values()].filter(v => v.delay === 350).length, 0);
    const table = s.w.document.createElement('table'); s.w.document.body.append(table);
    await Promise.resolve(); table.textContent = 'changed'; await Promise.resolve();
    assert.equal([...s.timeouts.values()].filter(v => v.delay === 350).length, 1);
});

test('KTP runs finish and recalc in background, hides outside planning and retains completion', async t => {
    const s = setup(t, 'https://school.mos.ru/planning/programs');
    s.w.sessionStorage.setItem('MESH_KTP_IDS', '[7]');
    s.load('ktp.js'); s.tick(500); await s.flush();
    const panel = s.w.document.getElementById('mesh-ktp-panel');
    const runButton = panel.querySelector('#ktp-btn-run');
    s.tick(500);
    assert.equal(panel.querySelector('#ktp-btn-run'), runButton);
    let finishRequest;
    s.w.fetch = url => {
        s.requests.push(url);
        return url.includes('/finish?') ? new Promise(resolve => { finishRequest = resolve; }) : Promise.resolve({ ok: true, status: 200, text: async () => '{}' });
    };
    runButton.click(); runButton.click();
    assert.equal(s.requests.length, 1);
    s.w.history.pushState({}, '', '/schedule'); s.tick(500);
    assert.equal(s.w.getComputedStyle(panel).display, 'none');
    finishRequest({ ok: true, status: 200, text: async () => '{}' });
    await s.flush();
    assert.equal(s.requests.length, 2);
    assert(s.requests[1].includes('/recalc?'));
    assert(panel.textContent.includes('Готово'));
    s.w.history.pushState({}, '', '/planning/programs'); s.tick(500);
    assert.equal(s.w.getComputedStyle(panel).display, 'flex');
    assert(panel.textContent.includes('Готово'));
    s.changes.forEach(fn => fn({ ktpModule: { newValue: false } }, 'sync')); s.tick(500);
    assert.equal(s.w.getComputedStyle(panel).display, 'none');
});

test('timer starts in bottom-right despite old saved position and settings open above it', t => {
    const s = setup(t);
    s.w.chrome.storage.local.get = (keys, cb) => cb({ timerLeft: '100px', timerTop: '10px' });
    s.load('timer.js'); s.tick(1000);
    const card = s.w.document.getElementById('mesh-timer-card');
    assert.equal(card.style.right, '20px'); assert.equal(card.style.bottom, '20px'); assert.equal(card.style.top, '');
    assert.equal(s.w.document.getElementById('mesh-timer-settings-panel').style.bottom, '110%');
});

async function workbook(rows, sharedStrings = '') {
    const zip = new JSZip();
    zip.file('xl/worksheets/sheet1.xml', `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`);
    if (sharedStrings) zip.file('xl/sharedStrings.xml', `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${sharedStrings}</sst>`);
    return zip.generateAsync({ type: 'uint8array' });
}
const str = (ref, value) => `<c r="${ref}" t="inlineStr"><is><t>${value}</t></is></c>`;
const num = (ref, value) => `<c r="${ref}"><v>${value}</v></c>`;

function summary(s) {
    s.w.JSZip = JSZip;
    s.load('mentor_journals.js', 'window.summaryTest = { parseJournalXlsx, buildAndShowSummarySheet, renderSummaryModalUI, isStudentName };');
    return s.w.summaryTest;
}

test('XLSX reads shared and inline names, double marks and ignores totals, dates, absences and topics', async t => {
    const s = setup(t), api = summary(s);
    const data = await workbook(
        `<row r="1">${str('A1', 'ФИО')}${str('F1', 'Средний балл')}${str('G1', 'Итог')}${str('H1', 'Тема урока')}</row>` +
        `<row r="2"><c r="A2" t="s"><v>0</v></c>${num('B2', 5)}${str('C2', '4/5')}${str('D2', 'н')}${str('E2', '01.10')}${num('F2', 4.67)}${num('G2', 3)}${num('H2', 2)}</row>` +
        `<row r="3">${str('A3', 'Петров И.В.')}${num('B3', 52)}${str('C3', '2/5abc')}${str('D3', 'б')}</row>`,
        '<si><r><t>Иванов </t></r><r><t>Иван Иванович</t></r></si>');
    const parsed = await api.parseJournalXlsx(data);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].avg, 4.67); assert.equal(parsed[0].marksCount, 3);
    assert.equal(parsed[1].name, 'Петров И.В.'); assert.equal(parsed[1].avg, 2); assert.equal(parsed[1].marksCount, 1);
    const zip = new JSZip();
    await assert.rejects(api.parseJournalXlsx(await zip.generateAsync({ type: 'uint8array' })), /отсутствует/);
});

test('summary fetches fresh exports, does not attest missing data, and fails visibly for unavailable journals', async t => {
    const s = setup(t), api = summary(s);
    const good = await workbook(`<row r="1">${str('A1', 'Иванов Иван')}${num('B1', 5)}</row><row r="2">${str('A2', 'Петров Петр')}${num('B2', 2)}</row>`);
    const empty = await workbook(`<row r="1">${str('A1', 'Иванов Иван')}${str('B1', 'н')}</row>`);
    const groups = [{ id: 1, name: 'ИСП2311 Предмет &lt;1&gt;' }, { id: 2, name: 'ИСП2311 Предмет 2' }];
    s.w.fetch = async url => { s.requests.push(url); return { ok: true, blob: async () => url.includes('group_ids=1') ? good : empty }; };
    const btn = s.w.document.createElement('button'); btn.innerText = 'Ведомость'; s.w.document.body.append(btn);
    let pending = api.buildAndShowSummarySheet(groups, btn); await s.flush(30); await pending;
    const modal = s.w.document.getElementById('speedmesh-summary-modal'); assert(modal);
    assert(modal.querySelector('#mesh-summary-tbody').textContent.includes('Нет данных'));
    assert.equal(btn.style.pointerEvents, 'auto');
    modal.remove();
    s.w.fetch = async url => { s.requests.push(url); return { ok: false, status: 500 }; };
    pending = api.buildAndShowSummarySheet(groups, btn); await s.flush(30); await pending;
    assert.equal(s.requests.length, 4);
    assert.equal(s.w.document.getElementById('speedmesh-summary-modal'), null);
    assert(s.w.document.getElementById('speedmesh-toast-notify').textContent.includes('HTTP 500'));
    assert.equal(btn.style.pointerEvents, 'auto');
});

test('KTP interceptor replaces visited lists and keeps IDs on detail responses', async t => {
    const s = setup(t);
    let data;
    s.w.fetch = async () => ({ clone: () => ({ json: async () => data }) });
    s.load('ktp_interceptor.js');
    const request = async response => {
        data = response;
        await s.w.fetch('https://school.mos.ru/api/profeducation/plan/teacher/v1/calendar_plans');
        await Promise.resolve();
        return JSON.parse(s.w.sessionStorage.getItem('MESH_KTP_IDS'));
    };
    assert.deepEqual(await request([{ id: 1 }, { id: 2 }]), [1, 2]);
    assert.deepEqual(await request({ items: [{ id: 3 }] }), [3]);
    assert.deepEqual(await request({ id: 3, name: 'Details' }), [3]);
    assert.deepEqual(await request({ items: [] }), []);
});

test('summary CSV export preserves names, decimal separators and quoted headers', async t => {
    const s = setup(t), api = summary(s);
    const subject = 'ОС "Практика" <тест>';
    const students = [{ name: 'Иванов Иван', subjects: { [subject]: 4.5 }, overallAvg: 4.5, failedCount: 0, status: 'Отличник' }];
    let exported, filename, revoked;
    s.w.URL.createObjectURL = blob => { exported = blob; return 'blob:https://school.mos.ru/test'; };
    s.w.URL.revokeObjectURL = value => { revoked = value; };
    s.w.HTMLAnchorElement.prototype.click = function () { filename = this.download; };
    api.renderSummaryModalUI('ИСП2311', 2026, 2027, [subject], students, '03.11.2026', '2026-11-03');
    const modal = s.w.document.getElementById('speedmesh-summary-modal');
    assert.equal(modal.querySelector('th[title]').getAttribute('title'), subject);
    modal.querySelector('#mesh-summary-export-csv').click();
    const csv = await new Promise((resolve, reject) => {
        const reader = new s.w.FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsText(exported);
    });
    assert(csv.includes('ОС ""Практика"" <тест>'));
    assert(csv.includes('"Иванов Иван";"4,50"'));
    assert.equal(filename, 'Сводная_ведомость_ИСП2311_на_2026-11-03.csv');
    await s.flush();
    assert.equal(revoked, 'blob:https://school.mos.ru/test');
});

test('task center keeps active tasks during clear, handles stop once and preserves results across routes', t => {
    const s = setup(t); s.load('task_center.js');
    let stopped = 0;
    const task = s.w.MeshTasks.start({ title: '<Оценки>', total: 3, onCancel: () => stopped++ });
    task.update({ current: 1, message: 'Проверка' });
    const row = s.w.document.querySelector('.mesh-task-row');
    assert.equal(row.querySelector('.mesh-task-title').textContent, '<Оценки>');
    assert.equal(row.querySelector('progress').value, 1);
    row.querySelector('.mesh-task-stop').click(); row.querySelector('.mesh-task-stop').click();
    assert.equal(stopped, 1); assert.equal(task.cancelled, true); assert.equal(row.dataset.status, 'stopping');
    s.w.document.getElementById('mesh-task-clear').click(); assert(row.isConnected);
    s.w.history.pushState({}, '', '/schedule'); assert(row.isConnected);
    task.finish('cancelled', 'Отправка остановлена'); task.update({ message: 'Late update' });
    assert.equal(row.querySelector('.mesh-task-message').textContent, 'Отправка остановлена');
    s.w.document.getElementById('mesh-task-close').click();
    assert.equal(s.w.document.getElementById('mesh-task-launcher').getAttribute('aria-expanded'), 'false');
    s.w.document.getElementById('mesh-task-clear').click(); assert(!row.isConnected);
});

test('grades report progress in the center and stop after a requested cancellation', async t => {
    const s = setup(t); s.load('task_center.js'); s.load('content.js'); s.tick(50); gradeCells(s.w, 2);
    let finishRequest, calls = 0;
    s.w.fetch = () => { calls++; return new Promise(resolve => { finishRequest = resolve; }); };
    const pending = s.w.eval('startSmartMatrixAPI(false)');
    const taskRow = s.w.document.querySelector('.mesh-task-row');
    taskRow.querySelector('.mesh-task-stop').click();
    finishRequest({ ok: true, json: async () => ({ id: 1 }) });
    await s.flush(); await pending;
    assert.equal(calls, 1); assert.equal(taskRow.dataset.status, 'cancelled');
    assert(taskRow.textContent.includes('Выставлено: 1'));
    assert.equal(s.w.document.getElementById('mesh-robot-panel').parentElement.id, 'mesh-task-controls');
});

test('KTP cancellation completes the current finish/recalc pair, retains logs, and skips the next plan', async t => {
    const s = setup(t, 'https://school.mos.ru/planning/programs');
    s.load('task_center.js'); s.w.sessionStorage.setItem('MESH_KTP_IDS', '[7,8]');
    s.load('ktp.js'); s.tick(500); await s.flush();
    let finishRequest;
    s.w.fetch = url => {
        s.requests.push(url);
        return url.includes('/finish?') ? new Promise(resolve => { finishRequest = resolve; }) : Promise.resolve({ ok: true, status: 200, text: async () => '{}' });
    };
    s.w.document.getElementById('ktp-btn-run').click();
    const taskRow = s.w.document.querySelector('.mesh-task-row');
    taskRow.querySelector('.mesh-task-stop').click();
    s.w.history.pushState({}, '', '/schedule'); s.tick(500);
    finishRequest({ ok: true, status: 200, text: async () => '{}' }); await s.flush(20);
    assert.equal(s.requests.length, 2); assert(s.requests[1].includes('/7/recalc?'));
    assert.equal(taskRow.dataset.status, 'cancelled');
    assert(taskRow.textContent.includes('Скачать лог'));
    assert.equal(s.w.getComputedStyle(s.w.document.getElementById('mesh-ktp-panel')).display, 'none');
});

test('summary cancellation restores the trigger and does not create a partial report', async t => {
    const s = setup(t); s.load('task_center.js'); const api = summary(s);
    const task = s.w.MeshTasks.start({ title: 'Ведомость', cancellable: true });
    const btn = s.w.document.createElement('button'); btn.innerText = 'Ведомость';
    s.w.document.querySelector('.mesh-task-stop').click();
    await api.buildAndShowSummarySheet([{ id: 1, name: 'Предмет' }], btn, undefined, task);
    assert.equal(s.requests.length, 0); assert.equal(btn.style.pointerEvents, 'auto');
    assert.equal(s.w.document.getElementById('speedmesh-summary-modal'), null);
    assert.equal(s.w.document.querySelector('.mesh-task-row').dataset.status, 'cancelled');
});

test('Excel download creates a real XLSX and reports completion in the task center', async t => {
    const s = setup(t); s.load('task_center.js'); const api = summary(s); s.load('excel_export.js');
    let exported, filename;
    s.w.URL.createObjectURL = blob => { exported = blob; return 'blob:https://school.mos.ru/xlsx'; };
    s.w.URL.revokeObjectURL = () => {};
    s.w.HTMLAnchorElement.prototype.click = function () { filename = this.download; };
    api.renderSummaryModalUI('ИСП2311', 2026, 2027, ['ОС'], [{ name: 'Иванов Иван', subjects: { ОС: 4.5 }, overallAvg: 4.5, failedCount: 0, status: 'Отличник' }], '03.11.2026', '2026-11-03');
    const btn = s.w.document.getElementById('mesh-summary-export-xlsx'); btn.click();
    await s.flush(30);
    assert.equal(btn.disabled, false);
    assert.equal(filename, 'Сводная_ведомость_ИСП2311_на_2026-11-03.xlsx');
    assert.equal(exported.type, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const bytes = await new Promise(resolve => { const reader = new s.w.FileReader(); reader.onload = () => resolve(new Uint8Array(reader.result)); reader.readAsArrayBuffer(exported); });
    const zip = await JSZip.loadAsync(bytes); assert(zip.file('xl/workbook.xml'));
    assert.equal(s.w.document.querySelector('.mesh-task-row').dataset.status, 'done');
});

test('journal rescans do not reopen a task center closed by the user', t => {
    const s = setup(t); s.load('task_center.js'); s.load('content.js');
    s.w.eval('drawRobotPanel(2)');
    const drawer = s.w.document.getElementById('mesh-task-drawer');
    assert.equal(drawer.hidden, false);
    s.w.document.getElementById('mesh-task-close').click();
    s.w.eval('drawRobotPanel(2)');
    assert.equal(drawer.hidden, true);
});

test('failed Excel creation restores the button and displays an error task', async t => {
    const s = setup(t); s.load('task_center.js'); const api = summary(s);
    s.w.MeshExcel = { createSummaryWorkbook: async () => { throw new Error('Тестовая ошибка'); } };
    api.renderSummaryModalUI('ИСП2311', 2026, 2027, [], [], '03.11.2026', '2026-11-03');
    const button = s.w.document.getElementById('mesh-summary-export-xlsx'); button.click();
    await s.flush();
    assert.equal(button.disabled, false);
    const row = s.w.document.querySelector('.mesh-task-row');
    assert.equal(row.dataset.status, 'error'); assert(row.textContent.includes('Тестовая ошибка'));
});

test('grade submission survives lowercase authorization captured by a background monitor', async t => {
    const s = setup(t); s.w.Headers = Headers;
    s.load('task_center.js'); s.load('content.js'); s.tick(50); gradeCells(s.w);
    s.w.sessionStorage.setItem('MESH_KTP_HEADERS', JSON.stringify({ authorization: 'Bearer captured-token', 'profile-id': '123', 'x-mes-subsystem': 'teacherspow' }));
    let received;
    s.w.fetch = async (url, options) => {
        const headers = new Headers(options.headers); received = headers;
        const valid = headers.get('authorization') === 'Bearer captured-token' && headers.get('profile-id') === '123';
        return { ok: valid, status: valid ? 200 : 401, text: async () => 'Invalid authorization', json: async () => ({ id: 1 }) };
    };
    const pending = s.w.eval('startSmartMatrixAPI(false)'); await s.flush(); await pending;
    assert.equal(received.get('authorization'), 'Bearer captured-token');
    assert.equal(received.get('profile-id'), '123');
    assert.equal(s.w.document.querySelector('.mesh-task-row').dataset.status, 'done');
});

test('selecting a grade on a markCell wrapper preserves it until the send button is clicked', async t => {
    const s = setup(t); s.w.Headers = Headers;
    s.w.document.body.innerHTML = '<table><tr><td>Иванов Иван</td><td data-test-component="markCell-1_100_200"></td></tr></table>';
    s.load('task_center.js'); s.load('content.js'); s.tick(50);
    const mark = s.w.document.querySelector('[data-test-component^="markCell"]');
    const phantom = mark.querySelector('.mesh-phantom-grade'); assert(phantom);
    phantom.dispatchEvent(new s.w.MouseEvent('mousedown', { bubbles: true, button: 0 }));
    assert.equal(mark.dataset.robotTargetGrade, '2');
    assert(s.w.document.getElementById('mesh-robot-btn'));
    let payload;
    s.w.fetch = async (url, options) => { payload = JSON.parse(options.body); return { ok: true, json: async () => ({ id: 1 }) }; };
    s.w.document.getElementById('mesh-global-weight').value = '1';
    s.w.document.getElementById('mesh-robot-btn').click(); await s.flush();
    assert.equal(payload.weight, 1);
    assert.equal(payload.grade_origins[0].grade_origin, '2');
    assert.equal(s.w.document.querySelector('.mesh-task-row').dataset.status, 'done');
});

test('grade submission repairs already concatenated copies of the same captured credentials', async t => {
    const s = setup(t); s.load('task_center.js'); s.load('content.js'); s.tick(50); gradeCells(s.w);
    s.w.sessionStorage.setItem('MESH_AUTH_HEADERS', JSON.stringify({ authorization: 'Bearer recovered-token, Bearer recovered-token', 'profile-id': '123, 123' }));
    let received;
    s.w.fetch = async (url, options) => { received = new Headers(options.headers); return { ok: true, json: async () => ({ id: 1 }) }; };
    const pending = s.w.eval('startSmartMatrixAPI(false)'); await s.flush(); await pending;
    assert.equal(received.get('authorization'), 'Bearer recovered-token');
    assert.equal(received.get('profile-id'), '123');
});

test('a confirmed grade in a nested markCell cannot be selected for a duplicate submission', async t => {
    const s = setup(t);
    s.w.document.body.innerHTML = '<table><tr><td>Иванов Иван</td><td><div data-test-component="markCell-1_100_200"></div></td></tr></table>';
    s.load('task_center.js'); s.load('content.js'); s.tick(50);
    const mark = s.w.document.querySelector('[data-test-component^="markCell"]');
    const cell = mark.parentElement;
    cell.querySelector('.mesh-phantom-grade').dispatchEvent(new s.w.MouseEvent('mousedown', { bubbles: true, button: 0 }));
    s.w.fetch = async () => ({ ok: true, json: async () => ({ id: 1 }) });
    s.w.document.getElementById('mesh-robot-btn').click(); await s.flush();
    s.w.eval('runCoreLogic()');
    assert(cell.querySelector('.api-success-badge'));
    assert.equal(cell.querySelector('.mesh-phantom-grade'), null);
    assert.equal(cell.hasAttribute('data-robot-target-grade'), false);
});

test('MESH Нет оценок export is an empty journal, while an unknown XLSX remains an error', async t => {
    const s = setup(t), api = summary(s);
    const empty = await workbook(`<row r="1">${str('A1', 'Нет оценок')}</row>`);
    assert.equal((await api.parseJournalXlsx(empty)).length, 0);
    const unknown = await workbook(`<row r="1">${str('A1', 'Сервис временно недоступен')}</row>`);
    await assert.rejects(api.parseJournalXlsx(unknown), /Не удалось распознать/);
});

test('repeated printed rosters merge lesson marks and never use absence totals as grades', async t => {
    const s = setup(t), api = summary(s);
    const bytes = await workbook(
        `<row r="1">${str('A1', '№')}${str('B1', 'Студент')}${str('C1', 'сен')}${str('E1', 'н')}${str('G1', 'Дата')}${str('H1', 'Тема')}</row>` +
        `<row r="2">${num('C2', 7)}${num('D2', 7)}${num('E2', 2)}</row>` +
        `<row r="3">${num('A3', 1)}${str('B3', 'Иванов Иван')}${num('C3', 5)}${num('D3', 4)}${num('E3', 2)}${num('F3', 5)}</row>` +
        `<row r="4">${num('A4', 2)}${str('B4', 'Петров Петр')}${str('C4', 'н')}${str('D4', 'н')}${num('E4', 4)}</row>` +
        `<row r="51">${str('A51', '№')}${str('B51', 'Студент')}${str('C51', 'н')}${str('G51', 'Дата')}${str('H51', 'Тема')}</row>` +
        `<row r="53">${num('A53', 1)}${str('B53', 'Иванов Иван')}${num('C53', 3)}${num('D53', 2)}</row>` +
        `<row r="54">${num('A54', 2)}${str('B54', 'Петров Петр')}${num('C54', 2)}</row>` +
        `<row r="101">${str('A101', '№')}${str('B101', 'Студент')}${str('C101', 'ноя')}${str('E101', 'н')}</row>` +
        `<row r="103">${num('A103', 1)}${str('B103', 'Иванов Иван')}${num('C103', 3)}${num('E103', 5)}</row>`
    );
    const parsed = await api.parseJournalXlsx(bytes);
    assert.equal(parsed.length, 2);
    const ivan = parsed.find(student => student.name === 'Иванов Иван');
    const petr = parsed.find(student => student.name === 'Петров Петр');
    assert.equal(ivan.marksCount, 3); assert.equal(ivan.avg, 4);
    assert.equal(petr.marksCount, 0); assert.equal(petr.avg, null);
});

test('empty disciplines do not block summary and stay visible as unknown values', async t => {
    const s = setup(t); s.load('task_center.js'); const api = summary(s);
    const good = await workbook(`<row r="1">${str('A1', 'Иванов Иван')}${num('B1', 5)}</row>`);
    const empty = await workbook(`<row r="1">${str('A1', 'Нет оценок')}</row>`);
    s.w.fetch = async url => ({ ok: true, blob: async () => url.includes('group_ids=1') ? good : empty });
    const task = s.w.MeshTasks.start({ title: 'Сводная ведомость' });
    const pending = api.buildAndShowSummarySheet([{ id: 1, name: 'ИСП2311 ОС' }, { id: 2, name: 'ИСП2311 Практика' }], null, undefined, task);
    await s.flush(30); await pending;
    const modal = s.w.document.getElementById('speedmesh-summary-modal'); assert(modal);
    assert(modal.querySelector('details').textContent.includes('ИСП2311 Практика'));
    assert(modal.querySelector('#mesh-summary-tbody').textContent.includes('Нет данных'));
    assert.equal(s.w.document.querySelector('.mesh-task-row').dataset.status, 'done');
    assert(s.w.document.querySelector('.mesh-task-message').textContent.includes('Без оценок: 1'));
});

test('all-empty MESH journals explain that no marks are available without a parsing failure', async t => {
    const s = setup(t); s.load('task_center.js'); const api = summary(s);
    const empty = await workbook(`<row r="1">${str('A1', 'Нет оценок')}</row>`);
    s.w.fetch = async () => ({ ok: true, blob: async () => empty });
    const task = s.w.MeshTasks.start({ title: 'Сводная ведомость' });
    const pending = api.buildAndShowSummarySheet([{ id: 1, name: 'ИСП2311 Практика' }], null, undefined, task);
    await s.flush(20); await pending;
    assert.equal(s.w.document.querySelector('.mesh-task-row').dataset.status, 'done');
    assert(s.w.document.getElementById('speedmesh-toast-notify').textContent.includes('пока нет оценок'));
    assert.equal(s.w.document.getElementById('speedmesh-summary-modal'), null);
});
