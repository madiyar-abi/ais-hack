export const classSizes: Record<string, number> = {
    '7A': 15, '7B': 9,  '7C': 14,
    '8A': 20, '8B': 20, '8C': 22, '8D': 16,
    '9A': 23, '9B': 19,
    '10A': 20, '10B': 19,
    '11A': 26, '11B': 24
};

// Core list of officially recognized classes for auto-fill logic (Using Latin A, B, C, D)
export const officialClasses = [
    '7A', '7B', '7C',
    '8A', '8B', '8C', '8D',
    '9A', '9B',
    '10A', '10B',
    '11A', '11B'
];

export function parseAttendanceAI(text: string) {
  const lower = text.toLowerCase();
  
  const classMatch = lower.match(/(?:в\s+)?(\d{1,2}\s*[а-яa-z])/i);
  let rawClassName = classMatch ? classMatch[1].toUpperCase().replace(/\s/g, '') : 'Неизвестный класс';

  // Normalize Cyrillic letters to Latin for consistency and modern display (A, B, C, D)
  const cyrillicToLatin: Record<string, string> = { 'А': 'A', 'Б': 'B', 'В': 'C', 'Г': 'D', 'Д': 'D' };
  let className = rawClassName.replace(/[АБВГД]/g, (match) => cyrillicToLatin[match] || match);

  const allPresent = /все (присутству|присуству|на месте)|(присутству|присуству) все|стопроцентная|без больных/i.test(lower);
  const nonePresent = /никто не приш|все (отсутству|болеют)/i.test(lower);

  const totalMatch = lower.match(/(\d+)\s*(чел|учен|списк|всего)/i);
  let totalCount = classSizes[className] || classSizes[rawClassName] || 25;
  
  if (totalMatch) {
    totalCount = parseInt(totalMatch[1], 10);
  }

  const numMatch = lower.match(/(\d+)\s*(забол|отсут|боле|не приш)/i);
  let absentCount = 0;

  if (allPresent) {
     absentCount = 0;
  } else if (nonePresent) {
     absentCount = totalCount;
  } else if (numMatch) {
    absentCount = parseInt(numMatch[1], 10);
  } else {
    if (lower.includes('болеет') || lower.includes('отсутствует')) {
       const digits = lower.match(/\d+/g);
       if (digits) {
          const filteredDigits = digits.map(d => parseInt(d, 10)).filter(d => d < 40 && d !== parseInt(className.replace(/\D/g, ''), 10));
          if (filteredDigits.length > 0) {
             absentCount = Math.min(...filteredDigits);
          }
       }
    }
  }

  if (className !== 'Неизвестный класс' && absentCount === 0 && !allPresent && !nonePresent) absentCount = 1;

  return { className, absentCount, totalCount };
}

export function generateAttendanceReport(messages: any[]) {
    const reportMap = new Map();

    // 1. Process messages (newest first). Map.set overwrites older ones, but wait!
    // If messages are ordered DESC by timestamp, the FIRST one we encounter is the NEWEST.
    // So we should only add to map if the class IS NOT YET in the map.
    for (const msg of messages) {
       const parsed = parseAttendanceAI(msg.text);
       const tClass = parsed.className; 
       
       if (tClass !== 'Неизвестный класс' && !reportMap.has(tClass)) {
           reportMap.set(tClass, {
               id: msg.id,
               sender: msg.sender_name || msg.sender_phone,
               time: new Date(msg.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
               text: msg.text,
               className: tClass,
               absentCount: parsed.absentCount,
               totalStudents: parsed.totalCount,
               presentCount: parsed.totalCount - parsed.absentCount,
               isAuto: false
           });
       }
    }

    // 2. Synthesize Auto-fill for missing official classes
    for (const cls of officialClasses) {
        if (!reportMap.has(cls)) {
            const total = classSizes[cls] || 25;
            reportMap.set(cls, {
                id: `auto-${cls}`,
                sender: 'Авто-система',
                time: '-',
                text: 'Отчет не предоставлен. Автоматически: 100% явка.',
                className: cls,
                absentCount: 0,
                totalStudents: total,
                presentCount: total,
                isAuto: true
            });
        }
    }

    const allReports = Array.from(reportMap.values());
    
    // 3. Sort intelligently (7A -> 7B -> 8A)
    allReports.sort((a, b) => {
        const gradeA = parseInt(a.className) || 0;
        const gradeB = parseInt(b.className) || 0;
        if (gradeA !== gradeB) return gradeA - gradeB;
        return a.className.localeCompare(b.className);
    });

    // 4. Divide into the 3 requested groups
    const group1 = allReports.filter(r => r.className.startsWith('7') || r.className.startsWith('8'));
    const group2 = allReports.filter(r => r.className.startsWith('9') || r.className.startsWith('10'));
    const group3 = allReports.filter(r => r.className.startsWith('11'));

    const totalAbsent = allReports.reduce((sum, r) => sum + r.absentCount, 0);

    return {
       allReports,
       totalAbsent,
       groups: [
           { id: 'g1', title: '7-8 классы', data: group1 },
           { id: 'g2', title: '9-10 классы', data: group2 },
           { id: 'g3', title: '11 классы', data: group3 }
       ]
    };
}
