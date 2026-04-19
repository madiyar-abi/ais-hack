const xlsx = require('xlsx');

function buildTeacherSubjectMap() {
    console.log("Parsing...");
    const wb = xlsx.readFile('./для хакатона расписание.xlsx');
    const map = {};
    wb.SheetNames.forEach(sheetName => {
        const sheet = wb.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        data.forEach(row => {
            row.forEach(cell => {
                if (typeof cell === 'string') {
                    // Match pattern: Предмет(Учитель1, Учитель2)
                    // e.g. "Математика(ЖоламанМ, Даулетбаева С)/англ.яз(Таңатар М)"
                    const groups = cell.split('/');
                    groups.forEach(g => {
                        const match = g.match(/([А-Яа-яA-Za-z\s\.]+)\((.*?)\)/);
                        if (match) {
                            const subject = match[1].trim();
                            const teachers = match[2].split(',');
                            teachers.forEach(t => {
                                map[t.trim().toLowerCase()] = subject;
                            });
                        } else {
                            // "Орыс тілі Гореева А.М." pattern
                            const words = g.trim().split(' ');
                            if (words.length >= 3 && !g.includes('(')) {
                                // Assume last two words are teacher name? Hard. 
                                // But qosymsha is usually formatted with parentheses!
                            }
                        }
                    });
                }
            });
        });
    });
    return map;
}

console.log(buildTeacherSubjectMap());
