// ---- Sheet source config ----
// The Google Sheet ID and tab name that hold the FY2026/27 spending data.
// Set VITE_GOOGLE_SHEETS_API_KEY in your Vercel project's environment variables.
export const SHEET_ID = import.meta.env.VITE_SHEET_ID || '14ITWuWHTl99kE0QlehSu4jP3ppGgXfLpg8aJiIAKxCw';
export const SHEET_TAB = import.meta.env.VITE_SHEET_TAB || '2026/27 spending';
export const API_KEY = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY || '';

// Range covers category names (A), 12 months Jul-Jun (B:M) and an optional
// "Annual Target" column (N) that you can fill in for any category, any time —
// leave it blank for categories you're not tracking a target for.
export const SHEET_RANGE = `A1:N80`;

// Financial year months, in sheet column order.
export const MONTHS = ['Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'June'];

// The individual grocery lines that roll up into "Groceries (Total)" —
// each can have its own target, and the total is computed by summing these,
// not read from its own row (no transactions get allocated directly to it).
export const GROCERY_TOTAL_NAME = 'Groceries (Total)';
export const GROCERY_TOTAL_COMPONENTS = [
  'Groceries (general, butcher, bakery)',
  'IGA',
  'Aldi',
  'Woolies',
  'Coles',
  'Asian',
];

// Overall household annual spending target — a single top-level figure,
// separate from the per-category targets in column N. Edit this number
// directly whenever your target changes.
export const OVERALL_ANNUAL_TARGET = 192363;

// The label (column A) for the row that holds total monthly income —
// salaries and other credits. Read separately from the spending categories,
// shown as its own stat box rather than in either table.
export const INCOME_ROW_NAME = 'Income';

// The category list, in display order. Must match the text in column A of
// the sheet exactly. Unknown rows in the sheet are ignored; categories listed
// here but missing from the sheet simply show as $0.
export const CATEGORIES = [
  'Mortgage Loan repayment',
  'Extra loan repayments',
  'RMG loan repayment',
  'Splurge',
  'Smile',
  ...GROCERY_TOTAL_COMPONENTS,
  GROCERY_TOTAL_NAME,
  'Fuel',
  'Electricity',
  'Water',
  'Health insurance',
  'Income Insurance etc',
  'Health care',
  'Rafa',
  'School fees',
  'Extra school costs (uniforms etc)',
  'Internet and phone and music',
  'Car insurance',
  'CoGB Rates',
  'Home and contents (bike) insurance',
  'Home maintenance',
  'Pool',
  'Clothing',
  'Subscriptions (TV, Choice, Cloud etc)',
  'Swimming',
  'Netball and Dance',
  'Random other',
  'Basketball and Trainerroad',
  'Bec nursing rego/union',
  'Additional travel (over and above smile)',
  'Dining out and takeaway',
  'Car servicing, parking etc (extra over rego)',
  'General shopping (Amazon, Temu, eBay, Kitchen Warehouse)',
  'Entertainment & Events (Ticketek, cinema, gigs)',
  'Alcohol',
  'Personal care & beauty',
  'Studio Daisie',
  'Pets',
 'Kids sport/activities (other) and iphone, birthdays, random',
  'Tax payments',
];

// Returns how many months of FY2026/27 (Jul->Jun) have elapsed, counting the
// current month as elapsed. Used for run-rate and YTD-target projections.
export function fyMonthsElapsed(date = new Date()) {
  const m = date.getMonth(); // 0 = Jan ... 11 = Dec
  const fyIndex = m >= 6 ? m - 6 : m + 6; // 0 = Jul ... 11 = Jun
  return fyIndex + 1;
}
