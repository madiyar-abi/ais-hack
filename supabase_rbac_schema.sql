-- 1. Таблица профилей (Profiles)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  login TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('teacher', 'director', 'deputy')),
  specialty TEXT
);

-- 2. Таблица ресурсов (Rooms)
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_number TEXT UNIQUE NOT NULL,      -- '302', 'Спортзал', 'Актовый зал'
  capacity INT NOT NULL DEFAULT 30,
  room_type TEXT NOT NULL DEFAULT 'class' CHECK (room_type IN ('class', 'lab', 'gym', 'auditorium', 'other'))
);

-- 3. Таблица ограничений (Constraints)
CREATE TABLE IF NOT EXISTS schedule_constraints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('teacher', 'class', 'room')),
  entity_id TEXT NOT NULL,               -- ID учителя, название класса (10А), номер кабинета
  rule_type TEXT NOT NULL CHECK (rule_type IN ('max_hours', 'blocked_slot', 'required_hours')),
  value TEXT,                            -- Значение (5, 18, '10:00-10:45') 
  time_slot TEXT
);

-- 4. Таблица расписания (Schedules - Матрица состояний)
CREATE TABLE IF NOT EXISTS schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  class_name TEXT NOT NULL,       -- например '7А', '11Б'
  room_number TEXT REFERENCES rooms(room_number) ON DELETE SET NULL, -- Связь с таблицей rooms!
  time_slot TEXT NOT NULL,        -- '08:00-08:45', 'Урок 1'
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7), -- 1=Понедельник, 7=Воскресенье
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'substituted', 'canceled'))
);

-- 5. Таблица задач (Tasks)
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  target_teacher_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'canceled'))
);

-- Добавляем Realtime, чтобы дашборды легко реагировали на изменения
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'schedules'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE schedules;
  END IF;
END
$$;

-- ============================================================
-- МИГРАЦИИ ДЛЯ МОДУЛЯ SMART SCHEDULE (Module 3)
-- Запускать по одному блоку в Supabase SQL Editor
-- ============================================================

-- МИГРАЦИЯ 1: Поддержка сохранения изменений расписания
-- Добавляет колонки для отслеживания оригинала и истории замен
ALTER TABLE schedules
  ADD COLUMN IF NOT EXISTS original_teacher_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_modified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS modified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS modified_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- МИГРАЦИЯ 2: Таблица истории замен (лог всех Больничных)
CREATE TABLE IF NOT EXISTS substitution_log (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id    UUID REFERENCES schedules(id) ON DELETE CASCADE,
  absent_teacher_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  substitute_teacher_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  day_of_week    INT NOT NULL,
  time_slot      TEXT NOT NULL,
  class_name     TEXT,
  reason         TEXT,                          -- обоснование от ИИ
  penalty_score  INT,                           -- итоговый штраф (меньше = лучше)
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  created_by     UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- МИГРАЦИЯ 3: Таблица ERP-задач (заявки завхозу)
CREATE TABLE IF NOT EXISTS erp_tasks (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title          TEXT NOT NULL,
  assigned_to    UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- завхоз
  scheduled_slot TEXT,                          -- '10:10–10:55'
  scheduled_day  INT,                           -- 1-5
  status         TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'done', 'canceled')),
  notified_via   TEXT DEFAULT 'whatsapp',       -- 'whatsapp' | 'push' | 'manual'
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  created_by     UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- МИГРАЦИЯ 4: Индексы для быстрой работы матрицы
CREATE INDEX IF NOT EXISTS idx_schedules_teacher_day ON schedules(teacher_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_schedules_slot_day ON schedules(time_slot, day_of_week);
CREATE INDEX IF NOT EXISTS idx_schedules_modified ON schedules(is_modified) WHERE is_modified = TRUE;

-- МИГРАЦИЯ 5: RLS политика — можно читать расписание без авторизации (для демо)
-- (если RLS включён на таблице schedules)
-- ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Anyone can read schedules" ON schedules FOR SELECT USING (true);
-- CREATE POLICY "Authenticated can update schedules" ON schedules FOR UPDATE USING (auth.role() = 'authenticated');

-- МИГРАЦИЯ 6: Функция сброса изменений (Reset to Original)
CREATE OR REPLACE FUNCTION reset_schedule_modifications()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE schedules
  SET
    teacher_id         = original_teacher_id,
    is_modified        = FALSE,
    modified_at        = NULL,
    modified_by        = NULL
  WHERE is_modified = TRUE
    AND original_teacher_id IS NOT NULL;
END;
$$;

-- Пример вызова сброса:
-- SELECT reset_schedule_modifications();
