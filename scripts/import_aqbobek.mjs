import fs from 'fs';
import xlsx from 'xlsx';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function generatePassword(length = 8) {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!?_#';
  let pass = '';
  for (let i = 0; i < length; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

function transliterate(str) {
  const map = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh',
    'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
    'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts',
    'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
    'қ': 'q', 'ә': 'a', 'і': 'i', 'ң': 'n', 'ғ': 'g', 'ұ': 'u', 'ү': 'u', 'ө': 'o', 'һ': 'h'
  };
  return str.toLowerCase().split('').map(c => map[c] || (/[a-z0-9]/.test(c) ? c : '')).join('');
}

function getLoginNamePart(fullName) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return transliterate(parts[0]);
  return transliterate(parts[0]) + '_' + transliterate(parts[1][0]);
}

async function startImport() {
  const filePath = './нагрузка учителей для хакатона 2025-2026.xlsx';
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    return;
  }

  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

  const outputCredentials = [];
  const dbRecords = [];
  const seenNames = new Set();

  for (let i = 3; i < rows.length; i++) { // Starts data roughly around row 3
    const row = rows[i];
    if (!row) continue;
    
    // index 1 contains the teacher's name as seen from preview
    const fullName = row[1];
    
    if (typeof fullName === 'string' && fullName.trim().length > 3) {
      const cleanName = fullName.trim();
      
      if (!seenNames.has(cleanName)) {
        seenNames.add(cleanName);
        
        const randomNum = Math.floor(100 + Math.random() * 900); // 3-digit
        const namePart = getLoginNamePart(cleanName);
        const login = `aqbobek-${namePart}-${randomNum}`;
        const password = generatePassword(8);
        const passwordHash = await bcrypt.hash(password, 10);

        dbRecords.push({
          full_name: cleanName,
          login: login,
          password_hash: passwordHash,
          role: 'teacher',
          category_id: null
        });

        outputCredentials.push({
          'ФИО': cleanName,
          'Логин': login,
          'Пароль': password
        });
      }
    }
  }

  console.log(`Найдено ${dbRecords.length} уникальных учителей. Отправка в БД...`);

  const { data, error } = await supabase.from('teachers_access').insert(dbRecords);

  if (error) {
    console.error('Ошибка вставки в Supabase (вероятно, таблица teachers_access еще не создана):', error.message);
  } else {
    console.log('Успешно загружено в Supabase!');
  }

  // Save to CSV / Excel always!
  const ws = xlsx.utils.json_to_sheet(outputCredentials);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, "Доступы");
  xlsx.writeFile(wb, 'aqbobek_teachers_credentials.xlsx');
  console.log('\nСгенерирован файл: aqbobek_teachers_credentials.xlsx (в корне проекта)');
  console.log('\nПример первых 3 аккаунтов:');
  console.table(outputCredentials.slice(0, 3));
}

startImport();
