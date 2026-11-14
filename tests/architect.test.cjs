const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const source = fs.readFileSync(path.join(__dirname, '../architect.js'), 'utf8');

async function setup(initialRules = {}) {
    const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body>
        <button id="open-modal-btn">Открыть</button>
        <div id="dynamic-modal" style="display:none;">Модалка</div>
        <div id="banner">Баннер</div>
    </body></html>`, { url: 'https://school.mos.ru/' });

    const { window } = dom;
    const localData = { MESH_ARCHITECT_RULES: JSON.parse(JSON.stringify(initialRules)) };
    const syncData = { architectMode: false };
    const messageListeners = [];
    const storageChangeListeners = [];

    const chrome = {
        storage: {
            local: {
                get: async (keys) => {
                    const out = {};
                    const list = Array.isArray(keys) ? keys : [keys];
                    for (const k of list) {
                        if (k in localData) out[k] = JSON.parse(JSON.stringify(localData[k]));
                    }
                    return out;
                },
                set: async (values) => {
                    const prev = localData.MESH_ARCHITECT_RULES ? JSON.parse(JSON.stringify(localData.MESH_ARCHITECT_RULES)) : undefined;
                    Object.assign(localData, JSON.parse(JSON.stringify(values)));
                    if ('MESH_ARCHITECT_RULES' in values) {
                        for (const fn of storageChangeListeners) {
                            fn({ MESH_ARCHITECT_RULES: { oldValue: prev, newValue: JSON.parse(JSON.stringify(values.MESH_ARCHITECT_RULES)) } }, 'local');
                        }
                    }
                }
            },
            sync: {
                get: (keys, cb) => cb({ ...syncData }),
                set: (values, cb) => { Object.assign(syncData, values); if (cb) cb(); }
            },
            onChanged: {
                addListener: (fn) => storageChangeListeners.push(fn)
            }
        },
        runtime: {
            onMessage: {
                addListener: (fn) => messageListeners.push(fn)
            }
        }
    };

    const context = {
        window,
        document: window.document,
        localStorage: window.localStorage,
        chrome,
        console,
        confirm: () => true,
        setInterval: window.setInterval.bind(window),
        clearInterval: window.clearInterval.bind(window),
        setTimeout: window.setTimeout.bind(window),
        clearTimeout: window.clearTimeout.bind(window),
        MouseEvent: window.MouseEvent
    };

    vm.runInNewContext(source, context);
    await new Promise(resolve => setTimeout(resolve, 20));

    return {
        dom,
        window,
        document: window.document,
        localData,
        sendMessage: (msg) => messageListeners.forEach(fn => fn(msg)),
        waitForSelector: async (sel) => {
            for (let i = 0; i < 30; i++) {
                const el = window.document.querySelector(sel);
                if (el) return el;
                await new Promise(r => setTimeout(r, 20));
            }
            return null;
        },
        flush: () => new Promise(resolve => setTimeout(resolve, 20))
    };
}

test('architect removes single rule and clears all rules without restoring from storage', async () => {
    const env = await setup({
        '#banner': { hide: true },
        '#dynamic-modal': { bg: '#ff0000' }
    });

    const styleEl = env.document.getElementById('mesh-architect-styles');
    assert.ok(styleEl.innerHTML.includes('#banner'));
    assert.ok(styleEl.innerHTML.includes('#dynamic-modal'));

    env.sendMessage({ action: 'toggleArchitect', state: true });
    const manager = await env.waitForSelector('#mesh-architect-manager');
    assert.ok(manager);

    const delBtns = manager.querySelectorAll('.mesh-arch-del-btn');
    assert.equal(delBtns.length, 2);
    delBtns[0].click();
    await env.flush();

    assert.equal(env.localData.MESH_ARCHITECT_RULES['#banner'], undefined);
    assert.ok(env.localData.MESH_ARCHITECT_RULES['#dynamic-modal']);
    assert.ok(!styleEl.innerHTML.includes('#banner'));
    assert.ok(styleEl.innerHTML.includes('#dynamic-modal'));

    env.document.getElementById('mesh-arch-clear-all').click();
    await env.flush();

    assert.deepEqual(env.localData.MESH_ARCHITECT_RULES, {});
    assert.equal(env.window.localStorage.getItem('MESH_ARCHITECT_RULES'), '{}');
    assert.equal(styleEl.innerHTML, '');

    env.sendMessage({ action: 'toggleArchitect', state: false });
    env.dom.window.close();
});

test('architect resetDesign message clears all rules even when inactive', async () => {
    const env = await setup({ '#banner': { hide: true } });
    const styleEl = env.document.getElementById('mesh-architect-styles');
    assert.ok(styleEl.innerHTML.includes('#banner'));

    env.sendMessage({ action: 'resetDesign' });
    await env.flush();

    assert.deepEqual(env.localData.MESH_ARCHITECT_RULES, {});
    assert.equal(styleEl.innerHTML, '');
    env.dom.window.close();
});

test('architect allows interacting with site buttons via pause toggle and Alt+click to edit dynamic blocks', async () => {
    const env = await setup();
    let modalOpened = 0;
    const openBtn = env.document.getElementById('open-modal-btn');
    const modal = env.document.getElementById('dynamic-modal');
    openBtn.addEventListener('click', () => {
        modalOpened++;
        modal.style.display = 'block';
    });

    env.sendMessage({ action: 'toggleArchitect', state: true });
    await env.waitForSelector('#mesh-architect-manager');

    // Обычный клик в активном режиме перехватывается архитектором
    openBtn.dispatchEvent(new env.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    assert.equal(modalOpened, 0);
    assert.equal(env.document.getElementById('mesh-architect-toolbar').style.display, 'flex');

    // Alt+клик проходит к интерфейсу сайта
    openBtn.dispatchEvent(new env.window.MouseEvent('click', { bubbles: true, cancelable: true, altKey: true }));
    assert.equal(modalOpened, 1);
    assert.equal(modal.style.display, 'block');

    // Кнопка паузы тоже пропускает обычные клики, а после снятия паузы можно скрыть открытый блок
    env.document.getElementById('mesh-arch-pause').click();
    openBtn.dispatchEvent(new env.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    assert.equal(modalOpened, 2);

    env.document.getElementById('mesh-arch-pause').click();
    modal.dispatchEvent(new env.window.MouseEvent('mousemove', { bubbles: true }));
    modal.dispatchEvent(new env.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    env.document.getElementById('mesh-arch-hide').click();
    await env.flush();

    assert.deepEqual(env.localData.MESH_ARCHITECT_RULES['#dynamic-modal'], { hide: true });
    assert.ok(env.document.getElementById('mesh-architect-styles').innerHTML.includes('#dynamic-modal'));

    env.sendMessage({ action: 'toggleArchitect', state: false });
    env.dom.window.close();
});
