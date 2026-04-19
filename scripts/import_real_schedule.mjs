import xlsx from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // or service role key if needed for profile insert, but anon key with disabled RLS should work
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const filePath = './для хакатона расписание.xlsx';

async function importRealSchedule() {
  console.log('1. Loading existing teachers from Supabase...');
  const { data: profiles, error } = await supabase.from('profiles').select('id, full_name').eq('role', 'teacher');
  
  const teacherMap = {};
  for (const p of profiles) {
    const lastName = p.full_name.split(' ')[0].toLowerCase().trim();
    teacherMap[lastName] = p.id;
  }
  
  // Custom manual mappings for those spelled differently or missing
  const manualMappingNames = [
    { search: 'таукенова', full: 'Таукенова Г.З.' },
    { search: 'касимов', full: 'Касимов Е.К.' },
    { search: 'саламатұлы', full: 'Саламатұлы А.' },
    { search: 'қайржанова', full: 'Қайыржанова Аружан' },
    { search: 'бақтыгулов', full: 'Бактыгулов Аманжол' },
    { search: 'алимбекова', full: 'Алимбекова У.С.' },
    { search: 'курмангалиев', full: 'Курмангалиев Е.К.' },
    { search: 'косов', full: 'Косов М.' },
    { search: 'мұрат', full: 'Мұрат Ә.' },
    { search: 'қыдырбаева', full: 'Қыдырбаева Г.' }
  ];

  // Helper to ensure teacher exists
  async function ensureTeacher(searchKey, fullName) {
      if (teacherMap[searchKey]) return teacherMap[searchKey];
      
      // Auto-insert missing teacher!
      console.log(`[Auto-Create] Учитель не найден: ${fullName}. Создаю профиль...`);
      const { data, error } = await supabase.from('profiles').insert({
          role: 'teacher',
          full_name: fullName,
          specialty: 'Приглашенный/Новый Учитель'
      }).select('id').single();
      
      if (data) {
          teacherMap[searchKey] = data.id;
          return data.id;
      }
      return null;
  }

  // Pre-seed known missing ones
  for (const m of manualMappingNames) {
      if (!teacherMap[m.search] && m.search !== 'қайржанова' && m.search !== 'бақтыгулов') {
          await ensureTeacher(m.search, m.full);
      }
  }
  // Hardcode fix for typo
  teacherMap['қайржанова'] = teacherMap['қайыржанова'];
  teacherMap['бақтыгулов'] = teacherMap['бактыгулов'];


  console.log('2. Parsing Excel sheet...');
  const wb = xlsx.readFile(filePath);
  const ws = wb.Sheets['сабақ кестесі'];
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });

  const classCols = [];
  const headerRow = rows[3];
  for (let i = 2; i < headerRow.length; i += 2) {
      if (headerRow[i] && typeof headerRow[i] === 'string' && headerRow[i].match(/\d+[А-ЯA-ZB]/)) {
          classCols.push({ class_name: headerRow[i].trim(), subject_col: i, room_col: i + 1 });
      }
  }

  const dbRecords = [];
  let currentDay = 1; 

  const ignoredWords = ['үй', 'жұмысы', 'технопарк', 'таңғы', 'ас', 'тжб', 'бжб', 'ұбт', 'аәд', ' ', ''];

  for (let i = 4; i < rows.length; i++) {
     const row = rows[i];
     if (!row || row.length === 0) continue;

     if (row[0] && typeof row[0] === 'string' && (row[0].includes('Сейсенбі') || row[0].includes('Сәрсенбі') || row[0].includes('Бейсенбі') || row[0].includes('Жұма'))) {
         currentDay++;
         continue;
     }

     if (typeof row[1] === 'number') {
         const rawTimeSlot = (row[0] || '').toString().trim().replace(/\./g, ':');
         if (!rawTimeSlot) continue;

         for (const c of classCols) {
             const cellData = row[c.subject_col];
             let rawRoomData = row[c.room_col];
             
             if (cellData && typeof cellData === 'string' && cellData.trim().length > 2) {
                 const text = cellData.trim();
                 
                 // Skip homework and breaks
                 const firstWord = text.split(' ')[0].toLowerCase();
                 if (ignoredWords.includes(firstWord) || ignoredWords.includes(text.toLowerCase())) continue;

                 // COMPLEX LENTA SPLITTING (e.g., "География(Жадырасын Е)/ДЖТ(Балтабай Ж)")
                 let subLessons = [];
                 if (text.includes('/')) {
                     const parts = text.split('/');
                     const rooms = rawRoomData ? rawRoomData.toString().split('/') : [];
                     
                     for (let pIdx = 0; pIdx < parts.length; pIdx++) {
                         // Some parts might be comma separated inside the parens "Математика(ЖоламанМ, Даулетбаева С)"
                         const commaParts = parts[pIdx].split(',');
                         for (let cp of commaParts) {
                             subLessons.push({ text: cp, room: rooms[pIdx] || 'МультиКаб', originalSlot: parts[pIdx] });
                         }
                     }
                 } else {
                     // Even single slots might have commas
                     const commaParts = text.split(',');
                     for (let cp of commaParts) {
                        subLessons.push({ text: cp, room: rawRoomData || 'Каб. Не Указан', originalSlot: text });
                     }
                 }

                 for (const sl of subLessons) {
                     const parts = sl.text.trim().split(/[\s(]+/).map(p => p.replace(/[)]/g, '').trim());
                     let teacherId = null;

                     // Attempt to resolve teacher ID
                     for (const part of parts) {
                         const cleanPart = part.toLowerCase();
                         if (cleanPart.length > 2 && teacherMap[cleanPart]) {
                             teacherId = teacherMap[cleanPart];
                             break;
                         }
                     }
                     if (!teacherId && parts.length >= 2) {
                         const possibleLastName = parts[parts.length - 2].toLowerCase();
                         if (teacherMap[possibleLastName]) teacherId = teacherMap[possibleLastName];
                     }

                     if (teacherId) {
                         dbRecords.push({
                            teacher_id: teacherId,
                            class_name: c.class_name + ' – ' + (sl.text.length > 40 ? sl.text.substring(0, 40) + '...' : sl.text),
                            room_number: sl.room.toString().trim(),
                            time_slot: rawTimeSlot,
                            day_of_week: currentDay
                         });
                     }
                 }
             }
         }
     }
  }

  console.log(`Prepared ${dbRecords.length} accurate sub-lesson slots. Uploading to Supabase...`);
  await supabase.from('schedules').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  const CHUNK_SIZE = 500;
  for (let i = 0; i < dbRecords.length; i += CHUNK_SIZE) {
      const chunk = dbRecords.slice(i, i + CHUNK_SIZE);
      const { error } = await supabase.from('schedules').insert(chunk);
      if (error) console.error('Insert error:', error.message);
  }

  console.log('✅ Идеально! Парсинг "Лент" и недостающих учителей завершен.');
}

importRealSchedule();
