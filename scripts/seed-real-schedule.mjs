import fs from 'fs';
import xlsx from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const DAYS_KAZ = {
  'дүйсенбі': 1,
  'сейсенбі': 2,
  'сәрсенбі': 3,
  'бейсенбі': 4,
  'жұма': 5,
  'сенбі': 6
};

async function seedRealSchedules() {
  const filePath = './для хакатона расписание.xlsx';
  if (!fs.existsSync(filePath)) {
    console.error('Файл расписания не найден!');
    return;
  }

  const { data: profiles } = await supabase.from('profiles').select('id, full_name');
  if (!profiles) return console.log('Нет профилей в БД');

  // Утилита для поиска teacher_id по строке вида "Орыс тілі Гореева А.М."
  function findTeacherId(cellText) {
    if (!cellText || typeof cellText !== 'string') return null;
    const textLower = cellText.toLowerCase();
    
    // Ищем профиль, чья фамилия содержится в тексте
    for (const p of profiles) {
      const parts = p.full_name.toLowerCase().split(' ');
      const lastName = parts[0]; 
      // Если фамилия учителя из базы есть внутри строки расписания...
      if (lastName && lastName.length > 3 && textLower.includes(lastName)) {
        return p.id;
      }
      // Или если имя редкое
      if (parts[1] && parts[1].length > 4 && textLower.includes(parts[1])) {
        return p.id;
      }
    }
    return null;
  }

  const wb = xlsx.readFile(filePath);
  const sheet = wb.Sheets['сабақ кестесі'];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  // Маппинг колонок: индекс -> Класс
  const columnClasses = {};
  const headerRow = rows[3]; // 'Уақыт', '№', '7A', 'каб', ...
  for (let c = 2; c < headerRow.length; c++) {
    const val = String(headerRow[c] || '').trim();
    if (val && val !== 'каб' && val !== 'Уақыт' && val !== '№' && !val.includes('Уақыт')) {
      columnClasses[c] = val; // класс
      columnClasses[c + 1] = val + '_room'; // следующая колонка - это кабинет
      c++; // пропускаем следующую колонку 'каб'
    }
  }

  const dbRecords = [];
  let currentDay = 1;

  for (let i = 4; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    // Пытаемся найти день недели 'Дүйсенбі'
    if (typeof row[0] === 'string') {
      const dayLower = row[0].toLowerCase().trim();
      for (const [kazDay, indexDay] of Object.entries(DAYS_KAZ)) {
        if (dayLower.includes(kazDay)) {
          currentDay = indexDay;
          break;
        }
      }
    }

    const timeStr = row[0];
    const lessonNum = parseInt(row[1]);

    // Проверяем, что это строка с уроком (есть время типа 08.00-08.45 и номер урока)
    if (timeStr && typeof timeStr === 'string' && timeStr.includes('.') && lessonNum >= 1) {
      
      const timeSlot = timeStr.trim();
      
      // Итерируемся по известным колонкам классов
      for (const colIndexStr of Object.keys(columnClasses)) {
        const c = parseInt(colIndexStr);
        if (columnClasses[c].includes('_room')) continue; // Пропускаем колонки-кабинеты, будем брать их по [c+1]
        
        const className = columnClasses[c];
        const cellContent = row[c];
        const roomCellContent = row[c + 1] || row[c + 2]; // Иногда бывают пустые колонки
        
        if (cellContent && typeof cellContent === 'string') {
          // Разбиваем по '/' если там несколько групп (например англ подгруппы)
          const groups = cellContent.split('/');
          const rooms = typeof roomCellContent === 'string' ? roomCellContent.split('/') : [String(roomCellContent || '')];
          
          for (let g = 0; g < groups.length; g++) {
            const groupText = groups[g].trim();
            if (groupText.length > 3) {
               const teacherId = findTeacherId(groupText);
               if (teacherId) {
                 dbRecords.push({
                   teacher_id: teacherId,
                   class_name: className + ' (' + groupText.substring(0, 15) + '...)',
                   room_number: String(rooms[Math.min(g, rooms.length - 1)] || 'Н/Д'),
                   time_slot: timeSlot,
                   day_of_week: currentDay
                 });
               }
            }
          }
        }
      }
    }
  }

  console.log(`\nИз расписания распознано ${dbRecords.length} реальных уроков привязанных к учителям из нашей БД.`);
  
  if (dbRecords.length > 0) {
    // Чистим всё старое расписание
    await supabase.from('schedules').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    // Вставляем батчами
    const CHUNK_SIZE = 500;
    for (let i = 0; i < dbRecords.length; i += CHUNK_SIZE) {
      const chunk = dbRecords.slice(i, i + CHUNK_SIZE);
      const { error } = await supabase.from('schedules').insert(chunk);
      if (error) console.error('Ошибка вставки:', error.message);
    }
    console.log('✅ Реальное расписание успешно загружено в Supabase!');
  } else {
    console.log('⚠️ Уроки не найдены. Возможно, не совпали фамилии или формат Excel.');
  }
}

seedRealSchedules();
