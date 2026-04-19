const xlsx = require('xlsx');

// Load 'нагрузка учителей'
const loadPath = '/Users/caliskan/ais hack/ais-hack/нагрузка учителей для хакатона 2025-2026.xlsx';
const loadWorkbook = xlsx.readFile(loadPath);
const loadSheet = loadWorkbook.Sheets[loadWorkbook.SheetNames[0]];
const loadData = xlsx.utils.sheet_to_json(loadSheet, { header: 1 });

const rawSpecialties = new Set();
// Assuming format is similar to import script: col 1 is Name, col 13 is Specialty, col 5 is KZ/RU status
for(let i=1; i<loadData.length; i++) {
    const row = loadData[i];
    if (row && row[13]) {
        rawSpecialties.add(row[13]);
    }
}

console.log("Raw Specialties from Workload:");
console.log(Array.from(rawSpecialties).join(', '));

// Load 'расписание'
const schedulePath = '/Users/caliskan/ais hack/ais-hack/для хакатона расписание.xlsx';
const scheduleWorkbook = xlsx.readFile(schedulePath);
const scheduleSheet = scheduleWorkbook.Sheets[scheduleWorkbook.SheetNames[0]];
const scheduleData = xlsx.utils.sheet_to_json(scheduleSheet, { header: 1 });

const scheduleSubjects = new Set();
for(let i=1; i<scheduleData.length; i++) {
    const row = scheduleData[i];
    // Subject is usually embedded with teacher name or in specific columns.  Let's look at col 2-6.
    for (let c=2; c<row.length; c++) {
        if (typeof row[c] === 'string' && row[c].trim().length > 0) {
            // Very noisy, let's extract subjects roughly (before teacher names)
            const parts = row[c].split('(')[0].trim();
            if (parts.length > 2 && !parts.match(/^\d+/) && !parts.includes('Каб')) {
                scheduleSubjects.add(parts);
            }
        }
    }
}

// console.log("\nSubjects visually parsed from schedule:");
// console.log(Array.from(scheduleSubjects).slice(0, 50).join(' | '));

