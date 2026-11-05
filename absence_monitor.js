// Read-only collector. Authentication stays in the open MESH tab.
(function () {
    const API = 'https://school.mos.ru/api/profeducation/';
    let running = null;
    const normalizeGroup = value => String(value || '').toUpperCase().replace(/[\s.-]/g, '');
    const listOf = value => {
        const list = Array.isArray(value) ? value : value?.items ?? value?.payload ?? value?.data;
        if (!Array.isArray(list)) throw new Error('Неизвестный формат ответа МЭШ');
        return list;
    };
    const moscowDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

    function authContext() {
        const stored = JSON.parse(sessionStorage.getItem('MESH_AUTH_HEADERS') || sessionStorage.getItem('MESH_KTP_HEADERS') || '{}');
        const headers = new Headers({ Accept: 'application/json', 'x-mes-subsystem': 'journalw' });
        for (const [key, value] of Object.entries(stored)) {
            if (['authorization', 'profile-id', 'aid', 'x-mes-hostid', 'x-mes-roleid', 'x-mes-role'].includes(key.toLowerCase())) headers.set(key, value);
        }
        const cookie = name => {
            const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
            return match ? decodeURIComponent(match[1]) : '';
        };
        if (!headers.has('authorization') && cookie('aupd_token')) headers.set('authorization', 'Bearer ' + cookie('aupd_token'));
        if (!headers.has('profile-id')) headers.set('profile-id', cookie('profile_id') || localStorage.getItem('MES_API_PROFILE_ID') || '');
        const year = headers.get('aid') || cookie('aid') || localStorage.getItem('MES_API_YEAR_ID') || '';
        if (!headers.has('authorization') || !headers.get('profile-id')) throw new Error('Войдите в МЭШ и откройте журнал');
        return { headers, year, profile: headers.get('profile-id') };
    }

    async function collect(groupName, context) {
        const auth = authContext();
        // One deadline covers pagination and all requests, so an unresponsive tab releases the next poll.
        const signal = AbortSignal.timeout(25000);
        async function get(path, params) {
            const url = new URL(API + path);
            url.search = new URLSearchParams(params);
            const res = await fetch(url, { headers: auth.headers, signal, cache: 'no-store', credentials: 'include' });
            if (!res.ok) throw new Error(res.status === 401 || res.status === 403 ? 'МЭШ требует повторного входа' : `МЭШ: HTTP ${res.status}`);
            return listOf(await res.json());
        }
        let allGroups = [];
        try { allGroups = listOf(JSON.parse(sessionStorage.getItem('MESH_MENTOR_GROUPS') || '[]')); } catch {}
        const targetName = normalizeGroup(groupName);
        const matches = group => {
            // Use cohort names first. Subject titles are not proof of membership.
            const names = [group.class_unit_name, group.short_name];
            if (names.some(name => normalizeGroup(name) === targetName || normalizeGroup(String(name || '').split(/[-.]/)[0]) === targetName)) return true;
            const tokens = String(group.name || '').toUpperCase().split(/[\s/(),;]+/);
            return tokens.some(token => normalizeGroup(token) === targetName || normalizeGroup(token) === targetName + '9' || normalizeGroup(token) === targetName + '11');
        };
        let seed = allGroups.find(group => matches(group) && !group.is_metagroup && (group.class_unit_ids?.length === 1 || (!group.class_unit_ids?.length && group.class_unit_id)));
        if (!seed && context?.profile === auth.profile && (!auth.year || String(context.academic_year_id) === String(auth.year)) && /^\d+$/.test(String(context.class_unit_id))) seed = context;
        if (!seed) throw new Error(`Группа ${groupName} не найдена. Откройте журнал кураторской группы`);
        const classId = String(seed.class_unit_ids?.[0] || seed.class_unit_id);
        const year = String(seed.academic_year_id || auth.year);
        if (!year) throw new Error('Не определён учебный год');
        const groups = await get('plan/teacher/v1/groups', { academic_year_id: year, class_unit_ids: classId });
        const groupIds = [...new Set(groups.filter(group => group.class_unit_ids?.map(String).includes(classId) || String(group.class_unit_id) === classId).map(group => group.id).filter(Boolean))];
        if (!groupIds.length) throw new Error('Не найдены дисциплины кураторской группы');
        const day = moscowDay();
        const date = day.split('-').reverse().join('.');
        const roster = await get('core/teacher/v1/student_profiles', { academic_year_id: year, class_unit_ids: classId, with_deleted: 'false', with_archived_groups: 'false', per_page: '1000', page: '1' });
        if (roster.length >= 1000) throw new Error('Список студентов слишком большой для полного сравнения');
        const students = new Map(roster.map(student => [String(student.id), [student.last_name, student.first_name, student.middle_name].filter(Boolean).join(' ') || student.user_name || student.name || student.full_name || student.short_name || `Студент № ${student.id}`]));
        if (!students.size) throw new Error('Не получен список студентов группы');
        const entries = new Map();
        for (let page = 1; page <= 20; page++) {
            const rows = await get('core/teacher/v1/attendances', { group_ids: groupIds.join(','), class_level_id: String(seed.class_level_id || ''), academic_year_id: year, start_at: date, stop_at: date, per_page: '1000', page: String(page) });
            for (const item of rows) {
                // Code 2 is "absent from the lesson"; medical/other excused reasons do not count as н.
                if (Number(item.absence_reason_id) !== 2 || !students.has(String(item.student_profile_id))) continue;
                if (item.date !== day && item.date !== date) continue;
                if (!item.schedule_lesson_id) throw new Error('В пропуске МЭШ отсутствует идентификатор занятия');
                const key = `${item.student_profile_id}:${item.schedule_lesson_id}:${day}`;
                entries.set(key, { key, name: students.get(String(item.student_profile_id)) });
            }
            if (rows.length < 1000) return { scope: `${auth.profile}:${year}:${classId}`, context: { profile: auth.profile, class_unit_id: classId, academic_year_id: year, class_level_id: seed.class_level_id }, day, groupName, entries: [...entries.values()] };
        }
        throw new Error('Не удалось получить полный список пропусков');
    }

    function showMiniNotice({ title, message }) {
        document.getElementById('mesh-absence-notice')?.remove();
        const notice = document.createElement('aside');
        notice.id = 'mesh-absence-notice';
        notice.setAttribute('role', 'status');
        notice.style.cssText = 'position:fixed;top:20px;right:20px;width:290px;max-width:calc(100vw - 40px);padding:12px 36px 12px 14px;background:#1e293b;color:#e2e8f0;border:1px solid #475569;border-left:3px solid #fbbf24;border-radius:12px;box-shadow:0 8px 25px #0f172a33;z-index:2147483647;font:12px/1.45 system-ui,sans-serif;';
        const heading = document.createElement('strong'); heading.textContent = title;
        const detail = document.createElement('div'); detail.textContent = message; detail.style.marginTop = '5px';
        const close = document.createElement('button'); close.type = 'button'; close.textContent = '×'; close.setAttribute('aria-label', 'Закрыть уведомление');
        close.style.cssText = 'position:absolute;top:8px;right:9px;background:none;border:0;color:#cbd5e1;cursor:pointer;font-size:19px;';
        close.onclick = () => notice.remove(); notice.append(heading, detail, close); document.body.append(notice);
        setTimeout(() => notice.remove(), 8000);
    }

    chrome.runtime.onMessage.addListener((message, sender, reply) => {
        if (sender.id !== chrome.runtime.id) return;
        if (message.action === 'showAbsenceNotice') {
            if (document.visibilityState !== 'visible') { reply({ shown: false }); return; }
            showMiniNotice(message); reply({ shown: true }); return;
        }
        if (message.action !== 'collectAbsences') return;
        if (running) { reply({ ok: false, error: 'Проверка уже выполняется' }); return; }
        if (typeof message.groupName !== 'string' || !message.groupName.trim()) return;
        running = collect(message.groupName, message.context);
        running.then(snapshot => { running = null; reply({ ok: true, snapshot }); }, error => { running = null; reply({ ok: false, error: error.message }); });
        return true;
    });
})();
