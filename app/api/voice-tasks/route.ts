import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { audioBase64, mimeType, profiles } = await request.json();
        const geminiKey = process.env.GEMINI_API_KEY;

        if (!geminiKey) {
            return NextResponse.json({ status: 'error', error: 'GEMINI_API_KEY not configured' }, { status: 500 });
        }

        const profileList = profiles.map((p: any) => `ID: ${p.id} | Имя: ${p.full_name} | Роль: ${p.role}`).join('\n');

        const prompt = `Ты - ИИ-маршрутизатор задач для портала школы. Твоя задача: внимательно прослушать прикрепленное аудиосообщение (голосовое поручение директора/руководителя) и разбить его на отдельные логические поручения (задачи). Постарайся 100% точно расслышать имена, так как я прикрепляю к сообщению список текущих сотрудников.

Доступные сотрудники (роли: director, teacher, admin, staff, etc):
${profileList}

Правила:
1. Выяви все поручения в аудиосообщении. Одно поручение = один объект в массиве.
2. Для каждого поручения определи Исполнителя, сравнив услышанные имена или должности со списком Доступных сотрудников с учетом возможных опечаток, сокращений или синонимов (например "Айбеку" -> Айбек, "Завхоз" -> Слесарь или кто-то ответственный за здание).
3. Если точный профиль не найден, оставь targetTeacherId = null и напиши "Не найден" в assignedTo.
4. КРИТИЧЕСКИ ВАЖНО: Если ты вообще не слышишь голоса (тишина/помехи) или не можешь выявить ни одного поручения из сказанного, верни массив с одним объектом: { "taskName": "Ошибка распознавания", "description": "Голос не распознан или поручений не найдено. Пожалуйста, повторите.", "assignedTo": "Не найден", "targetTeacherId": null, "confidence": 0 }

Твоя задача — вернуть строго JSON-массив! Никакого лишнего текста!
Формат возвращаемого JSON:
[
  {
    "taskName": "Краткое название поручения",
    "description": "Полная суть",
    "assignedTo": "Имя Фамилия исполнителя (или 'Не найден')",
    "targetTeacherId": "UUID исполнителя из списка (или null)",
    "confidence": 0.95
  }
]`;

        // Убираем префикс data:audio/webm;base64, если он есть
        const base64Data = audioBase64.includes(',') ? audioBase64.split(',')[1] : audioBase64;
        
        // Очищаем mimeType (Gemini API упадет с 400 Bad Request если передать параметры вроде "audio/mp4; codecs=mp4a")
        const cleanMimeType = (mimeType || 'audio/mp4').split(';')[0];

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
               contents: [{ 
                   parts: [
                       { text: prompt },
                       { inlineData: { mimeType: cleanMimeType, data: base64Data } }
                   ] 
               }],
               generationConfig: {
                   response_mime_type: "application/json"
               }
            })
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error("Gemini Error:", errText);
            throw new Error(`Gemini API error: ${errText}`);
        }

        const data = await res.json();
        const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!aiText) throw new Error("Empty response from AI");

        // The response format strictly enforced by Gemini when set to application/json
        let cleanAiText = aiText.trim();
        if (cleanAiText.startsWith('\`\`\`')) {
            cleanAiText = cleanAiText.replace(/^\`\`\`(json)?\n?/i, '').replace(/\n?\`\`\`$/i, '').trim();
        }
        
        let parsedArray;
        try {
            parsedArray = JSON.parse(cleanAiText);
        } catch (parseError) {
            console.error("JSON Parse Error:", parseError, "Raw Text:", aiText);
            throw new Error("Failed to parse JSON from AI response");
        }
        
        return NextResponse.json({ status: 'success', tasks: Array.isArray(parsedArray) ? parsedArray : [parsedArray] });
        
    } catch (e: any) {
        console.error("Voice Route Error: ", e);
        return NextResponse.json({ status: 'error', error: e.message }, { status: 500 });
    }
}
