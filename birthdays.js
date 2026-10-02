// ==========================================
// 🎂 MESH Birthdays (v10 - SPA Continuous Scanner)
// ==========================================
(function() {
    console.log("🎂 [MESH Birthdays] Модуль работает в фоне...");

    let isEnabled = true;
    chrome.storage.sync.get(['birthdayMode'], (data) => {
        if (data && data.birthdayMode !== undefined) isEnabled = data.birthdayMode;
    });

    chrome.runtime.onMessage.addListener((req) => {
        if (req.action === "updateSettings" && req.settings.birthdayMode !== undefined) {
            isEnabled = req.settings.birthdayMode;
            if (!isEnabled) document.querySelectorAll('.mesh-bday-cake').forEach(el => el.remove());
        }
    });

    async function scanAndDraw() {
        if (!isEnabled || !window.location.href.includes('journal')) return;

        // 1. Получаем токены
        let token = ""; let profileId = "";
        try {
            const cookies = document.cookie.split('; ').reduce((acc, c) => {
                const [k, v] = c.split('=');
                if (k) acc[k] = v;
                return acc;
            }, {});
            token = cookies['aupd_token'];
            profileId = cookies['profile_id'];
        } catch(e) {}

        if (!token || !profileId) return;

        let db = JSON.parse(localStorage.getItem('MESH_BDAYS_PRO') || '{}');
        const today = new Date().toISOString().slice(5, 10); // "MM-DD"

        // 2. Ищем все имена на экране
        const students = document.querySelectorAll('span[title]');
        
        for (let el of students) {
            let name = el.getAttribute('title').trim();
            if (name.split(' ').length < 2) continue; // Пропускаем мусор

            // А. Если студента нет в базе -> Ищем его ID и качаем дату
            if (!db[name]) {
                let studentId = null;
                let row = el.closest('tr') || el.closest('[role="row"]');
                
                if (row) {
                    row.querySelectorAll('*').forEach(child => {
                        if(child.attributes) {
                            Array.from(child.attributes).forEach(attr => {
                                let m = attr.value.match(/(\d{7,10})/);
                                if (m && m[1] !== decodeURIComponent(profileId)) studentId = m[1];
                            });
                        }
                    });
                }

                if (studentId) {
                    try {
                        let res = await fetch(`https://school.mos.ru/api/profeducation/core/teacher/v1/student_profiles/${studentId}?with_user_info=true`, {
                            headers: { 
                                "Authorization": `Bearer ${decodeURIComponent(token)}`, 
                                "Profile-Id": decodeURIComponent(profileId),
                                "x-mes-subsystem": "journalw"
                            }
                        });
                        if (res.ok) {
                            let data = await res.json();
                            let bday = data.user_info?.birth_date || data.birth_date;
                            if (bday) {
                                db[name] = bday;
                                localStorage.setItem('MESH_BDAYS_PRO', JSON.stringify(db));
                            }
                        }
                    } catch(e) {}
                    // Ждем чуть-чуть, чтобы не спамить запросами
                    await new Promise(r => setTimeout(r, 300));
                }
            }

            // Б. Если студент есть в базе и у него сегодня праздник
            if (db[name] && db[name].includes(today)) {
                let container = el.parentElement;
                // Проверяем, не нарисовали ли мы тортик уже
                if (container && !container.querySelector('.mesh-bday-cake')) {
                    let cake = document.createElement('span');
                    cake.className = 'mesh-bday-cake';
                    cake.innerHTML = ' 🎂';
                    cake.style.cssText = "color: #ef4444; font-size: 1.2em; animation: pulse 1.5s infinite; cursor: help; margin-left: 6px;";
                    cake.title = `С днем рождения! (${db[name]})`;
                    container.appendChild(cake);
                }
            }
        }
    }

    // Стиль для пульсации
    const style = document.createElement('style');
    style.innerHTML = "@keyframes pulse { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.2); } 100% { opacity: 1; transform: scale(1); } }";
    document.head.appendChild(style);

    // Этот интервал гарантирует, что при смене группы скрипт найдет новых студентов
    setInterval(scanAndDraw, 4000);
})();