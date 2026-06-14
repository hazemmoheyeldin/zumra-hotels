/**
 * One-time enrichment script: Parse System Hotels_Data.xlsx
 * and push hotel data (room types, meal plans, views) to Firestore.
 */
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const EXCEL_PATH = 'C:\\Users\\hazem\\OneDrive\\Desktop\\System Hotels_Data.xlsx';
const OUTPUT_PATH = path.join(__dirname, 'enrichment-output.json');

const normalize = (str) =>
  str ? str.toString().replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '').toLowerCase() : '';

console.log('Reading Excel:', EXCEL_PATH);
const wb = XLSX.readFile(EXCEL_PATH);

// --- Sheet 0: Hotels ---
const hotelsSheet = wb.Sheets['Hotels'];
const hotelsRows = XLSX.utils.sheet_to_json(hotelsSheet);
console.log(`Hotels: ${hotelsRows.length} rows`);

// --- Sheet 1: Room Types ---
const roomTypesSheet = wb.Sheets['Room Types'];
const roomTypesRows = XLSX.utils.sheet_to_json(roomTypesSheet);
console.log(`Room Types: ${roomTypesRows.length} rows`);

// --- Sheet 2: Meal Plans ---
const mealPlansSheet = wb.Sheets['Meal Plans'];
const mealPlansRows = XLSX.utils.sheet_to_json(mealPlansSheet);
console.log(`Meal Plans: ${mealPlansRows.length} rows`);

// --- Sheet 3: Room Views ---
const viewsSheet = wb.Sheets['Room Views'];
const viewsRows = XLSX.utils.sheet_to_json(viewsSheet);
console.log(`Room Views: ${viewsRows.length} rows`);

// Group enrichment data by normalized hotel name
const enrichmentMap = {};

roomTypesRows.forEach(row => {
  const hotelName = String(row['Hotel Name'] || '').trim();
  const roomTypeName = String(row['Room Type Name'] || '').trim();
  if (!hotelName || !roomTypeName) return;
  const key = normalize(hotelName);
  if (!enrichmentMap[key]) enrichmentMap[key] = { roomTypes: [], mealPlans: [], views: [] };
  if (!enrichmentMap[key].roomTypes.includes(roomTypeName)) {
    enrichmentMap[key].roomTypes.push(roomTypeName);
  }
});

mealPlansRows.forEach(row => {
  const hotelName = String(row['Hotel Name'] || '').trim();
  const mealPlanName = String(row['Meal Plan Name'] || '').trim();
  if (!hotelName || !mealPlanName) return;
  const key = normalize(hotelName);
  if (!enrichmentMap[key]) enrichmentMap[key] = { roomTypes: [], mealPlans: [], views: [] };
  if (!enrichmentMap[key].mealPlans.includes(mealPlanName)) {
    enrichmentMap[key].mealPlans.push(mealPlanName);
  }
});

viewsRows.forEach(row => {
  const hotelName = String(row['Hotel Name'] || '').trim();
  const viewName = String(row['Room View Name'] || '').trim();
  if (!hotelName || !viewName) return;
  const key = normalize(hotelName);
  if (!enrichmentMap[key]) enrichmentMap[key] = { roomTypes: [], mealPlans: [], views: [] };
  if (!enrichmentMap[key].views.includes(viewName)) {
    enrichmentMap[key].views.push(viewName);
  }
});

// Build final output: array of hotel enrichment objects
const output = [];
hotelsRows.forEach(hotel => {
  const key = normalize(String(hotel['Name'] || ''));
  const enrichment = enrichmentMap[key];
  if (!enrichment) return;

  output.push({
    id: String(hotel['ID']),
    name: hotel['Name'],
    arabicName: hotel['Arabic Name'] || '',
    displayName: hotel['Display Name'] || hotel['Name'],
    country: String(hotel['Country'] || '').trim(),
    city: String(hotel['City'] || '').trim(),
    stars: hotel['Stars'] || 0,
    address: hotel['Address'] || '',
    arabicAddress: hotel['Arabic Address'] || '',
    website: hotel['Website'] || '',
    email: hotel['Email'] || '',
    gaztNo: hotel['GAZT No'] || '',
    vatNo: hotel['VAT No'] || '',
    switchCode: hotel['Switch Code'] || '',
    roomTypes: enrichment.roomTypes,
    mealPlans: enrichment.mealPlans,
    views: enrichment.views,
    _normKey: key,
  });
});

console.log(`\nEnrichment output: ${output.length} hotels`);
console.log(`Hotels with room types: ${output.filter(h => h.roomTypes.length > 0).length}`);
console.log(`Hotels with meal plans: ${output.filter(h => h.mealPlans.length > 0).length}`);
console.log(`Hotels with views: ${output.filter(h => h.views.length > 0).length}`);

// Log samples
console.log('\n--- Sample Hotel ---');
console.log(JSON.stringify(output[0], null, 2));

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');
console.log(`\nOutput saved to: ${OUTPUT_PATH}`);
console.log('Now run: node scripts/push-enrichment.js');
