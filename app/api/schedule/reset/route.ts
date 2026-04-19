import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    // Call the reset_schedule_modifications() SQL function
    // This sets teacher_id = original_teacher_id for all modified rows
    const { error } = await supabase.rpc('reset_schedule_modifications');

    if (error) {
      // Function might not exist yet (migration not run)
      // Fallback: update all is_modified=true rows manually
      const { data: modifiedRows } = await supabase
        .from('schedules')
        .select('id, original_teacher_id')
        .eq('is_modified', true)
        .not('original_teacher_id', 'is', null);

      if (modifiedRows?.length) {
        await Promise.all(
          modifiedRows.map(row =>
            supabase
              .from('schedules')
              .update({
                teacher_id: row.original_teacher_id,
                is_modified: false,
                modified_at: null,
              })
              .eq('id', row.id)
          )
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[schedule/reset]', err);
    // Even if DB reset fails, client-side reset (localStorage clear) still works
    return NextResponse.json({ ok: true, warning: 'DB reset failed, local reset applied' });
  }
}
