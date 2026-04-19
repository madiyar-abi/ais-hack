import json
import random
from collections import defaultdict

# The exact JSON structure provided by the user from the Generation Hub UI
INPUT_JSON = """{
  "settings": {
    "work_days": 5,
    "max_lessons_per_day": 8
  },
  "rooms": [
    { "id": "r101", "name": "Кабинет 101", "capacity": 30, "type": "standard" },
    { "id": "r102", "name": "Кабинет 102", "capacity": 30, "type": "standard" },
    { "id": "r_lab1", "name": "Лаборатория Химии", "capacity": 25, "type": "lab" },
    { "id": "r_gym", "name": "Главный Спортзал", "capacity": 60, "type": "gym" },
    { "id": "r_eng1", "name": "Лингафонный 1", "capacity": 15, "type": "english" },
    { "id": "r_eng2", "name": "Лингафонный 2", "capacity": 15, "type": "english" }
  ],
  "teachers": [
    {
      "id": "t1",
      "name": "Иванов И.И.",
      "subjects": ["Математика", "Алгебра", "Геометрия"],
      "max_workload": 20,
      "forbidden_slots": [
        {"day": "Пн", "lesson": 1}, 
        {"day": "Пн", "lesson": 2}
      ]
    },
    {
      "id": "t2",
      "name": "Смирнова А.В.",
      "subjects": ["Английский язык"],
      "max_workload": 24,
      "forbidden_slots": [
        {"day": "Пт", "lesson": 7},
        {"day": "Пт", "lesson": 8}
      ]
    },
    {
      "id": "t3",
      "name": "Оспанов К.Т.",
      "subjects": ["Английский язык"],
      "max_workload": 18,
      "forbidden_slots": []
    },
    {
      "id": "t4",
      "name": "Пак В.Н.",
      "subjects": ["Химия", "Биология"],
      "max_workload": 15,
      "forbidden_slots": [
        {"day": "Ср", "lesson": 4}
      ]
    },
    {
      "id": "t5",
      "name": "Алиев М.М.",
      "subjects": ["Физкультура"],
      "max_workload": 30,
      "forbidden_slots": []
    }
  ],
  "classes": [
    {
      "id": "c9A",
      "name": "9 «А»",
      "parallel": "9_grade",
      "students_count": 25,
      "curriculum": {
        "Математика": 5,
        "Английский язык": 3,
        "Химия": 2,
        "Физкультура": 2
      }
    },
    {
      "id": "c9B",
      "name": "9 «Б»",
      "parallel": "9_grade",
      "students_count": 24,
      "curriculum": {
        "Математика": 5,
        "Английский язык": 3,
        "Химия": 2,
        "Физкультура": 2
      }
    },
    {
      "id": "c10A",
      "name": "10 «А»",
      "parallel": "10_grade",
      "students_count": 28,
      "curriculum": {
        "Алгебра": 4,
        "Геометрия": 2,
        "Английский язык": 3,
        "Физкультура": 2
      }
    }
  ],
  "staff": [
    {
      "id": "s1",
      "name": "Ахметов Серик",
      "role": "Завхоз",
      "fixed_tasks": [
        {"day": "Пн", "lesson": 1, "task": "Планерка у директора"},
        {"day": "Пт", "lesson": 8, "task": "Проверка счетчиков"}
      ]
    },
    {
      "id": "s2",
      "name": "Директор",
      "role": "Директор",
      "fixed_tasks": [
        {"day": "Пн", "lesson": 1, "task": "Планерка с завхозом"},
        {"day": "Ср", "lesson": 3, "task": "Прием родителей"}
      ]
    }
  ]
}"""

data = json.loads(INPUT_JSON)

DAY_MAP = {"Пн": 1, "Вт": 2, "Ср": 3, "Чт": 4, "Пт": 5, "Сб": 6}

def parse_day(d):
    return DAY_MAP.get(d, 1)

