import fs from 'fs';
import path from 'path';
import * as xlsx from 'xlsx';

let scheduleCache: Record<string, string> | null = null;
let loadCache: Record<string, string> | null = null;
let lastModifiedSchedule: number = 0;
let lastModifiedLoad: number = 0;

export function getExcelSpecialties(): { scheduleMap: Record<string, string>, loadMap: Record<string, string> } {
    const schedulePath = path.join(process.cwd(), 'для хакатона расписание.xlsx');
    const loadPath = path.join(process.cwd(), 'нагрузка учителей для хакатона 2025-2026.xlsx');
    
    // 1. Парсинг основной таблицы нагрузки
    try {
        if (fs.existsSync(loadPath)) {
            const stats = fs.statSync(loadPath);
            if (!loadCache || stats.mtimeMs !== lastModifiedLoad) {
                const fileBuffer = fs.readFileSync(loadPath);
                const wb = xlsx.read(fileBuffer, { type: 'buffer' });
                const map: Record<string, string> = {};
                const sheet = wb.Sheets[wb.SheetNames[0]];
                const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
                
                // Запоминаем последнее имя — оно переходит на следующие строки (алгебра + геометрия у одного учителя)
                let lastTeacherName = '';
                data.forEach((row: any) => {
                    const name = row[1];
                    const subj = row[3];
                    
                    if (typeof name === 'string' && name.trim().length > 3) {
                        lastTeacherName = name.trim().toLowerCase().replace(/\./g, '');
                    }
                    
                    if (lastTeacherName && typeof subj === 'string' && subj.trim().length > 2) {
                        const subjLower = subj.trim().toLowerCase();
                        // Пропускаем косымша — они обрабатываются через расписание
                        if (!subjLower.includes('косымша') && !subjLower.includes('қосымша')) {
                            // Если учитель уже есть (алгебра), не перезаписываем вторым предметом (геометрия) — 
                            // первый предмет важнее, он и определяет кластер
                            if (!map[lastTeacherName]) {
                                map[lastTeacherName] = subj.trim();
                            }
                            // Но геометрия → математика тот же кластер, ничего не теряем
                        }
                    }
                });
                loadCache = map;
                lastModifiedLoad = stats.mtimeMs;
            }
        }
    } catch (e) {
        console.error('Load excel parse error:', e);
        if (!loadCache) loadCache = {};
    }

    // 2. Парсинг расписания для динамических слотов (қосымша)
    try {
        if (fs.existsSync(schedulePath)) {
            const stats = fs.statSync(schedulePath);
            if (!scheduleCache || stats.mtimeMs !== lastModifiedSchedule) {
                const fileBuffer = fs.readFileSync(schedulePath);
                const wb = xlsx.read(fileBuffer, { type: 'buffer' });
                const map: Record<string, string> = {};
                
                wb.SheetNames.forEach(sheetName => {
                    const sheet = wb.Sheets[sheetName];
                    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
                    data.forEach((row: any) => {
                        row.forEach((cell: any) => {
                            if (typeof cell === 'string') {
                                const groups = cell.split('/');
                                groups.forEach(g => {
                                    const match = g.match(/([А-Яа-яA-Za-z\s\.]+)\((.*?)\)/);
                                    if (match) {
                                        const subject = match[1].trim().toLowerCase();
                                        const teachers = match[2].split(',');
                                        teachers.forEach(t => {
                                            const tName = t.trim().toLowerCase().replace(/\./g, '');
                                            if (tName.length > 2) map[tName] = subject;
                                        });
                                    }
                                });
                            }
                        });
                    });
                });
                scheduleCache = map;
                lastModifiedSchedule = stats.mtimeMs;
            }
        }
    } catch (e) {
        console.error('Qosymsha excel parse error:', e);
        if (!scheduleCache) scheduleCache = {};
    }

    return { scheduleMap: scheduleCache || {}, loadMap: loadCache || {} };
}

export function resolveRealSpecialty(teacherName: string, dbSpecialty: string): string {
    const { scheduleMap, loadMap } = getExcelSpecialties();
    const tName = teacherName.trim().toLowerCase().replace(/\./g, '');
    
    // Извлекаем фамилию (первое слово) из имени учителя для надёжного матчинга
    const tLastName = tName.split(' ')[0];
    
    // 1. Сначала ищем настоящую специальность в таблице нагрузки (это точнее всего!)
    for (const key in loadMap) {
        const keyLastName = key.split(' ')[0];
        if (tLastName.length > 3 && keyLastName === tLastName) {
            // Если в нагрузке написано "косымша", идём дальше
            if (!loadMap[key].toLowerCase().includes('косымша') && !loadMap[key].toLowerCase().includes('қосымша')) {
                return loadMap[key].charAt(0).toUpperCase() + loadMap[key].slice(1);
            }
        }
    }

    // 2. Если в нагрузке "косымша", ищем предмет в расписании
    for (const key in scheduleMap) {
        const keyLastName = key.split(' ')[0];
        if (tLastName.length > 3 && (keyLastName === tLastName || tLastName.includes(keyLastName))) {
            return scheduleMap[key].charAt(0).toUpperCase() + scheduleMap[key].slice(1);
        }
    }
    
    // 3. Fallback на БД
    if (dbSpecialty && dbSpecialty !== 'Общий профиль' && !dbSpecialty.toLowerCase().includes('косымша')) {
        return dbSpecialty;
    }
    
    return 'Общий профиль';
}
