import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function seedSmartData() {
  console.log('1. Создаем Матрицу Кабинетов (Rooms)...');
  const rooms = [
    { room_number: '301', capacity: 30, room_type: 'class' },
    { room_number: '302', capacity: 30, room_type: 'class' },
    { room_number: 'Лаборатория Физики', capacity: 25, room_type: 'lab' },
    { room_number: 'Лингафонный А', capacity: 15, room_type: 'lab' },
    { room_number: 'Лингафонный Б', capacity: 15, room_type: 'lab' },
    { room_number: 'Спортзал', capacity: 60, room_type: 'gym' },
    { room_number: 'Актовый зал', capacity: 200, room_type: 'auditorium' },
  ];

  // Сначала очищаем старые, если были (так как мы добавили UNIQUE)
  await supabase.from('rooms').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  const { error: roomErr } = await supabase.from('rooms').insert(rooms);
  if (roomErr) console.error('Ошибка вставки кабинетов:', roomErr);
  else console.log('✅ Кабинеты успешно добавлены!');

  console.log('2. Создаем Матрицу Ограничений (Constraints)...');
  await supabase.from('schedule_constraints').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // Фейковые ограничения (hardcoded для демо AI-генерации)
  const constraints = [
    { entity_type: 'class', entity_id: '10А', rule_type: 'max_hours', value: '36' }, // 36 часов в неделю
    { entity_type: 'room', entity_id: 'Спортзал', rule_type: 'blocked_slot', time_slot: '08:00-08:45' }, // Санитарный час утром
    { entity_type: 'teacher', entity_id: 'Английский (Группа)', rule_type: 'required_hours', value: 'Лента', time_slot: '10:00-10:45' }
  ];

  const { error: constErr } = await supabase.from('schedule_constraints').insert(constraints);
  if (constErr) console.error('Ошибка вставки констрейнтов:', constErr);
  else console.log('✅ Ограничения успешно загружены в базу!');

  console.log('🏁 Завершено: Данные для модуля Smart-Сборки готовы.');
}

seedSmartData();
