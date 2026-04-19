import json
import random
from collections import defaultdict
import copy

# =====================================================================
# 1. СТРУКТУРА ВХОДНЫХ ДАННЫХ (Input Data)
# =====================================================================

input_data = {
    "classes": ["7А", "7Б", "8А", "8Б", "9А", "9Б", "10А", "10Б", "11А", "11Б"],
    "teachers": [
        {"id": "T01", "name": "Иванов И.И.", "subject": "Математика", "constraints": {"unavailable_days": [1]}, "max_lessons": 6},
        {"id": "T02", "name": "Петрова П.П.", "subject": "Математика", "constraints": {"unavailable_days": []}, "max_lessons": 6},
        {"id": "T03", "name": "Смирнова С.С.", "subject": "Английский", "constraints": {"unavailable_days": [3]}, "max_lessons": 6},
        {"id": "T04", "name": "Джон Д.", "subject": "Английский", "constraints": {"unavailable_days": []}, "max_lessons": 6},
        {"id": "T05", "name": "Браун Э.", "subject": "Английский", "constraints": {"unavailable_days": [5]}, "max_lessons": 6}, # For Lentas
        {"id": "T06", "name": "Сидоров К.К.", "subject": "Физика", "constraints": {"unavailable_days": []}, "max_lessons": 6},
        {"id": "T07", "name": "Николаева Н.Н.", "subject": "Химия", "constraints": {"unavailable_days": [2]}, "max_lessons": 6},
        {"id": "T08", "name": "Кузнецов А.А.", "subject": "Физкультура", "constraints": {"unavailable_days": []}, "max_lessons": 6},
        {"id": "T09", "name": "Григорьев Г.Г.", "subject": "Физкультура", "constraints": {"unavailable_days": []}, "max_lessons": 6},
        {"id": "T10", "name": "Васильева В.В.", "subject": "История", "constraints": {"unavailable_days": []}, "max_lessons": 6},
        {"id": "T11", "name": "Михайлов М.М.", "subject": "География", "constraints": {"unavailable_days": []}, "max_lessons": 6},
        {"id": "T12", "name": "Павлова О.О.", "subject": "Литература", "constraints": {"unavailable_days": []}, "max_lessons": 6},
        {"id": "T13", "name": "Соколова Л.Л.", "subject": "Биология", "constraints": {"unavailable_days": [4]}, "max_lessons": 6},
        {"id": "T14", "name": "Волкова Е.Е.", "subject": "Информатика", "constraints": {"unavailable_days": []}, "max_lessons": 6},
        {"id": "T15", "name": "Морозов Д.Д.", "subject": "Музыка", "constraints": {"unavailable_days": []}, "max_lessons": 6},
    ],
    "staff": [
        {"id": "S01", "name": "Алиев А.А.", "role": "Завхоз"},
        {"id": "S02", "name": "Ким Е.Е.", "role": "Директор"}
    ],
    "rooms": [
        {"id": "R01", "number": "101", "type": "standard", "capacity": 30},
        {"id": "R02", "number": "102", "type": "standard", "capacity": 30},
        {"id": "R03", "number": "103", "type": "standard", "capacity": 30},
        {"id": "R04", "number": "201", "type": "math", "capacity": 30},
        {"id": "R05", "number": "202", "type": "math", "capacity": 30},
        {"id": "R06", "number": "Лингафонный 1", "type": "english", "capacity": 15},
        {"id": "R07", "number": "Лингафонный 2", "type": "english", "capacity": 15},
        {"id": "R08", "number": "Лингафонный 3", "type": "english", "capacity": 15},
        {"id": "R09", "number": "Спортзал 1", "type": "gym", "capacity": 60},
        {"id": "R10", "number": "Лаборатория", "type": "lab", "capacity": 30},
        {"id": "R11", "number": "Директорская", "type": "office", "capacity": 10},
        {"id": "R12", "number": "Склад", "type": "storage", "capacity": 5},
    ],
    "curriculum": {
        "standard": ["Математика", "Физика", "Химия", "История", "География", "Литература", "Биология", "Информатика", "Музыка"],
        "lenta_subject": "Английский"
    },
    "schedule_template": {
        "days": [1, 2, 3, 4, 5], # 1=Понедельник, 5=Пятница
        "slots_per_day": 6
    }
}


