# Household Ledger — FY2026/27 Spending Dashboard

A live dashboard that reads your "Money priorities" Google Sheet (tab:
`2026/27 spending`) and shows spend by category, both year-to-date and
month by month, with optional targets.

## 1. Get a Google Sheets API key

1. Go to https://console.cloud.google.com/ (you can reuse the same project
   you set up for the retirement dashboard, if you kept it).
2. APIs & Services → Library → enable **Google Sheets API**.
3. APIs & Services → Credentials → Create Credentials → API key.
4. Restrict the key: Application restriction → HTTP referrers → add your
   Vercel domain once you have it (e.g. `https://your-app.vercel.app/*`).
   API restriction → restrict to Google Sheets API only.

## 2. Share the sheet

The API key can only read sheets that are shared with "Anyone with the
link — Viewer". Open the "Money priorities" sheet → Share → General access
→ Anyone with the link → Viewer. (Editing still requires sign-in as normal;
this only affects read access via the API key.)

## 3. Deploy to Vercel

```bash
npm install -g vercel   # if you don't already have it
cd spending-dashboard
vercel
```

When prompted, or afterwards in the Vercel project's Settings →
Environment Variables, set:

- `VITE_GOOGLE_SHEETS_API_KEY` — the key from step 1

That's the only variable you need — the sheet ID and tab name are already
defaulted to your "Money priorities" sheet and the "2026/27 spending" tab
in `src/config.js`. Redeploy after adding the env var:

```bash
vercel --prod
```

## 4. Adding targets (optional, any time)

The dashboard looks for an **"Annual Target"** value in **column N** of the
`2026/27 spending` tab, on the same row as each category. Leave it blank
for categories you're not tracking — those just show actual spend with no
target line. For "Groceries", put the target on the "Groceries" row itself
(not on the IGA/Aldi/etc sub-rows).

No redeploy needed — targets are read live from the sheet.

## 5. Updating monthly

Just keep filling in the `2026/27 spending` tab as you have been. The
dashboard re-reads the sheet on every page load, so there's nothing else
to do.

## Notes on the data

- Sub-items under Groceries (IGA, Aldi, Woolies, Coles, Asian, Rafa meat)
  are automatically summed into a single "Groceries" total.
- "Year to date" and "projected annual" figures are based on the current
  calendar date against the July–June financial year — they don't rely on
  which sheet cells happen to be filled in.
- If you rename a category in the sheet, update the matching entry in
  `CATEGORIES` in `src/config.js`, or the dashboard will show it as $0.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in your API key
npm run dev
```
