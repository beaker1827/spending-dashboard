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

  const monthlyTotals = useMemo(() => {
    return MONTHS.map((label, i) => {
      const expenditure = aggregatable.reduce((s, r) => s + (r.monthly[i] || 0), 0);
      const incomeVal = income ? income[i] || 0 : 0;
      return { month: label, income: incomeVal, expenditure, net: incomeVal - expenditure };
    });
  }, [aggregatable, income]);

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
          <span className="ledger-eyebrow">Household
