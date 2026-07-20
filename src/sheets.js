import { SHEET_ID, SHEET_TAB, SHEET_RANGE, API_KEY, CATEGORIES, GROCERY_TOTAL_NAME, GROCERY_TOTAL_COMPONENTS, INCOME_ROW_NAME, TAX_PAYMENTS_ROW_NAME, DIVIDEND_INCOME_ROW_NAME, MONTHS } from './config';

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

  // Build a lookup: category name -> { monthly: number[12], target: number|null, targetMonths: number[] }
  const byName = {};
  for (const name of CATEGORIES) {
    byName[name] = { name, monthly: new Array(MONTHS.length).fill(0), target: null, targetMonths: [] };
  }

  let incomeMonthly = new Array(MONTHS.length).fill(0);
  let taxPaymentsMonthly = new Array(MONTHS.length).fill(0);
  let dividendIncomeMonthly = new Array(MONTHS.length).fill(0);

  for (const row of rows) {
    const label = (row[0] || '').toString().trim();
    if (!label) continue;

    if (label === INCOME_ROW_NAME) {
      incomeMonthly = MONTHS.map((_, i) => parseMoney(row[1 + i]));
      continue;
    }
    if (label === TAX_PAYMENTS_ROW_NAME) {
      taxPaymentsMonthly = MONTHS.map((_, i) => parseMoney(row[1 + i]));
      continue;
    }
    if (label === DIVIDEND_INCOME_ROW_NAME) {
      dividendIncomeMonthly = MONTHS.map((_, i) => parseMoney(row[1 + i]));
      continue;
    }

    if (!byName[label]) continue;

    const monthly = MONTHS.map((_, i) => parseMoney(row[1 + i]));
    const targetCell = row[13];
    const target = targetCell !== undefined && String(targetCell).trim() !== '' ? parseMoney(targetCell) : null;
    const targetMonthCell = (row[14] || '').toString().trim();
    const targetMonths = targetMonthCell
      ? targetMonthCell
          .split(',')
          .map((s) => s.trim().slice(0, 3).toLowerCase())
          .filter(Boolean)
          .map((s) => MONTHS.findIndex((m) => m.slice(0, 3).toLowerCase() === s))
          .filter((i) => i !== -1)
          .sort((a, b) => a - b)
      : [];

    byName[label].monthly = monthly;
    if (target !== null) byName[label].target = target;
    if (targetMonths.length > 0) byName[label].targetMonths = targetMonths;
  }

  // Groceries (Total) isn't allocated transactions directly — it's the sum
  // of the individual grocery lines above it. Its own target (if any is set
  // on that row in the sheet) is left as-is from the parsing above.
  byName[GROCERY_TOTAL_NAME].monthly = MONTHS.map((_, i) =>
    GROCERY_TOTAL_COMPONENTS.reduce((total, name) => total + (byName[name] ? byName[name].monthly[i] : 0), 0)
  );

  return {
    categories: CATEGORIES.map((name) => byName[name]),
    income: incomeMonthly,
    taxPayments: taxPaymentsMonthly,
    dividendIncome: dividendIncomeMonthly,
  };
}
