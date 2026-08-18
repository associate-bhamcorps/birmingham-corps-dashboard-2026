# Birmingham Corps Live Dashboard — AI Assistant Guide

This file helps AI tools (Claude Code, GitHub Copilot, etc.) understand this project so future maintainers can make changes by describing them in plain English.

## What this project is
A live metrics dashboard at **dashboard.birminghamcorps.org** that pulls real-time data from Birmingham Corps's Monday.com CRM boards and displays it in a web dashboard with tabs for Participants, Partners, Funders, Management Overview, Surveys, and a printable Monthly Report.

## How data flows
```
Monday.com boards → Netlify serverless function → Dashboard (index.html)
```
1. `index.html` calls `/.netlify/functions/monday-data?board=<name>` for each tab
2. The function (`netlify/functions/monday-data.js`) queries the Monday.com GraphQL API
3. Data is rendered into stat cards, tables, charts, and chip highlights
4. `index.html` also calls `/.netlify/functions/dashboard-config`, which reads the
   **Dashboard Control Panel** board and applies staff's wording / show-hide / banner /
   extra-card settings on top of what was just rendered

## Key files
| File | Purpose |
|------|---------|
| `index.html` | The entire dashboard UI + all JavaScript |
| `netlify/functions/monday-data.js` | Data proxy — fetches from Monday.com API |
| `netlify/functions/dashboard-config.js` | Reads the Dashboard Control Panel board (staff-editable settings) |
| `netlify/functions/report.js` | Monthly PDF report (opens at `/.netlify/functions/report`) |
| `netlify/functions/health.js` | Health check endpoint at `/.netlify/functions/health` |
| `netlify.toml` | Netlify build config (functions directory, redirects, headers) |

## Monday.com Board IDs
```javascript
participants: 18407896987  // Participants Professional Directory
partners:     18426299137  // Partners CRM
funders:      18426299125  // Funders CRM
control:      18427122467  // Dashboard Control Panel (settings, not data)
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

### Dashboard Control Panel board (18427122467)
Staff-editable settings, **not** data. Which group a row is in decides what it does — the
code keys off the leading digit of the group title, so groups can be renamed safely.

| Group | Effect |
|-------|--------|
| `1. CHANGE WORDING` | Row name = current wording on the dashboard, `New Wording` = replacement |
| `2. SHOW OR HIDE` | Row name = tab or section name, `Show or Hide` = Hide removes it |
| `3. ANNOUNCEMENT BANNER` | `Banner Message` + `Show` puts a banner across the top |
| `4. EXTRA NUMBER CARDS` | Row name = card label, plus `Number` and `Which Tab` |

Columns: `text_mm6b63dr` New Wording · `color_mm6bjge9` Show or Hide ·
`numeric_mm6bzdse` Number · `color_mm6be1bc` Which Tab ·
`long_text_mm6b2x20` Banner Message · `long_text_mm6bg2y6` What This Row Does (help text only)

## Environment variables (set in Netlify)
- `MONDAY_API_KEY` — Monday.com Personal API Token. If the dashboard shows "Not Authenticated", this needs to be refreshed in Netlify → Site configuration → Environment variables.

## Deployment
Push to the `main` branch on GitHub → Netlify auto-deploys within ~1 minute. No build step required.

## Common change requests and where to make them

### Rename a stat card label or heading
**Usually no code change is needed** — staff can do this themselves in the Dashboard Control
Panel board (group 1). Only edit code if the label needs to change permanently in the source.
Labels live in `renderParticipantStats()`, `renderPartnerStats()`, `renderFunderStats()`, and
in the tab buttons / `.section-title` elements.

If you rename a label in the code, update the matching row name in group 1 and group 2 of the
Dashboard Control Panel board too, or those rows will silently stop matching anything.

### Add a new controllable label
Anything matching `CFG_LABEL_SELECTORS` in `index.html` (`.tab-btn`, `.section-title`,
`.stat-label`, `th`, `h4`, `.breakdown-item > span:first-child`) is renameable from Monday
with no code change — just add a row to group 1 whose name is the current wording.

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
- `applyDashboardConfig()` runs **last** in `updateAllSections()` because it edits the DOM the
  render functions just produced. Anything that re-renders a container must run before it.
- Control Panel matching is deliberately loose (`normalizeLabel()` ignores emoji, punctuation,
  dash style, and capitalization) so staff don't have to type labels exactly
- Hides are applied before renames, so a "Hide" row still matches the original wording
- `dashboard-config.js` never returns an error status — on any failure it returns empty
  settings so a Monday outage or a bad API key can't take the dashboard down
- The Monthly Report highlights section is `contenteditable` — staff type directly before printing
