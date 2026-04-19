const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  { p: 'app/api/cron/attendance/route.ts', t: 'messages', c: "id, urgency_level, text, sender_name, sender_phone, timestamp" },
  { p: 'app/DashboardClient.tsx', t: 'categories', c: "id, name, color" }, 
  { p: 'app/api/debug/route.ts', t: 'messages', c: "id, urgency_level, text, sender_name, sender_phone, timestamp" },
  { p: 'app/api/whatsapp-webhook/route.ts', t: 'schedules', c: "id, teacher_id, class_name, room_number, time_slot, day_of_week, status" },
  { p: 'app/api/test-profiles/route.ts', t: 'profiles', c: "id, full_name, role, specialty" },
  { p: 'app/api/auth/login/route.ts', t: 'profiles', c: "id, login, password_hash, role, full_name" },
  { p: 'app/dashboard/teacher/page.tsx', t: 'schedules', c: "id, teacher_id, class_name, room_number, time_slot, day_of_week, status" },
  { p: 'app/dashboard/teacher/page.tsx', t: 'tasks', c: "id, title, description, target_teacher_id, status" },
  { p: 'app/components/admin/tabs/AttendanceTab.tsx', t: 'profiles', c: "id, full_name, role, specialty" },
  { p: 'app/components/admin/tabs/AttendanceTab.tsx', t: 'messages', c: "id, urgency_level, text, sender_name, sender_phone, timestamp" },
  { p: 'app/components/admin/tabs/SubstituteTab.tsx', t: 'messages', c: "id, urgency_level, text, sender_name, sender_phone, timestamp" },
  { p: 'app/components/admin/tabs/SubstituteTab.tsx', t: 'profiles', c: "id, full_name, role, specialty" },
  { p: 'app/components/admin/tabs/SubstituteTab.tsx', t: 'schedules', c: "id, teacher_id, class_name, room_number, time_slot, day_of_week, status" },
  { p: 'app/components/admin/tabs/IncidentsTab.tsx', t: 'messages', c: "id, urgency_level, text, sender_name, sender_phone, timestamp" }
];

let replacedCount = 0;

for (const { p, c } of filesToUpdate) {
  const fullPath = path.join(__dirname, p);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    const newContent = content.replace(/\.select\('\*'\)/g, `.select('${c}')`);
    if (content !== newContent) {
      fs.writeFileSync(fullPath, newContent);
      console.log('Fixed:', p);
      replacedCount++;
    }
  } else {
    console.warn('Could not find:', p);
  }
}
console.log('Total fixed:', replacedCount);
