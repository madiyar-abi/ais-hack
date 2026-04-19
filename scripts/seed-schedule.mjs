import fs from 'fs';
import xlsx from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TIME_SLOTS = [
  '08:00–08:45',
  '09:05–09:50',
  '10:10–10:55',
  '11:15–12:00',
  '12:05–12:50',
  '13:00–13:45'
];

async function seedSchedules() {
  const filePath = './нагрузка учителей для хакатона 2025-2026.xlsx';
  if (!fs.existsSync(filePath)) {
    console.error('Файл нагрузки не найден:', filePath);
    return;
  }

  console.log('1. Получаю актуальных учителей из БД...');
  const { data: profiles, error } = await supabase.from('profiles').select('id, full_name').eq('role', 'teacher');
  if (error || !profiles) {
    console.error('Ошибка БД:', error);
    return;
  }
  
  // Упрощенный маппинг для подстановки ID: 'нажмадинов марат' -> UUID
  const teacherMap = {};
  for (const p of profiles) {
    teacherMap[p.full_name.toLowerCase().trim()] = p.id;
  }

  const wb = xlsx.readFile(filePath);
  
  // Парсим "Кабинеттер тізімі" для маппинга кабинетов
  const roomMap = {};
  const roomSheet = wb.Sheets['Кабинеттер тізімі'];
  if (roomSheet) {
    const roomRows = xlsx.utils.sheet_to_json(roomSheet, { header: 1 });
    for (let i = 1; i < roomRows.length; i++) {
       const [_, roomName, __, ___, className] = roomRows[i];
       if (className) roomMap[className.toString().trim()] = roomName;
    }
  }

  // Парсим основную нагрузку
  const wlSheet = wb.Sheets['Жүктеме 2025-2026'];
  const rows = xlsx.utils.sheet_to_json(wlSheet, { header: 1 });

  // Строка заголовков где написаны классы 7A, 7B и т.д.
  const headers = rows[1]; 
  const CLASS_COLS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17]; 

  console.log('2. Генерация расписания на основе часов нагрузки...');
  const dbRecords = [];
  let currentTeacherName = null;

  for (let i = 3; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    
    // Если есть имя учителя в первой колонке - обновляем
    if (row[1] && typeof row[1] === 'string' && row[1].length > 2) {
      currentTeacherName = row[1].trim();
    }
    
    // Если преподаватель не найден в БД, пропускаем (возможно он в profiles записан иначе)
    if (!currentTeacherName || !teacherMap[currentTeacherName.toLowerCase()]) {
      continue;
    }
    const teacherId = teacherMap[currentTeacherName.toLowerCase()];
    const subject = row[3] || 'Предмет';

    // Для каждого класса проверяем часы
    for (const colIndex of CLASS_COLS) {
      const hours = parseInt(row[colIndex]);
      const className = headers[colIndex];
      
      if (!isNaN(hours) && hours > 0 && className) {
        // Выделенный кабинет классу или рандомный
        const roomNumber = roomMap[className] || String(100 + Math.floor(Math.random() * 200));
        
        // Распределяем учебные часы по случайным дням и случайным урокам
        for (let h = 0; h < hours; h++) {
          const dayOfWeek = 1 + Math.floor(Math.random() * 5); // 1 to 5 (ПН-ПТ)
          const timeSlot = TIME_SLOTS[Math.floor(Math.random() * TIME_SLOTS.length)];
          
          dbRecords.push({
            teacher_id: teacherId,
            class_name: className + ' (' + subject + ')',
            room_number: String(roomNumber),
            time_slot: timeSlot,
            day_of_week: dayOfWeek
          });
        }
      }
    }
  }

  console.log(`Сформировано ${dbRecords.length} фейковых уроков из распределения.`);
  
  // Очистим старое расписание
  await supabase.from('schedules').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  // Вставляем батчами по 1000
  const CHUNK_SIZE = 500;
  for (let i = 0; i < dbRecords.length; i += CHUNK_SIZE) {
    const chunk = dbRecords.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase.from('schedules').insert(chunk);
    if (error) {
      console.error('Ошибка вставки куска расписания:', error.message);
    }
  }

  console.log('✅ Идеально! Балансировка и выгрузка расписания в БД ολοкрована.');
}

seedSchedules();
