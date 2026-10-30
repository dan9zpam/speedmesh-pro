const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../cookie_cleaner.js'), 'utf8');

async function setup() {
    let now = 1000000;
    const state = { data: {}, alarms: {}, tabs: [], removed: [], events: {}, fail: false };
    const event = name => ({ addListener: fn => { state.events[name] = fn; } });
    const chrome = {
        storage: { local: {
            get: async key => ({ [key]: state.data[key] }),
            set: async values => Object.assign(state.data, JSON.parse(JSON.stringify(values)))
        } },
        alarms: {
            get: async name => state.alarms[name],
            create: async (name, value) => { state.alarms[name] = { scheduledTime: value.when }; },
            clear: async name => { delete state.alarms[name]; },
            onAlarm: event('alarm')
        },
        tabs: { query: async () => state.tabs, onRemoved: event('removed'), onUpdated: event('updated') },
        runtime: {
            id: 'test', getURL: name => 'chrome-extension://test/' + name,
            onMessage: event('message'), onStartup: event('startup'), onInstalled: event('installed')
        },
        cookies: {
            getAll: async ({ domain }) => [
                { domain: '.' + domain, path: '/', name: 'auth', storeId: '0', httpOnly: true },
                { domain: 'sub.' + domain, path: '/journal', name: 'auth', storeId: '0', partitionKey: { topLevelSite: 'https://school.mos.ru' } },
                { domain: '.mos.ru', path: '/', name: 'shared', storeId: '0' },
                { domain: 'evil' + domain, path: '/', name: 'other', storeId: '0' }
            ],
            remove: async details => {
                if (state.fail) throw new Error('denied');
                state.removed.push(details);
                return details;
            }
        }
    };
    vm.runInNewContext(source, { chrome, console, URL, Date: { now: () => now } });
    state.flush = () => new Promise(resolve => setImmediate(resolve));
    state.advance = millis => { now += millis; };
    state.settings = () => state.data.meshCookieCleanup;
    state.request = (action, extra = {}) => new Promise(resolve => {
        assert.equal(state.events.message({ action, ...extra }, {
            id: 'test', url: chrome.runtime.getURL('popup.html')
        }, resolve), true);
    });
    state.fire = async () => { state.events.alarm({ name: 'mesh-cookie-cleanup' }); await state.flush(); };
    await state.flush();
    return state;
}

test('daily default, manual cleanup, domain boundary and error reporting', async () => {
    const s = await setup();
    assert.equal(s.settings().hours, 24);
    assert.equal(s.removed.length, 0);
    assert.equal(s.settings().nextAt, 1000000 + 86400000);
    let result = await s.request('clearMeshCookies');
    assert.equal(result.last.removed, 4);
    assert(s.removed.every(c => !c.url.includes('evil') && c.name !== 'shared'));
    assert(s.removed.some(c => c.partitionKey));
    s.fail = true;
    result = await s.request('clearMeshCookies');
    assert.equal(result.last.failed, 4);
    assert.equal(result.last.removed, 0);
});

test('waits for every MESH tab; closes and navigations release due cleanup once', async () => {
    const s = await setup();
    s.tabs = [{ url: 'https://school.mos.ru/journal', active: false }, { url: 'https://sub.dnevnik.mos.ru/', discarded: true }];
    s.advance(86400000);
    await s.fire();
    assert.equal(s.settings().deferred, true);
    assert.equal(s.removed.length, 0);
    assert(s.alarms['mesh-cookie-cleanup'].scheduledTime >= s.settings().nextAt + 60000);
    s.tabs.pop(); s.events.removed(2); await s.flush();
    assert.equal(s.removed.length, 0);
    s.tabs = [{ url: 'https://example.com/' }];
    s.events.updated(1, { url: 'https://example.com/' }); await s.flush();
    assert.equal(s.removed.length, 4);
    assert.equal(s.settings().deferred, false);
    s.events.removed(1); await s.flush();
    assert.equal(s.removed.length, 4);
});

test('pending navigation defers; manual cleanup can override; disabling cancels waiting', async () => {
    const s = await setup();
    s.tabs = [{ pendingUrl: 'https://school.mos.ru/' }];
    s.advance(86400000); await s.fire();
    assert.equal(s.settings().deferred, true);
    await s.request('clearMeshCookies');
    assert.equal(s.removed.length, 4);
    s.advance(86400000); await s.fire();
    await s.request('setCookieCleanup', { hours: 0 });
    assert.equal(s.settings().deferred, false);
    assert(!s.alarms['mesh-cookie-cleanup']);
    s.tabs = []; s.events.removed(1); await s.flush(); await s.fire();
    assert.equal(s.removed.length, 4);
});

test('interval validation and restoration retain due time and deferred state', async () => {
    const s = await setup();
    assert.equal((await s.request('setCookieCleanup', { hours: 2 })).ok, false);
    await s.request('setCookieCleanup', { hours: 6 });
    s.tabs = [{ url: 'https://school.mos.ru/' }];
    s.advance(21600000); await s.fire();
    const nextAt = s.settings().nextAt;
    delete s.alarms['mesh-cookie-cleanup']; s.events.startup(); await s.flush();
    assert(s.alarms['mesh-cookie-cleanup']);
    assert.equal(s.settings().nextAt, nextAt);
    assert.equal(s.settings().deferred, true);
    s.tabs = [{ url: 'https://evilschool.mos.ru/' }]; await s.fire();
    assert.equal(s.removed.length, 4);
});
