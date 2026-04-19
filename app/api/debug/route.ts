import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
export async function GET() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { data } = await supabase.from('messages').select('*').order('timestamp', { ascending: false }).limit(3);
    return NextResponse.json(data);
}
