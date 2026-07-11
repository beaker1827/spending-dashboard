import { SHEET_ID, SHEET_TAB, SHEET_RANGE, API_KEY, CATEGORIES, GROCERY_SUBITEMS, MONTHS } from './config';

function parseMoney(cell) {
  if (cell === undefined || cell === null || cell === '') return 0;
  const n = Number(String(cell).replace(/[$,]/g, ''));
  return Number.isFinite(n) ? Math.abs(n) : 0;
}

export async function fetchSpendingData() {
  if (!API_KEY) {
    throw new Error('Missing VITE_GOOGLE_SHEETS_API_KEY environment variable.');
  }
  const range = encodeURIComponent(`'${SHEET_TAB}'!${SHEET_RANGE}`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?key=${API_KEY}`;

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sheets API error (${res.status}): ${body}`);
  }
  const json = await res.json();
  const rows = json.values || [];

  // Build a lookup: category name -> { monthly: number[12], target: number|null }
  const byName = {};
  for (const name of CATEGORIES) {
    byName[name] = { name, monthly: new Array(MONTHS.length).fill(0), target: null };
  }

  for (const row of rows) {
    const label = (row[0] || '').toString().trim();
    if (!label) continue;

    const monthly = MONTHS.map((_, i) => parseMoney(row[1 + i]));
    const targetCell = row[13];
    const target = targetCell !== undefined && String(targetCell).trim() !== '' ? parseMoney(targetCell) : null;

    if (GROCERY_SUBITEMS.includes(label)) {
      const g = byName['Groceries'];
      g.monthly = g.monthly.map((v, i) => v + monthly[i]);
      continue;
    }

    if (byName[label]) {
      byName[label].monthly = monthly;
      if (target !== null) byName[label].target = target;
    }
  }

  return CATEGORIES.map((name) => byName[name]);
}
