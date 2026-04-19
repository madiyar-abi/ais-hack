import fs from 'fs';
import * as xlsx from 'xlsx';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';

// Запускать так: node import_teachers.mjs (не забудьте установить пакеты jose bcryptjs xlsx)
// Для импорта нужен файл teachers.xlsx с колонками: "ФИО" и "Роль" (teacher/admin)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "ВАШ_URL";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "ВАШ_КЛЮЧ";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function generatePassword(length = 8) {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!?_';
  let pass = '';
  for (let i = 0; i < length; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

function normalizeLogin(name) {
  const translit = (str) => {
    const map = {
      'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh',
      'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
      'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts',
      'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
    };
    return str.toLowerCase().split('').map(c => map[c] || c).join('');
  };
  // Ivanova Anna -> ivanova_a
  const parts = name.split(' ');
  let login = translit(parts[0]);
  if (parts.length > 1) login += '_' + translit(parts[1][0]);
  return login;
}

async function startImport() {
  if (!fs.existsSync('teachers.xlsx')) {
    console.error('Ошибка: Файл teachers.xlsx не найден!');
    return;
  }

  const workbook = xlsx.readFile('teachers.xlsx');
  const sheetName = workbook.SheetNames[0];
  const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

  const outputCredentials = [];
  const dbRecords = [];

  for (const row of rows) {
    const fullName = row['ФИО'] || row['Имя'];
    const role = row['Роль'] || 'teacher';
    
    if (!fullName) continue;

    const baseLogin = normalizeLogin(fullName);
    const login = `${baseLogin}_${Math.floor(Math.random() * 100)}`; // Делаем уникальным
    const password = generatePassword();
    const passwordHash = await bcrypt.hash(password, 10);

    // Добавляем в массив для Supabase
    dbRecords.push({
      full_name: fullName,
      login: login,
      password_hash: passwordHash,
      role: role.toLowerCase() === 'admin' ? 'admin' : 'teacher',
      category_id: null // Привязку к категории можно сделать затем вручную в Supabase
    });

    // Добавляем в отчет для принтера
    outputCredentials.push({ 'ФИО': fullName, 'Логин': login, 'Пароль': password, 'Роль': role });
  }

  console.log(`Подготовлено ${dbRecords.length} записей. Начинаем загрузку в БД...`);

  const { data, error } = await supabase.from('teachers_access').insert(dbRecords);

  if (error) {
    console.error('Ошибка вставки в Supabase:', error);
  } else {
    console.log('Успешно загружено в Supabase!');
    
    // Пишем выходной файл
    const ws = xlsx.utils.json_to_sheet(outputCredentials);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Доступы");
    xlsx.writeFile(wb, 'output_credentials.xlsx');
    console.log('Сгенерирован файл с логинами и паролями: output_credentials.xlsx');
  }
}

startImport();
