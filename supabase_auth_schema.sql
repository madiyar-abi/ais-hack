export const sqlSchema = `
-- 1. Создание таблицы доступов (teachers_access)
CREATE TABLE teachers_access (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  login TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'teacher', -- 'teacher' или 'admin'
  category_id UUID REFERENCES categories(id) NULL
);

-- 2. Обновление таблицы messages (добавление исполнителя)
ALTER TABLE messages ADD COLUMN assigned_to UUID REFERENCES teachers_access(id) NULL;
`;
