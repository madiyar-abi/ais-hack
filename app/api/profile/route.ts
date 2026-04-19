import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-key-for-jwt-2026-ai-director');

export async function GET(request: Request) {
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

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: user, error } = await supabase
      .from('profiles')
      .select('id, full_name, login, role, specialty, avatar_url, phone, whatsapp_notifications')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: 'Профиль не найден' }, { status: 404 });
    }

    return NextResponse.json({ success: true, user });
  } catch (err) {
    console.error('Ошибка получения профиля:', err);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}
