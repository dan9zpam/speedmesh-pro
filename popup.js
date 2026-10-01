document.addEventListener('DOMContentLoaded', () => {
    // Устанавливаем актуальную версию в шапке
    const badge = document.querySelector('.version-badge');
    if (badge) badge.textContent = 'v' + chrome.runtime.getManifest().version;

    // Проверка обновлений (с возможностью скрытия)
    fetch('https://raw.githubusercontent.com/stillar1/speedmesh-pro/main/manifest.json', { cache: 'no-store' })
        .then(res => res.json())
        .then(data => {
            const currentVer = chrome.runtime.getManifest().version;
            if (data.version && data.version !== currentVer) {
                chrome.storage.local.get(['ignoredUpdate'], (store) => {
                    if (store.ignoredUpdate !== data.version) {
                        const banner = document.getElementById('update-banner');
                        if (banner) {
                            banner.style.display = 'block';
                            banner.onclick = () => {
                                alert("Чтобы обновиться:\n1. Скачайте код с GitHub (Code -> Download ZIP)\n2. Замените папку расширения\n3. Нажмите кнопку 'Обновить' 🔄 в chrome://extensions");
                                chrome.storage.local.set({ignoredUpdate: data.version});
                                banner.style.display = 'none';
                                chrome.tabs.create({ url: "https://github.com/stillar1/speedmesh-pro" });
                            };
                        }
                    }
                });
            }
        }).catch(e => console.log('Update check failed'));

    const toggles = [
        'autoGrader', 'highlightGrades', 'ktpModule', 'calcAttendance', 'calculatorMode', 'stickyMode', 
        'speedUp', 'apiSpyMode', 'architectMode', 'randomizerMode', 
        'timerMode', 'ghostMode'
    ];

    const uiElements = {};
    toggles.forEach(key => { uiElements[key] = document.getElementById(key); });

    chrome.storage.sync.get([...toggles, 'customBellsText', 'timerNoteText', 'timerTheme', 'menuTheme'], (data) => {
        if (data.menuTheme) {
            document.body.setAttribute('data-theme', data.menuTheme);
            if (document.getElementById('menuTheme')) document.getElementById('menuTheme').value = data.menuTheme;
        }

        toggles.forEach(key => {
            if (uiElements[key]) {
                const defaultState = ['speedUp', 'spyMode', 'architectMode', 'ghostMode'].includes(key) ? false : true;
                uiElements[key].checked = data[key] !== undefined ? data[key] : defaultState;
            }
        });

        if (document.getElementById('customBells') && data.customBellsText !== undefined) document.getElementById('customBells').value = data.customBellsText;
        if (document.getElementById('timerNote') && data.timerNoteText !== undefined) document.getElementById('timerNote').value = data.timerNoteText;
        if (document.getElementById('timerTheme') && data.timerTheme !== undefined) document.getElementById('timerTheme').value = data.timerTheme;
    });

    function showToast(text = "✅ Сохранено!") {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.innerHTML = text;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 1500);
    }

    function notifyContentScript(message) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].url.includes('mos.ru')) {
                chrome.tabs.sendMessage(tabs[0].id, message).catch(() => {});
            }
        });
    }

    toggles.forEach(key => {
        if (uiElements[key]) {
            uiElements[key].addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                chrome.storage.sync.set({ [key]: isChecked }, () => {
                    showToast();
                    if (key === 'ghostMode') {
                        setTimeout(() => alert("Для применения 'Режима невидимки' необходимо обновить страницу журнала (F5)."), 300);
                    }
                });
                
                if (key === 'autoGrader' || key === 'architectMode') {
                    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                        if (tabs[0] && tabs[0].url.includes('mos.ru')) {
                            chrome.tabs.reload(tabs[0].id);
                        }
                    });
                } else {
                    notifyContentScript({ action: 'updateSettings', settings: { [key]: isChecked } });
                }
            });
        }
    });

    ['customBells', 'timerNote'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', (e) => {
                chrome.storage.sync.set({ [id + 'Text']: e.target.value });
                notifyContentScript({ action: 'updateTimerData' });
            });
        }
    });

    const timerThemeSelect = document.getElementById('timerTheme');
    if (timerThemeSelect) {
        timerThemeSelect.addEventListener('change', (e) => {
            chrome.storage.sync.set({ timerTheme: e.target.value });
            notifyContentScript({ action: 'updateTimerData' });
        });
    }

    const menuThemeSelect = document.getElementById('menuTheme');
    if (menuThemeSelect) {
        menuThemeSelect.addEventListener('change', (e) => {
            const theme = e.target.value;
            document.body.setAttribute('data-theme', theme);
            chrome.storage.sync.set({ menuTheme: theme });
        });
    }

    const scanBtn = document.getElementById('runScannerBtn');
    if (scanBtn) {
        scanBtn.addEventListener('click', () => {
            notifyContentScript({action: "runFeatureScanner"});
            showToast("🔍 Сканирование запущено...");
        });
    }

    document.getElementById('refreshPageBtn')?.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].url.includes('mos.ru')) {
                chrome.tabs.reload(tabs[0].id);
            }
        });
    });

    document.getElementById('resetArchBtn')?.addEventListener('click', () => {
        if (confirm('Внимание! Это удалит все скрытые элементы и вернет оригинальный дизайн страницы. Продолжить?')) {
            notifyContentScript({ action: 'resetDesign' });
            showToast("✅ Дизайн сброшен");
        }
    });

    document.getElementById('buildChartBtn')?.addEventListener('click', () => {
        notifyContentScript({ action: 'buildChart' });
        showToast("📊 Строим график...");
    });

    document.getElementById('btn-guide')?.addEventListener('click', () => { 
        chrome.tabs.create({ url: chrome.runtime.getURL("guide.html") }); 
    });
    
    document.getElementById('btn-trophies')?.addEventListener('click', () => { 
        notifyContentScript({ action: 'showTrophies' }); 
    });

    document.getElementById('btn-rollback')?.addEventListener('click', async () => {
        if (confirm('Сбросить все настройки, достижения и оформление до исходного состояния?')) {
            await chrome.storage.local.clear();
            await chrome.storage.sync.clear();
            notifyContentScript({ action: 'rollbackData' });
            showToast("🔄 Откат завершен!");
            setTimeout(() => {
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs[0] && tabs[0].url.includes('mos.ru')) {
                        chrome.tabs.reload(tabs[0].id);
                    }
                });
            }, 1000);
        }
    });

    // --- МАШИНА ВРЕМЕНИ (Подмена даты) ---
    const dateInput = document.getElementById('fakeDate');
    const saveDateBtn = document.getElementById('saveDateBtn');
    const resetDateBtn = document.getElementById('resetDateBtn');

    if (dateInput && saveDateBtn && resetDateBtn) {
        chrome.storage.local.get(['fakeDate'], (result) => {
            dateInput.value = result.fakeDate || new Date().toISOString().split('T')[0];
        });

        const runOnPage = (func, arg) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (!tabs[0]?.id) return;
                chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    world: 'MAIN',
                    func: func,
                    args: arg ? [arg] : []
                }, () => {
                    showToast("✅ Дата применена!");
                    setTimeout(() => {
                        chrome.tabs.reload(tabs[0].id, () => window.close());
                    }, 500);
                });
            });
        };

        saveDateBtn.addEventListener('click', () => {
            const selectedDate = dateInput.value;
            if (selectedDate) {
                chrome.storage.local.set({ fakeDate: selectedDate }, () => {
                    runOnPage((val) => { window.localStorage.setItem('__mesh_spoofed_date', val); }, selectedDate);
                });
            }
        });

        resetDateBtn.addEventListener('click', () => {
            chrome.storage.local.remove('fakeDate', () => {
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (!tabs[0]?.id) return;
                    chrome.scripting.executeScript({
                        target: { tabId: tabs[0].id },
                        world: 'MAIN',
                        func: () => { window.localStorage.removeItem('__mesh_spoofed_date'); }
                    }, () => {
                        showToast("🔄 Дата сброшена!");
                        setTimeout(() => {
                            chrome.tabs.reload(tabs[0].id, () => window.close());
                        }, 500);
                    });
                });
            });
        });
    }
});
