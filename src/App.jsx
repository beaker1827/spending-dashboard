import { useEffect, useMemo, useState } from 'react';
import { fetchSpendingData } from './sheets';
import { fyMonthsElapsed } from './config';
import './App.css';

const money = (n) =>
  n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });

export default function App() {
  const [categories, setCategories] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSpendingData()
      .then((data) => setCategories(data))
      .catch((e) => setError(e.message));
  }, []);

  const monthsElapsed = fyMonthsElapsed();

  const rows = useMemo(() => {
    if (!categories) return [];
    return categories
      .map((c) => {
        const ytd = sum(c.monthly);
        const ytdTarget = c.target != null ? (c.target / 12) * monthsElapsed : null;
        const status = ytdTarget == null ? 'neutral' : ytd > ytdTarget ? 'over' : 'under';
        const yearlyExpected = c.target != null ? c.target : monthsElapsed ? (ytd / monthsElapsed) * 12 : 0;
        return { ...c, ytd, ytdTarget, status, yearlyExpected };
      })
      .sort((a, b) => b.ytd - a.ytd);
  }, [categories, monthsElapsed]);

  const totalYtd = useMemo(() => rows.reduce((s, r) => s + r.ytd, 0), [rows]);
  const monthlyAvg = monthsElapsed ? totalYtd / monthsElapsed : 0;
  const runRate = useMemo(() => rows.reduce((s, r) => s + r.yearlyExpected, 0), [rows]);

  const targeted = rows.filter((r) => r.target != null);
  const untargeted = rows.filter((r) => r.target == null);
  const untargetedMax = untargeted.length ? Math.max(...untargeted.map((r) => r.ytd)) : 0;
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
          <div className="ledger-stamp__item">
            <span className="ledger-stamp__label">Spent to date</span>
            <span className="ledger-stamp__value">{money(totalYtd)}</span>
          </div>
          <div className="ledger-stamp__item">
            <span className="ledger-stamp__label">Monthly average</span>
            <span className="ledger-stamp__value ledger-stamp__value--sub">{money(monthlyAvg)}</span>
          </div>
          <div className="ledger-stamp__item">
            <span className="ledger-stamp__label">Projected annual</span>
            <span className="ledger-stamp__value ledger-stamp__value--sub">{money(runRate)}</span>
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
            <span className="ledger-list__head-num">Year to date</span>
            <span className="ledger-list__head-num">Yearly target</span>
          </div>
          {targeted.length === 0 && (
            <p className="ledger-list__empty">No categories have an Annual Target set in column N yet.</p>
          )}
          {targeted.map((r) => renderRow(r, targetedMax))}
        </div>

        <div className="ledger-list ledger-list--spaced">
          <div className="ledger-list__title">All other categories</div>
          <div className="ledger-list__head">
            <span>Category</span>
            <span className="ledger-list__head-num">Year to date</span>
            <span className="ledger-list__head-num">Yearly expected</span>
          </div>
          {untargeted.map((r) => renderRow(r, untargetedMax))}
        </div>

        <div className="ledger-legend">
          <span className="ledger-legend__item"><i className="ledger-legend__swatch ledger-legend__swatch--over" /> over target to date</span>
          <span className="ledger-legend__item"><i className="ledger-legend__swatch ledger-legend__swatch--under" /> under target to date</span>
          <span className="ledger-legend__item"><i className="ledger-legend__swatch ledger-legend__swatch--neutral" /> no target set — bar shows relative size vs. your biggest untargeted category</span>
          <span className="ledger-legend__item">Yearly expected = this month's rate × 12</span>
        </div>
      </section>
    </div>
  );

  function renderRow(r, trackBasis) {
    const barPct = trackBasis ? Math.min((r.ytd / trackBasis) * 100, 100) : 0;
    const targetPct = r.ytdTarget != null && trackBasis ? Math.min((r.ytdTarget / trackBasis) * 100, 100) : null;
    return (
      <div key={r.name} className={`ledger-row ledger-row--${r.status}`}>
        <span className="ledger-row__name">{r.name}</span>
        <span className="ledger-row__bartrack">
          <span className="ledger-row__bar" style={{ width: `${barPct}%` }} />
          {targetPct != null && (
            <span
              className="ledger-row__target"
              style={{ left: `${targetPct}%` }}
              title={`Target to date: ${money(r.ytdTarget)}`}
            />
          )}
        </span>
        <span className="ledger-row__amount">{money(r.ytd)}</span>
        <span className="ledger-row__amount ledger-row__amount--muted">{money(r.yearlyExpected)}</span>
      </div>
    );
  }
}

function sum(arr) {
  return arr.reduce((a, b) => a + b, 0);
}
