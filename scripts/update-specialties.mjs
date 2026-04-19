import xlsx from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load env manually — split only on first '=' to preserve values with '=' in them
const envFile = readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envFile.split('\n')) {
    const idx = line.indexOf('=');
    if (idx > 0) env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
}

const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL'];
const SUPABASE_KEY = env['SUPABASE_SERVICE_ROLE_KEY'] || env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 1. Читаем нагрузку учителей из Excel (с переносом имени на несколько строк)
const wb = xlsx.readFile('нагрузка учителей для хакатона 2025-2026.xlsx');
const data = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });

const excelMap = {}; // { "Нажмадинов Марат": "алгебра", ... }
let lastName = '';
for (const row of data) {
    const name = row[1];
    const subj = row[3];
    if (typeof name === 'string' && name.trim().length > 3) {
        lastName = name.trim();
    }
    if (lastName && typeof subj === 'string' && subj.trim().length > 2) {
        const s = subj.trim().toLowerCase();
        if (!s.includes('косымша') && !s.includes('қосымша') && !excelMap[lastName]) {
            excelMap[lastName] = subj.trim();
        }
    }
}
console.log(`📋 Прочитано из Excel: ${Object.keys(excelMap).length} учителей\n`);

// 2. Получаем всех учителей из БД
const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, full_name, specialty')
    .eq('role', 'teacher');

if (error) { console.error('❌ Ошибка загрузки профилей:', error); process.exit(1); }
console.log(`👥 Учителей в БД: ${profiles.length}\n`);

let updated = 0, notFound = 0;

for (const teacher of profiles) {
    const dbLastName = teacher.full_name?.split(' ')[0]?.toLowerCase().replace(/\./g, '') || '';
    
    // Ищем совпадение по фамилии (первое слово)
    let matchedSubject = null;
    for (const [excelName, subject] of Object.entries(excelMap)) {
        const excelLastName = excelName.split(' ')[0].toLowerCase().replace(/\./g, '');
        if (dbLastName.length > 3 && excelLastName === dbLastName) {
            matchedSubject = subject;
            break;
        }
    }

    if (matchedSubject) {
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ specialty: matchedSubject })
            .eq('id', teacher.id);

        if (updateError) {
            console.error(`  ❌ Ошибка обновления ${teacher.full_name}:`, updateError.message);
        } else {
            console.log(`  ✅ ${teacher.full_name} → ${matchedSubject}`);
            updated++;
        }
    } else {
        console.log(`  ⚠️  ${teacher.full_name} → не найден в Excel (оставляем как есть)`);
        notFound++;
    }
}

console.log(`\n✅ Обновлено: ${updated}, ⚠️  Не найдено в Excel: ${notFound}`);