# =====================================================================
# 2. АЛГОРИТМ ГЕНЕРАЦИИ РАСПИСАНИЯ (Greedy + Backtracking heuristics)
# =====================================================================

class SchoolScheduler:
    def __init__(self, data):
        self.data = data
        self.schedule = [] # List of structured schedule units
        self.erp_tasks = []
        self.teacher_load = defaultdict(int)
        
    def generate(self):
        # Структура: день -> время (слот) -> кабинет -> что там происходит
        # Шаг 1: Распределяем ленты (Lenta) - самый жесткий констрейнт!
        self._allocate_lentas()
        
        # Шаг 2: Распределяем обычные уроки, стараясь не делать "окон" у классов
        self._allocate_lessons()
        
        # Шаг 3: ERP Задачи (Завхоз и Директор)
        self._allocate_erp_tasks()
        
        return {
            "academic_schedule": self.schedule,
            "erp_schedule": self.erp_tasks
        }
        
    def _allocate_lentas(self):
        """
        Механика ленты: пара классов (например: 9A, 9Б) в один слот.
        Нужно N учителей английского и N лингафонных.
        """
        lenta_subject = self.data["curriculum"]["lenta_subject"]
        english_teachers = [t for t in self.data["teachers"] if t["subject"] == lenta_subject]
        english_rooms = [r for r in self.data["rooms"] if r["type"] == "english"]
        
        # Для упрощения ставим Ленту английского для 9-х классов во Вторник, 2-й урок (день 2, слот 2)
        target_day = 2
        target_slot = 2
        lenta_classes = ["9А", "9Б"]
        
        for i, cls_name in enumerate(lenta_classes):
            if i < len(english_teachers) and i < len(english_rooms):
                teacher = english_teachers[i]
                room = english_rooms[i]
                
                self.schedule.append({
                    "day": target_day,
                    "slot": target_slot,
                    "class_name": cls_name,
                    "subject": lenta_subject,
                    "teacher_id": teacher["id"],
                    "teacher_name": teacher["name"],
                    "room_id": room["id"],
                    "room_number": room["number"],
                    "type": "LENTA"
                })
                self.teacher_load[teacher["id"]] += 1

    def _allocate_lessons(self):
        """Заполняем пустые слоты базовыми предметами без 'окон'."""
        days = self.data["schedule_template"]["days"]
        slots = range(1, 7) # 1..6 уроков
        
        for day in days:
            for cls_name in self.data["classes"]:
                for slot in slots:
                    # Проверяем не занят ли класс (может быть занят лентой на этом слоте)
                    is_busy = any(s["day"] == day and s["slot"] == slot and s["class_name"] == cls_name for s in self.schedule)
                    if is_busy:
                        continue
                        
                    # Берем рандомный предмет для простоты
                    subject = random.choice(self.data["curriculum"]["standard"])
                    
                    # Ищем учителя, который может вести предмет, свободен в этот слот и день, и не превысил лимит
                    available_teachers = [
                        t for t in self.data["teachers"] 
                        if t["subject"] == subject 
                        and day not in t["constraints"]["unavailable_days"]
                        and self.teacher_load[t["id"]] < t["max_lessons"]
                    ]
                    
                    random.shuffle(available_teachers)
                    selected_teacher = None
                    for t in available_teachers:
                        # Свободен ли он в этот слот?
                        is_t_busy = any(s["day"] == day and s["slot"] == slot and s["teacher_id"] == t["id"] for s in self.schedule)
                        if not is_t_busy:
                            selected_teacher = t
                            break
                            
                    if not selected_teacher:
                        # Тупик, оставляем "самопознание" или окно для алгоритмической простоты
                        continue
                        
                    # Ищем подходящий кабинет
                    room_type = "standard"
                    if subject == "Химия": room_type = "lab"
                    elif subject == "Физкультура": room_type = "gym"
                    elif subject == "Математика": room_type = "math"
                    
                    available_rooms = [r for r in self.data["rooms"] if r["type"] == room_type or r["type"] == "standard"]
                    selected_room = None
                    for r in available_rooms:
                        is_r_busy = any(s["day"] == day and s["slot"] == slot and s["room_id"] == r["id"] for s in self.schedule)
                        if not is_r_busy:
                            selected_room = r
                            break
                            
                    if selected_room and selected_teacher:
                        self.schedule.append({
                            "day": day,
                            "slot": slot,
                            "class_name": cls_name,
                            "subject": subject,
                            "teacher_id": selected_teacher["id"],
                            "teacher_name": selected_teacher["name"],
                            "room_id": selected_room["id"],
                            "room_number": selected_room["number"],
                            "type": "STANDARD"
                        })
                        self.teacher_load[selected_teacher["id"]] += 1

    def _allocate_erp_tasks(self):
        """Интеграция завхоза и директора."""
        zavhoz = next(s for s in self.data["staff"] if s["role"] == "Завхоз")
        director = next(s for s in self.data["staff"] if s["role"] == "Директор")
        
        # Директор: Собрание с завучами (Вторник, 3-й урок) в кабинете директора, проверка уроков (Среда, 2-й урок)
        self.erp_tasks.append({"day": 2, "slot": 3, "staff_id": director["id"], "staff_name": director["name"], "task": "Совещание с завучами", "room": "Директорская"})
        self.erp_tasks.append({"day": 3, "slot": 2, "staff_id": director["id"], "staff_name": director["name"], "task": "Посещение урока Математики (10А)", "room": "201"})
        
        # Завхоз: Починка проектора (Понедельник, 1-й урок) пока класс на физ-ре
        self.erp_tasks.append({"day": 1, "slot": 1, "staff_id": zavhoz["id"], "staff_name": zavhoz["name"], "task": "Починка освещения", "room": "101"})


