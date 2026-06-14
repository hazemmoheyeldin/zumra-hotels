/**
 * Generate csvHotels.ts from enrichment-output.json
 * Uses 'h{N}' IDs matching the existing app convention.
 */
const fs = require('fs');
const path = require('path');

const INPUT_PATH = path.join(__dirname, 'enrichment-output.json');
const OUTPUT_PATH = path.join(__dirname, '..', 'src', 'lib', 'csvHotels.ts');

const hotels = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf-8'));

function esc(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, "\\'").replace(/\n/g, ' ').replace(/\r/g, '');
}

let lines = [];
lines.push(`/**`);
lines.push(` * Auto-generated hotel data from System Hotels_Data.xlsx`);
lines.push(` * Source: System Hotels_Data.xlsx (${hotels.length} hotels)`);
lines.push(` * Generated: ${new Date().toISOString()}`);
lines.push(` */`);
lines.push(`import { Hotel } from '../types';`);
lines.push('');
lines.push(`export const CSV_HOTELS: Hotel[] = [`);

hotels.forEach((h, i) => {
  const id = `h${i + 1}`;
  const rt = (h.roomTypes || []).map(v => `'${esc(v)}'`).join(',');
  const mp = (h.mealPlans || []).map(v => `'${esc(v)}'`).join(',');
  const vw = (h.views || []).map(v => `'${esc(v)}'`).join(',');

  lines.push(
    `  {id:'${id}',hotelNumber:${i + 1},name:"${esc(h.name)}",nameAr:"${esc(h.arabicName)}",city:'${esc(h.city)}',stars:${h.stars || 0},address:'${esc(h.address)}',contact:'',roomTypes:[${rt}],views:[${vw}],mealPlans:[${mp}]},`
  );
});

lines.push(`];`);
lines.push('');

fs.writeFileSync(OUTPUT_PATH, lines.join('\n'), 'utf-8');
console.log(`Generated ${OUTPUT_PATH}`);
console.log(`Total hotels: ${hotels.length}`);
console.log(`First: ${hotels[0].name} (${(hotels[0].roomTypes || []).length} room types)`);
console.log(`Last: ${hotels[hotels.length - 1].name}`);
