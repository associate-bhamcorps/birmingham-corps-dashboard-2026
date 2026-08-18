# Birmingham Corps Dashboard — Maintenance Guide

**Dashboard URL:** dashboard.birminghamcorps.org
**Monthly Report URL:** dashboard.birminghamcorps.org/.netlify/functions/report

---

## Accounts you need access to

| Service | What it does | Where to log in |
|---------|-------------|-----------------|
| **Monday.com** | Stores all live data, and the Dashboard Control Panel board | monday.com |
| **GitHub** (`associate-bhamcorps/birmingham-corps-dashboard-2026`) | Stores the code | github.com |
| **Netlify** | Hosts the live website | app.netlify.com |
| **Claude** | AI tool that can make code changes for you in plain English | claude.ai/code *(requires a subscription — set up under the org)* |

> All accounts except Claude are already under Birmingham Corps org accounts.
> Claude Code is currently under Wenica's personal account — the organization should set up its own Claude subscription if they want AI-assisted maintenance.

---

## Day-to-day data updates (NO code required)

The dashboard reads **live data directly from Monday.com**. To update what appears on the dashboard, just update the Monday.com boards:

| To update… | Go to Monday.com board… |
|------------|------------------------|
| Participant counts, statuses, programs | **Participants Professional Directory** |
| Partner organizations | **Partners CRM** |
| Funders, grant amounts, AmeriCorps funds | **Funders CRM** |

Changes appear on the dashboard within seconds of a page refresh. **No one needs to touch the code.**

---

## Changing the dashboard itself (NO code required)

Wording, sections, and extra numbers are controlled from one Monday.com board:

> **Dashboard Control Panel**
> https://birminghamcorps-company.monday.com/boards/18427122467

Edit a row there, wait about a minute, then refresh the dashboard. That's the whole process.
Every row has a **What This Row Does** column explaining it in plain English.

The board has four groups, and the group a row sits in is what decides what it does:

### 1. CHANGE WORDING — rename anything on the dashboard
Find the row whose name matches the words currently on the dashboard (for example
`Featured Partners`). Type what you want instead in the **New Wording** column.

- Leave **New Wording** blank to keep the current wording.
- You don't have to match emoji, capitalization, or punctuation exactly.
- Emoji on the dashboard are kept automatically — renaming `Featured Partners` to
  `Partner Spotlight` keeps the ✨.

### 2. SHOW OR HIDE — remove a tab or section
Set a row to **Hide** and that tab or section disappears from the dashboard. Set it back to
**Show** to bring it back. Nothing is deleted — hidden things are just not displayed.

### 3. ANNOUNCEMENT BANNER — put a message at the top
Type your message in **Banner Message** and set **Show or Hide** to **Show**. A yellow bar
appears across the top of the dashboard for everyone. Set it back to **Hide** to take it down.

### 4. EXTRA NUMBER CARDS — add your own big number
Click **+ Add item**, type the words that go under the number as the row name, then fill in
**Number**, pick **Which Tab**, and set **Show or Hide** to **Show**. The card appears at the
top of that tab. (Duplicate the EXAMPLE row if you'd rather start from a copy.)

> These are numbers you type in by hand — they do not update themselves. For numbers that
> should update automatically from your data, ask a developer to add them properly.

### If something looks wrong
Undo your change in the Control Panel board and refresh the dashboard. **Nothing you do on
this board can break the dashboard** — if the board can't be read for any reason, the
dashboard just displays its normal wording.

### What this board can't do
Adding new tabs, new charts, new tables, or pulling in a new Monday.com board still needs a
code change — see "Making small text/label changes (with AI help)" below.

---

## Monthly Report workflow

1. Go to the dashboard and click **📄 Monthly Report** (opens in a new tab)
2. Select the month you want using the month picker at the top
3. Scroll to **Highlights & Next Steps** at the bottom — click each row and type directly
4. Click **🖨️ Save as PDF / Print** to export
5. Share the PDF with board members

---

## If the dashboard stops loading data

**Step 1 — Check the error banner** at the top of the dashboard. It will say what's wrong.

**Most common cause: API key expired**
1. Go to Monday.com → click your avatar (bottom-left) → **Administration** → **Connections** → **API**
2. Copy the **Personal API Token**
3. Go to [app.netlify.com](https://app.netlify.com) → Birmingham Corps site → **Site configuration** → **Environment variables**
4. Find `MONDAY_API_KEY` → click the three dots → **Edit variable** → paste the new token → **Save**
5. Go to **Deploys** → **Trigger deploy** → **Deploy site**
6. Wait about 1 minute, then refresh the dashboard

---

## Making small text/label changes (with AI help)

**Try the Dashboard Control Panel board first** (see above) — renaming labels, hiding
sections, and adding number cards no longer need any of the steps below.

For anything else — a new tab, a new chart, a new data source, a changed calculation:

1. Open [claude.ai/code](https://claude.ai/code) (requires a Claude subscription)
2. Open the project folder (`birmingham-corps-live` in Downloads)
3. Describe the change in plain English, for example:
   - *"Change the label 'Active Participant Quarterly' to 'Active Participants This Month'"*
   - *"Update the 2028 goal for residents from 40 to 50"*
   - *"Add a new stat card to the Participants tab showing the number of alumni"*
4. Claude will find the right place in the code and make the change
5. When asked, approve the commit and push — Netlify will deploy automatically

The `CLAUDE.md` file in the project tells Claude everything about how the dashboard works, so it can make accurate changes without needing to be explained the whole system each time.

---

## Making bigger changes (hire a developer)

For adding entirely new tabs, integrating new data sources, or redesigning sections, a web developer with basic HTML/JavaScript knowledge can maintain this project. Point them to:
- `index.html` — the entire dashboard
- `netlify/functions/monday-data.js` — the data connection to Monday.com
- `CLAUDE.md` — full technical reference

The tech stack is intentionally simple: plain HTML, CSS, and JavaScript — no frameworks or build tools required.

---

## Deployment (how code changes go live)

1. Change is made to a file in the `birmingham-corps-live` folder
2. It's committed and pushed to GitHub (Claude Code does this automatically)
3. Netlify detects the push and deploys within ~1 minute
4. The live site updates automatically — no manual upload needed

---

## Annual / periodic tasks

| Task | When | How |
|------|------|-----|
| Rotate Monday.com API key | If dashboard stops loading | See "If the dashboard stops loading" above |
| Update 2028 strategic goal targets | When targets change | Ask Claude to update the `GOALS_2028` constant in `index.html` |
| Archive old Monday.com items | Annually | In Monday.com — doesn't affect the dashboard until items are deleted |
| Review Netlify plan | Annually | app.netlify.com — free tier covers this project's usage |

---

## Emergency contacts / resources

- **Netlify support:** netlify.com/support
- **Monday.com support:** support.monday.com
- **GitHub docs:** docs.github.com
- **Claude Code:** claude.ai/code

---

*Last updated: August 2026 — maintained by Birmingham Corps*