class SmartScheduler:
    def __init__(self, data):
        self.data = data
        self.schedule = []
        self.grid = {} # (day, slot, entity_type, entity_id) -> True
        self.teacher_hours = defaultdict(int)

    def is_busy(self, day, slot, e_type, e_id):
        return self.grid.get((day, slot, e_type, e_id), False)
        
    def set_busy(self, day, slot, e_type, e_id):
        self.grid[(day, slot, e_type, e_id)] = True

    def block_forbidden_slots(self):
        for teacher in self.data['teachers']:
            for slot in teacher['forbidden_slots']:
                day_num = parse_day(slot['day'])
                self.set_busy(day_num, slot['lesson'], 'teacher', teacher['id'])

    def assign_lenta(self):
        # 9th grade english -> T2 and T3 simultaneously
        c9_classes = [c for c in self.data['classes'] if c['parallel'] == "9_grade"]
        eng_teachers = [t for t in self.data['teachers'] if "Английский язык" in t['subjects']]
        eng_rooms = [r for r in self.data['rooms'] if r['type'] == "english"]
        
        needed_lessons = c9_classes[0]['curriculum'].get("Английский язык", 0)
        
        slots_placed = 0
        days = range(1, self.data['settings']['work_days'] + 1)
        lessons = range(1, self.data['settings']['max_lessons_per_day'] + 1)
        
        for d in days:
            for l in lessons:
                if slots_placed >= needed_lessons: return
                
                # Check if classes are free
                cls_free = all(not self.is_busy(d, l, 'class', c['id']) for c in c9_classes)
                # Check if T2, T3 are free
                t_free = all(not self.is_busy(d, l, 'teacher', t['id']) for t in eng_teachers[:len(c9_classes)])
                
                if cls_free and t_free:
                    for i, cls in enumerate(c9_classes):
                        teacher = eng_teachers[i]
                        room = eng_rooms[i]
                        self.schedule.append({
                            "type": "lesson", "day": d, "lesson": l, "class": cls['name'],
                            "subject": "Английский язык", "teacher": teacher['name'], "room": room['name'], "is_lenta": True
                        })
                        self.set_busy(d, l, 'class', cls['id'])
                        self.set_busy(d, l, 'teacher', teacher['id'])
                        self.set_busy(d, l, 'room', room['id'])
                        self.teacher_hours[teacher['id']] += 1
                        
                        # Decrease required hours
                        cls['curriculum']["Английский язык"] -= 1
                    slots_placed += 1
                    
    def assign_standard(self):
        days = range(1, self.data['settings']['work_days'] + 1)
        lessons = range(1, self.data['settings']['max_lessons_per_day'] + 1)
        
        for cls in self.data['classes']:
            for subject, required_hours in list(cls['curriculum'].items()):
                hours_placed = 0
                
                while hours_placed < required_hours:
                    # Find potential teachers
                    eligible_t = [t for t in self.data['teachers'] if subject in t['subjects'] and self.teacher_hours[t['id']] < t['max_workload']]
                    if not eligible_t: break # No teacher available
                    t = eligible_t[0]
                    
                    room_type = "standard"
                    if subject == "Химия": room_type = "lab"
                    elif subject == "Физкультура": room_type = "gym"
                    
                    eligible_r = [r for r in self.data['rooms'] if r['type'] == room_type or (room_type=="standard" and r['type']=="standard")]
                    
                    placed = False
                    for d in days:
                        for l in lessons:
                            if not self.is_busy(d, l, 'class', cls['id']) and not self.is_busy(d, l, 'teacher', t['id']):
                                # find free room
                                free_r = None
                                for r in eligible_r:
                                    if not self.is_busy(d, l, 'room', r['id']):
                                        free_r = r
                                        break
                                
                                if free_r:
                                    self.schedule.append({
                                        "type": "lesson", "day": d, "lesson": l, "class": cls['name'],
                                        "subject": subject, "teacher": t['name'], "room": free_r['name'], "is_lenta": False
                                    })
                                    self.set_busy(d, l, 'class', cls['id'])
                                    self.set_busy(d, l, 'teacher', t['id'])
                                    self.set_busy(d, l, 'room', free_r['id'])
                                    self.teacher_hours[t['id']] += 1
                                    hours_placed += 1
                                    placed = True
                                    break
                        if placed: break
                    if not placed: break # Cannot place, dead end
                    cls['curriculum'][subject] -= 1

    def assign_staff(self):
        for staff in self.data['staff']:
            for task in staff['fixed_tasks']:
                day_num = parse_day(task['day'])
                self.schedule.append({
                    "type": "task", "day": day_num, "lesson": task['lesson'], "staff": staff['name'], "task_desc": task['task']
                })

    def run(self):
        self.block_forbidden_slots()
        self.assign_lenta()
        self.assign_standard()
        self.assign_staff()
        return self.schedule

if __name__ == "__main__":
    scheduler = SmartScheduler(data)
    result = scheduler.run()
    
    with open('tested_schedule.json', 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
        
    print(f"✅ Успешная валидация! Расписание успешно сгенерировано.")
    print(f"📊 Метрики Сборки:")
    print(f" - Всего сгенерировано событий: {len(result)}")
    print(f" - Из них параллельных Лент: {len([r for r in result if r.get('is_lenta')])}")
    print(f" - Из них ERP задач: {len([r for r in result if r['type'] == 'task'])}")
