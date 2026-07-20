import { useEffect, useMemo, useState } from 'react';
import { fetchSpendingData } from './sheets';
import { MONTHS, fyMonthsElapsed, fyWeeksElapsed, OVERALL_ANNUAL_TARGET, GROCERY_TOTAL_NAME } from './config';
import './App.css';

const money = (n) =>
  n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });

export default function App() {
  const [categories, setCategories] = useState(null);
  const [income, setIncome] = useState(null);
  const [taxPayments, setTaxPayments] = useState(null);
  const [dividendIncome, setDividendIncome] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSpendingData()
      .then(({ categories, income, taxPayments, dividendIncome }) => {
        setCategories(categories);
        setIncome(income);
        setTaxPayments(taxPayments);
        setDividendIncome(dividendIncome);
      })
      .catch((e) => setError(e.message));
  }, []);

  const monthsElapsed = fyMonthsElapsed();
  const weeksElapsed = fyWeeksElapsed();

  const rows = useMemo(() => {
    if (!categories) return [];
    return categories.map((c) => {
      const ytd = sum(c.monthly);
      let ytdTarget = null;
      if (c.target != null) {
        if (c.targetMonths && c.targetMonths.length > 0) {
          // Lump-sum or instalment category: the target splits evenly across
          // however many due months are listed, and steps up by one
          // instalment each time one of those months arrives.
          const instalment = c.target / c.targetMonths.length;
          const currentMonthIndex = monthsElapsed - 1;
          const elapsedInstalments = c.targetMonths.filter((m) => currentMonthIndex >= m).length;
          ytdTarget = elapsedInstalments * instalment;
        } else if (c.weeklyCadence) {
          // Weekly direct debit: step up once per week (52 even instalments
          // across the year) rather than jumping in whole-month steps.
          ytdTarget = (c.target / 52) * weeksElapsed;
        } else {
          // Default: pro-rate evenly across the whole months elapsed so far.
          ytdTarget = (c.target / 12) * monthsElapsed;
        }
      }
      const status = ytdTarget == null ? 'neutral' : ytd > ytdTarget ? 'over' : 'under';
      const yearlyExpected = c.target != null ? c.target : monthsElapsed ? (ytd / monthsElapsed) * 12 : 0;
      return { ...c, ytd, ytdTarget, status, yearlyExpected };
    });
  }, [categories, monthsElapsed, weeksElapsed]);

  // Groceries (Total) is a derived row — its YTD and budget are already the
  // sum of the individual grocery lines above it — so it's excluded here to
  // avoid double-counting those dollars in the headline totals. It's still
  // shown as its own row in the table below for reference.
  const aggregatable = useMemo(() => rows.filter((r) => r.name !== GROCERY_TOTAL_NAME), [rows]);

  const totalYtd = useMemo(() => aggregatable.reduce((s, r) => s + r.ytd, 0), [aggregatable]);
  const monthlyAvg = monthsElapsed ? totalYtd / monthsElapsed : 0;
  const runRate = useMemo(() => aggregatable.reduce((s, r) => s + r.yearlyExpected, 0), [aggregatable]);
  const incomeYtd = useMemo(() => (income ? sum(income) : 0), [income]);
  const taxPaymentsYtd = useMemo(() => (taxPayments ? sum(taxPayments) : 0), [taxPayments]);
  const dividendIncomeYtd = useMemo(() => (dividendIncome ? sum(dividendIncome) : 0), [dividendIncome]);
  const targetVariance = runRate - OVERALL_ANNUAL_TARGET;
  const isOverTarget = targetVariance > 0;

  const targeted = rows.filter((r) => r.target != null);
  const untargeted = rows.filter((r) => r.target == null);
  const untargetedScaleMax = 2500;
  const targetedMax = targeted.length ? Math.max(...targeted.map((r) => Math.max(r.ytd, r.ytdTarget))) : 0;

  if (error) {
    return (
      <div className="ledger-page">
        <div className="ledger-error">
          <h1>Couldn't load the ledger</h1>
          <p>{error}</p>
          <p className="ledger-error__hint">
            Check that <code>VITE_GOOGLE_SHEETS_API_KEY</code> is set and that the sheet is shared so the API key
            can read it.
          </p>
        </div>
      </div>
    );
  }

  if (!categories) {
    return (
      <div className="ledger-page">
        <div className="ledger-loading">Opening the ledger…</div>
      </div>
    );
  }

  return (
    <div className="ledger-page">
      <header className="ledger-masthead">
        <div className="ledger-masthead__title">
          <span className="ledger-eyebrow">Household Ledger</span>
          <h1>FY2026/27 Spending</h1>
        </div>
        <div className="ledger-stamp">
          <div className="ledger-stamp__item ledger-stamp__item--highlight">
            <span className="ledger-stamp__label">Income to date</span>
            <span className="ledger-stamp__value">{money(incomeYtd)}</span>
          </div>
          <div className="ledger-stamp__item">
            <span className="ledger-stamp__label">Spent to date</span>
            <span className="ledger-stamp__value">{money(totalYtd)}</span>
          </div>
          <div className="ledger-stamp__item">
            <span className="ledger-stamp__label">Monthly average</span>
            <span className="ledger-stamp__value">{money(monthlyAvg)}</span>
          </div>
          <div className="ledger-stamp__item">
            <span className="ledger-stamp__label">Projected annual</span>
            <span className="ledger-stamp__value">{money(runRate)}</span>
          </div>
          <div className="ledger-stamp__item">
            <span className="ledger-stamp__label">Yearly target spend</span>
            <span className="ledger-stamp__value">{money(OVERALL_ANNUAL_TARGET)}</span>
          </div>
          <div className="ledger-stamp__item">
            <span className="ledger-stamp__label">Vs. target</span>
            <span className={`ledger-stamp__value ${isOverTarget ? 'ledger-stamp__value--over' : 'ledger-stamp__value--under'}`}>
              {money(Math.abs(targetVariance))} {isOverTarget ? 'over' : 'under'}
            </span>
          </div>
        </div>
        <p className="ledger-caption">
          {monthsElapsed} of 12 months into the financial year · figures update as you fill in the sheet
        </p>
      </header>

      <section className="ledger-body">
        <div className="ledger-list">
          <div className="ledger-list__title">Categories with a target</div>
          <div className="ledger-list__head">
            <span>Category</span>
            <span></span>
            <span className="ledger-list__head-num">Year to date</span>
            <span className="ledger-list__head-num">Yearly budget</span>
          </div>
          {targeted.length === 0 && (
            <p className="ledger-list__empty">No categories have an Annual Target set in column N yet.</p>
          )}
          {targeted.map((r) => renderRow(r, targetedMax))}
        </div>

        <div className="ledger-list ledger-list--spaced ledger-list--simple">
          <div className="ledger-list__title">All other categories</div>
          <div className="ledger-list__head">
            <span>Category</span>
            <span className="ledger-list__head-axis">
              <span>$0</span>
              <span>{money(untargetedScaleMax)}</span>
            </span>
            <span className="ledger-list__head-num">Year to date</span>
          </div>
          {untargeted.map((r) => renderRow(r, untargetedScaleMax, false))}
        </div>

        <div className="ledger-legend">
          <span className="ledger-legend__item"><i className="ledger-legend__swatch ledger-legend__swatch--over" /> over target to date</span>
          <span className="ledger-legend__item"><i className="ledger-legend__swatch ledger-legend__swatch--under" /> under target to date</span>
          <span className="ledger-legend__item"><i className="ledger-legend__swatch ledger-legend__swatch--neutral" /> no target set — bar shows relative size vs. your biggest untargeted category</span>
          <span className="ledger-legend__item">Yearly target column = your Annual Target from column N</span>
        </div>

        <div className="ledger-footer-stats">
          <div className="ledger-stamp__item">
            <span className="ledger-stamp__label">Tax payments to date</span>
            <span className="ledger-stamp__value">{money(taxPaymentsYtd)}</span>
          </div>
          <div className="ledger-stamp__item ledger-stamp__item--highlight">
            <span className="ledger-stamp__label">Dividend income to date</span>
            <span className="ledger-stamp__value">{money(dividendIncomeYtd)}</span>
          </div>
        </div>
        <p className="ledger-caption">Tracked separately — excluded from Spent to date, Projected Annual, and Vs. target above.</p>
      </section>
    </div>
  );

  function renderRow(r, trackBasis, showExpected = true) {
    const barPct = trackBasis ? Math.min((r.ytd / trackBasis) * 100, 100) : 0;
    const targetPct = r.ytdTarget != null && trackBasis ? Math.min((r.ytdTarget / trackBasis) * 100, 100) : null;
    return (
      <div key={r.name} className={`ledger-row ledger-row--${r.status} ${showExpected ? '' : 'ledger-row--simple'}`}>
        <span className="ledger-row__name">{r.name}</span>
        <span className="ledger-row__bartrack">
          <span className="ledger-row__bar" style={{ width: `${barPct}%` }} />
          {targetPct != null && (
            <span className="ledger-row__target" style={{ left: `${targetPct}%` }}>
              <span className="ledger-row__target-tip">
                Expected to date ({MONTHS[monthsElapsed - 1]}): {money(r.ytdTarget)}
              </span>
            </span>
          )}
        </span>
        <span className="ledger-row__amount">{money(r.ytd)}</span>
        {showExpected && <span className="ledger-row__amount ledger-row__amount--muted">{money(r.yearlyExpected)}</span>}
      </div>
    );
  }
}

function sum(arr) {
  return arr.reduce((a, b) => a + b, 0);
}
