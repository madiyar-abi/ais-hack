const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function test() {
  const { data: profiles } = await supabase.from('profiles').select('*').ilike('full_name', '%байдирахманова%');
  console.log("Profiles:", profiles);
  if (profiles.length > 0) {
      const { data: sch } = await supabase.from('schedules').select('*').eq('teacher_id', profiles[0].id).eq('day_of_week', 1);
      console.log("Monday Schedule:", sch);
  }
}
test();
