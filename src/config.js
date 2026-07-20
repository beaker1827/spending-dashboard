// ---- Sheet source config ----
// The Google Sheet ID and tab name that hold the FY2026/27 spending data.
// Set VITE_GOOGLE_SHEETS_API_KEY in your Vercel project's environment variables.
export const SHEET_ID = import.meta.env.VITE_SHEET_ID || '14ITWuWHTl99kE0QlehSu4jP3ppGgXfLpg8aJiIAKxCw';
export const SHEET_TAB = import.meta.env.VITE_SHEET_TAB || '2026/27 spending';
export const API_KEY = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY || '';

// Range covers category names (A), 12 months Jul-Jun (B:M), an optional
// "Annual Target" column (N), and an optional "Target Month(s) / Cadence"
// column (O).
// Leave N blank for categories you're not tracking a target for. Leave O
// blank for anything billed roughly once a month (health insurance, etc) —
// the expected-to-date line steps up in whole-month increments.
// Fill in O with the word "Weekly" for a category paid via regular weekly
// direct debit (school fees, etc) — the expected-to-date line moves
// smoothly day by day instead of jumping in monthly steps, so it tracks
// actual weekly spending much more closely.
// Fill in O with ONE month abbreviation (Jul, Aug, Sept, Oct, Nov, Dec, Jan,
// Feb, Mar, Apr, May, June — full names like "October" also work) for a
// category that's a single annual lump sum due in a known month (car
// insurance) — the expected-to-date line sits at $0 until that month, then
// jumps to the full target.
// Fill in O with SEVERAL comma-separated months (e.g. "Aug, Nov, Feb, May")
// for a category billed several times a year in known months (quarterly
// council rates) — the annual target splits evenly across however many
// months you list, and the expected-to-date line steps up by one instalment
// each time one of those months arrives.
export const SHEET_RANGE = `A1:O80`;

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
export const OVERALL_ANNUAL_TARGET = 170000;

// The label (column A) for the row that holds total monthly income —
// salaries and other credits. Read separately from the spending categories,
// shown as its own stat box rather than in either table.
export const INCOME_ROW_NAME = 'Income';

// Tracked separately from the spending categories, shown as their own boxes
// rather than in the category tables — and excluded from Projected Annual.
export const TAX_PAYMENTS_ROW_NAME = 'Tax payments';
export const DIVIDEND_INCOME_ROW_NAME = 'Dividend Income';

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
];

// Returns how many months of FY2026/27 (Jul->Jun) have elapsed, counting the
// current month as elapsed. Used for run-rate and YTD-target projections.
export function fyMonthsElapsed(date = new Date()) {
  const m = date.getMonth(); // 0 = Jan ... 11 = Dec
  const fyIndex = m >= 6 ? m - 6 : m + 6; // 0 = Jul ... 11 = Jun
  return fyIndex + 1;
}

// Returns how many days into FY2026/27 (starting 1 July) the given date is,
// counting today as day 1. Used for smooth day-by-day pro-rating of
// "Weekly" cadence categories, instead of the coarser whole-month steps.
export function fyDaysElapsed(date = new Date()) {
  const y = date.getFullYear();
  const fyStartYear = date.getMonth() >= 6 ? y : y - 1; // FY starts 1 July
  const fyStart = new Date(fyStartYear, 6, 1);
  const diffMs = date - fyStart;
  return Math.floor(diffMs / 86400000) + 1;
}

// Total number of days in the current financial year (365 or 366).
export function fyTotalDays(date = new Date()) {
  const y = date.getFullYear();
  const fyStartYear = date.getMonth() >= 6 ? y : y - 1;
  const fyStart = new Date(fyStartYear, 6, 1);
  const fyEnd = new Date(fyStartYear + 1, 6, 1);
  return Math.round((fyEnd - fyStart) / 86400000);
}
