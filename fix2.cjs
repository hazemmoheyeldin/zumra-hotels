const fs = require('fs');
let f = fs.readFileSync('src/components/ReservationsPage.tsx', 'utf8');
const lines = f.split('\n');
let changes = 0;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('className={mt-1.5 text-[9px] font-bold px-2 py-1 rounded')) {
    lines[i] = lines[i].replace('className={mt-1.5', 'className={' + String.fromCharCode(96) + 'mt-1.5').replace('}}' + '>', String.fromCharCode(96) + '}}' + '>');
    changes++;
    console.log('Fixed className line', i+1);
  }
  if (lines[i].includes('className={mt-1 text-[9px] font-bold px-2 py-1 rounded')) {
    lines[i] = lines[i].replace('className={mt-1', 'className={' + String.fromCharCode(96) + 'mt-1').replace('}}' + '>', String.fromCharCode(96) + '}}' + '>');
    changes++;
    console.log('Fixed className line', i+1);
  }
}
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('{\u{1F4B5}} Client:')) {
    lines[i] = lines[i].replace('{\u{1F4B5}} Client:', '\u{1F4B5} Client:');
    changes++;
  }
  if (lines[i].includes('{\u{1F4B8}} Supplier:')) {
    lines[i] = lines[i].replace('{\u{1F4B8}} Supplier:', '\u{1F4B8} Supplier:');
    changes++;
  }
}
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('\u{0024}{\u0027\u2014 \u0027}{resObj.clientCreditNote}')) {
    lines[i] = lines[i].replace('\u{0024}{\u0027\u2014 \u0027}{resObj.clientCreditNote}', String.fromCharCode(96) + ' \u2014 \u{0024}{resObj.clientCreditNote}' + String.fromCharCode(96));
    changes++;
  }
  if (lines[i].includes('\u{0024}{\u0027\u2014 \u0027}{resObj.supplierCreditNote}')) {
    lines[i] = lines[i].replace('\u{0024}{\u0027\u2014 \u0027}{resObj.supplierCreditNote}', String.fromCharCode(96) + ' \u2014 \u{0024}{resObj.supplierCreditNote}' + String.fromCharCode(96));
    changes++;
  }
}
if (changes > 0) {
  f = lines.join('\n');
  fs.writeFileSync('src/components/ReservationsPage.tsx', f, 'utf8');
  console.log('Applied ' + changes + ' fixes');
} else {
  console.log('No patterns matched');
  for (let i = 1608; i < 1619; i++) { console.log('L'+(i+1)+': '+lines[i].substring(0,120)); }
}
