const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const source = fs.readFileSync(path.join(__dirname, '../themes.js'), 'utf8');

function setup(initialTheme = 'default') {
    const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body style="background-color: rgb(244, 243, 248); color: rgb(20, 20, 20);">
        <main style="background-color: rgb(244, 243, 248);">
            <aside style="background-color: rgb(255, 255, 255); border: 1px solid rgb(220, 220, 230);">
                <span id="title" style="color: rgb(30, 30, 30);">Расписание</span>
            </aside>
            <button id="tint-btn" style="background-color: rgb(235, 248, 234); color: rgb(20, 40, 20);">Урок</button>
        </main>
        <div id="mesh-timer-card" style="background-color: rgb(255, 255, 255);">Таймер</div>
    </body></html>`, { url: 'https://school.mos.ru/' });

    const { window } = dom;
    const messageListeners = [];

    const chrome = {
        storage: {
            sync: {
                get: (keys, cb) => cb({ activeTheme: initialTheme })
            }
        },
        runtime: {
            onMessage: {
                addListener: (fn) => messageListeners.push(fn)
            }
        }
    };

    vm.runInNewContext(source, {
        window,
        document: window.document,
        chrome,
        console,
        getComputedStyle: window.getComputedStyle.bind(window),
        MutationObserver: window.MutationObserver,
        setTimeout: window.setTimeout.bind(window)
    });

    return {
        dom,
        document: window.document,
        sendMessage: (msg) => messageListeners.forEach(fn => fn(msg)),
        flush: () => new Promise(resolve => setTimeout(resolve, 40))
    };
}

test('dark theme adapts light surfaces, tinted buttons, text, borders, new SPA nodes and restores on default', async () => {
    const env = setup('default');

    env.sendMessage({ action: 'updateTheme', theme: 'dark' });
    await env.flush();

    const styleEl = env.document.getElementById('mesh-theme-preset-styles');
    assert.ok(styleEl.innerHTML.includes('color-scheme: dark'));
    assert.equal(env.document.querySelector('aside').getAttribute('data-mesh-dark-bg'), 'surface');
    assert.equal(env.document.querySelector('aside').getAttribute('data-mesh-dark-border'), '1');
    assert.equal(env.document.getElementById('title').getAttribute('data-mesh-dark-text'), '1');
    assert.equal(env.document.getElementById('tint-btn').getAttribute('data-mesh-dark-bg'), 'tint');
    assert.ok(env.document.getElementById('tint-btn').style.getPropertyValue('--mesh-dark-bg').startsWith('rgb('));
    assert.equal(env.document.getElementById('mesh-timer-card').getAttribute('data-mesh-dark-bg'), null);

    // Новые динамические элементы в SPA также адаптируются
    const modal = env.document.createElement('div');
    modal.id = 'late-modal';
    modal.style.backgroundColor = 'rgb(255, 255, 255)';
    modal.style.color = 'rgb(15, 15, 15)';
    env.document.body.appendChild(modal);
    await env.flush();

    assert.equal(modal.getAttribute('data-mesh-dark-bg'), 'surface');
    assert.equal(modal.getAttribute('data-mesh-dark-text'), '1');

    // Возврат на default полностью снимает адаптацию
    env.sendMessage({ action: 'updateTheme', theme: 'default' });
    await env.flush();

    assert.equal(styleEl.innerHTML, '');
    assert.equal(env.document.querySelectorAll('[data-mesh-dark-bg], [data-mesh-dark-text], [data-mesh-dark-border], [data-mesh-dark-locked]').length, 0);
    env.dom.window.close();
});

test('dark theme marks locked journal cells darker and dims all marks including б and н', async () => {
    const env = setup('dark');
    const table = env.document.createElement('table');
    table.innerHTML = `
        <tbody>
            <tr>
                <td id="locked-cell-b"><div data-test-component="markCell-1_2_3" data-disabled-by="ATTENDANCE"><span style="color: rgb(255, 0, 0);">б</span></div></td>
                <td id="locked-cell-n" style="background-color: rgb(242, 242, 242);"><div data-test-component="markCell-1_2_4"><span>н</span></div></td>
                <td id="open-cell"><div data-test-component="markCell-1_2_5" data-disabled-by="NOT_DISABLED"><span>5</span></div></td>
            </tr>
        </tbody>
    `;
    env.document.body.appendChild(table);
    await env.flush();

    const styleHtml = env.document.getElementById('mesh-theme-preset-styles').innerHTML;
    assert.ok(styleHtml.includes('[data-mesh-dark-locked="1"]'));
    assert.ok(styleHtml.includes('#090c10'));
    assert.ok(styleHtml.includes('#9aa4b2'));
    assert.ok(!styleHtml.includes('opacity: 0.45'));
    assert.ok(styleHtml.includes('grayscale(0.85)'));

    assert.equal(env.document.getElementById('locked-cell-b').getAttribute('data-mesh-dark-locked'), '1');
    assert.equal(env.document.getElementById('locked-cell-n').getAttribute('data-mesh-dark-locked'), '1');
    assert.equal(env.document.getElementById('open-cell').getAttribute('data-mesh-dark-locked'), null);

    env.sendMessage({ action: 'updateTheme', theme: 'default' });
    await env.flush();
    assert.equal(env.document.querySelectorAll('[data-mesh-dark-locked]').length, 0);
    env.dom.window.close();
});

test('dark theme removes MESH branding colors and fixes contrast and text bugs', async () => {
    const env = setup('dark');

    // 1. Проверяем, что в стилях шапки таблиц нейтральные, а не синие MESH-заголовки
    const styleHtml = env.document.getElementById('mesh-theme-preset-styles').innerHTML;
    assert.ok(styleHtml.includes('.ant-table-thead > tr > th, thead th'));
    assert.ok(styleHtml.includes('color: #e6edf3 !important;'));
    assert.ok(!styleHtml.includes('color: #58a6ff !important;\n            border-color: #30363d !important;\n        }'));

    // 2. Проверяем наличие стилей для кнопок, табов, селектов и календаря
    assert.ok(styleHtml.includes('.ant-btn-primary'));
    assert.ok(styleHtml.includes('.ant-tabs-tab'));
    assert.ok(styleHtml.includes('.ant-radio-button-wrapper'));
    assert.ok(styleHtml.includes('.ant-select-dropdown'));
    assert.ok(styleHtml.includes('.ant-picker'));

    // 3. Создаем элементы с типичной расцветкой МЭШ:
    // - светло-голубой фон МЭШ (колонка "сегодня" / подложка карточек)
    const meshBlueCol = env.document.createElement('div');
    meshBlueCol.id = 'site-today-col';
    meshBlueCol.style.backgroundColor = 'rgb(230, 247, 255)'; // #e6f7ff (МЭШ light blue)
    env.document.body.appendChild(meshBlueCol);

    // - темно-синий текст МЭШ (заголовки/подписи в дневнике)
    const meshDarkText = env.document.createElement('span');
    meshDarkText.id = 'site-dark-text';
    meshDarkText.style.color = 'rgb(0, 50, 150)'; // темно-синий, который тонул в темноте
    env.document.body.appendChild(meshDarkText);

    // - светло-синяя рамка МЭШ
    const meshBorder = env.document.createElement('div');
    meshBorder.id = 'site-border';
    meshBorder.style.borderTop = '1px solid rgb(145, 213, 255)'; // #91d5ff
    env.document.body.appendChild(meshBorder);

    // - насыщенный блок цвета МЭШ
    const meshBlock = env.document.createElement('div');
    meshBlock.id = 'site-block';
    meshBlock.style.backgroundColor = 'rgb(24, 144, 255)'; // #1890ff
    env.document.body.appendChild(meshBlock);

    // - кнопка МЭШ с темно-синей рамкой и светлый градиент
    const meshBtnBorder = env.document.createElement('button');
    meshBtnBorder.id = 'site-btn-border';
    meshBtnBorder.style.borderTop = '1px solid rgb(0, 85, 203)';
    env.document.body.appendChild(meshBtnBorder);

    const meshGradient = env.document.createElement('div');
    meshGradient.id = 'site-gradient';
    meshGradient.style.backgroundImage = 'linear-gradient(47.42deg, rgb(255, 185, 122) 0%, rgb(255, 225, 132) 100%)';
    env.document.body.appendChild(meshGradient);

    await env.flush();

    // Светло-голубой МЭШ-фон нейтрализован в canvas, а не синий тинт
    assert.equal(meshBlueCol.getAttribute('data-mesh-dark-bg'), 'canvas');
    assert.notEqual(meshBlueCol.getAttribute('data-mesh-dark-bg'), 'tint');

    // Темно-синий нечитаемый текст адаптирован в контрастный акцент
    assert.equal(meshDarkText.getAttribute('data-mesh-dark-text'), 'accent');

    // Синяя рамка адаптирована
    assert.equal(meshBorder.getAttribute('data-mesh-dark-border'), '1');
    assert.equal(meshBtnBorder.getAttribute('data-mesh-dark-border'), '1');

    // Насыщенный синий блок МЭШ и светлый градиент переведены в темный фон
    assert.equal(meshBlock.getAttribute('data-mesh-dark-bg'), 'elevated');
    assert.equal(meshGradient.getAttribute('data-mesh-dark-bg'), 'elevated');

    env.dom.window.close();
});

test('crimson theme applies black-red palette and adapts late nodes', async () => {
    const env = setup('crimson');

    const styleHtml = env.document.getElementById('mesh-theme-preset-styles').innerHTML;
    assert.ok(styleHtml.includes('#08080a'));
    assert.ok(styleHtml.includes('#ef4444'));

    const dynamicBox = env.document.createElement('div');
    dynamicBox.id = 'late-white-box';
    dynamicBox.style.backgroundColor = 'rgb(255, 255, 255)';
    env.document.body.appendChild(dynamicBox);
    await env.flush();
    assert.equal(dynamicBox.getAttribute('data-mesh-dark-bg'), 'surface');

    // Удаленные темы откатываются к default
    env.sendMessage({ action: 'updateTheme', theme: 'matrix' });
    await env.flush();
    assert.equal(env.document.getElementById('mesh-theme-preset-styles').innerHTML, '');

    env.dom.window.close();
});

test('dark and crimson themes keep dark grades readable and preserve colored averages', async () => {
    const env = setup('dark');
    const row = env.document.createElement('tr');
    row.innerHTML = `
        <td data-mesh-colored="true"><span style="color: rgb(39, 174, 96);">4.75</span></td>
        <td><div data-test-component="markCell-1_2_3"><span style="color: rgb(20, 20, 20);">5</span></div></td>
        <td><div data-test-component="markCell-1_2_4"><span style="color: rgb(192, 57, 43);">2</span></div></td>
    `;
    env.document.body.appendChild(row);
    await env.flush();

    assert.equal(row.querySelector('[data-mesh-colored] span').getAttribute('data-mesh-dark-text'), null);
    assert.equal(row.querySelector('[data-test-component="markCell-1_2_3"] span').getAttribute('data-mesh-dark-text'), '1');
    assert.equal(row.querySelector('[data-test-component="markCell-1_2_4"] span').getAttribute('data-mesh-dark-text'), null);
    env.dom.window.close();
});

test('dark and crimson themes style #mesh-task-center via theme variables', async () => {
    const env = setup('dark');
    let styleHtml = env.document.getElementById('mesh-theme-preset-styles').innerHTML;
    assert.ok(styleHtml.includes('#mesh-task-center'));
    assert.ok(styleHtml.includes('--mesh-tc-surface: #161b22'));
    assert.ok(styleHtml.includes('--mesh-tc-accent: #58a6ff'));
    assert.ok(styleHtml.includes('--mesh-sticky-bg: #161b22'));

    env.sendMessage({ action: 'updateTheme', theme: 'crimson' });
    await env.flush();
    styleHtml = env.document.getElementById('mesh-theme-preset-styles').innerHTML;
    assert.ok(styleHtml.includes('--mesh-tc-surface: #120b0d'));
    assert.ok(styleHtml.includes('--mesh-tc-accent: #ef4444'));

    env.sendMessage({ action: 'updateTheme', theme: 'default' });
    await env.flush();
    assert.equal(env.document.getElementById('mesh-theme-preset-styles').innerHTML, '');
    env.dom.window.close();
});
