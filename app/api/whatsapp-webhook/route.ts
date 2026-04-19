import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// 1. Инициализация Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const supabase = createClient(supabaseUrl, supabaseKey);

// Функция-заглушка для AI-фильтрации
// TODO: В будущем здесь будет вызов OpenAI/Gemini API для анализа текста и определения категории
// Основная функция AI-маршрутизации сообщений
// Генерирует ответ: Инцидент, Замена, Посещаемость или Обычное
// Генерирует ответ: Инцидент (3), Замена (2), Посещаемость (1), Обычное (0)
async function categorizeMessageAI(text: string, sender_name: string) {
    try {
        if (process.env.GEMINI_API_KEY) {
            const prompt = `Ты - школьный AI диспетчер. Проанализируй сообщение от пользователя с именем "${sender_name}": "${text}".
Ответь строго в формате JSON: {"categoryName": "Инцидент" | "Замена" | "Посещаемость" | "Обычное", "urgency_level": 0 | 1 | 2 | 3, "absentTeacherName": "Имя Фамилия или null"}.
Правила (3 главных сценария):
1. Если важный инцидент, ЧП, авария, жалоба, поломка ("сломалась парта") ИЛИ нарушение дисциплины (курение, вейп, драка, буллинг, срыв урока) -> categoryName="Инцидент", urgency_level=3.
2. Если учитель заболел, не прийдет или просит подменить его на уроке, либо пишет "не смогу провести", "не смогу прийти", "не получится прийти", "буду отсутствовать", "не буду" (в контексте урока/класса) → categoryName="Замена", urgency_level=2. Если это Замена, постарайся извлечь имя отсутствующего/заболевшего учителя из текста, либо используй имя отправителя (${sender_name}), если учитель пишет про себя.
3. Если классрук пишет отчет о посещаемости, указывая класс и сколько болеет/отсутствует, или что присутствуют все, или наоборот (напр: "В 7А 13 человек, 2 болеют", "В 11Б все присутствуют" или "7б никто не пришел") -> categoryName="Посещаемость", urgency_level=1.
Все остальное -> categoryName="Обычное", urgency_level=0.`;

            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });
            const data = await res.json();
            const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (aiText) {
                const match = aiText.match(/\{[\s\S]*?\}/);
                if (match) {
                    const parsed = JSON.parse(match[0]);
                    return { urgency_level: Number(parsed.urgency_level) || 0, categoryName: parsed.categoryName, absentTeacherName: parsed.absentTeacherName || null };
                }
            }
        }
    } catch (e) {
        console.error("Gemini API Error, falling back to smart local AI:", e);
    }

    const lowerText = text.toLowerCase();
    
    // Сценарий: Важный инцидент, поломка или нарушение дисциплины (3)
    if (lowerText.includes("срочно") || lowerText.includes("пожар") || lowerText.includes("потоп") || lowerText.includes("жалоба") || lowerText.includes("скандал") || lowerText.includes("сломал") || lowerText.includes("ремонт") || lowerText.includes("разби") || lowerText.includes("курил") || lowerText.includes("вейп") || lowerText.includes("драка") || lowerText.includes("мат") || lowerText.includes("сигарет") || lowerText.includes("наказа") || lowerText.includes("сорвал")) {
        return { urgency_level: 3, categoryName: "Инцидент" };
    }

    // Сценарий: Учитель просит замену (уровень 2)
    if (
        lowerText.includes("заболел") ||
        lowerText.includes("не приду") ||
        lowerText.includes("не смогу провести") ||
        lowerText.includes("не смогу провести") || // с мягким знаком
        lowerText.includes("не смогу прийти") ||
        lowerText.includes("не буду на") ||
        lowerText.includes("не получится") ||
        lowerText.includes("буду отсутствовать") ||
        lowerText.includes("заменит") ||
        lowerText.includes("температура") ||
        lowerText.includes("больничный") ||
        lowerText.includes("попрошу заменить") ||
        lowerText.includes("прошу заменить")
    ) {
        return { urgency_level: 2, categoryName: "Замена", absentTeacherName: null };
    }

    // Сценарий: Посещаемость (1)
    if (/\d+\s*[абвг]/i.test(lowerText) || /класс|отсутству|человек|присутству|присуству|на месте/i.test(lowerText)) {
        if (/болеет|болеют|отсутству|болею|присутству|присуству|на месте|никто не пришел|никто не пришёл/i.test(lowerText)) {
            return { urgency_level: 1, categoryName: "Посещаемость" };
        }
    }

    return { urgency_level: 0, categoryName: "Организационные вопросы", absentTeacherName: null };
}

