// ==========================================
// 🕵️‍♂️ MESH Interceptor: Сбор ключей (⚡ ОПТИМИЗИРОВАН v3)
// ==========================================
(function() {
    console.log("🕵️‍♂️ MESH Interceptor: Ускоренный модуль сбора данных запущен");
    const originalFetch = window.fetch;
    
    window.fetch = async function(...args) {
        const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');
        const response = await originalFetch.apply(this, args);
        
        // ⚡ СУПЕР-ОПТИМИЗАЦИЯ: Читаем ТОЛЬКО запросы с оценками, формами контроля и системами оценивания.
        // Игнорируем гигантские матрицы журнала, метрику и телеметрию Яндекса.
        if (url.includes('/api/profeducation/plan/teacher/v1/groups')) {
            try {
                const clone = response.clone();
                clone.json().then(data => {
                    let groups = Array.isArray(data) ? data : (data.items || data.data || []);
                    if (groups.length > 0 && groups[0].id) {
                        window.sessionStorage.setItem('MESH_MENTOR_GROUPS', JSON.stringify(groups));
                    }
                }).catch(()=>{});
            } catch(e) {}
        }

        if (url.includes('/api/profeducation/core/teacher/v1/attendances')) {
            try {
                const clone = response.clone();
                clone.json().then(data => {
                    const list = Array.isArray(data) ? data : (data.payload || data.items || []);
                    if (list.length > 0) {
                        window.sessionStorage.setItem('MESH_ATTENDANCES_CACHE', JSON.stringify(list));
                    }
                }).catch(()=>{});
            } catch(e) {}
        }

        if (url.includes('/api/profeducation/core/teacher/v1/attendance_notifications')) {
            try {
                const clone = response.clone();
                clone.json().then(data => {
                    const list = Array.isArray(data) ? data : (data.payload || data.items || []);
                    if (list.length > 0) {
                        window.sessionStorage.setItem('MESH_NOTIFICATIONS_CACHE', JSON.stringify(list));
                    }
                }).catch(()=>{});
            } catch(e) {}
        }

        if (url.includes('/api/profeducation/core/teacher/v1/emias_medical_recommendations')) {
            try {
                const clone = response.clone();
                clone.json().then(data => {
                    const list = Array.isArray(data) ? data : (data.payload || data.items || []);
                    if (list.length > 0) {
                        window.sessionStorage.setItem('MESH_EMIAS_CACHE', JSON.stringify(list));
                    }
                }).catch(()=>{});
            } catch(e) {}
        }

        if (url.includes('/api/profeducation/core/teacher/v1/student_profiles')) {
            try {
                const clone = response.clone();
                clone.json().then(data => {
                    const list = Array.isArray(data) ? data : (data.payload || data.items || []);
                    list.forEach(st => {
                        if (st.id && st.ispp_account) {
                            window.sessionStorage.setItem(`MESH_STUDENT_ISPP_${st.id}`, String(st.ispp_account));
                        }
                    });
                }).catch(()=>{});
            } catch(e) {}
        }

        if ((url.includes('/api/profeducation/core/teacher/v1/') || url.includes('marks') || url.includes('grade_system')) && !url.includes('journal')) {
            if (args[1]?.method !== 'POST' && args[1]?.method !== 'DELETE') {
                try {
                    const clone = response.clone();
                    clone.json().then(data => {
                        let db = JSON.parse(window.sessionStorage.getItem('MESH_GLOBAL_DB') || '{"grade_system_ids":[], "control_forms":[]}');
                        let updatedDb = false;
                        let strData = JSON.stringify(data);
                        
                        let gsMatches = strData.match(/"grade_system_id":\s*(\d+)/g);
                        if (gsMatches) { gsMatches.forEach(m => { let id = parseInt(m.split(':')[1].trim()); if (!db.grade_system_ids.includes(id)) { db.grade_system_ids.push(id); updatedDb = true; } }); }
                        
                        let cfMatches = strData.match(/"control_form_id":\s*(\d+)/g);
                        if (cfMatches) { cfMatches.forEach(m => { let id = parseInt(m.split(':')[1].trim()); if (!db.control_forms.includes(id)) { db.control_forms.push(id); updatedDb = true; } }); }
                        
                        if (updatedDb) window.sessionStorage.setItem('MESH_GLOBAL_DB', JSON.stringify(db));

                        let map = JSON.parse(window.sessionStorage.getItem('MESH_MARKS_MAP') || '{}');
                        let marksArray = Array.isArray(data) ? data : (data.items || data.marks || data.payload || []);
                        let updatedMap = false;
                        
                        marksArray.forEach(m => {
                            if (m.id && m.student_profile_id && m.schedule_lesson_id) {
                                map[`${m.student_profile_id}_${m.schedule_lesson_id}`] = m.id;
                                updatedMap = true;
                            }
                        });
                        if (updatedMap) window.sessionStorage.setItem('MESH_MARKS_MAP', JSON.stringify(map));
                    }).catch(()=>{});
                } catch(e){}
            }
        }
        return response;
    };
})();