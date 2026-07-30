import { Fragment, useEffect, useMemo, useState } from 'react';
import { fetchSpendingData } from './sheets';
import { MONTHS, fyMonthsElapsed, fyWeeksElapsed, OVERALL_ANNUAL_TARGET, GROCERY_TOTAL_NAME, GROCERY_TOTAL_COMPONENTS } from './config';
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
          const instalment = c.target / c.targetMonths.length;
          const currentMonthIndex = monthsElapsed - 1;
          const elapsedInstalments = c.targetMonths.filter((m) => currentMonthIndex >= m).length;
          ytdTarget = elapsedInstalments * instalment;
        } else if (c.weeklyCadence) {
          ytdTarget = (c.target / 52) * weeksElapsed;
        } else {
          ytdTarget = (c.target / 12) * monthsElapsed;
        }
      }
      const status = ytdTarget == null ? 'neutral' : ytd > ytdTarget ? 'over' : 'under';
      const yearlyExpected = c.target != null ? c.target : monthsElapsed ? (ytd / monthsElapsed) * 12 : 0;

      let yearlyTracking = null;
      let trackingVariance = null;
      if (c.target != null) {
        if (c.fixed) {
          yearlyTracking = c.target;
        } else {
          const elapsedFraction = c.target > 0 ? ytdTarget / c.target : 0;
          yearlyTracking = elapsedFraction > 0 ? ytd / elapsedFraction : c.target;
        }
        trackingVariance = yearlyTracking - c.target;
      }

      return { ...c, ytd, ytdTarget, status, yearlyExpected, yearlyTracking, trackingVariance };
    });
  }, [categories, monthsElapsed, weeksElapsed]);

  const aggregatable = useMemo(() => rows.filter((r) => r.name !== GROCERY_TOTAL_NAME), [rows]);

  const totalYtd = useMemo(() => aggregatable.reduce((s, r) => s + r.ytd, 0), [aggregatable]);
  const monthlyAvg = monthsElapsed ? totalYtd / monthsElapsed : 0;
  const runRate = useMemo(
    () => aggregatable.reduce((s, r) => s + (r.target != null ? r.yearlyTracking : r.yearlyExpected), 0),
    [aggregatable]
  );
  const incomeYtd = useMemo(() => (income ? sum(income) : 0), [income]);
  const taxPaymentsYtd = useMemo(() => (taxPayments ? sum(taxPayments) : 0), [taxPayments]);
  const dividendIncomeYtd = useMemo(() => (dividendIncome ? sum(dividendIncome) : 0), [dividendIncome]);
  const targetVariance = runRate - OVERALL_ANNUAL_TARGET;
  const isOverTarget = targetVariance > 0;

  const [sortMode, setSortMode] = useState('sheet');
  const [filterMode, setFilterMode] = useState('all');
  const [groceriesExpanded, setGroceriesExpanded] = useState(false);

  const targeted = rows.filter((r) => r.target != null);
  const untargeted = rows.filter((r) => r.target == null);
  const untargetedScaleMax = 2500;
  const targetedMax = targeted.length ? Math.max(...targeted.map((r) => Math.max(r.ytd, r.ytdTarget))) : 0;

  // The individual grocery lines are folded under "Groceries (Total)" and
  // only shown when expanded, so the main list isn't dominated by 6-7
  // grocery rows. They're excluded from sort/filter — those apply to the
  // main visible list only.
  const groceryComponentRows = targeted.filter((r) => GROCERY_TOTAL_COMPONENTS.includes(r.name));
  let targetedMain = targeted.filter((r) => !GROCERY_TOTAL_COMPONENTS.includes(r.name));

  if (filterMode === 'over') targetedMain = targetedMain.filter((r) => r.status === 'over');
  if (filterMode === 'under') targetedMain = targetedMain.filter((r) => r.status === 'under');

  if (sortMode === 'amount') {
    targetedMain = [...targetedMain].sort((a, b) => b.ytd - a.ytd);
  } else if (sortMode === 'status') {
    const rank = (s) => (s === 'over' ? 0 : s === 'under' ? 1 : 2);
    targetedMain = [...targetedMain].sort((a, b) => rank(a.status) - rank(b.status));
  }
  // sortMode === 'sheet' — no re-sort, keeps the order already in `rows`.

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
          <div className="ledger-list__title-row">
            <div className="ledger-list__title">Categories with a target</div>
            <div className="ledger-list__controls">
              <div className="ledger-toggle-group">
                <button className={sortMode === 'sheet' ? 'is-active' : ''} onClick={() => setSortMode('sheet')}>Sheet order</button>
                <button className={sortMode === 'amount' ? 'is-active' : ''} onClick={() => setSortMode('amount')}>Amount</button>
                <button className={sortMode === 'status' ? 'is-active' : ''} onClick={() => setSortMode('status')}>Status</button>
              </div>
              <div className="ledger-toggle-group">
                <button className={filterMode === 'all' ? 'is-active' : ''} onClick={() => setFilterMode('all')}>All</button>
                <button className={filterMode === 'over' ? 'is-active' : ''} onClick={() => setFilterMode('over')}>Over</button>
                <button className={filterMode === 'under' ? 'is-active' : ''} onClick={() => setFilterMode('under')}>Under</button>
              </div>
            </div>
          </div>
          <div className="ledger-list__head">
            <span>Category</span>
            <span></span>
            <span className="ledger-list__head-num">Year to date</span>
            <span className="ledger-list__head-num">Anticipated Costs</span>
            <span className="ledger-list__head-num">Yearly Tracking</span>
            <span className="ledger-list__head-num">Vs. Anticipated</span>
          </div>
          {targeted.length === 0 && (
            <p className="ledger-list__empty">No categories have an Annual Target set in column N yet.</p>
          )}
          {targeted.length > 0 && targetedMain.length === 0 && (
            <p className="ledger-list__empty">No categories match this filter.</p>
          )}
          {targetedMain.map((r) => (
            <Fragment key={r.name}>
              {renderRow(r, targetedMax, true, true, r.name === GROCERY_TOTAL_NAME)}
              {r.name === GROCERY_TOTAL_NAME && groceriesExpanded &&
                groceryComponentRows.map((g) => renderRow(g, targetedMax, true, true, false, true))}
            </Fragment>
          ))}
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
          {untargeted.map((r) => renderRow(r, untargetedScaleMax, false, false))}
        </div>

        <div className="ledger-legend">
          <span className="ledger-legend__item"><i className="ledger-legend__swatch ledger-legend__swatch--over" /> over target to date</span>
          <span className="ledger-legend__item"><i className="ledger-legend__swatch ledger-legend__swatch--under" /> under target to date</span>
          <span className="ledger-legend__item"><i className="ledger-legend__swatch ledger-legend__swatch--neutral" /> no target set — bar shows relative size vs. your biggest untargeted category</span>
          <span className="ledger-legend__item">Anticipated Costs = your Annual Target from column N · Yearly Tracking = forecast full-year spend (fixed costs in column P track exactly to Anticipated)</span>
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

  function renderRow(r, trackBasis, showExpected = true, showTracking = false, isGroceryToggle = false, isSubRow = false) {
    const barPct = trackBasis ? Math.min((r.ytd / trackBasis) * 100, 100) : 0;
    const targetPct = r.ytdTarget != null && trackBasis ? Math.min((r.ytdTarget / trackBasis) * 100, 100) : null;
    const varianceOver = showTracking && r.trackingVariance != null && r.trackingVariance > 0;
    const varianceSign = showTracking && r.trackingVariance != null ? (r.trackingVariance > 0 ? '+' : r.trackingVariance < 0 ? '−' : '') : '';
    return (
      <div
        key={r.name}
        className={`ledger-row ledger-row--${r.status} ${showTracking ? '' : 'ledger-row--simple'} ${isSubRow ? 'ledger-row--sub' : ''}`}
      >
        <span className="ledger-row__name">
          {isGroceryToggle && (
            <button
              type="button"
              className="ledger-row__toggle"
              onClick={() => setGroceriesExpanded((v) => !v)}
              aria-label={groceriesExpanded ? 'Hide grocery breakdown' : 'Show grocery breakdown'}
            >
              {groceriesExpanded ? '▾' : '▸'}
            </button>
          )}
          {r.name}
        </span>
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
        {showTracking && <span className="ledger-row__amount">{money(r.yearlyTracking)}</span>}
        {showTracking && (
          <span className={`ledger-row__amount ${varianceOver ? 'ledger-row__amount--over' : 'ledger-row__amount--under'}`}>
            {varianceSign}
            {money(Math.abs(r.trackingVariance))}
          </span>
        )}
      </div>
    );
  }
}

function sum(arr) {
  return arr.reduce((a, b) => a + b, 0);
}
