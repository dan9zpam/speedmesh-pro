// ==========================================
// ⏳ MESH Timer (Расширенные Темы)
// ==========================================
(function() {
    let isEnabled = true;
    let customSchedule = null;
    let timerNoteStr = "";
    let currentTheme = 'default';
    
    let customPrefs = {};
    chrome.storage.local.get(['timerCustomTheme', 'timerCustomBg', 'timerCustomText'], (d) => {
        customPrefs = d || {};
    });
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
            if (changes.timerCustomTheme) customPrefs.timerCustomTheme = changes.timerCustomTheme.newValue;
            if (changes.timerCustomBg) customPrefs.timerCustomBg = changes.timerCustomBg.newValue;
            
            if (changes.timerOpacity) customPrefs.timerOpacity = changes.timerOpacity.newValue;
            if (changes.timerCustomText) customPrefs.timerCustomText = changes.timerCustomText.newValue;
        }
    });

    // 🎨 ЦВЕТОВЫЕ ТЕМЫ ДЛЯ ТАЙМЕРА (8 штук!)
    const themes = {
        liquid_glass: {
            bg: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.4)', text: '#ffffff', infoText: '#eaeaea',
            breakDot: '#af52de', breakBar: 'rgba(255, 255, 255, 0.5)', lessonDot: '#ffffff', lessonBar: 'rgba(255, 255, 255, 0.3)',
            warnDot: '#ff453a', warnBar: 'rgba(255, 255, 255, 0.5)', specDot: '#ff9f0a', specBar: 'rgba(255, 255, 255, 0.5)',
            idleDot: '#ffffff', idleBar: 'rgba(255, 255, 255, 0.2)', noteBg: 'rgba(255, 255, 255, 0.2)', noteBorder: '1px solid rgba(255,255,255,0.4)', noteText: '#ffffff',
            isLiquid: true
        },
        apple_light: {
            bg: 'rgba(255, 255, 255, 0.25)', border: '1px solid rgba(255, 255, 255, 0.4)', text: '#000', infoText: '#333',
            breakDot: '#af52de', breakBar: 'rgba(175, 82, 222, 0.3)', lessonDot: '#34c759', lessonBar: 'rgba(52, 199, 89, 0.3)',
            warnDot: '#ff3b30', warnBar: 'rgba(255, 59, 48, 0.3)', specDot: '#ff9500', specBar: 'rgba(255, 149, 0, 0.3)',
            idleDot: '#8e8e93', idleBar: 'rgba(142, 142, 147, 0.3)', noteBg: 'rgba(255, 255, 255, 0.4)', noteBorder: '1px solid rgba(255,255,255,0.5)', noteText: '#000'
        },
        apple_dark: {
            bg: 'rgba(40, 40, 40, 0.3)', border: '1px solid rgba(255, 255, 255, 0.15)', text: '#fff', infoText: '#ccc',
            breakDot: '#bf5af2', breakBar: 'rgba(191, 90, 242, 0.3)', lessonDot: '#32d74b', lessonBar: 'rgba(50, 215, 75, 0.3)',
            warnDot: '#ff453a', warnBar: 'rgba(255, 69, 58, 0.3)', specDot: '#ff9f0a', specBar: 'rgba(255, 159, 10, 0.3)',
            idleDot: '#98989d', idleBar: 'rgba(152, 152, 157, 0.3)', noteBg: 'rgba(60, 60, 60, 0.4)', noteBorder: '1px solid rgba(255,255,255,0.2)', noteText: '#fff'
        },
        default: {
            bg: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(255, 255, 255, 0.1)', text: '#fff', infoText: '#cbd5e1',
            breakDot: '#8b5cf6', breakBar: 'rgba(139, 92, 246, 0.3)', lessonDot: '#10b981', lessonBar: 'rgba(16, 185, 129, 0.3)',
            warnDot: '#ef4444', warnBar: 'rgba(239, 68, 68, 0.3)', specDot: '#f59e0b', specBar: 'rgba(245, 158, 11, 0.3)',
            idleDot: '#64748b', idleBar: 'rgba(100, 116, 139, 0.3)', noteBg: 'rgba(15, 23, 42, 0.85)', noteBorder: '1px solid rgba(139, 92, 246, 0.5)', noteText: '#e2e8f0'
        },
        minimal: {
            bg: 'rgba(255, 255, 255, 0.4)', border: '1px solid #cbd5e1', text: '#0f172a', infoText: '#475569',
            breakDot: '#8b5cf6', breakBar: 'rgba(139, 92, 246, 0.2)', lessonDot: '#3b82f6', lessonBar: 'rgba(59, 130, 246, 0.2)',
            warnDot: '#ef4444', warnBar: 'rgba(239, 68, 68, 0.2)', specDot: '#f59e0b', specBar: 'rgba(245, 158, 11, 0.2)',
            idleDot: '#94a3b8', idleBar: 'rgba(148, 163, 184, 0.2)', noteBg: 'rgba(255, 255, 255, 0.4)', noteBorder: '1px solid #94a3b8', noteText: '#334155'
        },
        hacker: {
            bg: 'rgba(0, 0, 0, 0.5)', border: '1px solid #22c55e', text: '#22c55e', infoText: '#16a34a',
            breakDot: '#22c55e', breakBar: 'rgba(34, 197, 94, 0.2)', lessonDot: '#22c55e', lessonBar: 'rgba(34, 197, 94, 0.2)',
            warnDot: '#22c55e', warnBar: 'rgba(34, 197, 94, 0.2)', specDot: '#22c55e', specBar: 'rgba(34, 197, 94, 0.2)',
            idleDot: '#064e3b', idleBar: 'rgba(6, 78, 59, 0.2)', noteBg: 'rgba(0, 0, 0, 0.9)', noteBorder: '1px solid #16a34a', noteText: '#22c55e'
        },
        cyberpunk: {
            bg: 'rgba(20, 0, 30, 0.95)', border: '1px solid #f0a', text: '#0ff', infoText: '#ffeb3b',
            breakDot: '#f0a', breakBar: 'rgba(255, 0, 170, 0.3)', lessonDot: '#0f0', lessonBar: 'rgba(0, 255, 0, 0.2)',
            warnDot: '#f00', warnBar: 'rgba(255, 0, 0, 0.3)', specDot: '#ffeb3b', specBar: 'rgba(255, 235, 59, 0.3)',
            idleDot: '#404', idleBar: 'rgba(68, 0, 68, 0.3)', noteBg: 'rgba(20, 0, 30, 0.85)', noteBorder: '1px solid #0ff', noteText: '#ffeb3b'
        },
        vaporwave: {
            bg: 'linear-gradient(135deg, rgba(255, 113, 206, 0.9) 0%, rgba(1, 205, 254, 0.9) 100%)', border: '1px solid #fff', text: '#fff', infoText: '#fff',
            breakDot: '#fff', breakBar: 'rgba(255, 255, 255, 0.3)', lessonDot: '#fff', lessonBar: 'rgba(255, 255, 255, 0.3)',
            warnDot: '#fffc00', warnBar: 'rgba(255, 252, 0, 0.4)', specDot: '#05ffa1', specBar: 'rgba(5, 255, 161, 0.3)',
            idleDot: 'rgba(255,255,255,0.5)', idleBar: 'rgba(255, 255, 255, 0.1)', noteBg: 'rgba(255, 113, 206, 0.8)', noteBorder: '1px solid #fff', noteText: '#fff'
        },
        ocean: {
            bg: 'rgba(3, 15, 38, 0.95)', border: '1px solid #00f0ff', text: '#00f0ff', infoText: '#0ea5e9',
            breakDot: '#38bdf8', breakBar: 'rgba(56, 189, 248, 0.2)', lessonDot: '#00f0ff', lessonBar: 'rgba(0, 240, 255, 0.2)',
            warnDot: '#ef4444', warnBar: 'rgba(239, 68, 68, 0.3)', specDot: '#fbbf24', specBar: 'rgba(251, 191, 36, 0.2)',
            idleDot: '#1e3a8a', idleBar: 'rgba(30, 58, 138, 0.3)', noteBg: 'rgba(3, 15, 38, 0.85)', noteBorder: '1px solid #0ea5e9', noteText: '#38bdf8'
        },
        autumn: {
            bg: 'rgba(67, 36, 17, 0.95)', border: '1px solid #d97706', text: '#fde68a', infoText: '#fdba74',
            breakDot: '#d97706', breakBar: 'rgba(217, 119, 6, 0.3)', lessonDot: '#f59e0b', lessonBar: 'rgba(245, 158, 11, 0.3)',
            warnDot: '#dc2626', warnBar: 'rgba(220, 38, 38, 0.4)', specDot: '#fcd34d', specBar: 'rgba(252, 211, 77, 0.3)',
            idleDot: '#78350f', idleBar: 'rgba(120, 53, 15, 0.3)', noteBg: 'rgba(67, 36, 17, 0.85)', noteBorder: '1px solid #f59e0b', noteText: '#fde68a'
        },
        dracula: {
            bg: 'rgba(40, 42, 54, 0.95)', border: '1px solid #ff79c6', text: '#f8f8f2', infoText: '#bd93f9',
            breakDot: '#ff79c6', breakBar: 'rgba(255, 121, 198, 0.3)', lessonDot: '#50fa7b', lessonBar: 'rgba(80, 250, 123, 0.3)',
            warnDot: '#ff5555', warnBar: 'rgba(255, 85, 85, 0.4)', specDot: '#f1fa8c', specBar: 'rgba(241, 250, 140, 0.3)',
            idleDot: '#6272a4', idleBar: 'rgba(98, 114, 164, 0.3)', noteBg: 'rgba(40, 42, 54, 0.85)', noteBorder: '1px solid #bd93f9', noteText: '#f8f8f2'
        }
    };

    chrome.storage.sync.get(['timerMode', 'customBellsText', 'timerNoteText', 'timerTheme'], (data) => {
        if (data && data.timerMode !== undefined) isEnabled = data.timerMode;
        if (data && data.customBellsText) customSchedule = parseCustomSchedule(data.customBellsText);
        if (data && data.timerNoteText) timerNoteStr = data.timerNoteText;
        if (data && data.timerTheme) currentTheme = data.timerTheme;
    });

    chrome.runtime.onMessage.addListener((req) => {
        if (req.action === "updateSettings" && req.settings.timerMode !== undefined) {
            isEnabled = req.settings.timerMode;
            const card = document.getElementById('mesh-timer-card');
            if (card) card.style.display = isEnabled ? 'flex' : 'none';
        }
        if (req.action === "updateTimerData") {
            chrome.storage.sync.get(['customBellsText', 'timerNoteText', 'timerTheme'], (data) => {
                customSchedule = parseCustomSchedule(data.customBellsText);
                timerNoteStr = data.timerNoteText || "";
                currentTheme = data.timerTheme || 'default';
                updateTimer(); 
            });
        }
    });

    function parseCustomSchedule(text) {
        if (!text || text.trim() === "") return null;
        let lines = text.split('\n');
        let newSchedule = [];
        lines.forEach(line => {
            let match = line.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
            if (match) {
                let s = match[1].split(':'); let e = match[2].split(':');
                let startFmt = `${s[0].padStart(2, '0')}:${s[1].padStart(2, '0')}`;
                let endFmt = `${e[0].padStart(2, '0')}:${e[1].padStart(2, '0')}`;
                newSchedule.push({ type: 'lesson', start: startFmt, end: endFmt, title: 'Пара' });
            }
        });
        if (newSchedule.length === 0) return null;
        let fullSchedule = [];
        for (let i = 0; i < newSchedule.length; i++) {
            fullSchedule.push(newSchedule[i]);
            if (i < newSchedule.length - 1) {
                fullSchedule.push({ type: 'break', start: newSchedule[i].end, end: newSchedule[i+1].start, title: 'Перемена' });
            }
        }
        return fullSchedule;
    }

    const scheduleData = {
        mon: [{ type: 'special', start: '08:10', end: '08:30', title: 'Флаг/Разговоры' }, { type: 'break', start: '08:30', end: '09:00', title: 'Перемена' }, { type: 'lesson', start: '09:00', end: '09:45', title: '1 урок' }, { type: 'break', start: '09:45', end: '09:55', title: 'Перемена' }, { type: 'lesson', start: '09:55', end: '10:40', title: '2 урок' }, { type: 'break', start: '10:40', end: '11:00', title: 'Перемена' }, { type: 'lesson', start: '11:00', end: '11:45', title: '3 урок' }, { type: 'break', start: '11:45', end: '12:05', title: 'Перемена' }, { type: 'lesson', start: '12:05', end: '12:50', title: '4 урок' }, { type: 'break', start: '12:50', end: '13:10', title: 'Перемена' }, { type: 'lesson', start: '13:10', end: '13:55', title: '5 урок' }, { type: 'break', start: '13:55', end: '14:15', title: 'Перемена' }, { type: 'lesson', start: '14:15', end: '15:00', title: '6 урок' }, { type: 'break', start: '15:00', end: '15:10', title: 'Перемена' }, { type: 'lesson', start: '15:10', end: '15:55', title: '7 урок' }, { type: 'break', start: '15:55', end: '16:15', title: 'Перемена' }, { type: 'lesson', start: '16:15', end: '17:00', title: '8 урок' }, { type: 'break', start: '17:00', end: '17:10', title: 'Перемена' }, { type: 'lesson', start: '17:10', end: '17:55', title: '9 урок' }, { type: 'break', start: '17:55', end: '18:05', title: 'Перемена' }, { type: 'lesson', start: '18:05', end: '18:50', title: '10 урок' }],
        tue: [{ type: 'lesson', start: '09:00', end: '09:45', title: '1 урок' }, { type: 'break', start: '09:45', end: '09:55', title: 'Перемена' }, { type: 'lesson', start: '09:55', end: '10:40', title: '2 урок' }, { type: 'break', start: '10:40', end: '11:00', title: 'Перемена' }, { type: 'lesson', start: '11:00', end: '11:45', title: '3 урок' }, { type: 'break', start: '11:45', end: '12:05', title: 'Перемена' }, { type: 'lesson', start: '12:05', end: '12:50', title: '4 урок' }, { type: 'break', start: '12:50', end: '13:10', title: 'Перемена' }, { type: 'lesson', start: '13:10', end: '13:55', title: '5 урок' }, { type: 'break', start: '13:55', end: '14:15', title: 'Перемена' }, { type: 'lesson', start: '14:15', end: '15:00', title: '6 урок' }, { type: 'break', start: '15:00', end: '15:10', title: 'Перемена' }, { type: 'lesson', start: '15:10', end: '15:55', title: '7 урок' }, { type: 'break', start: '15:55', end: '16:15', title: 'Перемена' }, { type: 'lesson', start: '16:15', end: '17:00', title: '8 урок' }, { type: 'break', start: '17:00', end: '17:10', title: 'Перемена' }, { type: 'lesson', start: '17:10', end: '17:55', title: '9 урок' }, { type: 'break', start: '17:55', end: '18:05', title: 'Перемена' }, { type: 'lesson', start: '18:05', end: '18:50', title: '10 урок' }],
        sat: [{ type: 'lesson', start: '09:00', end: '09:45', title: '1 урок' }, { type: 'break', start: '09:45', end: '09:50', title: 'Перемена' }, { type: 'lesson', start: '09:50', end: '10:35', title: '2 урок' }, { type: 'break', start: '10:35', end: '10:45', title: 'Перемена' }, { type: 'lesson', start: '10:45', end: '11:30', title: '3 урок' }, { type: 'break', start: '11:30', end: '11:35', title: 'Перемена' }, { type: 'lesson', start: '11:35', end: '12:20', title: '4 урок' }, { type: 'break', start: '12:20', end: '12:40', title: 'Перемена' }, { type: 'lesson', start: '12:40', end: '13:25', title: '5 урок' }, { type: 'break', start: '13:25', end: '13:30', title: 'Перемена' }, { type: 'lesson', start: '13:30', end: '14:15', title: '6 урок' }, { type: 'break', start: '14:15', end: '14:25', title: 'Перемена' }, { type: 'lesson', start: '14:25', end: '15:10', title: '7 урок' }, { type: 'break', start: '15:10', end: '15:15', title: 'Перемена' }, { type: 'lesson', start: '15:15', end: '16:00', title: '8 урок' }, { type: 'break', start: '16:00', end: '16:20', title: 'Перемена' }, { type: 'lesson', start: '16:20', end: '17:05', title: '9 урок' }, { type: 'break', start: '17:05', end: '17:10', title: 'Перемена' }, { type: 'lesson', start: '17:10', end: '17:55', title: '10 урок' }]
    };

    function getMinutes(timeStr) { const [h, m] = timeStr.split(':').map(Number); return h * 60 + m; }
    function getCurrentScheduleKey() { const day = new Date().getDay(); if (day === 1) return 'mon'; if (day === 6) return 'sat'; if (day === 0) return 'mon'; return 'tue'; }
    const pad = n => n.toString().padStart(2, '0');

    function initDOM() {
        if (!document.getElementById('mesh-timer-styles')) {
            const style = document.createElement('style');
            style.id = 'mesh-timer-styles';
            style.innerHTML = `
                
                .mesh-liquid-effect {
                    box-shadow: inset 0 1px 1px rgba(255,255,255,0.5), 0 8px 32px rgba(0,0,0,0.3) !important;
                }
                .mesh-liquid-effect::before {
                    content: ''; position: absolute; top: 0; left: -100%; width: 50%; height: 100%;
                    background: linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0) 100%);
                    transform: skewX(-20deg); animation: mesh-glare 4s infinite; z-index: 0; pointer-events: none;
                }
                .mesh-liquid-effect::after {
                    content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0;
                    background-image: linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 40%, rgba(255,255,255,0) 60%, rgba(255,255,255,0.1) 100%);
                    z-index: 0; pointer-events: none;
                }
                @keyframes mesh-glare {
                    0% { left: -100%; } 20% { left: 200%; } 100% { left: 200%; }
                }
                #mesh-timer-inner {
                    transition: transform 0.3s, border-radius 0.3s; /* Убрали all, чтобы ползунки не лагали */
                }
 20% { left: 200%; } 100% { left: 200%; }
                }
            `;
            document.head.appendChild(style);
        }

        if (document.getElementById('mesh-timer-card')) return;
        const card = document.createElement('div');
        card.id = 'mesh-timer-card';
        card.style.cssText = `position: fixed; top: 15px; right: 350px; z-index: 9999999; font-family: 'Segoe UI', sans-serif; display: flex; flex-direction: column; gap: 6px; cursor: move; user-select: none; align-items: flex-end; transition: 0.3s;`;
        card.innerHTML = `
            <div id="mesh-timer-inner" style="position: relative; border-radius: 30px; padding: 6px 14px; display: flex; align-items: center; gap: 10px; overflow: hidden; backdrop-filter: blur(10px) saturate(180%); box-shadow: 0 4px 15px rgba(0,0,0,0.3); transition: all 0.3s; transform-origin: top right;">
                <div id="mesh-timer-bg" style="position:absolute; top:0; left:0; height:100%; width:0%; z-index:0; transition:width 1s linear, background 0.3s;"></div>
                <div style="position:relative; z-index:2; display:flex; align-items:center; gap:8px;">
                    <div id="mesh-timer-dot" style="width:10px; height:10px; border-radius:50%; transition: all 0.3s;"></div>
                    <div id="mesh-timer-val" style="font-family:monospace; font-size:16px; font-weight:bold; letter-spacing:0.5px; width:55px; transition: color 0.3s;">--:--</div>
                    <div id="mesh-timer-info" style="font-size:12px; font-weight:600; white-space:nowrap; transition: color 0.3s;">Загрузка...</div>
                    <div id="mesh-timer-settings-btn" style="cursor:pointer; font-size:14px; margin-left:5px; opacity:0.3; transition:0.2s;" title="Настройки">⚙️</div>
                </div>
            </div>
            
            <div id="mesh-timer-settings-panel" style="display:none; position:absolute; top:110%; right:0; background:rgba(20,25,30,0.9); backdrop-filter:blur(10px); padding:10px; border-radius:12px; border:1px solid rgba(255,255,255,0.1); width:200px; flex-direction:column; gap:8px; z-index:10000000; box-shadow: 0 5px 20px rgba(0,0,0,0.5);">
                <div style="color:white; font-size:11px; font-weight:bold; margin-bottom:2px; display:flex; justify-content:space-between;">
                    <span>Настройки</span>
                    <span id="mesh-timer-reset-colors" style="cursor:pointer; color:#e74c3c; font-size:9px;">Сброс цветов</span>
                </div>
                <label style="color:#aaa; font-size:10px; display:flex; justify-content:space-between; align-items:center;">Стиль: 
                    <select id="mesh-timer-theme-select" style="background:#0f172a; color:white; border:1px solid #334; border-radius:4px; font-size:10px; padding:2px; cursor:pointer;">
                        <option value="default">Неоновый космос</option>
                        <option value="minimal">Светлый минимализм</option>
                        <option value="hacker">Матрица</option>
<option value="apple_light">Apple Glass (Светлая)</option>
                        <option value="apple_dark">Apple Glass (Темная)</option>
                        <option value="liquid_glass">Liquid Glass (Отражения)</option>
                    </select>
                </label>
                <label style="color:#aaa; font-size:10px; display:flex; justify-content:space-between; align-items:center;">Свой фон: <input type="color" id="mesh-timer-color-bg" style="width:24px; height:24px; border:none; background:none; cursor:pointer; padding:0;"></label>
                <label style="color:#aaa; font-size:10px; display:flex; justify-content:space-between; align-items:center;">Свой текст: <input type="color" id="mesh-timer-color-text" style="width:24px; height:24px; border:none; background:none; cursor:pointer; padding:0;"></label>
                <div style="height:1px; background:rgba(255,255,255,0.1); margin:4px 0;"></div>
                <label style="color:#aaa; font-size:10px; display:flex; justify-content:space-between;">Размер: <input type="range" id="mesh-timer-scale" min="0.5" max="2.0" step="0.1" value="1.0" style="width:80px;"></label>
                <label style="color:#aaa; font-size:10px; display:flex; justify-content:space-between;">Скругление: <input type="range" id="mesh-timer-radius" min="0" max="40" step="2" value="30" style="width:80px;"></label>
                <label style="color:#aaa; font-size:10px; display:flex; justify-content:space-between;">Прозрачность: <input type="range" id="mesh-timer-opacity" min="0.0" max="1.0" step="0.1" value="0.5" style="width:80px;"></label>
                <label style="color:#aaa; font-size:10px; display:flex; justify-content:space-between;">Стекло: <input type="range" id="mesh-timer-glass" min="0" max="20" step="1" value="10" style="width:80px;"></label>
            </div>

            <div id="mesh-timer-note-box" style="display: none; border-radius: 12px; padding: 4px 12px; font-size: 11px; text-align: center; backdrop-filter: blur(10px) saturate(180%); box-shadow: 0 4px 15px rgba(0,0,0,0.2); max-width: 250px; word-wrap: break-word; transition: all 0.3s; margin-top:6px;">
                <span id="mesh-timer-note-text" style="font-weight: 600; transition: color 0.3s;"></span>
            </div>
        `;
        
        // Listeners for custom properties
        setTimeout(() => {
            const btn = document.getElementById('mesh-timer-settings-btn');
            const panel = document.getElementById('mesh-timer-settings-panel');
            const inner = document.getElementById('mesh-timer-inner');
            const note = document.getElementById('mesh-timer-note-box');
            
            if (btn && panel) {
                btn.onmouseover = () => btn.style.opacity = '1';
                btn.onmouseout = () => btn.style.opacity = '0.3';
                btn.onclick = (e) => {
                    e.stopPropagation();
                    panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
                };
            }
            
            chrome.storage.local.get(['timerScale', 'timerRadius', 'timerGlass'], (d) => {
                if (d.timerScale) { inner.style.transform = `scale(${d.timerScale})`; document.getElementById('mesh-timer-scale').value = d.timerScale; }
                if (d.timerRadius) { inner.style.borderRadius = `${d.timerRadius}px`; note.style.borderRadius = `${Math.max(4, d.timerRadius-10)}px`; document.getElementById('mesh-timer-radius').value = d.timerRadius; }
                if (d.timerGlass) { inner.style.backdropFilter = `blur(${d.timerGlass}px) saturate(180%)`; document.getElementById('mesh-timer-glass').value = d.timerGlass; }
            });
            
            document.getElementById('mesh-timer-scale').oninput = (e) => {
                inner.style.transform = `scale(${e.target.value})`;
                chrome.storage.local.set({timerScale: e.target.value});
            };
            document.getElementById('mesh-timer-radius').oninput = (e) => {
                inner.style.borderRadius = `${e.target.value}px`;
                note.style.borderRadius = `${Math.max(4, e.target.value-10)}px`;
                chrome.storage.local.set({timerRadius: e.target.value});
            };
            
            chrome.storage.local.get(['timerCustomTheme', 'timerCustomBg', 'timerCustomText'], (d) => {
                if (d.timerCustomTheme) { document.getElementById('mesh-timer-theme-select').value = d.timerCustomTheme; }
                if (d.timerCustomBg) { document.getElementById('mesh-timer-color-bg').value = d.timerCustomBg; }
                if (d.timerCustomText) { document.getElementById('mesh-timer-color-text').value = d.timerCustomText; }
            });

            
            
            
            document.getElementById('mesh-timer-reset-colors').onclick = () => {
                chrome.storage.local.remove(['timerCustomBg', 'timerCustomText'], () => {
                    document.getElementById('mesh-timer-color-bg').value = '#000000';
                    document.getElementById('mesh-timer-color-text').value = '#000000';
                });
            };

            
            chrome.storage.local.get(['timerOpacity'], (d) => {
                if (d.timerOpacity !== undefined) { document.getElementById('mesh-timer-opacity').value = d.timerOpacity; }
            });
            

                    document.getElementById('mesh-timer-opacity').oninput = (e) => {
                customPrefs.timerOpacity = parseFloat(e.target.value);
                chrome.storage.local.set({timerOpacity: customPrefs.timerOpacity});
                updateTimer(); // Моментальное обновление без лагов
            };
            document.getElementById('mesh-timer-glass').oninput = (e) => {
                inner.style.backdropFilter = `blur(${e.target.value}px) saturate(180%)`;
                chrome.storage.local.set({timerGlass: e.target.value});
            };
            document.getElementById('mesh-timer-color-bg').oninput = (e) => {
                customPrefs.timerCustomBg = e.target.value;
                chrome.storage.local.set({timerCustomBg: e.target.value});
                updateTimer();
            };
            document.getElementById('mesh-timer-color-text').oninput = (e) => {
                customPrefs.timerCustomText = e.target.value;
                chrome.storage.local.set({timerCustomText: e.target.value});
                updateTimer();
            };
            document.getElementById('mesh-timer-theme-select').onchange = (e) => {
                customPrefs.timerCustomTheme = e.target.value;
                chrome.storage.local.set({timerCustomTheme: e.target.value});
                updateTimer();
            };

        }, 100);

        document.body.appendChild(card);
        if (!isEnabled) card.style.display = 'none';

        
        // Кастомная логика перетаскивания (без лишних кнопок)
        let isDragging = false;
        let startX, startY, initialX, initialY;
        
        card.onmousedown = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.id === 'mesh-timer-settings-btn') return;
            isDragging = true;
            startX = e.clientX; startY = e.clientY;
            const rect = card.getBoundingClientRect();
            initialX = rect.left; initialY = rect.top;
            card.style.transition = 'none'; // Убираем плавность при перетаскивании
        };
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            card.style.left = (initialX + dx) + 'px';
            card.style.top = (initialY + dy) + 'px';
            card.style.right = 'auto'; // Сбрасываем привязку к правому краю
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                card.style.transition = '0.3s';
                chrome.storage.local.set({ timerLeft: card.style.left, timerTop: card.style.top });
            }
        });
