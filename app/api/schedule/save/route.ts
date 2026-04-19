import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { changes } = await req.json();
    if (!changes?.length) return NextResponse.json({ ok: true, saved: 0 });

    // For each changed row:
    // 1. Read current state to preserve original_teacher_id if not already set
    // 2. Update teacher_id, mark as modified
    const results = await Promise.all(
      changes.map(async ({ id, teacher_id, time_slot, day_of_week }: any) => {
        // Check if original already saved
        const { data: current } = await supabase
          .from('schedules')
          .select('original_teacher_id, teacher_id')
          .eq('id', id)
          .single();

        const original_teacher_id =
          current?.original_teacher_id || current?.teacher_id || null;

        return supabase
          .from('schedules')
          .update({
            teacher_id,
            time_slot,
            day_of_week,
            is_modified: true,
            modified_at: new Date().toISOString(),
            original_teacher_id,
          })
          .eq('id', id);
      })
    );

    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
      console.error('[schedule/save] Partial errors:', errors.length);
      // Still return ok — localStorage already has the data
      return NextResponse.json({ ok: true, saved: changes.length - errors.length, errors: errors.length });
    }

    return NextResponse.json({ ok: true, saved: changes.length });
  } catch (err: any) {
    console.error('[schedule/save]', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
