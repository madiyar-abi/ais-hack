import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateAttendanceReport } from '../../../utils/attendance';

export async function GET(request: Request) {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data: allMessages } = await supabase.from('messages').select('*').order('timestamp', { ascending: false });
        const attendanceMessages = (allMessages || []).filter(msg => msg.urgency_level === 1);

        const { totalAbsent, groups } = generateAttendanceReport(attendanceMessages);

        const botUrl = process.env.WHATSAPP_BOT_URL || 'http://localhost:3001/send-message';
        const groupId = process.env.WHATSAPP_ATTENDANCE_GROUP_ID || '120363433079394966@g.us';

        let summaryText = `📋 *АВТОМАТИЗИРОВАННАЯ СВОДКА ПИТАНИЯ (09:00)*\n_Кому: Завстоловой_\n\n\`\`\`json\n`;
        
        const jsonData = {
           "Отчет": "Утренний срез посещаемости",
           "Время": "09:00",
           "Всего_порций": 0,
           "Отсутствуют": totalAbsent,
           "Детализация": [] as any[]
        };

        let allSchoolPresent = 0;
        groups.forEach(group => {
           const groupTotalPresent = group.data.reduce((sum: number, r: any) => sum + r.presentCount, 0);
           const groupTotalAbsent = group.data.reduce((sum: number, r: any) => sum + r.absentCount, 0);
           allSchoolPresent += groupTotalPresent;
           
           const sickClasses = group.data.filter((r: any) => r.absentCount > 0);
           jsonData["Детализация"].push({
               "Блок": group.title,
               "Порции": groupTotalPresent,
               "Снято_с_питания": groupTotalAbsent,
               "Болеющие_классы": sickClasses.map((r: any) => `${r.className} (${r.absentCount})`)
           });
        });
        
        jsonData["Всего_порций"] = allSchoolPresent;
        
        summaryText += JSON.stringify(jsonData, null, 2);
        summaryText += `\n\`\`\`\n\n✅ Сгенерировано автоматически. *Всего: ${allSchoolPresent} порций. Отсутствуют: ${totalAbsent}*. Данные отправлены в столовую и директору.`;

        const res = await fetch(botUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ groupId, text: summaryText })
        });
        
        if (!res.ok) throw new Error('Bot response not OK');

        return NextResponse.json({ status: 'success', sent: true });
    } catch (e: any) {
        return NextResponse.json({ status: 'error', error: e.message }, { status: 500 });
    }
}
