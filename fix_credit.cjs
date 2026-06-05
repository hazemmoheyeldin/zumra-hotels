const fs = require('fs');
let f = fs.readFileSync('src/components/ReservationsPage.tsx', 'utf8');
const lines = f.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("className={mt-1.5 text-[9px] font-bold px-2 py-1 rounded")) {
    lines[i] = lines[i].replace(
      /className=\{mt-1\.5 text-\[9px\] font-bold px-2 py-1 rounded (.+?)\}\}>/,
      'className={mt-1.5 text-[9px] font-bold px-2 py-1 rounded ' + String.fromCharCode(36) + '{' + String.fromCharCode(36) + '{1}}}' + '>'
    );
  }
}