// Новая функция ИИ для вычленения только нужных уроков на основании сообщения
async function filterScheduleAI(text: string, scheduleArray: any[]) {
    try {
        if (!process.env.GEMINI_API_KEY || scheduleArray.length === 0) return null;
        
        const days = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];
        
        // Группируем уроки по дням, чтобы пронумеровать их по порядку (1-й урок, 2-й урок и т.д.)
        const dailySchedules: Record<number, any[]> = {};
        scheduleArray.forEach(s => {
            if (!dailySchedules[s.day_of_week]) dailySchedules[s.day_of_week] = [];
            dailySchedules[s.day_of_week].push(s);
        });
        
        let scheduleText = '';
        Object.keys(dailySchedules).forEach(dayKey => {
            const dayNum = parseInt(dayKey);
            // Сортируем уроки внутри дня по времени, чтобы нумерация была логичной
            const lessons = dailySchedules[dayNum].sort((a, b) => a.time_slot.localeCompare(b.time_slot));
            lessons.forEach((s, index) => {
                const lessonSequenceNumber = index + 1; 
                scheduleText += `- ${days[s.day_of_week - 1] || 'День?!'} | ${lessonSequenceNumber} урок (${s.time_slot}) | ${s.class_name} | Каб. ${s.room_number}\n`;
            });
        });
        
        const prompt = `Учитель написал сообщение об отсутствии/замене: "${text}".
Его текущее расписание уроков в базе:
${scheduleText}

Задание: 
1. Проанализируй сообщение учителя и вытащи, НА КАКОЙ ИМЕННО УРОК (или уроки) он просит замену.
2. Верни ТОЛЬКО ту информацию, которую запросил учитель. 
3. Если он назвал конкретный урок (например "восьмой урок 7В"), выведи ТОЛЬКО ОДНУ строчку про этот 8-й урок. КАТЕГОРИЧЕСКИ ЗАПРЕЩАЕТСЯ выводить другие уроки 7В или всё остальное расписание!

Формат вывода:
- Если запрошенный урок ЕСТЬ в базе: \`- [День] | [Номер] урок ([Время]) | [Класс] | Каб. [Кабинет]\`
- Если запрошенного урока НЕТ в базе: \`- [День из сообщения] | [Запрошенный урок] (вне базы) | [Класс] | Кабинет не указан\`
- Если учитель пишет просто "заболел сегодня/завтра" (без указания классов) - только тогда верни все уроки на этот день.
Главное правило: Если просят один урок - верни ОДИН урок. Никакого мусора.`;

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await res.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
    } catch (e) {
        console.error("Gemini Filter Error:", e);
        return null;
    }
}

