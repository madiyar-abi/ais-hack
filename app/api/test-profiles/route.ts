import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase.from('profiles').select('*');
  return NextResponse.json({ profiles: data, error });
}
