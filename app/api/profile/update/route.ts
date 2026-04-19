import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-key-for-jwt-2026-ai-director');

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = payload.id;

    if (!userId) {
      return NextResponse.json({ error: 'Неверный токен' }, { status: 401 });
    }

    const body = await request.json();
    const { avatar_url, password } = body;

    const updates: any = {};

    if (avatar_url !== undefined) {
      if (typeof avatar_url !== 'string') {
        return NextResponse.json({ error: 'Неверный формат аватарки' }, { status: 400 });
      }
      updates.avatar_url = avatar_url;
    }

    if (password) {
      if (password.length < 4) {
        return NextResponse.json({ error: 'Пароль слишком короткий' }, { status: 400 });
      }
      const salt = await bcrypt.genSalt(10);
      updates.password_hash = await bcrypt.hash(password, salt);
    }


    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Нет данных для обновления' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);

    if (error) {
      console.error('DB Update Error:', error);
      return NextResponse.json({ error: `Ошибка БД: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Ошибка обновления профиля:', err);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}