# =====================================================================
# 3. SMART SUBSTITUTION (Алгоритм замены)
# =====================================================================

def handle_teacher_absence(teacher_name, schedule_data, raw_data):
    """
    При болезни учителя ищет замену среди других учителей с нужной специализацией,
    проверяя их "окна" (свободные слоты). Если нет предметника, ставим администратора или дежурного.
    """
    absent_lessons = [s for s in schedule_data if s["teacher_name"] == teacher_name]
    substitutions = []
    
    for lesson in absent_lessons:
        day = lesson["day"]
        slot = lesson["slot"]
        subject = lesson["subject"]
        
        # Кандидаты: Учителя того же предмета
        candidates = [t for t in raw_data["teachers"] if t["subject"] == subject and t["name"] != teacher_name]
        
        substitute_found = None
        for candidate in candidates:
            # Свободен ли кандидат?
            is_busy = any(s["day"] == day and s["slot"] == slot and s["teacher_id"] == candidate["id"] for s in schedule_data)
            if not is_busy:
                substitute_found = candidate
                break
                
        if substitute_found:
            substitutions.append({
                "lesson_target": f"{lesson['class_name']} ({lesson['day']} день, {lesson['slot']} урок)",
                "original_teacher": teacher_name,
                "substitute_teacher": substitute_found["name"],
                "subject": subject,
                "status": "Идеальная замена (предметник)"
            })
        else:
            # Fallback: ставим Директора или дежурного на "Окно/Дежурство"
            substitutions.append({
                "lesson_target": f"{lesson['class_name']} ({lesson['day']} день, {lesson['slot']} урок)",
                "original_teacher": teacher_name,
                "substitute_teacher": "Дежурный Администратор (Директор)",
                "subject": subject,
                "status": "Аварийная замена (присмотр)"
            })
            
    return substitutions


# =====================================================================
# ИСПОЛНЕНИЕ (EXECUTION)
# =====================================================================

if __name__ == "__main__":
    scheduler = SchoolScheduler(input_data)
    result = scheduler.generate()
    
    # 1. Output the generated JSON
    with open("generated_schedule.json", "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
        
    # 2. Simulate smart substitution
    sick_teacher = "Смирнова С.С." # Teacher of English
    sub_results = handle_teacher_absence(sick_teacher, result["academic_schedule"], input_data)
    
    print(f"Расписание сгенерировано. Всего уроков: {len(result['academic_schedule'])}")
    print(f"Пример Умной Замены (Заболел(а) {sick_teacher}):")
    for r in sub_results:
        print(f" - {r['lesson_target']}: Замена на -> {r['substitute_teacher']} [{r['status']}]")

