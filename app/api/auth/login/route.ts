import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Секретный ключ для JWT (желательно в .env, здесь хардкод для простоты запуска)
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-key-for-jwt-2026-ai-director');

export async function POST(request: Request) {
  console.log('--- Login Attempt Starting ---');
  try {
    const body = await request.json();
    console.log('Login request received for:', body.login);
    const { login, password } = body;

    if (!login || !password) {
      return NextResponse.json({ error: 'Логин и пароль обязательны' }, { status: 400 });
    }

    const cleanLogin = login.trim();
    const cleanPassword = password.trim();

    // 1. Ищем пользователя в таблице profiles
    const { data: user, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('login', cleanLogin)
      .single();

    if (error || !user) {
      console.log('User not found or DB error:', cleanLogin, error);
      return NextResponse.json({ error: 'Неверный логин или пароль (пользователь не найден)' }, { status: 401 });
    }

    // 2. Сверяем пароль
    const isValid = await bcrypt.compare(cleanPassword, user.password_hash);
    if (!isValid) {
      console.log('Password mismatch for user:', cleanLogin);
      return NextResponse.json({ error: 'Неверный логин или пароль (пароль не совпадает)' }, { status: 401 });
    }

    console.log('Login successful for:', cleanLogin, 'Role:', user.role);

    // 3. Создаем JWT токен с помощью jose
    const token = await new SignJWT({
      id: user.id,
      login: user.login,
      role: user.role, // 'admin' или 'teacher'
      full_name: user.full_name,
      category_id: user.category_id,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h') // Токен живет сутки
      .sign(JWT_SECRET);

    // 4. Устанавливаем HTTP-only Cookie через NextResponse
    const response = NextResponse.json(
      { success: true, user: { login: user.login, role: user.role } },
      { status: 200 }
    );

    response.cookies.set({
      name: 'auth_token',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 1 день
    });

    return response;
  } catch (err: any) {
    console.error('Ошибка входа:', err);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}
