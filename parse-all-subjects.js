const xlsx = require('xlsx');

const schedulePath = '/Users/caliskan/ais hack/ais-hack/для хакатона расписание.xlsx';
const scheduleWorkbook = xlsx.readFile(schedulePath);
const scheduleSheet = scheduleWorkbook.Sheets[scheduleWorkbook.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(scheduleSheet, { header: 1 });

const subjects = new Set();

for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    for (let col = 1; col < row.length; col++) {
        if (typeof row[col] === 'string' && row[col].includes('(')) {
            const match = row[col].match(/\((.*?)\s+([А-ЯЁ][а-яё]+(?: [А-ЯЁ][а-яё]+)+.*?)\)/);
            if (match) {
                subjects.add(match[1].trim());
            }
        }
    }
}

console.log(Array.from(subjects).sort().join('\n'));