export async function POST(request: Request) {
    try {
        const incomingData = await request.json();

        // 2. Парсинг данных от провайдера WhatsApp 
        // Обратите внимание: ключи зависят от провайдера (GreenAPI, Wablas, Meta и т.д.)
        const text = incomingData?.text || incomingData?.message || incomingData?.body || "";
        const sender_phone = incomingData?.sender || incomingData?.phone || incomingData?.from || "";
        const sender_name = incomingData?.senderName || incomingData?.pushName || "Неизвестный";
        const message_timestamp = incomingData?.timestamp 
            ? new Date(incomingData.timestamp * 1000).toISOString() 
            : new Date().toISOString();

        console.log(`[Webhook] Получено сообщение от ${sender_name}: ${text}`);

        if (!text) {
            return NextResponse.json({ status: 'ignored', message: 'Empty text' }, { status: 200 });
        }

        let textToSave = text;
        
        // 4. Вызов функции AI-категоризации (теперь асинхронной, работает через Gemini или Fallback)
        const { urgency_level, categoryName, absentTeacherName } = await categorizeMessageAI(text, sender_name);
        
        // Поиск расписания отсутствующего учителя, если это Замена
        if (categoryName === 'Замена') {
            // Многоуровневый поиск имени: AI → регулярка из текста → отправитель
            let resolvedName = absentTeacherName && absentTeacherName !== "null" ? absentTeacherName : null;

            if (!resolvedName) {
                // Пытаемся вытащить фамилию из текста: "Я Байдирахманова ...", "Это Гореева ...", "меня зовут Иванов"
                const nameMatch = text.match(/(?:Я|я|это|меня зовут|пишет)\s+([А-ЯҐЄІЇа-яґєії]{4,})/u);
                if (nameMatch) resolvedName = nameMatch[1];
            }

            if (!resolvedName && sender_name && sender_name !== 'Неизвестный') {
                // Крайний случай: используем имя отправителя из WhatsApp
                resolvedName = sender_name.split(' ')[0];
            }

            if (resolvedName) {
                const searchName = resolvedName.split(' ')[0];
                const { data: profiles } = await supabase.from('profiles').select('id, full_name').ilike('full_name', `%${searchName}%`);
                
                if (profiles && profiles.length > 0) {
                    const targetTeacherId = profiles[0].id;

                    // 1. Определяем день и номер урока прямо из текста сообщения (не из БД!)
                    const textLower = text.toLowerCase();
                    
                    const dayMap: Record<string, number> = {
                        'понедель': 1, 'вторник': 2, 'вторни': 2,
                        'среда': 3, 'среду': 3, 'четверг': 4,
                        'пятница': 5, 'пятницу': 5, 'суббота': 6, 'субботу': 6
                    };
                    const lessonNumberMap: Record<string, number> = {
                        'перв': 1, '1-': 1, ' 1 ': 1, 'втор': 2, '2-': 2, ' 2 ': 2,
                        'трет': 3, '3-': 3, ' 3 ': 3, 'четвертый': 4, 'четверт': 4, '4-': 4, ' 4 ': 4,
                        'пятый': 5, 'пят': 5, '5-': 5, ' 5 ': 5,
                        'шест': 6, '6-': 6, ' 6 ': 6, 'седьмой': 7, 'седьм': 7, '7-': 7, ' 7 ': 7,
                        'восьм': 8, '8-': 8, ' 8 ': 8, 'девят': 9, '9-': 9, ' 9 ': 9,
                        'десят': 10, '10-': 10
                    };
                    
                    let targetDayNum: number | null = null;
                    for (const [key, val] of Object.entries(dayMap)) {
                        if (textLower.includes(key)) { targetDayNum = val; break; }
                    }

                    let targetLessonNum: number | null = null;
                    for (const [key, val] of Object.entries(lessonNumberMap)) {
                        if (textLower.includes(key)) { targetLessonNum = val; break; }
                    }

                    // 2. Загружаем расписание с фильтром по дню (если день известен)
                    let scheduleQuery = supabase.from('schedules').select('*').eq('teacher_id', targetTeacherId).order('time_slot', { ascending: true });
                    if (targetDayNum) scheduleQuery = scheduleQuery.eq('day_of_week', targetDayNum);
                    const { data: sch } = await scheduleQuery;

                    textToSave += `\n\n📌 *Уроки на замену (${profiles[0].full_name}):*\n`;

                    // 3. Извлекаем класс из текста (8C, 7В, 10А и т.д.)
                    // Паттерн: цифра + буква (латиница или кириллица, только 1 буква). Вместо \b используем границы пробелов/знаков пунктуации, так как \b не работает с кириллицей в JS.
                    const classMatch = text.match(/(?:^|[\s,."'])(\d{1,2})\s*([A-ZА-ЯҒҚҢӨҰҮІa-zа-яғқңөұүі]{1})(?=[\s,."']|$)/u);
                    const targetClass = classMatch ? `${classMatch[1]}${classMatch[2].toUpperCase()}` : null;

                    if (targetLessonNum && targetDayNum) {
                        // 3a. Самый точный сценарий: знаем день + номер урока
                        const dayLessons = (sch || []).sort((a: any, b: any) => a.time_slot.localeCompare(b.time_slot));
                        const foundLesson = dayLessons[targetLessonNum - 1];
                        
                        if (foundLesson) {
                            const dayNames = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];
                            textToSave += `- ${dayNames[foundLesson.day_of_week - 1]} | ${targetLessonNum} урок (${foundLesson.time_slot}) | ${foundLesson.class_name} | Каб. ${foundLesson.room_number}`;
                        } else {
                            const dayNames = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
                            const cabMatch = text.match(/(?:кабинет[е]?|каб\.?)\s*(\d{2,3})/i);
                            const cabNumber = cabMatch ? cabMatch[1] : 'уточните';
                            textToSave += `- ${dayNames[(targetDayNum || 1) - 1]} | ${targetLessonNum} урок (вне базы) | ${targetClass || '—'} | Каб. ${cabNumber}`;
                        }
                    } else if (targetClass && sch && sch.length > 0) {
                        // Нормализация гомоглифов Кирилица↔Латиница (А→A, В→B, С→C, Е→E и т.д.)
                        const normalizeClass = (s: string) => s
                            .replace(/\s/g, '').toUpperCase()
                            .replace(/А/g, 'A').replace(/В/g, 'B').replace(/С/g, 'C')
                            .replace(/Е/g, 'E').replace(/Н/g, 'H').replace(/К/g, 'K')
                            .replace(/М/g, 'M').replace(/О/g, 'O').replace(/Р/g, 'P')
                            .replace(/Т/g, 'T').replace(/Х/g, 'X');
                        
                        // 3b. Знаем класс (и день) — показываем только уроки этого класса
                        const dayNames = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];
                        const normTarget = normalizeClass(targetClass);
                        const classLessons = sch.filter((lesson: any) => {
                            const normLesson = normalizeClass(lesson.class_name || '');
                            return normLesson.startsWith(normTarget);
                        });
                        
                        if (classLessons.length > 0) {
                            classLessons.forEach((lesson: any) => {
                                textToSave += `- ${dayNames[lesson.day_of_week - 1]} | ${lesson.time_slot} | ${lesson.class_name} | Каб. ${lesson.room_number}\n`;
                            });
                        } else {
                            // Класс не найден в расписании — пишем из текста
                            const cabMatch = text.match(/(?:кабинет[е]?|каб\.?)\s*(\d{2,3})/i);
                            const cabNumber = cabMatch ? cabMatch[1] : 'уточните';
                            const dayNames2 = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
                            textToSave += `- ${dayNames2[(targetDayNum || 1) - 1]} | урок (вне базы) | ${targetClass} | Каб. ${cabNumber}`;
                        }
                    } else if (sch && sch.length > 0) {
                        // 3c. Только знаем день — показываем все уроки этого дня
                        const dayNames = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];
                        sch.forEach((lesson: any) => {
                            textToSave += `- ${dayNames[lesson.day_of_week - 1]} | ${lesson.time_slot} | ${lesson.class_name} | Каб. ${lesson.room_number}\n`;
                        });
                    } else {
                        textToSave += `— Расписание не найдено. Уточните детали.`;
                    }
                }
            }
        }

        // 4. Получаем ID категории из БД по имени
        // В реальном приложении лучше загрузить все категории при страте и держать в кэше
        const { data: categoryData } = await supabase
            .from('categories')
            .select('id')
            .eq('name', categoryName)
            .single();

        const category_id = categoryData?.id || null;

        // 5. Сохранение обработанного сообщения в БД Supabase
        const { error } = await supabase
            .from('messages')
            .insert([
                {
                    text: textToSave,
                    sender_phone,
                    sender_name,
                    timestamp: message_timestamp,
                    category_id,
                    is_read: false,
                    urgency_level,
                    assigned_to: null // Пока сообщение не взято в работу, оно не привязано к учителю
                }
            ]);

        if (error) {
            console.error('Ошибка сохранения в Supabase:', error);
            return NextResponse.json({ status: 'error', error: error.message }, { status: 500 });
        }

        // 6. Возврат 200 OK для провайдера WhatsApp (чтобы сообщения не дублировались)
        return NextResponse.json({ status: 'success' }, { status: 200 });

    } catch (error) {
        console.error('Ошибка сервера при обработке webhook:', error);
        return NextResponse.json({ status: 'error' }, { status: 500 });
    }
}