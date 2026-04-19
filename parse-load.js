const xlsx = require('xlsx');

const loadPath = '/Users/caliskan/ais hack/ais-hack/нагрузка учителей для хакатона 2025-2026.xlsx';
const loadWorkbook = xlsx.readFile(loadPath);
const loadSheet = loadWorkbook.Sheets[loadWorkbook.SheetNames[0]];
const loadData = xlsx.utils.sheet_to_json(loadSheet, { header: 1 });

for (let i = 0; i < loadData.length; i++) {
    const row = loadData[i];
    if (row && row.join(' ').toLowerCase().includes('қазиев')) {
        console.log(`Found Qaziyev at row ${i}:`, row);
    }
}
