import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function DELETE(request: Request, context: any) {
  try {
    // В Next.js 14/15 params может быть Promise, безопаснее дождаться
    const params = await context.params;
    const { id } = params;

    if (!id) {
      return NextResponse.json({ error: 'Необходим ID' }, { status: 400 });
    }

    // Инициализируем клиента Supabase (с обходом RLS если есть Service Role Key)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Инциденты и Замены хранятся в таблице messages
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Ошибка при удалении сообщения (incidents api):', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Успешно удалено' }, { status: 200 });

  } catch (error: any) {
    console.error('Server Error (DELETE incident):', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}
