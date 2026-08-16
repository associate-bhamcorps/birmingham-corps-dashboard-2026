# Birmingham Corps Live Dashboard — AI Assistant Guide

This file helps AI tools (Claude Code, GitHub Copilot, etc.) understand this project so future maintainers can make changes by describing them in plain English.

## What this project is
A live metrics dashboard at **dashboard.birminghamcorps.org** that pulls real-time data from Birmingham Corps's Monday.com CRM boards and displays it in a web dashboard with tabs for Participants, Partners, Funders, Marketing Performance, Management Overview, and a printable Monthly Report.

## How data flows
```
Monday.com boards → Netlify serverless function → Dashboard (index.html)
```
1. `index.html` calls `/.netlify/functions/monday-data?board=<name>` for each tab
2. The function (`netlify/functions/monday-data.js`) queries the Monday.com GraphQL API
3. Data is rendered into stat cards, tables, charts, and chip highlights

## Key files
| File | Purpose |
|------|---------|
| `index.html` | The entire dashboard UI + all JavaScript |
| `netlify/functions/monday-data.js` | Data proxy — fetches from Monday.com API |
| `netlify/functions/report.js` | Monthly PDF report (opens at `/.netlify/functions/report`) |
| `netlify/functions/health.js` | Health check endpoint at `/.netlify/functions/health` |
| `netlify.toml` | Netlify build config (functions directory, redirects, headers) |

## Monday.com Board IDs
```javascript
participants: 18407896987  // Participants Professional Directory
partners:     18426299137  // Partners CRM
funders:      18426299125  // Funders CRM
marketing:    18411541832  // Marketing Performance
```

## Monday.com Column IDs by board

### Participants board (18407896987)
- `color_mm28tqgd` — Status (Active / Alumni / Withdrawn / etc.)
- `color_mm2ybdsg` — Program (AmeriCorps / Career Navigator / etc.)
- PII columns filtered out: `phone_mm28k3k7`, `email_mm28c8fj`

### Partners board (18426299137)
- `dropdown_mm651r0a` — Partner Type
- `color_mm65tnts` — Relationship Stage
- `numeric_mm65xnm6` — Contract / Grant Amount
- `text_mm65nnww` — Primary Contact

### Funders board (18426299125)
- `dropdown_mm658e0s` — Partner Type (contains "AmeriCorps Funder" for gov grants)
- `color_mm65ah3h` — Relationship Stage
- `numeric_mm65vv1m` — Contract / Grant Amount (total award)
- `numeric_mm65890b` — Spent $
- `numeric_mm659sqb` — Due $
- `numeric_mm658226` — Owed $
- `numeric_mm67fc5e` — Received $

### Marketing board (18411541832)
- `date_mm33s7em` — Month (used to filter by month in the dashboard)
- `numeric_mm6557x3` — Newsletters Sent
- `dropdown_mm65ztx6` — Newsletter name
- `dropdown_mm31wyzn` — Marketing Channels

## Environment variables (set in Netlify)
- `MONDAY_API_KEY` — Monday.com Personal API Token. If the dashboard shows "Not Authenticated", this needs to be refreshed in Netlify → Site configuration → Environment variables.

## Deployment
Push to the `main` branch on GitHub → Netlify auto-deploys within ~1 minute. No build step required.

## Common change requests and where to make them

### Rename a stat card label
Search `index.html` for the current label text and replace it. Labels are in `renderParticipantStats()`, `renderPartnerStats()`, `renderFunderStats()`, `renderMarketingStats()`.

### Change which AmeriCorps funders are excluded from fund totals
The `isAmeriCorpsFunder()` function in `index.html` checks if `dropdown_mm658e0s` contains "americorps". Update that string if the funder type label changes in Monday.com.

### Add a new tab
1. Add a tab button in the nav bar (`<button class="tab-btn" onclick="switchTab('newtab', this)">`)
2. Add a `<div id="newtab" class="tab-content">` section in the HTML
3. Add a fetch call for the new board in `initDashboard()` if it reads from a new Monday.com board
4. Add the board ID to `BOARD_IDS` in `monday-data.js`

### Update the 2028 strategic goals targets
Search `index.html` for `GOALS_2028` — it's a constant array near `renderStrategicGoals2028()`. Change the `target` values to match the updated strategic plan.

### Add or remove a board from the Monthly Report
Edit `netlify/functions/report.js`. The `BOARD_IDS` object at the top maps board names to IDs.

### Rotate the Monday.com API key
1. Go to Monday.com → your avatar (bottom-left) → Administration → Connections → API
2. Copy the Personal API Token
3. Go to app.netlify.com → Birmingham Corps site → Site configuration → Environment variables → Edit `MONDAY_API_KEY`
4. Trigger a new deploy from Netlify → Deploys

## Architecture notes
- `Promise.allSettled` is used in `initDashboard()` so if one board fails, others still load
- AmeriCorps funds are excluded from the "Total Funds YTD" stat by checking `isAmeriCorpsFunder()`
- The Marketing tab filters by month using the `date_mm33s7em` column on each marketing item
- The Monthly Report highlights section is `contenteditable` — staff type directly before printing
