import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Инициализация
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function injectAdmin() {
  const login = 'admin-director';
  const rawPassword = 'AqbobekAdmin2026!';
  
  try {
    const passwordHash = await bcrypt.hash(rawPassword, 10);
    
    // Проверим, есть ли уже этот логин
    await supabase.from('teachers_access').delete().eq('login', login);

    const { error } = await supabase.from('teachers_access').insert([{
      full_name: 'Директор Лицея',
      login: login,
      password_hash: passwordHash,
      role: 'admin',
      category_id: null
    }]);

    if (error) {
      console.error('Ошибка добавления администратора:', error.message);
    } else {
      console.log('===============');
      console.log('Успешно добавлен аккаунт директора!');
      console.log('Логин:', login);
      console.log('Пароль:', rawPassword);
      console.log('===============');
    }
  } catch (err) {
    console.error('Критическая ошибка:', err);
  }
}

injectAdmin();
