// dashboard-config.js — Reads the "Dashboard Control Panel" board in Monday.com
// and turns it into settings the dashboard applies on every page load.
//
// Board: https://birminghamcorps-company.monday.com/boards/18427122467
//
// The board has four groups. Which group a row is in decides what it does:
//   Group starting "1." → rename wording        (row name = current wording, "New Wording" = replacement)
//   Group starting "2." → show / hide a section (row name = tab or section name, "Show or Hide" = Hide)
//   Group starting "3." → announcement banner   ("Banner Message" = text, "Show or Hide" = Show)
//   Group starting "4." → extra number card     (row name = card label, "Number", "Which Tab")
//
// This endpoint NEVER throws in a way that breaks the dashboard — on any failure it
// returns empty settings, and the dashboard renders exactly as it would without it.

const https = require('https');

const CONTROL_BOARD_ID = 18427122467;

const COL = {
  newWording: 'text_mm6b63dr',
  showHide:   'color_mm6bjge9',
  number:     'numeric_mm6bzdse',
  whichTab:   'color_mm6be1bc',
  banner:     'long_text_mm6b2x20'
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
  // Monday edits should show up quickly, but don't hammer the API on every refresh.
  'Cache-Control': 'public, max-age=60'
};

const EMPTY = { renames: [], hide: [], banner: null, cards: [] };

function httpsPost(url, data, headers) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const options = { method: 'POST', headers: { ...headers, 'Content-Length': Buffer.byteLength(body) } };
    const req = https.request(url, options, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch (e) { reject(new Error('Invalid JSON from Monday.com')); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function fetchControlBoard(apiKey) {
  const query = `{
    boards(ids: [${CONTROL_BOARD_ID}]) {
      items_page(limit: 300) {
        items {
          id
          name
          group { id title }
          column_values { id text }
        }
      }
    }
  }`;

  const json = await httpsPost('https://api.monday.com/v2', { query }, {
    'Content-Type': 'application/json',
    'Authorization': apiKey,
    'API-Version': '2024-01'
  });

  if (json.errors) throw new Error('Monday.com error: ' + JSON.stringify(json.errors));
  if (!json.data?.boards?.[0]) throw new Error('Control board not found');

  return json.data.boards[0].items_page.items.map(item => {
    const rec = { id: item.id, name: item.name, group: item.group?.title || '' };
    item.column_values.forEach(col => { rec[col.id] = (col.text || '').trim(); });
    return rec;
  });
}

// The leading number in the group title is what makes a row do its job, so a team
// member renaming "1. CHANGE WORDING …" to something friendlier won't break anything.
function groupKind(groupTitle) {
  const n = (groupTitle || '').trim().match(/^(\d)/);
  return n ? n[1] : null;
}

const TAB_KEYS = {
  'participants': 'participants',
  'partners': 'partners',
  'funders': 'funders',
  'management overview': 'management',
  'management': 'management'
};

function buildConfig(items) {
  const cfg = { renames: [], hide: [], banner: null, cards: [] };

  items.forEach(row => {
    const kind = groupKind(row.group);
    const name = (row.name || '').trim();
    if (!kind || !name) return;

    if (kind === '1') {
      const to = (row[COL.newWording] || '').trim();
      // Blank "New Wording" means "leave it alone" — that is the safe default.
      if (to && to !== name) cfg.renames.push({ from: name, to });

    } else if (kind === '2') {
      if ((row[COL.showHide] || '').toLowerCase() === 'hide') cfg.hide.push(name);

    } else if (kind === '3') {
      const message = (row[COL.banner] || '').trim();
      if (message && (row[COL.showHide] || '').toLowerCase() !== 'hide') {
        cfg.banner = { message };
      }

    } else if (kind === '4') {
      if ((row[COL.showHide] || '').toLowerCase() === 'hide') return;
      const raw = (row[COL.number] || '').trim();
      const tab = TAB_KEYS[(row[COL.whichTab] || '').trim().toLowerCase()];
      if (!tab) return;                       // no tab chosen → nothing to place
      cfg.cards.push({ label: name, value: raw, tab });
    }
  });

  return cfg;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  const apiKey = process.env.MONDAY_API_KEY;
  if (!apiKey) {
    // No key: behave as if there are no settings rather than breaking the dashboard.
    return { statusCode: 200, headers: CORS, body: JSON.stringify(EMPTY) };
  }

  try {
    const items = await fetchControlBoard(apiKey);
    return { statusCode: 200, headers: CORS, body: JSON.stringify(buildConfig(items)) };
  } catch (err) {
    console.error('dashboard-config error:', err.message);
    return { statusCode: 200, headers: CORS, body: JSON.stringify(EMPTY) };
  }
};
