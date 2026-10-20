// ==========================================
// 🚪 MESH Visits & Attendance Scanner
// Комплексный модуль посещаемости:
// 1. Официальный реестр пропусков МЭШ и справки ЕМИАС
// 2. Проходы через турникеты (dnevnik-mos-ru-api)
// ==========================================
(function() {
    console.log("🚪 MESH Visits & Attendance Scanner: Модуль посещаемости активен");

    let isVisitsEnabled = true;

    const syncVisitsSettings = () => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
            chrome.storage.sync.get(['visitsScanner'], (data) => {
                if (data && data.visitsScanner !== undefined) {
                    isVisitsEnabled = data.visitsScanner;
                }
            });
        }
    };
    syncVisitsSettings();

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((req) => {
            if (req.action === "updateSettings") syncVisitsSettings();
        });
    }

    const REASONS_MAP = {
        1: "По болезни (ЕМИАС)",
        2: "Отсутствовал на уроке",
        3: "По семейным обстоятельствам",
        4: "Уважительная причина",
        5: "По состоянию здоровья",
        6: "По заявлению родителей",
        7: "Карантин",
        8: "Причина не указана",
        9: "По заявлению обучающегося",
        10: "Индивидуальный учебный план"
    };

    // Заголовки без дублирования (защита от 431 Request Header Fields Too Large)
    function getMeshHeaders(subsystem = "profeducation") {
        let headers = {
            "Accept": "application/json, text/plain, */*",
            "Content-Type": "application/json"
        };

        let cookies = {};
        try {
            cookies = document.cookie.split('; ').reduce((acc, v) => {
                let parts = v.split('=');
                if (parts[0]) acc[parts[0].trim()] = decodeURIComponent(parts.slice(1).join('='));
                return acc;
            }, {});
        } catch(e) {}

        const token = cookies['aupd_token'] || cookies['auth_token'] || "";
        const profileId = cookies['profile_id'] || cookies['student_id'] || "";

        if (subsystem === "familyweb") {
            // Спецификация dnevnik-mos-ru-api для семейного API (только Auth-Token)
            if (token) headers["Auth-Token"] = token;
            if (profileId) headers["Profile-Id"] = profileId;
            headers["x-mes-subsystem"] = "familyweb";
        } else {
            // Спецификация учительского API СПО / школы
            if (token) headers["Authorization"] = `Bearer ${token}`;
            if (profileId) headers["Profile-Id"] = profileId;
            headers["x-mes-subsystem"] = subsystem;
        }

        return headers;
    }

    function getMskDateStr(dateObj = new Date()) {
        return dateObj.toLocaleDateString('en-CA', { timeZone: 'Europe/Moscow' });
    }

    // 1. Получение официальных пропусков студента из кэша перехватчика
    function getOfficialAttendances(studentProfileId) {
        if (!studentProfileId) return [];
        try {
            const raw = window.sessionStorage.getItem('MESH_ATTENDANCES_CACHE');
            if (!raw) return [];
            const list = JSON.parse(raw);
            return list.filter(item => String(item.student_profile_id) === String(studentProfileId));
        } catch(e) {
            return [];
        }
    }

    // 2. Получение справок ЕМИАС о болезни из кэша перехватчика
    function getEmiasExemptions(studentProfileId) {
        if (!studentProfileId) return [];
        try {
            const raw = window.sessionStorage.getItem('MESH_EMIAS_CACHE');
            if (!raw) return [];
            const list = JSON.parse(raw);
            return list.filter(item => String(item.student_profile_id) === String(studentProfileId));
        } catch(e) {
            return [];
        }
    }

    // 2.1. Получение уведомлений/заявлений родителей из кэша
    function getParentNotifications(studentProfileId) {
        if (!studentProfileId) return [];
        try {
            const raw = window.sessionStorage.getItem('MESH_NOTIFICATIONS_CACHE');
            if (!raw) return [];
            const list = JSON.parse(raw);
            return list.filter(item => String(item.student_profile_id) === String(studentProfileId));
        } catch(e) {
            return [];
        }
    }

    // 3. Резолвинг лицевого счета (contract_id / ispp_account)
    async function resolveContractId(studentProfileId) {
        if (!studentProfileId) return null;
        const cacheKey = `MESH_STUDENT_ISPP_${studentProfileId}`;
        const cached = window.sessionStorage.getItem(cacheKey);
        if (cached) return cached;

        const headers = getMeshHeaders("familyweb");

        // Попытка через семейный профиль
        try {
            const res = await fetch('https://school.mos.ru/api/family/web/v1/profile', {
                headers,
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data.children && Array.isArray(data.children)) {
                    for (let child of data.children) {
                        if (child.contract_id) {
                            window.sessionStorage.setItem(`MESH_STUDENT_ISPP_${child.id}`, String(child.contract_id));
                            if (String(child.id) === String(studentProfileId)) {
                                return String(child.contract_id);
                            }
                        }
                    }
                    if (data.children.length === 1 && data.children[0].contract_id) {
                        return String(data.children[0].contract_id);
                    }
                }
            }
        } catch(e) {}

        return null;
    }

    // 4. Запрос проходов через турникеты (по dnevnik-mos-ru-api)
    async function fetchVisits(contractId, fromDate, toDate) {
        if (!contractId) return [];
        const today = getMskDateStr();
        const from = fromDate || today;
        const to = toDate || today;
        const cacheKey = `MESH_VISITS_${contractId}_${from}_${to}`;

        const cached = window.sessionStorage.getItem(cacheKey);
        if (cached) {
            try { return JSON.parse(cached); } catch(e) {}
        }

        const headers = getMeshHeaders("familyweb");
        const url = `https://school.mos.ru/api/family/web/v1/visits?from=${from}&to=${to}&contract_id=${contractId}`;

        const res = await fetch(url, { headers, credentials: 'include' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        const payload = data.payload || [];

        try {
            window.sessionStorage.setItem(cacheKey, JSON.stringify(payload));
        } catch(e) {}

        return payload;
    }

    // 5. Формирование сводного статуса посещаемости ученика
    function getStudentAttendanceSummary(studentProfileId) {
        const attendances = getOfficialAttendances(studentProfileId);
        const emias = getEmiasExemptions(studentProfileId);
        const notifications = getParentNotifications(studentProfileId);

        let todayMsk = getMskDateStr();
        let todayParts = todayMsk.split('-'); // 2026-10-14 -> 14.10.2026
        let todayDot = `${todayParts[2]}.${todayParts[1]}.${todayParts[0]}`;

        // Проверяем пропуск на сегодня
        const todayAbsence = attendances.find(a => a.date === todayDot || a.date === todayMsk);
        // Проверяем действующую справку ЕМИАС
        const activeEmias = emias.find(e => e.date === todayMsk || e.date === todayDot);
        // Проверяем заявление родителей
        const activeNotif = notifications.find(n => n.date === todayMsk || n.date === todayDot);

        let statusText = "Присутствует";
        let statusColor = "#10b981";

        if (activeEmias) {
            statusText = "Справка ЕМИАС (болезнь)";
            statusColor = "#3b82f6";
        } else if (activeNotif) {
            statusText = `Заявление: ${activeNotif.description || REASONS_MAP[activeNotif.nonattendance_reason_id] || 'Уважительная'}`;
            statusColor = "#f59e0b";
        } else if (todayAbsence) {
            const reason = REASONS_MAP[todayAbsence.absence_reason_id] || "Пропуск";
            statusText = `Н: ${reason}`;
            statusColor = "#ef4444";
        }

        return {
            totalAbsences: attendances.length,
            emiasCount: emias.length,
            notificationsCount: notifications.length,
            todayStatusText: statusText,
            todayStatusColor: statusColor,
            attendances,
            emias,
            notifications
        };
    }

    // 6. Модальное окно истории посещаемости
    let visitsModal = null;

    function createVisitsModal() {
        if (visitsModal) return visitsModal;

        visitsModal = document.createElement('div');
        visitsModal.id = 'mesh-visits-history-modal';
        visitsModal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(8px);
            z-index: 10000002; display: none; align-items: center; justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        `;

        visitsModal.innerHTML = `
            <div style="background: #111827; border: 1px solid #374151; border-radius: 16px; width: 540px; max-width: 94vw; max-height: 85vh; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.6); overflow: hidden; color: #f9fafb;">
                <div style="padding: 16px 20px; border-bottom: 1px solid #374151; display: flex; justify-content: space-between; align-items: center; background: #1f2937;">
                    <div>
                        <div style="font-size: 11px; text-transform: uppercase; color: #9ca3af; letter-spacing: 1px;">Досье посещаемости МЭШ</div>
                        <div id="mesh-modal-student-name" style="font-size: 16px; font-weight: 700; color: #fff; margin-top: 2px;">Студент</div>
                    </div>
                    <button id="mesh-modal-close-btn" style="background: transparent; border: none; color: #9ca3af; font-size: 20px; cursor: pointer; padding: 4px 8px; border-radius: 6px;">✕</button>
                </div>
                
                <div id="mesh-modal-tabs" style="padding: 10px 20px; background: #111827; border-bottom: 1px solid #1f2937; display: flex; gap: 8px; align-items: center;">
                    <button id="mesh-tab-official" style="background: #2563eb; color: #fff; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">📋 Пропуски в МЭШ</button>
                    <button id="mesh-tab-turnstile" style="background: #374151; color: #9ca3af; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">🚪 Турникеты</button>
                </div>

                <div id="mesh-modal-body" style="padding: 16px 20px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 10px;">
                </div>
            </div>
        `;

        document.body.appendChild(visitsModal);

        const closeBtn = visitsModal.querySelector('#mesh-modal-close-btn');
        closeBtn.onclick = () => { visitsModal.style.display = 'none'; };

        visitsModal.onclick = (e) => {
            if (e.target === visitsModal) visitsModal.style.display = 'none';
        };

        return visitsModal;
    }

    async function showStudentVisitsHistory(studentProfileId, studentName) {
        const modal = createVisitsModal();
        modal.style.display = 'flex';

        const nameEl = modal.querySelector('#mesh-modal-student-name');
        const bodyEl = modal.querySelector('#mesh-modal-body');
        const tabOfficial = modal.querySelector('#mesh-tab-official');
        const tabTurnstile = modal.querySelector('#mesh-tab-turnstile');

        nameEl.innerText = studentName || "Студент";

        function renderOfficial() {
            tabOfficial.style.background = '#2563eb';
            tabOfficial.style.color = '#fff';
            tabTurnstile.style.background = '#374151';
            tabTurnstile.style.color = '#9ca3af';

            const summary = getStudentAttendanceSummary(studentProfileId);
            let html = '';

            // Карточки справок ЕМИАС
            if (summary.emias && summary.emias.length > 0) {
                html += `
                    <div style="background: rgba(59, 130, 246, 0.15); border: 1px solid #3b82f6; border-radius: 10px; padding: 12px; margin-bottom: 8px;">
                        <div style="font-size: 12px; font-weight: 700; color: #60a5fa; margin-bottom: 6px;">🏥 Справки ЕМИАС (${summary.emias.length})</div>
                `;
                summary.emias.forEach(em => {
                    html += `
                        <div style="font-size: 12px; color: #dbeafe; display: flex; justify-content: space-between; padding: 3px 0;">
                            <span>Освобождение от занятий (${em.type || 'Болезнь'})</span>
                            <b>${em.date}</b>
                        </div>
                    `;
                });
                html += `</div>`;
            }

            // Карточки заявлений и уведомлений родителей
            if (summary.notifications && summary.notifications.length > 0) {
                html += `
                    <div style="background: rgba(245, 158, 11, 0.15); border: 1px solid #f59e0b; border-radius: 10px; padding: 12px; margin-bottom: 8px;">
                        <div style="font-size: 12px; font-weight: 700; color: #fbbf24; margin-bottom: 6px;">💬 Заявления родителей (${summary.notifications.length})</div>
                `;
                summary.notifications.forEach(notif => {
                    const rName = REASONS_MAP[notif.nonattendance_reason_id] || "Заявление";
                    html += `
                        <div style="font-size: 12px; color: #fef3c7; display: flex; flex-direction: column; gap: 2px; padding: 4px 0; border-bottom: 1px dashed rgba(245, 158, 11, 0.3);">
                            <div style="display: flex; justify-content: space-between;">
                                <b style="color: #fde68a;">${rName}</b>
                                <span style="color: #fbbf24;">${notif.date}</span>
                            </div>
                            ${notif.description ? `<div style="font-size: 11px; color: #d1d5db; font-style: italic;">«${notif.description}»</div>` : ''}
                        </div>
                    `;
                });
                html += `</div>`;
            }

            // Список официальных пропусков
            if (summary.attendances && summary.attendances.length > 0) {
                html += `<div style="font-size: 13px; font-weight: 700; color: #fff; margin: 6px 0;">Всего зафиксировано пропусков: ${summary.attendances.length}</div>`;
                
                // Сортировка по дате
                const sorted = [...summary.attendances].reverse();
                sorted.forEach(a => {
                    let aDateIso = a.date;
                    if (a.date && a.date.includes('.')) {
                        const p = a.date.split('.');
                        aDateIso = `${p[2]}-${p[1]}-${p[0]}`;
                    }
                    const hasEmias = (summary.emias || []).find(e => e.date === a.date || e.date === aDateIso);
                    const hasNotif = (summary.notifications || []).find(n => n.date === a.date || n.date === aDateIso);

                    let badgeColor = "#ef4444";
                    let reason = REASONS_MAP[a.absence_reason_id] || "Пропуск занятия";

                    if (hasEmias) {
                        badgeColor = "#3b82f6";
                        reason = "По болезни (справка ЕМИАС)";
                    } else if (hasNotif) {
                        badgeColor = "#f59e0b";
                        reason = `Заявление родителей: ${hasNotif.description || 'Уважительная'}`;
                    } else if (a.absence_reason_id === 2) {
                        reason = "Отметка преподавателя (Н)";
                    }

                    html += `
                        <div style="display: flex; justify-content: space-between; align-items: center; background: #1f2937; border: 1px solid #374151; padding: 8px 12px; border-radius: 8px; font-size: 12px;">
                            <div>
                                <b style="color: ${badgeColor}; margin-right: 6px;">Н</b>
                                <span style="color: #e5e7eb;">${reason}</span>
                            </div>
                            <span style="color: #93c5fd; font-weight: 600;">${a.date}</span>
                        </div>
                    `;
                });
            } else {
                html += `
                    <div style="text-align: center; color: #10b981; padding: 40px 0; font-size: 14px;">
                        🎉 Зафиксированных пропусков в журнале нет!<br>
                        <span style="font-size: 11px; color: #9ca3af; margin-top: 4px; display: inline-block;">100% посещаемость по данным МЭШ</span>
                    </div>
                `;
            }

            bodyEl.innerHTML = html;
        }

        async function renderTurnstiles() {
            tabTurnstile.style.background = '#2563eb';
            tabTurnstile.style.color = '#fff';
            tabOfficial.style.background = '#374151';
            tabOfficial.style.color = '#9ca3af';

            async function loadTurnstilesForContract(cid) {
                bodyEl.innerHTML = `<div style="text-align: center; color: #9ca3af; padding: 30px 0; font-size: 13px;">⏳ Загрузка проходов через турникеты (Л/С: ${cid})...</div>`;
                try {
                    const visits = await fetchVisits(cid);
                    if (!visits || visits.length === 0) {
                        bodyEl.innerHTML = `
                            <div style="text-align: center; color: #9ca3af; padding: 30px 20px; font-size: 13px;">
                                <div style="font-size: 24px; margin-bottom: 8px;">🚪</div>
                                По лицевому счету <b style="color: #60a5fa;">${cid}</b> проходов через турникеты не найдено.<br>
                                <span style="font-size: 11px; color: #6b7280; display: inline-block; margin-top: 6px;">
                                    (Проверьте корректность номера лицевого счета или период)
                                </span>
                                <div style="margin-top: 16px;">
                                    <button id="mesh-btn-change-contract" style="background: #374151; color: #fff; border: none; padding: 6px 12px; border-radius: 6px; font-size: 11px; cursor: pointer;">Изменить номер счета</button>
                                </div>
                            </div>
                        `;
                        const chBtn = bodyEl.querySelector('#mesh-btn-change-contract');
                        if (chBtn) chBtn.onclick = () => renderInputForm(cid);
                        return;
                    }

                    let html = `
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 12px;">
                            <span style="color: #9ca3af;">Лицевой счет: <b style="color: #60a5fa;">${cid}</b></span>
                            <button id="mesh-btn-change-contract" style="background: transparent; border: 1px solid #4b5563; color: #9ca3af; padding: 2px 8px; border-radius: 4px; font-size: 10px; cursor: pointer;">Изменить</button>
                        </div>
                    `;

                    visits.forEach(day => {
                        html += `
                            <div style="background: #1f2937; border: 1px solid #374151; border-radius: 8px; padding: 10px; margin-bottom: 6px;">
                                <div style="font-size: 12px; font-weight: 700; color: #93c5fd; margin-bottom: 4px;">📅 ${day.date}</div>
                        `;
                        (day.visits || []).forEach(v => {
                            html += `
                                <div style="display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0;">
                                    <span style="color: #10b981; font-weight: 600;">Вход: ${v.in || '—'}</span>
                                    <span style="color: ${v.out ? '#3b82f6' : '#f59e0b'}; font-weight: 600;">Выход: ${v.out || 'в здании'}</span>
                                </div>
                            `;
                        });
                        html += `</div>`;
                    });

                    bodyEl.innerHTML = html;

                    const chBtn = bodyEl.querySelector('#mesh-btn-change-contract');
                    if (chBtn) chBtn.onclick = () => renderInputForm(cid);
                } catch(e) {
                    bodyEl.innerHTML = `
                        <div style="color: #ef4444; font-size: 12px; text-align: center; padding: 20px;">
                            Ошибка загрузки турникетов: ${e.message}
                            <div style="margin-top: 12px;">
                                <button id="mesh-btn-change-contract" style="background: #374151; color: #fff; border: none; padding: 6px 12px; border-radius: 6px; font-size: 11px; cursor: pointer;">Изменить номер счета</button>
                            </div>
                        </div>
                    `;
                    const chBtn = bodyEl.querySelector('#mesh-btn-change-contract');
                    if (chBtn) chBtn.onclick = () => renderInputForm(cid);
                }
            }

            function renderInputForm(initialVal = "") {
                bodyEl.innerHTML = `
                    <div style="padding: 24px 20px; background: #1f2937; border: 1px solid #374151; border-radius: 12px; text-align: center;">
                        <div style="font-size: 26px; margin-bottom: 8px;">💳</div>
                        <div style="font-size: 14px; font-weight: 700; color: #fff; margin-bottom: 4px;">Лицевой счет</div>
                        <div style="font-size: 11px; color: #9ca3af; margin-bottom: 14px; line-height: 1.4; max-width: 380px; margin-left: auto; margin-right: auto;">
                            Номер лицевого счета не всегда привязан в профиле МЭШ. Введите номер лицевого счета из личного кабинета mos.ru студента:
                        </div>
                        <div style="display: flex; gap: 8px; justify-content: center; max-width: 320px; margin: 0 auto;">
                            <input type="text" id="mesh-input-contract" placeholder="Лицевой счет (напр. 1234567)" value="${initialVal}" style="background: #111827; border: 1px solid #4b5563; color: white; padding: 8px 12px; border-radius: 6px; font-size: 13px; outline: none; flex: 1;">
                            <button id="mesh-btn-save-contract" style="background: #2563eb; color: white; border: none; padding: 8px 14px; border-radius: 6px; font-weight: 600; font-size: 13px; cursor: pointer;">Найти</button>
                        </div>
                    </div>
                `;

                const input = bodyEl.querySelector('#mesh-input-contract');
                const btn = bodyEl.querySelector('#mesh-btn-save-contract');

                const handleSearch = () => {
                    const val = (input.value || '').trim();
                    if (!val) return alert("Введите номер лицевого счета");
                    window.sessionStorage.setItem(`MESH_STUDENT_ISPP_${studentProfileId}`, val);
                    loadTurnstilesForContract(val);
                };

                btn.onclick = handleSearch;
                input.onkeydown = (e) => { if (e.key === 'Enter') handleSearch(); };
            }

            bodyEl.innerHTML = `<div style="text-align: center; color: #9ca3af; padding: 30px 0; font-size: 13px;">⏳ Поиск лицевого счета...</div>`;

            const contractId = await resolveContractId(studentProfileId);
            if (!contractId) {
                renderInputForm();
            } else {
                loadTurnstilesForContract(contractId);
            }
        }

        tabOfficial.onclick = renderOfficial;
        tabTurnstile.onclick = renderTurnstiles;

        // По умолчанию открываем официальные пропуски
        renderOfficial();
    }

    // Экспорт API
    window.MeshVisitsAPI = {
        isEnabled: () => isVisitsEnabled,
        getOfficialAttendances,
        getEmiasExemptions,
        getStudentAttendanceSummary,
        resolveContractId,
        fetchVisits,
        showStudentVisitsHistory
    };
})();
