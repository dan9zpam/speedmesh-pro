// ==========================================
// 🏆 MESH Achievements (Vaporwave Edition - 120 Badges & Modal UI)
// ==========================================
(async function() {
    console.log("🌴 MESH Achievements: Движок (120 Ачивок) активирован!");

    let stats = { totalGrades: 0, totalDays: 0, lastDate: null, streak: 0, unlocked: {} };
    try {
        const result = await chrome.storage.local.get(['MESH_ACHIEVEMENTS_PRO']);
        if (result.MESH_ACHIEVEMENTS_PRO) {
            stats = result.MESH_ACHIEVEMENTS_PRO;
        } else {
            const saved = localStorage.getItem('MESH_ACHIEVEMENTS_PRO');
            if (saved) { stats = JSON.parse(saved); }
        }
        if (!stats.streak) stats.streak = 0;
        if (!stats.unlocked) stats.unlocked = {};
        
        // Save back to chrome.storage.local if we just loaded from localStorage
        if (!result.MESH_ACHIEVEMENTS_PRO) chrome.storage.local.set({ 'MESH_ACHIEVEMENTS_PRO': stats });
    } catch(e) {}

    async function saveStats() {
        try {
            const result = await chrome.storage.local.get(['MESH_ACHIEVEMENTS_PRO']);
            if (result.MESH_ACHIEVEMENTS_PRO) {
                // Merge in-memory stats with storage stats to avoid overwriting changes from other tabs
                stats = { ...result.MESH_ACHIEVEMENTS_PRO, ...stats };
                stats.unlocked = { ...result.MESH_ACHIEVEMENTS_PRO.unlocked, ...stats.unlocked };
            }
        } catch(e) {}
        localStorage.setItem('MESH_ACHIEVEMENTS_PRO', JSON.stringify(stats));
        await chrome.storage.local.set({ 'MESH_ACHIEVEMENTS_PRO': stats });
    }

    const BADGES = {
        'hacker_man': { i: '💻', t: 'Хакер', d: 'Взломали систему (использовали сканер).' },
        'weight_master': { i: '⚖️', t: 'Властелин Весов', d: 'Выставили оценку с нестандартным весом.' },
        'column_king': { i: '📏', t: 'Король Столбцов', d: 'Закрыли целый столбец за 1 клик.' },
        'night_owl': { i: '🦉', t: 'Ночной Дозор', d: 'Выставили оценку после полуночи.' },
        'early_bird': { i: '🌅', t: 'Жаворонок', d: 'Работаете в МЭШ в 6 утра.' },
        'speed_demon': { i: '🏎️', t: 'Демон Скорости', d: 'Поставили 10 оценок за 5 секунд.' },
        'zen_master': { i: '🧘', t: 'Дзен Мастер', d: 'Отменили оценку через Ctrl+Z.' },
        'ghost_rider': { i: '👻', t: 'Призрачный Гонщик', d: 'Использовали режим невидимки.' },
        'timer_god': { i: '⏱️', t: 'Повелитель Времени', d: 'Запустили таймер урока.' },
        'architect_builder': { i: '🏗️', t: 'Строитель', d: 'Скрыли элемент через Архитектор.' },
        'random_luck': { i: '🎲', t: 'Случайный Выбор', d: 'Крутанули рулетку учеников.' },
        'attendance_pro': { i: '✅', t: 'Гуру Посещаемости', d: 'Быстро проставили Н-ки.' },
        'five_star': { i: '⭐', t: 'Пять Звезд', d: 'Поставили всем пятерки (Всем 5).' },
        'merciful': { i: '👼', t: 'Милосердный', d: 'Исправили 2 на 3.' },
        'ruthless': { i: '😈', t: 'Безжалостный', d: 'Исправили 5 на 2.' },

        'first_blood': { i: '🩸', t: 'Первая Кровь', d: 'Выставили первую авто-оценку.' },
        'novice': { i: '🌱', t: 'Новичок', d: 'Поставили 10 авто-оценок за всё время.' },
        'pro': { i: '🦾', t: 'Кибер-Препод', d: 'Поставили 50 авто-оценок. Вы втягиваетесь!' },
        'terminator': { i: '🤖', t: 'Терминатор', d: '100 оценок! Машина по выставлению баллов.' },
        'god': { i: '👑', t: 'Бог Журнала', d: '500 авто-оценок. Сервер МЭШ молится на вас.' },
        'cyborg': { i: '🦿', t: 'Киборг', d: 'Поставили 1000 авто-оценок. Вы забыли, как писать ручкой.' },
        'matrix': { i: '🕶️', t: 'Архитектор Матрицы', d: '5000 авто-оценок. Вы и есть МЭШ.' },
        'over_9000': { i: '💥', t: 'OVER 9000!', d: 'Более 9000 оценок. Ваш уровень запредельный!' },
        'ten_k': { i: '💎', t: 'Бриллиантовый Препод', d: '10 000 оценок. Вы вошли в историю МЭШ.' },
        'fifty_k': { i: '🌌', t: 'Сингулярность', d: '50 000 оценок. МЭШ теперь работает на вашей энергии.' },
        'three_axes': { i: '🎰', t: 'Три Топора', d: 'Выставили ровно 777 оценок за всё время.' },
        'devil': { i: '😈', t: 'Адский Труд', d: '666 авто-оценок за всё время.' },
        'make_a_wish': { i: '🌠', t: 'Загадай Желание', d: 'Работа в МЭШ ровно в 11:11.' },
        'cinderella': { i: '👠', t: 'Золушка', d: 'Поставили оценку в 23:59. Карета превращается в тыкву.' },
        'owl': { i: '🦉', t: 'Ночной Дозор', d: 'Открыли МЭШ после полуночи (00:00 - 04:00).' },
        'vampire': { i: '🦇', t: 'Вампир', d: 'Глубокая ночь. Зашли с 02:00 до 03:00.' },
        'nightmare': { i: '🧛', t: 'Дракула', d: 'Зашли в МЭШ ровно в полночь (00:00).' },
        'sunrise': { i: '🌤️', t: 'Первые Лучи', d: 'Работаете на рассвете (с 05:00 до 06:00).' },
        'early_bird': { i: '🌅', t: 'Ранняя Пташка', d: 'Уже в журнале до 07:00 утра.' },
        'lunch_break': { i: '🍔', t: 'Без Обеда', d: 'Выставляете оценки с 13:00 до 14:00.' },
        'tea_time': { i: '🫖', t: 'Время Чая', d: 'Работаете ровно в 17:00.' },
        'overtime': { i: '🌃', t: 'Сверхурочные', d: 'Сидите в журнале после 20:00.' },
        'friday_party': { i: '🪩', t: 'Пятничный Вайб', d: 'Работаете в пятницу после 18:00.' },
        'weekend_warrior': { i: '⚔️', t: 'Трудоголик', d: 'Зашли в МЭШ в выходные.' },
        'monday': { i: '☠️', t: 'Тяжелый Понедельник', d: 'Зашли в МЭШ в понедельник до 10:00.' },
        'winter_is_coming': { i: '🐺', t: 'Зима Близко', d: 'Зашли в журнал 1 декабря.' },
        'santa': { i: '🎅', t: 'Тайный Санта', d: 'Закрываете долги в декабре.' },
        'new_year': { i: '🥂', t: 'С Наступающим', d: 'Сидите в журнале 31 декабря.' },
        'grinch': { i: '🎄', t: 'Гринч', d: 'Работа в новогодние праздники (1-8 января).' },
        'student_day': { i: '🎓', t: 'Татьянин День', d: 'Работа в День студента (25 января).' },
        'valentines': { i: '💖', t: 'Любовь к Работе', d: 'Зашли в МЭШ 14 февраля.' },
        'defender': { i: '🪖', t: 'Защитник Журнала', d: 'Работаете 23 февраля.' },
        'leap_year': { i: '🐸', t: 'Редкий Гость', d: '29 февраля. Бывает раз в 4 года.' },
        'womens_day': { i: '💐', t: 'Весенний Праздник', d: 'Работаете 8 марта.' },
        'pi_day': { i: '🥧', t: 'День Пи', d: 'Зашли в МЭШ 14 марта (3.14).' },
        'ides_of_march': { i: '🗡️', t: 'Мартовские Иды', d: 'Работа 15 марта. Берегите спину.' },
        'spring': { i: '🌸', t: 'Весеннее Обострение', d: 'Март-Апрель. Скоро сессия!' },
        'fool': { i: '🤡', t: 'День Дурака', d: 'Работа 1 апреля. Это не шутка?' },
        'cosmonaut': { i: '🚀', t: 'Поехали!', d: 'День космонавтики (12 апреля).' },
        'labor_day': { i: '🕊️', t: 'Мир, Труд, Май', d: 'Зашли в МЭШ 1 мая.' },
        'star_wars': { i: '☄️', t: 'Джедай', d: 'Зашли в МЭШ 4 мая (May the 4th).' },
        'victory': { i: '🎆', t: 'День Победы', d: 'Зашли в МЭШ 9 мая.' },
        'may_bugs': { i: '🐞', t: 'Майский Жук', d: 'Зашли в систему на майских праздниках.' },
        'last_bell': { i: '🔔', t: 'Последний Звонок', d: 'Зашли в МЭШ 25 мая. Почти свобода!' },
        'longest_day': { i: '☀️', t: 'Летнее Солнцестояние', d: 'Работа 21 июня. Самый длинный день.' },
        'summer': { i: '🏖️', t: 'Где мой отпуск?', d: 'Зашли в журнал летом.' },
        'knowledge': { i: '🎒', t: 'Снова в Школу', d: 'Работаете 1 сентября.' },
        'autumn': { i: '🍂', t: 'Снова в Бой', d: 'Сентябрь горит.' },
        'teachers_day': { i: '🧑‍🏫', t: 'Проф. Праздник', d: 'Зашли в МЭШ 5 октября (День Учителя).' },
        'halloween': { i: '🎃', t: 'Сладость/Гадость', d: 'Зашли в МЭШ 31 октября.' },
        'sales_day': { i: '🛒', t: 'Черная Пятница', d: '11 ноября (11.11). Скидки на двойки!' },
        'darkest_night': { i: '🌑', t: 'Зимнее Солнцестояние', d: 'Работа 21 декабря. Тьма сгущается.' },
        'lucky_13': { i: '🐈‍⬛', t: 'Пятница 13-е', d: 'Работаете в пятницу 13-го числа.' },
        'sniper': { i: '🎯', t: 'Снайпер', d: '15 успешных оценок за одну сессию.' },
        'machine_gun': { i: '🔫', t: 'Пулеметчик', d: '30 оценок за сессию.' },
        'answer_to_everything': { i: '🌌', t: 'Главный Вопрос', d: 'Выставили 42 оценки за сессию.' },
        'nice': { i: '😏', t: 'Nice', d: 'Выставили 69 оценок за сессию.' },
        'slevin': { i: '🍀', t: 'Число Слевина', d: 'Выставили 77 оценок за сессию.' },
        'almost_there': { i: '🤏', t: 'Еще Чуть-Чуть', d: 'Выставили 99 оценок за сессию.' },
        'centurion': { i: '💯', t: 'Центурион', d: '100 оценок за ОДНУ сессию. Монстр.' },
        'half_k': { i: '🪙', t: 'Полтысячи', d: '500 оценок за одну сессию. Рекорд!' },
        'blackjack': { i: '🃏', t: 'Блэкджек', d: 'Поставили ровно 21 оценку за сессию.' },
        'lucky_seven': { i: '🎰', t: 'Семерка', d: 'Поставили ровно 7 пятерок за сессию.' },
        'good_cop': { i: '😇', t: 'Добрый Коп', d: 'Поставили пять «5» подряд!' },
        'santa_claus': { i: '🎅', t: 'Дед Мороз', d: '10 пятерок подряд. Вы сегодня добрый.' },
        'executioner': { i: '🪓', t: 'Палач', d: 'Три «2» подряд.' },
        'massacre': { i: '🩸', t: 'Резня', d: '10 двоек подряд. Остановитесь!' },
        'hater': { i: '😒', t: 'Душнила', d: 'Три «3» подряд.' },
        'lover': { i: '🤝', t: 'Меценат', d: 'Пять «4» подряд.' },
        'stability': { i: '🗿', t: 'Стабильность', d: 'Десять троек за одну сессию.' },
        'combo_breaker': { i: '⚡', t: 'Комбо-Брейкер', d: 'Сразу после «2» влепили кому-то «5».' },
        'rollercoaster': { i: '🎢', t: 'Амер. Горки', d: 'Чередование оценок: 5, 2, 5, 2.' },
        'zebra': { i: '🦓', t: 'Зебра', d: 'Чередование: 5, 4, 5, 4, 5, 4.' },
        'bad_zebra': { i: '🚧', t: 'Черная Полоса', d: 'Чередование: 3, 2, 3, 2, 3, 2.' },
        'straight_flush': { i: '🃏', t: 'Стрит-Флеш', d: 'Поставили подряд 2, 3, 4 и 5.' },
        'stairway_down': { i: '📉', t: 'Спуск на Дно', d: 'Поставили подряд 5, 4, 3, 2.' },
        'generous': { i: '🤑', t: 'Джекпот', d: 'Поставили 50 пятерок за одну сессию!' },
        'ruthless': { i: '🌋', t: 'Извержение', d: 'Влепили 20 двоек за одну сессию.' },
        'rain_of_twos': { i: '🌧️', t: 'Дождь из Двоек', d: 'Поставили 15 двоек за сессию.' },
        'rain_of_fives': { i: '🌠', t: 'Звездопад', d: 'Поставили 30 пятерок за сессию.' },
        'yin_yang': { i: '☯️', t: 'Инь-Ян', d: 'Поставили ровно пять «5» и пять «2» за сессию.' },
        'perfectionist': { i: '✨', t: 'Перфекционист', d: 'Выставили оценку каждому в группе.' },
        'flawless': { i: '🛡️', t: 'Неуязвимые', d: 'Группа без единой буквы «Н» на экране.' },
        'perfect_balance': { i: '⚖️', t: 'Идеальный Баланс', d: 'На странице ровно 1 "Н" и 1 "Б".' },
        'plague': { i: '🦠', t: 'Эпидемия', d: 'Больше 10 пропусков (Н) на странице.' },
        'hospital': { i: '🏥', t: 'Лазарет', d: 'На странице 20 или больше больничных (Б/У/П).' },
        'quarantine': { i: '☣️', t: 'Карантин', d: '20 прогулов и 20 больных одновременно.' },
        'ghost_town': { i: '🏚️', t: 'Город-Призрак', d: 'На странице 30 или больше пропусков (Н).' },
        'apocalypse': { i: '💀', t: 'Апокалипсис', d: '50 пропусков на одной странице.' },
        'streak_5': { i: '🔥', t: 'В Огне', d: 'Заходили в МЭШ 5 дней подряд.' },
        'streak_10': { i: '☢️', t: 'МЭШ-зависимость', d: '10 дней подряд в журнале.' },
        'streak_30': { i: '📅', t: 'Месяц без Выходных', d: 'Заходили в МЭШ 30 дней подряд.' },
        'veteran': { i: '🎖️', t: 'Ветеран', d: 'Провели в МЭШ суммарно 30 разных дней.' },
        'hundred_days': { i: '🗓️', t: 'Сотня', d: 'Провели в МЭШ суммарно 100 разных дней.' },
        'half_year': { i: '⏳', t: 'Полгода Жизни', d: '180 дней в журнале. Вы живете здесь.' },
        'architect': { i: '🏗️', t: 'Архитектор', d: 'Использовали модуль перекраски.' },
        'picasso': { i: '🎨', t: 'Пикассо', d: 'Изменили множество элементов в Архитекторе.' },
        'hacker': { i: '💻', t: 'Хакер', d: 'Экстремально перестроили интерфейс Архитектором.' },
        'destroyer_of_worlds': { i: '💥', t: 'Разрушитель Миров', d: 'Сбросили дизайн Архитектора 3 раза.' },
        'spy': { i: '🕵️‍♂️', t: 'Агент 007', d: 'Включили шпиона API.' },
        'paranoid': { i: '👁️', t: 'Параноик', d: 'Проверили шпион API 10 раз.' },
        'data_miner': { i: '⛏️', t: 'Датамайнер', d: 'Скачали логи шпиона 5 раз.' },
        'turbo': { i: '⚡', t: 'Флэш', d: 'Включили ускорение анимаций.' },
        'ktp_master': { i: '📅', t: 'Повелитель Времени', d: 'Открыли страницу КТП.' },
        'absence_mode': { i: '👻', t: 'Охотник за Н-ками', d: 'Открыли режим отсутствия.' },
        'weight_1': { i: '🪶', t: 'Легкотня', d: 'Выставили оценку с Весом 1.' },
        'symbiote': { i: '🕷️', t: 'Симбиот', d: 'Выбрали Оценку с Весом 2.' },
        'indecisive_weight': { i: '⚖️', t: 'Весы', d: 'Сменили вес оценки туда-сюда 5 раз за сессию.' },
        'all_5': { i: '⭐', t: 'Раздача Слонов', d: 'Использовали массовый режим "Всем 5".' },
        'all_4': { i: '🙂', t: 'Хорошисты', d: 'Использовали массовый режим "Всем 4".' },
        'all_3': { i: '😐', t: 'Удовлетворительно', d: 'Использовали массовый режим "Всем 3".' },
        'all_2': { i: '🌩️', t: 'Гроза Курса', d: 'Использовали массовый режим "Всем 2".' },
        'col_picker': { i: '🗓️', t: 'Матрица Дат', d: 'Использовали выделение столбцов.' },
        'undo_master': { i: '⏪', t: 'Машина Времени', d: 'Удалили оценку Ластиком или Ctrl+Z.' },
        'undo_spam': { i: '♻️', t: 'Нерешительность', d: 'Отменили 5 оценок за одну сессию.' },
        'alt_eraser': { i: '🧹', t: 'Уборщик', d: 'Использовали скрытый Alt+Клик для удаления.' },
        'ninja_eraser': { i: '🥷', t: 'Ниндзя-Ластик', d: 'Удалили 10 оценок через Alt+Click.' },
        'pdf_dossier': { i: '🖨️', t: 'Бюрократ', d: 'Сгенерировали PDF-досье на студента.' },
        'inspector': { i: '🔍', t: 'Инспектор', d: 'Скачали досье 5 раз за одну сессию.' },
        'misclick_master': { i: '🖱️', t: 'Мастер Мисклика', d: 'Кликнули в пустоту 20 раз.' },
        'fast_fingers': { i: '🖱️', t: 'Быстрые Пальцы', d: 'Поставили 5 оценок меньше чем за 3 сек.' },
        'speed_demon': { i: '🏎️', t: 'Спидраннер', d: 'Поставили 10 оценок быстрее 10 сек.' },
        'machine_learning': { i: '🦾', t: 'Нейросеть', d: 'Поставили 5 оценок за 1 секунду.' },
        'marathon': { i: '🏃', t: 'Марафонец', d: 'Провели на странице журнала больше 30 минут.' },
        'coffee': { i: '☕', t: 'Кофе-брейк', d: 'Отошли за чаем (неактивность 15 минут).' },
        'coffee_addict': { i: '☕☕', t: 'Кофеиновый Маньяк', d: 'Отошли от ПК 3 раза за сессию.' },
        'hibernation': { i: '🐻', t: 'Спячка', d: 'Оставили МЭШ открытым без действий на 1 час.' },
        'night_owl': { i: '🦉🦉', t: 'Сова 80лвл', d: 'Сделали 50 действий глубокой ночью.' },
        'vampire_lord': { i: '🧛‍♂️', t: 'Высший Вампир', d: 'Сделали 100 действий глубокой ночью.' },
        'ambassador': { i: '💎', t: 'Амбассадор', d: 'Собрали 10 достижений!' },
        'collector': { i: '🗃️', t: 'Коллекционер', d: 'Собрали 50 достижений.' },
        'hoarder': { i: '🏆', t: 'Барахольщик', d: 'Собрали 75 достижений.' },
        'century_club': { i: '💯', t: 'Сотня', d: 'Собрали 100 достижений.' },
        'completionist': { i: '🏅', t: 'Комплиционист', d: 'Собрали 120 достижений.' },
        
        // --- 35 НОВЫХ ДОСТИЖЕНИЙ ---
        'hacker_man': { i: '👨‍💻', t: 'HACKERMAN', d: 'Открыли сканер среды (Режим разработчика).' },
        'sysadmin': { i: '🖧', t: 'Сисадмин', d: 'Заглянули в хранилища через сканер.' },
        'neo': { i: '💊', t: 'Нео', d: 'Нашли глобальный стейт React / Vue.' },
        'debugger': { i: '🐛', t: 'Дебаггер', d: 'Использовали инструменты разработчика (F12).' },
        'matrix_glitch': { i: '👾', t: 'Сбой Матрицы', d: 'Спровоцировали ошибки API за сессию.' },
        'speed_reader': { i: '📖', t: 'Скороход', d: 'Получили ответ от сервера мгновенно.' },
        'lag_master': { i: '🐌', t: 'Властелин Лагов', d: 'Сервер МЭШ еле отвечает. Держитесь!' },
        'click_hero': { i: '🖱️', t: 'Клик Хиро', d: 'Нажали множество кнопок в интерфейсе.' },
        'keyboard_warrior': { i: '⌨️', t: 'Клавиатурный Воин', d: 'Спамили горячие клавиши (Ctrl+Z).' },
        'ghost_click': { i: '👻', t: 'Клик Призрака', d: 'Попытка выставить оценку без токена.' },
        'inspector_gadget': { i: '🕵️', t: 'Инспектор Гаджет', d: 'Часто использовали сканер фич.' },
        'shadow_broker': { i: '👤', t: 'Теневой Брокер', d: 'Исследовали сотни ключей Local Storage.' },
        'data_hoarder': { i: '📦', t: 'Плюшкин Данных', d: 'Накопили мегабайт логов API.' },
        'clean_slate': { i: '🧼', t: 'Чистый Лист', d: 'Сбросили внутренние кэши.' },
        'silent_assassin': { i: '🥷', t: 'Тихий Убийца', d: 'Оценены все ученики очень тихо и быстро.' },
        'scroll_master': { i: '📜', t: 'Мастер Свитков', d: 'Много скроллили длинную таблицу.' },
        'zoom_zoom': { i: '🏎️', t: 'Вжжжух!', d: 'Грузили страницы одну за другой.' },
        'multitasker': { i: '🤹', t: 'Многозадачность', d: 'Много журналов в памяти.' },
        'no_touch': { i: '🛑', t: 'Бесконтактный бой', d: 'Только массовые оценки (Всем 5, Всем 2).' },
        'color_blind': { i: '🎨', t: 'Монохром', d: 'Выключали раскраску в настройках.' },
        'rgb_fan': { i: '🌈', t: 'Фанат RGB', d: 'Наслаждаетесь цветными оценками.' },
        'weight_lifter': { i: '🏋️', t: 'Тяжелоатлет', d: 'Ставите только тяжелые оценки (Вес 2+).' },
        'feather_weight': { i: '🪶', t: 'Легкий вес', d: 'Используете только Вес 1.' },
        'balance_master': { i: '🤹‍♂️', t: 'Мастер Баланса', d: 'Чередовали веса 1 и 2.' },
        'lucky_strike': { i: '🎳', t: 'Страйк!', d: 'Одной кнопкой выставили массу пятерок.' },
        'unlucky_strike': { i: '💥', t: 'Крушение!', d: 'Массовое поражение двойками.' },
        'diplomat': { i: '🤝', t: 'Дипломат', d: 'Никого не обидели и не порадовали за день.' },
        'workaholic': { i: '💼', t: 'Шопоголик Оценок', d: 'Заполнили сразу целый столбец.' },
        'ghost_column': { i: '👻', t: 'Столбец Призрак', d: 'Отменили все оценки в одном столбце.' },
        'time_traveler': { i: '⏳', t: 'Путешественник во времени', d: 'Пытались управлять датами.' },
        'archaeologist': { i: '🏺', t: 'Археолог', d: 'Трогали очень старые даты.' },
        'magician': { i: '🎩', t: 'Фокусник', d: 'Выставили оценку и тут же испарили её.' },
        'illusionist': { i: '✨', t: 'Иллюзионист', d: 'За секунду превратили 2 в 5.' },
        'game_over': { i: '🎮', t: 'Game Over', d: 'Полная победа над рутиной.' },

        // --- 50 НОВЫХ СУПЕР-АЧИВОК (Vaporwave Expansion Pack) ---
        'coffee_break_pro': { i: '🍩', t: 'Кофе с Пончиком', d: 'Перерыв больше 30 минут.' },
        'night_rider': { i: '🏍️', t: 'Ночной Гонщик', d: 'Оценки после 2 ночи.' },
        'weekend_freak': { i: '🤪', t: 'Безумец Выходного', d: 'Проверка работ в воскресенье утром.' },
        'monday_blues': { i: '🌧️', t: 'Тоска Понедельника', d: 'Первая двойка в понедельник.' },
        'friday_joy': { i: '🎉', t: 'Пятничная Радость', d: 'Пятерки в пятницу вечером.' },
        'spring_break': { i: '🌴', t: 'Весенние Каникулы', d: 'Работа в апреле.' },
        'winter_tale': { i: '❄️', t: 'Зимняя Сказка', d: 'Оценки в снегопад (январь).' },
        'summer_sadness': { i: '🌞', t: 'Летняя Печаль', d: 'МЭШ в июле. Зачем вы здесь?' },
        'deadline_master': { i: '⏰', t: 'Мастер Дедлайнов', d: 'Выставление в последний день месяца.' },
        'speed_of_light': { i: '⚡', t: 'Скорость Света', d: 'Оценки ставятся со скоростью автокликера.' },
        'turtle_mode': { i: '🐢', t: 'Режим Черепахи', d: 'Одна оценка в 10 минут.' },
        'rage_quit': { i: '💢', t: 'Рейдж Квит', d: 'Закрыли вкладку после 10 двоек.' },
        'good_boy': { i: '🐶', t: 'Хороший Мальчик', d: 'Всем пятерки за урок.' },
        'bad_cop_2': { i: '👮', t: 'Злой Коп V2', d: 'Только тройки и двойки за сессию.' },
        'true_neutral': { i: '🟰', t: 'Нейтралитет', d: 'Одни четверки.' },
        'chaos_bringer': { i: '🌪️', t: 'Вестник Хаоса', d: 'Рандомные оценки от 2 до 5.' },
        'lucky_clover': { i: '🍀', t: 'Клевер Удачи', d: 'Нажали наугад и выставили 5.' },
        'unlucky_cat': { i: '🐈', t: 'Черный Кот', d: 'Случайно поставили 2 и сохранили.' },
        'eraser_god': { i: '🧽', t: 'Бог Ластика', d: 'Стёрли 50 оценок.' },
        'click_spam': { i: '🖱️', t: 'Спам Кликов', d: '100 кликов за минуту.' },
        'afk_farmer': { i: '🌾', t: 'АФК Фермер', d: 'Оставили вкладку на сутки.' },
        'tab_hoarder': { i: '📑', t: 'Плюшкин Вкладок', d: 'Открыто много окон МЭШ.' },
        'dark_mode_fan': { i: '🌙', t: 'Рыцарь Тьмы', d: 'Включили темную тему МЭШ.' },
        'light_mode_enjoyer': { i: '☀️', t: 'Адепт Света', d: 'Выжгли глаза белым фоном.' },
        'font_hacker': { i: '🔤', t: 'Шрифтовой Хакер', d: 'Поменяли шрифты в Архитекторе.' },
        'css_magician': { i: '🧙‍♂️', t: 'Маг CSS', d: 'Мощно изменили CSS.' },
        'inspector_pro': { i: '🕵️', t: 'Инспектор Pro', d: 'Открыли код страницы 50 раз.' },
        'network_ninja': { i: '🥷', t: 'Ниндзя Сети', d: 'Перехватили 100 запросов API.' },
        'json_reader': { i: '📄', t: 'Чтец JSON', d: 'Смотрели сырые данные журнала.' },
        'error_404': { i: '🚫', t: 'Ошибка 404', d: 'Страница не найдена, но вы упорны.' },
        'error_502': { i: '🔥', t: 'Сервер Горит', d: 'Bad Gateway в МЭШ.' },
        'rate_limit': { i: '🚦', t: 'Слишком Быстро', d: 'Словили лимит запросов.' },
        'cookie_monster': { i: '🍪', t: 'Куки-Монстр', d: 'Токены сохранены успешно.' },
        'session_expired': { i: '⏳', t: 'Время Вышло', d: 'Сессия МЭШ истекла.' },
        'relogin_king': { i: '👑', t: 'Король Релогинов', d: 'Часто перелогиниваетесь.' },
        'password_forgetter': { i: '🔑', t: 'Где Пароль?', d: 'Восстановление доступа.' },
        'mos_ru_fan': { i: '🏛️', t: 'Фанат mos.ru', d: 'Истинный москвич.' },
        'qr_scanner': { i: '📱', t: 'Сканер', d: 'Зашли по QR коду.' },
        'two_fa': { i: '🛡️', t: 'Безопасник', d: 'Прошли двухфакторку без нервов.' },
        'excel_export': { i: '📊', t: 'Мастер Excel', d: 'Скачали журналы.' },
        'zip_master': { i: '📦', t: 'Упаковщик', d: 'Скачали все журналы архивом.' },
        'report_builder': { i: '📋', t: 'Генератор Отчетов', d: 'Скачали отчет успеваемости.' },
        'stats_nerd': { i: '📈', t: 'Ботан-Статист', d: 'Считали средний балл.' },
        'auto_avg': { i: '🤖', t: 'Средний Балл Pro', d: 'Полагаетесь на скрипт.' },
        'red_zone': { i: '🛑', t: 'Красная Зона', d: 'Ученик на грани отчисления (2.50).' },
        'green_zone': { i: '✅', t: 'Зеленая Зона', d: 'Ученик идет на медаль (4.50+).' },
        'perfect_student': { i: '🌟', t: 'Идеал', d: 'Все пятерки у студента.' },
        'truant': { i: '👻', t: 'Прогульщик', d: 'Одни "Н" в строке.' },
        'sick_leave': { i: '🤒', t: 'Хронически Болен', d: 'Много "Б" подряд.' },
        'miracle_recovery': { i: '🏥', t: 'Чудесное Исцеление', d: 'Сразу после "Б" получил 5.' },
        'easter_egg': { i: '🥚', t: 'Пасхалка', d: 'Секретное нажатие выполнено.' },
        'mesh_god': { i: '🏔️', t: 'Вершина МЭШ', d: 'Вы познали все тайны системы.' },

        // --- 10 СЕКРЕТНЫХ ПАСХАЛОК ---
        'easter_konami': { i: '🎮', t: 'Код Конами', d: 'Вверх, вверх, вниз, вниз, влево...' },
        'easter_type_speed': { i: '🏎️', t: 'Тайный Поклонник', d: 'Напечатали название расширения.' },
        'easter_shake_mouse': { i: '🌪️', t: 'Землетрясение', d: 'Потрясли мышью от злости.' },
        'easter_double_click': { i: '🖱️', t: 'Двойной Удар', d: 'Серия двойных кликов.' },
        'easter_type_pi': { i: '🥧', t: 'Архимед', d: 'Ввели первые цифры числа Пи.' },
        'easter_hover_logo': { i: '🧘', t: 'Медитация', d: 'Смотрели в одну точку (шапку) 10 секунд.' },
        'easter_click_spam': { i: '⚡', t: 'Кликер', d: 'Слишком много кликов за 5 секунд.' },
        'easter_copy_paste': { i: '📋', t: 'Плагиат', d: 'Пытались скопировать МЭШ 10 раз.' },
        'easter_select_all': { i: '🟦', t: 'Выделить Всё', d: 'Случайно выделили всё 5 раз.' },
        'easter_type_666': { i: '😈', t: 'Изгоняющий', d: 'Вызвали сатану в журнале.' },

        // --- 35 ИНТЕРАКТИВНЫХ ПАСХАЛОК С АНИМАЦИЯМИ ---
        'easter_spin': { i: '🌀', t: 'Центрифуга', d: 'Кликнули по своей аватарке 3 раза.' },
        'easter_rainbow': { i: '🌈', t: 'Радужный МЭШ', d: 'Кликнули правой кнопкой по шапке 5 раз.' },
        'easter_gravity': { i: '🙃', t: 'Гравитация', d: 'Двойной клик по самому низу экрана слева.' },
        'easter_blur': { i: '👓', t: 'Где Очки?', d: 'Shift + Клик по любой дате в журнале.' },
        'easter_disco': { i: '🪩', t: 'Дискотека', d: 'Alt + Клик по любой кнопке.' },
        'easter_earthquake': { i: '🌋', t: 'Землетрясение', d: '3 раза кликнули колесиком по таблице.' },
        'easter_huge_cursor': { i: '🖱️', t: 'Гигантский Курсор', d: 'Замерли над таблицей на 10 сек.' },
        'easter_dark_souls': { i: '☠️', t: 'YOU DIED', d: 'Нажали Escape 3 раза подряд. МЭШ беспощаден.' },
        'easter_zoom_in': { i: '🔍', t: 'Лупа', d: 'Ctrl + Клик колесиком по элементу.' },
        'easter_invert': { i: '📸', t: 'Негатив', d: 'Кликнули правой кнопкой 5 раз в пустоту.' },
        'easter_flip': { i: '🪞', t: 'Зазеркалье', d: 'Очень быстро провели мышью влево-вправо-влево.' },
        'easter_matrix_rain': { i: '📟', t: 'Матрица', d: 'Нажали Ctrl+M 3 раза.' },
        'easter_invisible': { i: '🫥', t: 'Плащ-невидимка', d: 'Спрятали МЭШ уходом мыши за окно.' },
        'easter_bouncy': { i: '🪀', t: 'Батут', d: 'Резко дернули скролл вниз до упора.' },
        'easter_ghost': { i: '👻', t: 'Призрак', d: 'Зажали Alt и кликнули по имени ученика.' },
        'easter_slow_mo': { i: '🐌', t: 'Слоу-Мо', d: 'Нажали Shift + Space. Время замедлилось.' },
        'easter_dvd': { i: '📀', t: 'Ностальгия', d: 'Кликнули 10 раз в левом верхнем углу (как логотип DVD).' },
        'easter_marquee': { i: '🏃', t: 'Бегущая Строка', d: 'Alt + Клик по любому длинному тексту.' },
        'easter_comic_sans': { i: '🤡', t: 'Комик Санс', d: 'Ctrl + Shift + Клик по шапке.' },
        'easter_neon': { i: '🏮', t: 'Киберпанк', d: 'Кликнули по верхней панели МЭШ 7 раз.' },
        'easter_circle': { i: '⭕', t: 'Круговорот', d: 'Нарисовали мышью ровный круг.' },
        'easter_rage': { i: '🤬', t: 'Ярость', d: 'Кликнули в одну и ту же ячейку 5 раз подряд.' },
        'easter_hide_seek': { i: '🫣', t: 'Прятки', d: 'Увели мышь за пределы окна 5 раз.' },
        'easter_blackout': { i: '🔦', t: 'Выключение Света', d: 'Двойной клик в правом нижнем углу.' },
        'easter_pixelate': { i: '👾', t: 'Пиксели', d: 'Двойной клик по любому тексту со словом "оценка".' },
        'easter_wavy': { i: '🌊', t: 'Шторм', d: 'Shift + наведение на боковое меню.' },
        'easter_jump_btn': { i: '🐸', t: 'Поймай Меня', d: 'Попытались нажать кнопку с зажатым Shift.' },
        'easter_party': { i: '🎉', t: 'Вечеринка', d: 'Нажали Enter 10 раз подряд.' },
        'easter_glitch': { i: '📺', t: 'Глитч', d: 'Зажали левую и правую кнопку мыши одновременно.' },
        'easter_mirror': { i: '🪞', t: 'Отражение', d: 'Потянули мышь с левого края вправо.' },
        'easter_fall': { i: '🍂', t: 'Листопад', d: 'Кликнули в самый низ страницы 5 раз.' },
        'easter_helicopter': { i: '🚁', t: 'Вертолет', d: 'Крутили мышью по кругу быстро.' },
        'easter_snow': { i: '❄️', t: 'Снегопад', d: 'Нажали Ctrl+Shift+S.' },
        'easter_thanos': { i: '🫰', t: 'Щелчок Таноса', d: 'МЭШ уполовинился.' },
        'easter_hacker_typer': { i: '💻', t: 'Мамкин Хакер', d: 'Слишком быстро печатали текст.' },

        'absolute_god': { i: '♾️', t: 'Абсолют', d: 'Собрали ВСЕ достижения. Вы прошли МЭШ на 100%.' }
    };

    function showVaporwaveToast(badge) {
        let container = document.getElementById('mesh-vw-toast-container');
        if (!container) {
            container = document.createElement('div'); container.id = 'mesh-vw-toast-container';
            container.style.cssText = 'position:fixed; bottom:30px; right:30px; z-index:9999999; display:flex; flex-direction:column; gap:15px; pointer-events:none;';
            document.body.appendChild(container);
        }
        const toast = document.createElement('div');
        toast.style.cssText = `background: linear-gradient(135deg, #2b1055 0%, #7597de 100%); border: 2px solid #ff71ce; box-shadow: 0 0 10px #ff71ce, 0 0 20px #01cdfe, inset 0 0 15px rgba(1, 205, 254, 0.3); color: #fff; padding: 15px 20px; border-radius: 4px; display: flex; align-items: center; gap: 15px; transform: translateX(150%); transition: transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275); font-family: 'Courier New', monospace; min-width: 280px; position: relative; overflow: hidden;`;
        const scanlines = `<div style="position:absolute; top:0; left:0; right:0; bottom:0; background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06)); background-size: 100% 2px, 3px 100%; pointer-events:none;"></div>`;
        toast.innerHTML = scanlines + `<div style="font-size: 36px; filter: drop-shadow(0 0 8px #01cdfe); z-index:2;">${badge.i}</div><div style="display: flex; flex-direction: column; z-index:2;"><span style="font-size: 10px; color: #b967ff; font-weight: bold; text-shadow: 0 0 3px #b967ff; letter-spacing: 2px;">ACHIEVEMENT UNLOCKED</span><span style="font-size: 16px; font-weight: bold; color: #01cdfe; text-shadow: 0 0 5px #01cdfe; margin-bottom: 4px; letter-spacing: 1px; text-transform: uppercase;">${badge.t}</span><span style="font-size: 11px; color: #ffeb3b; line-height: 1.3;">${badge.d}</span></div>`;
        container.appendChild(toast);
        requestAnimationFrame(() => toast.style.transform = 'translateX(0)');
        setTimeout(() => { toast.style.transform = 'translateX(150%)'; setTimeout(() => toast.remove(), 600); }, 6000);
    }

    async function unlockBadge(badgeId) {
        if (!stats.unlocked[badgeId] && BADGES[badgeId]) {
            stats.unlocked[badgeId] = new Date().toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); 
            await saveStats(); showVaporwaveToast(BADGES[badgeId]);
            let count = Object.keys(stats.unlocked).length;
            if (count === 10) await unlockBadge('ambassador');
            if (count === 50) await unlockBadge('collector');
            if (count === 75) await unlockBadge('hoarder');
            if (count === 100) await unlockBadge('century_club');
            if (count === 120) await unlockBadge('completionist');
            if (count === Object.keys(BADGES).length - 1) await unlockBadge('absolute_god'); 
        }
    }

    function checkTimeBased() {
        // ... (код проверки времени остался без изменений)
        const d = new Date(); const h = d.getHours(); const m = d.getMonth() + 1; const day = d.getDay(); const date = d.getDate(); const mins = d.getMinutes();
        if (h === 11 && mins === 11) unlockBadge('make_a_wish');
        if (h === 23 && mins === 59) unlockBadge('cinderella');
        if (h >= 0 && h < 4) unlockBadge('owl');
        if (h >= 2 && h < 3) unlockBadge('vampire');
        if (h === 0) unlockBadge('nightmare');
        if (h >= 5 && h < 6) unlockBadge('sunrise');
        if (h >= 4 && h < 7) unlockBadge('early_bird');
        if (h >= 13 && h < 14) unlockBadge('lunch_break');
        if (h === 17) unlockBadge('tea_time');
        if (h >= 20) unlockBadge('overtime');
        if (day === 1 && h >= 8 && h <= 10) unlockBadge('monday');
        if (day === 0 || day === 6) unlockBadge('weekend_warrior');
        if (day === 5 && h >= 18) unlockBadge('friday_party');
        if (day === 5 && date === 13) unlockBadge('lucky_13');
        if (m === 1 && date <= 8) unlockBadge('grinch');
        if (m === 1 && date === 25) unlockBadge('student_day');
        if (m === 2 && date === 14) unlockBadge('valentines');
        if (m === 2 && date === 23) unlockBadge('defender');
        if (m === 2 && date === 29) unlockBadge('leap_year');
        if (m === 3 && date === 8) unlockBadge('womens_day');
        if (m === 3 && date === 14) unlockBadge('pi_day');
        if (m === 3 && date === 15) unlockBadge('ides_of_march');
        if (m === 3 || m === 4) unlockBadge('spring');
        if (m === 4 && date === 1) unlockBadge('fool');
        if (m === 4 && date === 12) unlockBadge('cosmonaut');
        if (m === 5 && date === 1) unlockBadge('labor_day');
        if (m === 5 && date === 4) unlockBadge('star_wars');
        if (m === 5 && date === 9) unlockBadge('victory');
        if (m === 5 && date <= 10) unlockBadge('may_bugs');
        if (m === 5 && date === 25) unlockBadge('last_bell');
        if (m === 6 && date === 21) unlockBadge('longest_day');
        if (m === 6 || m === 7 || m === 8) unlockBadge('summer');
        if (m === 9 && date === 1) unlockBadge('knowledge');
        if (m === 9) unlockBadge('autumn');
        if (m === 10 && date === 5) unlockBadge('teachers_day');
        if (m === 10 && date === 31) unlockBadge('halloween');
        if (m === 11 && date === 11) unlockBadge('sales_day');
        if (m === 12 && date === 1) unlockBadge('winter_is_coming');
        if (m === 12 && date === 21) unlockBadge('darkest_night');
        if (m === 12) unlockBadge('santa');
        if (m === 12 && date === 31) unlockBadge('new_year');
        
        const dateStr = d.toDateString();
        if (stats.lastDate !== dateStr) { 
            let lastD = new Date(stats.lastDate);
            let diffDays = Math.round((d - lastD) / (1000 * 60 * 60 * 24));
            if (diffDays === 1) stats.streak++; else stats.streak = 1;
            stats.totalDays++; stats.lastDate = dateStr; saveStats(); 
        }
        if (stats.streak >= 5) unlockBadge('streak_5');
        if (stats.streak >= 10) unlockBadge('streak_10');
        if (stats.streak >= 30) unlockBadge('streak_30');
        if (stats.totalDays >= 30) unlockBadge('veteran');
        if (stats.totalDays >= 100) unlockBadge('hundred_days');
        if (stats.totalDays >= 180) unlockBadge('half_year');
    }

    function checkTableBased() {
        if (!window.location.href.includes('journal')) return;
        setTimeout(() => {
            const cells = document.querySelectorAll('td, [role="gridcell"]');
            if (cells.length < 30) return;
            let hCount = 0; let bCount = 0;
            cells.forEach(c => { 
                let t = c.innerText.trim().toUpperCase();
                if (t === 'Н') hCount++; 
                if (t === 'Б' || t === 'У' || t === 'П') bCount++; 
            });
            if (hCount === 0) unlockBadge('flawless');
            if (hCount === 1 && bCount === 1) unlockBadge('perfect_balance');
            if (hCount >= 10) unlockBadge('plague');
            if (hCount >= 20 && bCount >= 20) unlockBadge('quarantine');
            if (hCount >= 30) unlockBadge('ghost_town');
            if (hCount >= 50) unlockBadge('apocalypse');
            if (bCount >= 20) unlockBadge('hospital');
        }, 3000);
    }

    let spyPanelCount = 0; let spyLogCount = 0; let archClearCount = 0;
    function checkFeatures() {
        if (window.location.href.includes('planning')) unlockBadge('ktp_master');
        let archRules = localStorage.getItem('MESH_ARCHITECT_RULES');
        if (archRules) {
            unlockBadge('architect');
            if (archRules.length > 50) unlockBadge('picasso');
            if (archRules.length > 200) unlockBadge('hacker');
        }
        if (sessionStorage.getItem('MESH_SPY_ENABLED') === 'true') {
            unlockBadge('spy');
            if (document.getElementById('mesh-spy-panel')) { spyPanelCount++; if (spyPanelCount >= 10) unlockBadge('paranoid'); }
        }
        try { chrome.storage.sync.get(['speedUp'], (data) => { if (data.speedUp) unlockBadge('turbo'); }); } catch(e) {}
        const activeToggles = document.querySelectorAll('.ant-radio-button-wrapper-checked');
        for (let toggle of activeToggles) { if ((toggle.innerText || '').toLowerCase().includes('отсутстви')) unlockBadge('absence_mode'); }
    }

    let dossierCount = 0; let undoCount = 0; let emptyClicks = 0;
    document.addEventListener('click', (e) => {
        if (e.target.id === 'mesh-pdf-btn') {
            unlockBadge('pdf_dossier'); dossierCount++;
            if(dossierCount >= 5) unlockBadge('inspector');
        }
        if (e.target.id === 'mesh-cp-start') unlockBadge('col_picker');
        if (e.target.closest && e.target.closest('.api-success-badge[title*="удалить"]')) {
            unlockBadge('undo_master'); undoCount++; if(undoCount >= 5) unlockBadge('undo_spam');
        }
        if (e.altKey && e.target.closest('[data-test-component*="markCell"]')) {
            unlockBadge('alt_eraser'); 
            stats.altEraseCount++; saveStats();
            if(stats.altEraseCount >= 10) unlockBadge('ninja_eraser');
            undoCount++; if(undoCount >= 5) unlockBadge('undo_spam');
        }
        if (e.target.tagName === 'BODY' || e.target.tagName === 'MAIN' || e.target.classList.contains('ant-layout-content')) {
            emptyClicks++; if(emptyClicks >= 20) unlockBadge('misclick_master');
        }
        if (e.target.innerText === '💾 Скачать') {
            spyLogCount++; if(spyLogCount >= 5) unlockBadge('data_miner');
        }
        if (e.target.id === 'mesh-arch-clear-all') {
            archClearCount++; if(archClearCount >= 3) unlockBadge('destroyer_of_worlds');
        }
        if (e.target.innerText && e.target.innerText.includes('ZIP архив')) {
            unlockBadge('zip_master');
            unlockBadge('excel_export');
        }
        // Easter egg
        if (e.target.closest && e.target.closest('.ant-layout-header')) {
            stats.logoClicks = (stats.logoClicks || 0) + 1;
            if (stats.logoClicks >= 10) unlockBadge('easter_egg');
        }
    });

    document.addEventListener('change', (e) => {
        if (e.target.id === 'mesh-global-weight') { stats.weightSwaps++; if(stats.weightSwaps >= 5) unlockBadge('indecisive_weight'); }
    });

    let sessionGrades = 0; let recentGrades = []; let speedTracker = []; let nightGrades = 0;
    function processNewGrade(gradeText) {
        stats.totalGrades++; sessionGrades++; saveStats();
        
        let h = new Date().getHours();
        if(h >= 0 && h < 4) { nightGrades++; if(nightGrades >= 50) unlockBadge('night_owl'); if(nightGrades >= 100) unlockBadge('vampire_lord'); }

        speedTracker.push(Date.now());
        if (speedTracker.length > 10) speedTracker.shift();
        if (speedTracker.length >= 5 && (speedTracker[speedTracker.length-1] - speedTracker[speedTracker.length-5] < 1000)) unlockBadge('machine_learning');
        if (speedTracker.length >= 5 && (speedTracker[speedTracker.length-1] - speedTracker[speedTracker.length-5] < 3000)) unlockBadge('fast_fingers');
        if (speedTracker.length === 10 && (speedTracker[9] - speedTracker[0] < 10000)) unlockBadge('speed_demon');

        if (stats.totalGrades >= 1) unlockBadge('first_blood');
        if (stats.totalGrades >= 10) unlockBadge('novice');
        if (stats.totalGrades >= 50) unlockBadge('pro');
        if (stats.totalGrades >= 100) unlockBadge('terminator');
        if (stats.totalGrades >= 500) unlockBadge('god');
        if (stats.totalGrades >= 1000) unlockBadge('cyborg');
        if (stats.totalGrades >= 5000) unlockBadge('matrix');
        if (stats.totalGrades >= 9000) unlockBadge('over_9000');
        if (stats.totalGrades >= 10000) unlockBadge('ten_k');
        if (stats.totalGrades >= 50000) unlockBadge('fifty_k');
        if (stats.totalGrades === 777) unlockBadge('three_axes');
        if (stats.totalGrades === 666) unlockBadge('devil');

        if (sessionGrades === 7) unlockBadge('lucky_seven');
        if (sessionGrades === 15) unlockBadge('sniper');
        if (sessionGrades === 21) unlockBadge('blackjack');
        if (sessionGrades === 30) unlockBadge('machine_gun');
        if (sessionGrades === 42) unlockBadge('answer_to_everything');
        if (sessionGrades === 69) unlockBadge('nice');
        if (sessionGrades === 77) unlockBadge('slevin');
        if (sessionGrades === 99) unlockBadge('almost_there');
        if (sessionGrades === 100) unlockBadge('centurion');
        if (sessionGrades === 500) unlockBadge('half_k');

        const val = parseInt(gradeText.replace(/[^\d]/g, ''));
        if (!isNaN(val)) {
            recentGrades.push(val); if (recentGrades.length > 10) recentGrades.shift();
            
            let fivesCount = recentGrades.filter(g => g === 5).length;
            let twosCount = recentGrades.filter(g => g === 2).length;
            
            if (sessionGrades >= 50 && fivesCount >= 50) unlockBadge('generous'); 
            if (sessionGrades >= 20 && twosCount >= 20) unlockBadge('ruthless');
            if (sessionGrades >= 30 && fivesCount >= 30) unlockBadge('rain_of_fives'); 
            if (sessionGrades >= 15 && twosCount >= 15) unlockBadge('rain_of_twos');
            
            const last3 = recentGrades.slice(-3); const last4 = recentGrades.slice(-4); const last5 = recentGrades.slice(-5); const last6 = recentGrades.slice(-6); const last10 = recentGrades.slice(-10);
            
            if (last3.every(g => g === 2) && last3.length === 3) unlockBadge('executioner');
            if (last10.every(g => g === 2) && last10.length === 10) unlockBadge('massacre');
            if (last3.every(g => g === 3) && last3.length === 3) unlockBadge('hater');
            if (last10.every(g => g === 3) && last10.length === 10) unlockBadge('stability');
            if (last5.every(g => g === 4) && last5.length === 5) unlockBadge('lover');
            if (last5.every(g => g === 5) && last5.length === 5) unlockBadge('good_cop');
            if (last10.every(g => g === 5) && last10.length === 10) unlockBadge('santa_claus');
            
            if (last4.join('') === '2345') unlockBadge('straight_flush');
            if (last4.join('') === '5432') unlockBadge('stairway_down');
            if (last4.join('') === '5252') unlockBadge('rollercoaster');
            
            if (last6.join('') === '545454' || last6.join('') === '454545') unlockBadge('zebra');
            if (last6.join('') === '323232' || last6.join('') === '232323') unlockBadge('bad_zebra');
            
            if (recentGrades.length >= 2 && recentGrades[recentGrades.length-2] === 2 && val === 5) unlockBadge('combo_breaker');
        }

        let gMode = document.getElementById('mesh-global-grade');
        if (gMode && gMode.value === '5') unlockBadge('all_5');
        if (gMode && gMode.value === '4') unlockBadge('all_4');
        if (gMode && gMode.value === '3') unlockBadge('all_3');
        if (gMode && gMode.value === '2') unlockBadge('all_2');
        let wMode = document.getElementById('mesh-global-weight');
        if (wMode && wMode.value === '1') unlockBadge('weight_1');
        if (wMode && wMode.value === '2') unlockBadge('symbiote');
    }

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((m) => {
            m.addedNodes.forEach(node => {
                if (node.nodeType === 1 && node.classList) {
                    if (node.classList.contains('api-success-badge') && node.innerText.includes('✅')) processNewGrade(node.innerText);
                    if (node.innerText.includes('🗑️')) unlockBadge('undo_master');
                }
            });
        });
    });

    let idleTimer; let deepIdleTimer; let idleCount = 0;
    function resetIdle() {
        clearTimeout(idleTimer); clearTimeout(deepIdleTimer);
        idleTimer = setTimeout(() => { unlockBadge('coffee'); idleCount++; if(idleCount >= 3) unlockBadge('coffee_addict'); }, 15 * 60 * 1000); 
        deepIdleTimer = setTimeout(() => { unlockBadge('hibernation'); }, 60 * 60 * 1000);
    }
    document.addEventListener('mousemove', resetIdle); document.addEventListener('keypress', resetIdle);

    setTimeout(() => unlockBadge('marathon'), 30 * 60 * 1000); 
    setTimeout(() => {
        checkTimeBased(); checkTableBased(); checkFeatures(); resetIdle();
        observer.observe(document.body, { childList: true, subtree: true });
        document.addEventListener('SpeedmeshDOMReady', checkFeatures);
    }, 2000);

    // ==========================================
    // ЛОГИКА ОТРИСОВКИ ЗАЛА СЛАВЫ ПОВЕРХ МЭШ
    // ==========================================
    chrome.runtime.onMessage.addListener((req) => {
        if (req.action === 'showTrophies') {
            showHallOfFameModal();
        }
    });

    function showHallOfFameModal() {
        if (document.getElementById('mesh-hof-modal')) return;
        
        const overlay = document.createElement('div');
        overlay.id = 'mesh-hof-modal';
        overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,15,27,0.85); backdrop-filter:blur(5px); z-index:9999999; display:flex; justify-content:center; align-items:center;';
        
        const modal = document.createElement('div');
        modal.style.cssText = 'background:#111; border:2px solid #01cdfe; box-shadow:0 0 20px #01cdfe; border-radius:12px; width:80%; max-width:850px; max-height:85vh; display:flex; flex-direction:column; color:white; font-family:"Courier New", monospace;';
        
        const header = document.createElement('div');
        header.style.cssText = 'padding:20px; border-bottom:1px solid #333; display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.5); border-radius:12px 12px 0 0;';
        
        const count = Object.keys(stats.unlocked).length;
        const total = Object.keys(BADGES).length;
        
        header.innerHTML = `
            <div>
                <h2 style="margin:0; color:#ff71ce; text-shadow:0 0 10px #ff71ce; text-transform:uppercase; font-size: 28px;">🏆 Зал Славы МЭШ</h2>
                <div style="font-size:14px; color:#05ffa1; margin-top:8px;">Открыто: ${count} из ${total} | Выставлено авто-оценок: ${stats.totalGrades}</div>
            </div>
            <div style="display:flex; gap:15px; align-items:center;">
                <button id="mesh-hof-reset" style="background:rgba(255,0,0,0.1); border:1px solid #ff71ce; color:#ff71ce; padding:6px 12px; border-radius:6px; cursor:pointer; font-family:'Courier New', monospace; font-weight:bold; transition:0.2s; box-shadow:0 0 5px rgba(255,113,206,0.3);" onmouseover="this.style.background='#ff71ce'; this.style.color='#000'; this.style.boxShadow='0 0 15px #ff71ce';" onmouseout="this.style.background='rgba(255,0,0,0.1)'; this.style.color='#ff71ce'; this.style.boxShadow='0 0 5px rgba(255,113,206,0.3)';">СБРОС ⚠️</button>
                <button id="mesh-hof-close" style="background:transparent; border:none; color:#ff71ce; font-size:30px; cursor:pointer; font-weight:bold; transition:0.2s;" onmouseover="this.style.textShadow='0 0 10px #ff71ce'" onmouseout="this.style.textShadow='none'">✖</button>
            </div>
        `;
        
        const gridContainer = document.createElement('div');
        gridContainer.style.cssText = 'padding:25px; overflow-y:auto; display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:15px;';
        
        for (let key in BADGES) {
            let badge = BADGES[key];
            let isUnlocked = stats.unlocked[key];
            let card = document.createElement('div');
            
            card.style.cssText = `background:rgba(255,255,255,0.05); border:1px solid ${isUnlocked ? '#01cdfe' : '#333'}; border-radius:8px; padding:15px; text-align:center; transition:0.2s; box-shadow:${isUnlocked ? 'inset 0 0 10px rgba(1,205,254,0.2)' : 'none'}; opacity:${isUnlocked ? '1' : '0.5'}; display:flex; flex-direction:column; justify-content:center;`;
            
            if (isUnlocked) {
                card.onmouseover = () => { card.style.transform = 'scale(1.05)'; card.style.borderColor = '#ff71ce'; card.style.boxShadow = '0 0 15px #ff71ce'; };
                card.onmouseout = () => { card.style.transform = 'scale(1)'; card.style.borderColor = '#01cdfe'; card.style.boxShadow = 'inset 0 0 10px rgba(1,205,254,0.2)'; };
                
                card.onclick = () => {
                    // Анимация при клике
                    card.style.transform = 'scale(1.1) rotate(3deg)';
                    card.style.borderColor = '#05ffa1';
                    card.style.boxShadow = '0 0 20px #05ffa1';
                    setTimeout(() => { 
                        card.style.transform = 'scale(1.05)'; 
                        card.style.borderColor = '#ff71ce'; 
                        card.style.boxShadow = '0 0 15px #ff71ce'; 
                    }, 300);
                    
                    // Добавление даты, если её еще нет на карточке
                    if (!card.querySelector('.hof-date-badge')) {
                        let dateStr = typeof isUnlocked === 'string' ? isUnlocked : "Давно";
                        let dateB = document.createElement('div');
                        dateB.className = 'hof-date-badge';
                        dateB.innerHTML = `📅 ${dateStr}`;
                        dateB.style.cssText = "margin-top:10px; font-size:11px; color:#05ffa1; background:rgba(5,255,161,0.1); padding:5px; border-radius:4px; border:1px solid #05ffa1; opacity:0; transition:opacity 0.3s ease; letter-spacing:0px;";
                        card.appendChild(dateB);
                        // Запуск плавного появления
                        requestAnimationFrame(() => { dateB.style.opacity = '1'; });
                    }
                };
            }

            card.innerHTML = `
                <div style="font-size:42px; filter:${isUnlocked ? 'drop-shadow(0 0 10px #01cdfe)' : 'grayscale(100%) opacity(0.3)'}; margin-bottom:10px;">${isUnlocked ? badge.i : '❓'}</div>
                <div style="font-size:14px; font-weight:bold; color:${isUnlocked ? '#fff' : '#666'}; text-transform:uppercase; line-height:1.2;">${isUnlocked ? badge.t : 'Скрыто'}</div>
                <div style="font-size:11px; color:${isUnlocked ? '#aaa' : '#444'}; margin-top:8px; line-height:1.3;">${isUnlocked ? badge.d : 'Требования для получения неизвестны...'}</div>
            `;
            gridContainer.appendChild(card);
        }
        
        modal.appendChild(header);
        modal.appendChild(gridContainer);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        document.getElementById('mesh-hof-close').onclick = () => overlay.remove();
        
        let resetBtn = document.getElementById('mesh-hof-reset');
        if (resetBtn) {
            resetBtn.onclick = () => {
                if (confirm("🚨 ВНИМАНИЕ! Вы собираетесь сбросить весь прогресс (все оценки и достижения). Это действие необратимо. Продолжить?")) {
                    stats = { totalGrades: 0, totalDays: 0, lastDate: null, streak: 0, unlocked: {} };
                    saveStats();
                    overlay.remove();
                    showHallOfFameModal(); // Перерисовываем чистое окно
                }
            };
        }

        overlay.onclick = (e) => { if(e.target === overlay) overlay.remove(); };
    }

    // ==========================================
    // 35 ИНТЕРАКТИВНЫХ ПАСХАЛОК С АНИМАЦИЯМИ
    // ==========================================

    let rightClicks = 0; let mClicks = 0; let escs = 0; let enters = 0;
    let logoTimer = null; let hoverTimer = null; let clickTarget = null; let clickCount = 0;
    let outCount = 0;
    
    document.addEventListener('contextmenu', (e) => {
        if(e.clientY < 60) {
            rightClicks++;
            if(rightClicks >= 5) { unlockBadge('easter_rainbow'); rightClicks = 0; }
        } else {
            stats.rcEmpty = (stats.rcEmpty||0)+1;
            if(stats.rcEmpty >= 5) { unlockBadge('easter_invert'); stats.rcEmpty=0; }
        }
    });

    document.addEventListener('mousedown', (e) => {
        if(e.button === 1) { 
            if (e.target.closest('table') || e.target.closest('[role="grid"]')) {
                mClicks++;
                if(mClicks >= 3) { unlockBadge('easter_earthquake'); mClicks=0; }
            }
            if (e.ctrlKey) { unlockBadge('easter_zoom_in'); }
        }
        
        if (e.buttons === 3) { 
            unlockBadge('easter_glitch');
        }
        
        if (e.shiftKey && e.target.innerText && e.target.innerText.includes('.')) {
            unlockBadge('easter_blur');
        }
        
        if (e.altKey && e.target.tagName === 'BUTTON') {
            unlockBadge('easter_disco');
        }
        
        if (e.altKey && (e.target.innerText || '').length > 3) {
            unlockBadge('easter_marquee');
        }
        
        if (e.ctrlKey && e.shiftKey && e.clientY < 60) {
            unlockBadge('easter_comic_sans');
        }
    });
    
    document.addEventListener('click', (e) => {
        if (e.target === clickTarget) {
            clickCount++;
            if (clickCount >= 5) {
                unlockBadge('easter_rage');
                clickCount = 0;
            }
        } else { clickTarget = e.target; clickCount = 1; }
        
        if (e.clientY < 60 && clickCount >= 7) {
            unlockBadge('easter_neon');
        }
        
        if (e.clientX < 50 && e.clientY < 50 && clickCount >= 10) {
            unlockBadge('easter_dvd');
        }
        
        if (e.clientY > window.innerHeight - 50 && clickCount >= 5) {
            unlockBadge('easter_fall');
        }
        
        if (e.target.closest('.ant-avatar') || e.target.closest('[class*="avatar"]')) {
            stats.avaClicks = (stats.avaClicks||0)+1;
            if(stats.avaClicks >= 3) { unlockBadge('easter_spin'); stats.avaClicks=0; }
        }
        
        if (e.shiftKey && e.target.tagName === 'BUTTON') {
            unlockBadge('easter_jump_btn');
        }
    });
    
    document.addEventListener('dblclick', (e) => {
        if (e.clientY > window.innerHeight - 50 && e.clientX < window.innerWidth / 2) {
            unlockBadge('easter_gravity');
        }
        if (e.clientY > window.innerHeight - 50 && e.clientX > window.innerWidth / 2) {
            unlockBadge('easter_blackout');

        }
        if (e.target.innerText && e.target.innerText.toLowerCase().includes('оценка')) {
            unlockBadge('easter_pixelate');
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { 
            escs++; 
            if(escs >= 3) { 
                unlockBadge('easter_dark_souls'); 

                escs = 0;
            }
        } else escs = 0;
        
        if (e.key === 'Enter') { enters++; if(enters >= 10) { unlockBadge('easter_party'); enters = 0; } } else enters = 0;
        if (e.key.toLowerCase() === 'm' && e.ctrlKey) { stats.matrixC = (stats.matrixC||0)+1; if(stats.matrixC>=3) unlockBadge('easter_matrix_rain'); }
        if (e.key === ' ' && e.shiftKey) { unlockBadge('easter_slow_mo'); }
        if (e.key.toLowerCase() === 's' && e.ctrlKey && e.shiftKey) { unlockBadge('easter_snow'); }
    });

    let xHist = [];
    document.addEventListener('mousemove', (e) => {
        xHist.push(e.clientX);
        if(xHist.length > 20) xHist.shift();
        let dirs = 0;
        for(let i=2; i<xHist.length; i++) {
            if ((xHist[i-1]-xHist[i-2]) * (xHist[i]-xHist[i-1]) < -5000) dirs++;
        }
        if(dirs > 5) { unlockBadge('easter_flip'); xHist=[]; }
        
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(()=> { unlockBadge('easter_huge_cursor'); }, 10000);
    });
    
    document.addEventListener('mouseleave', () => {
        outCount++;
        if(outCount >= 5) { 
            unlockBadge('easter_invisible'); 

            outCount=0; 
        }
    });

})();