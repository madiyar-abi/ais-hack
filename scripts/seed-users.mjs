import fs from 'fs';
import xlsx from 'xlsx';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';

// Инициализируем Supabase клиент
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function seedUsers() {
  const filePath = './teachers.xlsx'; // По умолчанию читаем файл из корня
  
  if (!fs.existsSync(filePath)) {
    console.error(`\n❌ Файл ${filePath} не найден в корне проекта!`);
    console.log('Пожалуйста, положи файл с колонками "ФИО", "Логин", "Пароль", "Роль", "Специальность" в директорию проекта.');
    return;
  }

  console.log('Чтение Excel файла...');
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

  const dbRecords = [];
  
  console.log(`Найдено ${rows.length} строк. Обработка паролей...`);
  
  for (const row of rows) {
    // В Excel ключи зависят от того, как названы колонки в первой строке:
    const fullName = row['ФИО'] || row['full_name'];
    const login = row['Логин'] || row['login'];
    const plainPassword = row['Пароль'] ? row['Пароль'].toString() : null;
    const role = (row['Роль'] || row['role'] || 'teacher').toLowerCase();
    const specialty = row['Специальность'] || row['specialty'] || null;

    if (!login || !plainPassword || !fullName) {
      console.warn(`Пропуск строки: не хватает обязательных данных (Логин/Пароль/ФИО). Данные:`, row);
      continue;
    }

    try {
      const passwordHash = await bcrypt.hash(plainPassword, 10);
      dbRecords.push({
        full_name: fullName.trim(),
        login: login.trim(),
        password_hash: passwordHash,
        role: role.trim(),
        specialty: specialty ? specialty.trim() : null
      });
    } catch (e) {
      console.error(`Ошибка при хешировании пароля для ${login}:`, e);
    }
  }

  if (dbRecords.length === 0) {
    console.log('Нет валидных данных для отправки в базу.');
    return;
  }

  console.log(`\nОтправка ${dbRecords.length} записей в таблицу profiles...`);

  const { error } = await supabase.from('profiles').insert(dbRecords);

  if (error) {
    console.error('❌ Ошибка при вставке пользователей в Supabase:', error.message);
  } else {
    console.log('✅ Успешно! Пользователи загружены в таблицу profiles.');
  }
}

seedUsers();
