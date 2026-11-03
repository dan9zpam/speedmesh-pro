// Shared UI for operations in this MESH tab. Tasks are never replayed after reload.
(function () {
    if (window.MeshTasks) return;
    const tasks = new Map();
    let sequence = 0;
    let root, launcher, drawer, list, controls, empty;
    const labels = { running: 'В работе', stopping: 'Останавливается', done: 'Готово', error: 'Ошибка', cancelled: 'Остановлено' };
    const active = task => task.status === 'running' || task.status === 'stopping';

    function ensureUI() {
        if (root?.isConnected) return;
        const style = document.createElement('style');
        style.textContent = `
            #mesh-task-center { position:fixed; right:20px; bottom:66px; z-index:9999998; color:#e2e8f0; font:13px/1.45 system-ui,sans-serif; }
            #mesh-task-center * { box-sizing:border-box; }
            #mesh-task-center button { font:inherit; cursor:pointer; border:1px solid #475569; border-radius:9px; padding:7px 11px; background:#334155; color:#f8fafc; }
            #mesh-task-center button:hover { background:#475569; }
            #mesh-task-center button:focus-visible { outline:2px solid #a5b4fc; outline-offset:3px; }
            #mesh-task-center button:disabled { cursor:default; opacity:.6; }
            #mesh-task-launcher { display:block; margin-left:auto; background:#334155; box-shadow:0 4px 16px #0f172a33; }
            #mesh-task-drawer { width:min(390px,calc(100vw - 32px)); max-height:calc(100vh - 150px); overflow:auto; margin-bottom:10px; background:#0f172a; border:1px solid #475569; border-radius:16px; box-shadow:0 14px 45px #0f172a55; }
            #mesh-task-drawer[hidden] { display:none !important; }
            .mesh-task-header { display:flex; align-items:center; justify-content:space-between; padding:13px 15px; border-bottom:1px solid #334155; }
            #mesh-task-list, #mesh-task-controls { padding:0 12px; }
            .mesh-task-row { margin:12px 0; padding:12px; background:#1e293b; border:1px solid #334155; border-radius:12px; overflow-wrap:anywhere; }
            .mesh-task-title { font-weight:650; margin-bottom:5px; }
            .mesh-task-status { color:#a5b4fc; font-size:11px; }
            .mesh-task-row[data-status="error"] .mesh-task-status { color:#fca5a5; }
            .mesh-task-row[data-status="done"] .mesh-task-status { color:#6ee7b7; }
            .mesh-task-message { color:#cbd5e1; margin:6px 0; white-space:pre-wrap; }
            .mesh-task-row progress { width:100%; height:6px; accent-color:#818cf8; }
            .mesh-task-actions { display:flex; gap:6px; margin-top:8px; flex-wrap:wrap; }
            #mesh-task-empty { padding:14px; margin:0; color:#94a3b8; }
            #mesh-task-center #mesh-robot-panel, #mesh-task-center #mesh-ktp-panel {
                position:static !important; inset:auto !important; transform:none !important; width:100% !important; max-width:100% !important;
                margin:12px 0 !important; padding:12px !important; border:1px solid #334155 !important; border-radius:12px !important;
                background:#1e293b !important; box-shadow:none !important; gap:10px !important; flex-wrap:wrap !important; transition:none !important;
            }
            #mesh-task-center #mesh-robot-panel > div { margin-left:0 !important; max-width:100%; flex-wrap:wrap; }
            #mesh-task-center #mesh-robot-panel button { padding:7px 10px !important; font-size:12px !important; }
            #mesh-task-center #mesh-robot-panel select { max-width:100%; }
        `;
        (document.head || document.documentElement).append(style);
        root = document.createElement('div');
        root.id = 'mesh-task-center';
        root.innerHTML = `<section id="mesh-task-drawer" aria-label="Центр задач" hidden>
            <div class="mesh-task-header"><strong>Центр задач</strong><button type="button" id="mesh-task-close" aria-label="Свернуть центр задач">×</button></div>
            <div id="mesh-task-controls"></div><div id="mesh-task-list" aria-live="polite"></div>
            <p id="mesh-task-empty">Здесь появятся текущие задачи и их результаты.</p>
            <div class="mesh-task-header"><small>Задачи этой вкладки</small><button type="button" id="mesh-task-clear">Убрать завершённые</button></div>
        </section><button type="button" id="mesh-task-launcher" aria-expanded="false" aria-controls="mesh-task-drawer">Задачи</button>`;
        document.body.append(root);
        launcher = root.querySelector('#mesh-task-launcher');
        drawer = root.querySelector('#mesh-task-drawer');
        list = root.querySelector('#mesh-task-list');
        controls = root.querySelector('#mesh-task-controls');
        empty = root.querySelector('#mesh-task-empty');
        launcher.onclick = () => setOpen(drawer.hidden);
        root.querySelector('#mesh-task-close').onclick = () => { setOpen(false); launcher.focus(); };
        root.querySelector('#mesh-task-clear').onclick = () => {
            for (const [id, task] of tasks) if (!active(task)) { task.row.remove(); tasks.delete(id); }
            refresh();
        };
        root.addEventListener('keydown', event => { if (event.key === 'Escape') { setOpen(false); launcher.focus(); } });
    }

    function setOpen(open) {
        ensureUI();
        drawer.hidden = !open;
        launcher.setAttribute('aria-expanded', String(open));
    }

    function refresh() {
        const running = [...tasks.values()].filter(active).length;
        const errors = [...tasks.values()].filter(task => task.status === 'error').length;
        launcher.textContent = running ? `Задачи · ${running} в работе` : errors ? `Задачи · ошибок: ${errors}` : 'Задачи';
        empty.hidden = tasks.size > 0;
    }

    function render(task) {
        task.row.dataset.status = task.status;
        task.row.querySelector('.mesh-task-status').textContent = labels[task.status];
        task.row.querySelector('.mesh-task-message').textContent = task.message;
        const progress = task.row.querySelector('progress');
        progress.hidden = !(task.total > 0);
        if (task.total > 0) { progress.max = task.total; progress.value = Math.min(task.current, task.total); }
        const count = task.row.querySelector('.mesh-task-count');
        count.textContent = task.total > 0 ? `${task.current} / ${task.total}` : '';
        const stop = task.row.querySelector('.mesh-task-stop');
        stop.hidden = !task.cancellable || !active(task);
        stop.disabled = task.cancelled;
        refresh();
    }

    window.MeshTasks = {
        open: () => setOpen(true),
        attachPanel(panel) {
            ensureUI();
            if (panel.parentElement !== controls) controls.append(panel);
        },
        start({ title, total = 0, message = '', cancellable = false, onCancel } = {}) {
            ensureUI();
            // Bound session history without discarding active operations.
            const completed = [...tasks.values()].filter(task => !active(task));
            while (completed.length >= 10) { const old = completed.shift(); old.row.remove(); tasks.delete(old.id); }
            const task = { id: ++sequence, status: 'running', title, total, current: 0, message, cancelled: false, cancellable: cancellable || !!onCancel };
            task.row = document.createElement('article');
            task.row.className = 'mesh-task-row';
            task.row.innerHTML = '<div class="mesh-task-title"></div><span class="mesh-task-status"></span> <span class="mesh-task-count"></span><div class="mesh-task-message"></div><progress aria-label="Прогресс задачи"></progress><div class="mesh-task-actions"><button type="button" class="mesh-task-stop">Остановить</button></div>';
            task.row.querySelector('.mesh-task-title').textContent = title;
            task.row.querySelector('.mesh-task-stop').onclick = () => {
                if (!active(task) || task.cancelled) return;
                task.cancelled = true;
                task.status = 'stopping';
                task.message = 'Завершаем текущий запрос…';
                try { onCancel?.(); } finally { render(task); }
            };
            tasks.set(task.id, task);
            list.prepend(task.row);
            render(task);
            setOpen(true);
            return {
                get cancelled() { return task.cancelled; },
                update(values) {
                    if (!active(task)) return;
                    for (const key of ['message', 'current', 'total']) if (values[key] !== undefined) task[key] = values[key];
                    render(task);
                },
                finish(status = 'done', message = '') {
                    if (!active(task)) return;
                    task.status = ['done', 'error', 'cancelled'].includes(status) ? status : 'error';
                    task.message = message;
                    if (task.status === 'done') task.current = task.total;
                    render(task);
                },
                action(label, callback) {
                    const button = document.createElement('button');
                    button.type = 'button'; button.textContent = label;
                    button.onclick = async () => {
                        button.disabled = true;
                        try { await callback(); } catch (error) {
                            task.message = 'Не удалось выполнить действие: ' + error.message;
                            render(task);
                        } finally { button.disabled = false; }
                    };
                    task.row.querySelector('.mesh-task-actions').append(button);
                }
            };
        }
    };
    if (document.body) ensureUI();
})();