chrome.storage.local.get(['timerLeft', 'timerTop'], (data) => {
            if (data.timerLeft && data.timerTop) { card.style.right = 'auto'; card.style.left = data.timerLeft; card.style.top = data.timerTop; }
        });

        
    }

    function updateTimer() {
        if (!isEnabled || !document.getElementById('mesh-timer-card')) return;
        

        const activeThemeStr = customPrefs.timerCustomTheme || currentTheme || 'default';
        const th = themes[activeThemeStr] || themes.default;
        

        let applyBg = th.bg;
        if (customPrefs.timerCustomBg) { applyBg = customPrefs.timerCustomBg + '80'; }
        
        // Apply custom opacity if set
        if (customPrefs.timerOpacity !== undefined) {
            // Replace the alpha value in rgba
            if (applyBg.startsWith('rgba')) {
                applyBg = applyBg.replace(/[^,]+(?=\))/, ` ${customPrefs.timerOpacity}`);
            } else if (applyBg.startsWith('#') && applyBg.length === 9) {
                // Hex with alpha #RRGGBBAA
                let alphaHex = Math.round(customPrefs.timerOpacity * 255).toString(16).padStart(2, '0');
                applyBg = applyBg.substring(0, 7) + alphaHex;
            }
        }
        
        const innerEl = document.getElementById('mesh-timer-inner');
        innerEl.style.backgroundColor = applyBg;
        
        if (th.isLiquid) innerEl.classList.add('mesh-liquid-effect');
        else innerEl.classList.remove('mesh-liquid-effect');

        let applyText = customPrefs.timerCustomText || th.text;
        document.getElementById('mesh-timer-inner').style.border = th.border;
        document.getElementById('mesh-timer-val').style.color = applyText;
        document.getElementById('mesh-timer-info').style.color = customPrefs.timerCustomText || th.infoText;
        document.getElementById('mesh-timer-settings-btn').style.color = applyText;


        const noteBox = document.getElementById('mesh-timer-note-box');
        noteBox.style.background = th.noteBg; noteBox.style.border = th.noteBorder; document.getElementById('mesh-timer-note-text').style.color = th.noteText;

        if (timerNoteStr.trim() !== "") { document.getElementById('mesh-timer-note-text').textContent = timerNoteStr; noteBox.style.display = 'block'; } 
        else { noteBox.style.display = 'none'; }

        const now = new Date(); const currentMins = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
        const todayKey = getCurrentScheduleKey(); const isSunday = now.getDay() === 0;

        const elTime = document.getElementById('mesh-timer-val'); const elInfo = document.getElementById('mesh-timer-info');
        const elBar = document.getElementById('mesh-timer-bg'); const elDot = document.getElementById('mesh-timer-dot');

        if (isSunday) { elTime.textContent = "--:--"; elInfo.textContent = "Выходной"; elBar.style.width = '0%'; elDot.style.background = th.idleDot; elDot.style.boxShadow = 'none'; return; }

        const data = (customSchedule && customSchedule.length > 0) ? customSchedule : scheduleData[todayKey];
        let activeFound = false;

        for (let i = 0; i < data.length; i++) {
            const item = data[i]; const startMins = getMinutes(item.start); const endMins = getMinutes(item.end);
            if (currentMins >= startMins && currentMins < endMins) {
                activeFound = true;
                const totalDur = (endMins - startMins) * 60; const elap = (currentMins - startMins) * 60; const rem = totalDur - elap;
                elTime.textContent = rem >= 3600 ? `${Math.floor(rem/3600)}:${pad(Math.floor((rem%3600)/60))}:${pad(Math.floor(rem%60))}` : `${pad(Math.floor(rem/60))}:${pad(Math.floor(rem%60))}`;
                elBar.style.width = `${(elap / totalDur) * 100}%`;

                if (item.type === 'break') { elInfo.textContent = `Перемена`; elDot.style.background = th.breakDot; elDot.style.boxShadow = `0 0 8px ${th.breakDot}`; elBar.style.background = th.breakBar; } 
                else if (item.type === 'special') { elInfo.textContent = item.title; elDot.style.background = th.specDot; elDot.style.boxShadow = `0 0 8px ${th.specDot}`; elBar.style.background = th.specBar; } 
                else { elInfo.textContent = item.title; elDot.style.background = (rem < 300) ? th.warnDot : th.lessonDot; elDot.style.boxShadow = (rem < 300) ? `0 0 8px ${th.warnDot}` : `0 0 8px ${th.lessonDot}`; elBar.style.background = (rem < 300) ? th.warnBar : th.lessonBar; }
                break;
            }
        }
        if (!activeFound) {
            const firstStart = getMinutes(data[0].start);
            if (currentMins < firstStart) {
                const diff = firstStart - currentMins; elTime.textContent = diff >= 60 ? `${Math.floor(diff/60)}:${pad(Math.floor(diff%60))}` : `${pad(Math.floor(diff%60))}:00`;
                elInfo.textContent = "До занятий"; elBar.style.width = '100%'; elDot.style.background = th.lessonDot; elDot.style.boxShadow = `0 0 8px ${th.lessonDot}`;
            } else { elTime.textContent = "--:--"; elInfo.textContent = "Уроки окончены"; elBar.style.width = '100%'; elDot.style.background = th.idleDot; elDot.style.boxShadow = 'none'; }
        }
    }
    let isTimerInitialized = false;
    let timerInterval = setInterval(() => { 
    try { 
        if (document.body) { 
            if (!document.getElementById('mesh-timer-card')) {
                isTimerInitialized = false; 
            }
            if(!isTimerInitialized) { 
                initDOM(); 
                if(document.getElementById('mesh-timer-card')) isTimerInitialized = true; 
            } 
            updateTimer(); 
        } 
    } catch(e) { 
        if(e.message && e.message.includes('context')) clearInterval(timerInterval);
        else console.error("Speedmesh Timer Error:", e);
    } 
}, 1000);
})();