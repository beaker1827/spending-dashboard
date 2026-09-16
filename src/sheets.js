import { SHEET_ID, SHEET_TAB, SHEET_RANGE, TRANSACTIONS_TAB, TRANSACTIONS_RANGE, API_KEY, CATEGORIES, GROCERY_TOTAL_NAME, GROCERY_TOTAL_COMPONENTS, INCOME_ROW_NAME, TAX_PAYMENTS_ROW_NAME, DIVIDEND_INCOME_ROW_NAME, EXTRA_LOAN_REPAYMENTS_ROW_NAME, MONTHS } from './config';

function parseMoney(cell) {
  if (cell === undefined || cell === null || cell === '') return 0;
  const n = Number(String(cell).replace(/[$,]/g, ''));
  return Number.isFinite(n) ? Math.abs(n) : 0;
}

// Unlike parseMoney, this keeps the sign — used for rows where negative and
// positive values mean genuinely different things and need to net against
// each other (e.g. extra loan repayments vs money brought back out of the
// offset), rather than both being treated as positive spend amounts.
function parseSignedMoney(cell) {
  if (cell === undefined || cell === null || cell === '') return 0;
  const n = Number(String(cell).replace(/[$,]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function sheetUrl(tab, range) {
  const encoded = encodeURIComponent(`'${tab}'!${range}`);
  return `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encoded}?key=${API_KEY}`;
}

// Fetches the optional Transactions tab and groups rows by category.
// Returns {} if the tab doesn't exist or can't be read — the dashboard
// treats a missing transaction list as "no breakdown available" rather
// than an error, so the summary tab alone is still enough to run on.
async function fetchTransactions() {
  try {
    const res = await fetch(sheetUrl(TRANSACTIONS_TAB, TRANSACTIONS_RANGE));
    if (!res.ok) return {};
    const json = await res.json();
    const rows = json.values || [];

        const byCategory = {};
    for (const row of rows) {
      const category = (row[0] || '').toString().trim();
      const date = (row[1] || '').toString().trim();
      const description = (row[2] || '').toString().trim();
      const credit = parseMoney(row[3]);
      const debit = parseMoney(row[4]);
      if (!category) continue;
      if (!date && !description && credit === 0 && debit === 0) continue;

      // Net effect on spend: a debit adds to the category total, a credit
      // (refund, money brought back, etc) reduces it.
      const amount = debit - credit;

      if (!byCategory[category]) byCategory[category] = [];
      byCategory[category].push({ date, description, amount });
    }
    return byCategory;
  } catch {
    return {};
  }
}

export async function fetchSpendingData() {
  if (!API_KEY) {
    throw new Error('Missing VITE_GOOGLE_SHEETS_API_KEY environment variable.');
  }

  const [res, transactionsByCategory] = await Promise.all([
    fetch(sheetUrl(SHEET_TAB, SHEET_RANGE)),
    fetchTransactions(),
  ]);

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sheets API error (${res.status}): ${body}`);
  }
  const json = await res.json();
  const rows = json.values || [];

  // Build a lookup: category name -> { monthly: number[12], target: number|null, targetMonths: number[], weeklyCadence: boolean, fixed: boolean }
  const byName = {};
  for (const name of CATEGORIES) {
    byName[name] = { name, monthly: new Array(MONTHS.length).fill(0), target: null, targetMonths: [], weeklyCadence: false, fixed: false };
  }

  let incomeMonthly = new Array(MONTHS.length).fill(0);
  let taxPaymentsMonthly = new Array(MONTHS.length).fill(0);
  let dividendIncomeMonthly = new Array(MONTHS.length).fill(0);
  let extraLoanRepaymentsMonthly = new Array(MONTHS.length).fill(0);

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
    if (label === EXTRA_LOAN_REPAYMENTS_ROW_NAME) {
      extraLoanRepaymentsMonthly = MONTHS.map((_, i) => parseSignedMoney(row[1 + i]));
      continue;
    }

    if (!byName[label]) continue;

    const monthly = MONTHS.map((_, i) => parseMoney(row[1 + i]));
    const targetCell = row[13];
    const target = targetCell !== undefined && String(targetCell).trim() !== '' ? parseMoney(targetCell) : null;
    const targetMonthCell = (row[14] || '').toString().trim();
    const isWeekly = targetMonthCell.toLowerCase() === 'weekly';
    const targetMonths = !isWeekly && targetMonthCell
      ? targetMonthCell
          .split(',')
          .map((s) => s.trim().slice(0, 3).toLowerCase())
          .filter(Boolean)
          .map((s) => MONTHS.findIndex((m) => m.slice(0, 3).toLowerCase() === s))
          .filter((i) => i !== -1)
          .sort((a, b) => a - b)
      : [];
    const isFixed = (row[15] || '').toString().trim() !== '';

    byName[label].monthly = monthly;
    if (target !== null) byName[label].target = target;
    if (targetMonths.length > 0) byName[label].targetMonths = targetMonths;
    byName[label].weeklyCadence = isWeekly;
    byName[label].fixed = isFixed;
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
    extraLoanRepayments: extraLoanRepaymentsMonthly,
    transactionsByCategory,
  };
}
