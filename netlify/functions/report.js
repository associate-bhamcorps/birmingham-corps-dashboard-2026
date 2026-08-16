// Auto-Generated Monthly Report
// Visit: /.netlify/functions/report  (or  ?month=May&year=2026)
// Shows live data. Click "Save as PDF" in the browser to export.

const https = require('https');

const BOARD_IDS = {
  participants: 18407896987,
  partners:     18426299137,  // Partners CRM
  funders:      18426299125,  // Funders CRM
  marketing:    18411541832
};

function httpsPost(url, data, headers) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const options = { method: 'POST', headers: { ...headers, 'Content-Length': Buffer.byteLength(body) } };
    const req = https.request(url, options, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function fetchBoard(boardName, apiKey) {
  const boardId = BOARD_IDS[boardName];
  const query = `{ boards(ids: [${boardId}]) { items_page(limit: 500) { items { id name column_values { id type text value } } } } }`;
  const json = await httpsPost('https://api.monday.com/v2', { query }, {
    'Content-Type': 'application/json', 'Authorization': apiKey, 'API-Version': '2024-01'
  });
  if (json.errors) throw new Error('Monday.com error: ' + JSON.stringify(json.errors));
  if (!json.data?.boards?.[0]) throw new Error('No data for ' + boardName);
  return json.data.boards[0].items_page.items.map(item => {
    const rec = { id: item.id, name: item.name };
    item.column_values.forEach(col => {
      if (col.id !== 'phone_mm28k3k7' && col.id !== 'email_mm28c8fj' &&
          col.id !== 'phone_mm654hnc' && col.id !== 'email_mm65z62w' &&
          col.id !== 'phone_mm65np2d' && col.id !== 'email_mm651qqs') {
        rec[col.id] = col.text || '';
      }
    });
    return rec;
  });
}

exports.handler = async (event) => {
  const apiKey = process.env.MONDAY_API_KEY;
  if (!apiKey) return { statusCode: 500, body: 'API key not configured' };

  const params = event.queryStringParameters || {};
  const now = new Date();
  const monthName = params.month || now.toLocaleString('en-US', { month: 'long', timeZone: 'America/Chicago' });
  const year = params.year || now.getFullYear();

  let participants, partners, funders, marketing;
  try {
    [participants, partners, funders, marketing] = await Promise.all([
      fetchBoard('participants', apiKey),
      fetchBoard('partners', apiKey),
      fetchBoard('funders', apiKey),
      fetchBoard('marketing', apiKey)
    ]);
  } catch (err) {
    return { statusCode: 500, body: `Error loading data: ${err.message}` };
  }

  // Participant metrics
  function getStatusLabel(raw) {
    if (!raw || !raw.trim()) return 'Not Set';
    const r = raw.trim().toLowerCase();
    if (r.includes('alumni') || r.includes('completed')) return 'Alumni';
    if (r.includes('active') || r.includes('enrolled')) return 'Active';
    return raw;
  }
  const totalParticipants = participants.length;
  const activeParticipants = participants.filter(p => getStatusLabel(p.color_mm28tqgd) === 'Active').length;
  const activeCorpsMembers = participants.filter(p =>
    (p.color_mm2ybdsg || '').toLowerCase().includes('americorps') &&
    getStatusLabel(p.color_mm28tqgd) === 'Active'
  ).length;

  const programCounts = {};
  participants.forEach(p => {
    const pr = p.color_mm2ybdsg || 'Unassigned';
    programCounts[pr] = (programCounts[pr] || 0) + 1;
  });

  // Partner metrics (Partners CRM — program/employer partners)
  const totalPartners = partners.length;
  const activePartners = partners.filter(p => {
    const s = (p.color_mm65tnts || '').toLowerCase();
    return s.includes('current');
  }).length;
  const topPartners = [...partners]
    .sort((a, b) => (parseFloat(b.numeric_mm65xnm6) || 0) - (parseFloat(a.numeric_mm65xnm6) || 0))
    .slice(0, 5);

  // Funder metrics (Funders CRM)
  const isAmeriCorps = f => (f.dropdown_mm658e0s || '').toLowerCase().includes('americorps');
  const nonAmeriCorpsFunders = funders.filter(f => !isAmeriCorps(f));
  const totalFunders = funders.length;
  const totalRaised = nonAmeriCorpsFunders.reduce((s, f) => s + (parseFloat(f.numeric_mm65vv1m) || 0), 0);
  const topFunders = [...nonAmeriCorpsFunders]
    .sort((a, b) => (parseFloat(b.numeric_mm65vv1m) || 0) - (parseFloat(a.numeric_mm65vv1m) || 0))
    .slice(0, 5);

  // Marketing metrics
  const totalCampaigns = marketing.length;
  const totalNewsletterSent = marketing.reduce((s, m) => s + (parseFloat(m.numeric_mm6557x3) || 0), 0);

  // HTML rows
  const programRows = Object.entries(programCounts)
    .sort(([,a],[,b]) => b - a)
    .map(([name, count]) => `<tr><td>${name}</td><td>${count}</td><td>${((count/totalParticipants)*100).toFixed(1)}%</td></tr>`)
    .join('');

  const partnerRows = topPartners.map(p => `
    <tr>
      <td>${p.name}</td>
      <td>${p.dropdown_mm651r0a || '—'}</td>
      <td>$${parseFloat(p.numeric_mm65xnm6 || 0).toLocaleString()}</td>
      <td>${p.color_mm65tnts || '—'}</td>
    </tr>`).join('');

  const funderRows = topFunders.map(f => `
    <tr>
      <td>${f.name}</td>
      <td>$${parseFloat(f.numeric_mm65vv1m || 0).toLocaleString()}</td>
      <td>${f.color_mm65ah3h || '—'}</td>
    </tr>`).join('');

  const generatedAt = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago', dateStyle: 'full', timeStyle: 'short' });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Birmingham Corps — ${monthName} ${year} Leadership Report</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Inter', 'Segoe UI', sans-serif; color: #1a1a2e; background: #f8f9fc; }

  .report-header {
    background: linear-gradient(135deg, #2c3e50 0%, #1a252f 100%);
    color: white; padding: 40px 60px;
    display: flex; justify-content: space-between; align-items: center;
    border-bottom: 6px solid #e74c3c;
  }
  .header-left h1 { font-size: 28px; font-weight: 900; letter-spacing: -0.5px; }
  .header-left p { opacity: 0.7; font-size: 14px; margin-top: 4px; }
  .header-right { text-align: right; }
  .header-right .period { font-size: 22px; font-weight: 700; }
  .header-right .generated { font-size: 11px; opacity: 0.6; margin-top: 4px; }

  .no-print {
    background: #e74c3c; color: white;
    padding: 12px 24px; text-align: center; font-size: 14px; font-weight: 600;
  }
  .no-print button {
    background: white; color: #e74c3c; border: none;
    padding: 8px 20px; border-radius: 6px; font-weight: 700;
    cursor: pointer; margin-left: 16px; font-size: 14px;
  }

  .content { max-width: 1000px; margin: 0 auto; padding: 40px 30px; }
  .section { background: white; border-radius: 10px; padding: 30px; margin-bottom: 28px; box-shadow: 0 2px 8px rgba(0,0,0,0.07); }
  .section-title {
    font-size: 18px; font-weight: 700; color: #2c3e50;
    margin-bottom: 20px; padding-bottom: 12px;
    border-bottom: 3px solid #e74c3c;
  }

  .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
  .kpi-card { text-align: center; padding: 24px 16px; border-radius: 10px; color: white; }
  .kpi-card.blue   { background: linear-gradient(135deg, #3498db, #2980b9); }
  .kpi-card.green  { background: linear-gradient(135deg, #27ae60, #229954); }
  .kpi-card.red    { background: linear-gradient(135deg, #e74c3c, #c0392b); }
  .kpi-card.purple { background: linear-gradient(135deg, #9b59b6, #8e44ad); }
  .kpi-card.orange { background: linear-gradient(135deg, #f39c12, #d68910); }
  .kpi-card.teal   { background: linear-gradient(135deg, #16a085, #1abc9c); }
  .kpi-value { font-size: 38px; font-weight: 900; }
  .kpi-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; opacity: 0.9; margin-top: 6px; }

  table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
  thead th { background: #2c3e50; color: white; padding: 11px 14px; text-align: left; font-weight: 600; }
  tbody td { padding: 11px 14px; border-bottom: 1px solid #ecf0f1; }
  tbody tr:last-child td { border-bottom: none; }
  tbody tr:hover { background: #f9f9f9; }

  .footer {
    text-align: center; padding: 30px;
    color: #7f8c8d; font-size: 12px;
    border-top: 1px solid #ecf0f1; margin-top: 20px;
  }

  .edit-hint { font-size:12px; color:#95a5a6; font-style:italic; font-weight:400; margin-left:8px; }
  .editable-cell {
    min-height: 48px; cursor: text; outline: none;
    padding: 11px 14px; vertical-align: top;
    border-left: 3px solid transparent; transition: border-color 0.2s;
  }
  .editable-cell:focus { border-left-color: #e74c3c; background: #fffbf9; outline: none; }
  .editable-cell:empty::before { content: attr(data-placeholder); color: #bdc3c7; font-style: italic; pointer-events: none; }

  @media print {
    .no-print { display: none !important; }
    .edit-hint { display: none !important; }
    body { background: white; }
    .section { box-shadow: none; border: 1px solid #ddd; }
    .report-header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .kpi-card { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .editable-cell { border-left: none; background: transparent !important; }
    .editable-cell:empty::before { display: none; }
  }
</style>
</head>
<body>

<div class="no-print" style="padding:0;">
  <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 24px;flex-wrap:wrap;gap:10px;">
    <div>
      📋 Preview Mode &nbsp;
      <button onclick="window.print()">🖨️ Save as PDF / Print</button>
      <button onclick="window.location.reload()" style="background:rgba(255,255,255,0.2);color:white;margin-left:8px;">↻ Refresh</button>
    </div>
    <div style="display:flex;align-items:center;gap:10px;">
      <span style="font-size:13px;opacity:0.85;">Select month:</span>
      <button onclick="adjYear(-1)" style="background:rgba(255,255,255,0.2);color:white;border:none;padding:5px 12px;border-radius:6px;cursor:pointer;font-size:15px;font-weight:700;">◀</button>
      <span id="yrLabel" style="font-size:15px;font-weight:700;min-width:46px;text-align:center;">${year}</span>
      <button onclick="adjYear(1)" style="background:rgba(255,255,255,0.2);color:white;border:none;padding:5px 12px;border-radius:6px;cursor:pointer;font-size:15px;font-weight:700;">▶</button>
    </div>
  </div>
  <div style="display:flex;flex-wrap:wrap;gap:6px;padding:4px 24px 14px;" id="mPicker"></div>
</div>
<script>
var MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
var vYear=parseInt('${year}');
var selMonth='${monthName}';
var selYear=parseInt('${year}');
function renderPicker(){
  var el=document.getElementById('mPicker');
  el.innerHTML=MONTHS.map(function(m){
    var active=(m===selMonth&&vYear===selYear);
    return '<button onclick="goMonth(\''+m+'\')" style="'+
      'background:'+(active?'white':'rgba(255,255,255,0.15)')+';'+
      'color:'+(active?'#e74c3c':'white')+';'+
      'border:none;padding:7px 15px;border-radius:20px;cursor:pointer;'+
      'font-size:13px;font-weight:'+(active?'700':'500')+';'+
      'transition:all 0.15s;">'+
      (active?'✓ ':'')+m+
    '</button>';
  }).join('');
}
function adjYear(d){vYear+=d;document.getElementById('yrLabel').textContent=vYear;renderPicker();}
function goMonth(m){window.location.href='/.netlify/functions/report?month='+m+'&year='+vYear;}
renderPicker();
</script>

<div class="report-header">
  <div class="header-left">
    <h1>📊 Birmingham Corps</h1>
    <p>Leadership Data Report — Confidential</p>
  </div>
  <div class="header-right">
    <div class="period">${monthName} ${year}</div>
    <div class="generated">Generated ${generatedAt} (CT)</div>
  </div>
</div>

<div class="content">

  <!-- EXECUTIVE SUMMARY -->
  <div class="section">
    <div class="section-title">📋 Executive Summary</div>
    <div class="kpi-grid">
      <div class="kpi-card blue"><div class="kpi-value">${totalParticipants}</div><div class="kpi-label">Total Program Participants Of All Time</div></div>
      <div class="kpi-card green"><div class="kpi-value">${activeParticipants}</div><div class="kpi-label">Active Participant Quarterly</div></div>
      <div class="kpi-card red"><div class="kpi-value">${activeCorpsMembers}</div><div class="kpi-label">Total Active Corps Collective Members</div></div>
      <div class="kpi-card purple"><div class="kpi-value">${totalPartners}</div><div class="kpi-label">Total Partners Of All Time</div></div>
      <div class="kpi-card orange"><div class="kpi-value">$${(totalRaised/1000).toFixed(0)}K</div><div class="kpi-label">Total Funds Yr. To Date Raised (Calendar Year Jan 1–Dec 1)</div></div>
      <div class="kpi-card teal"><div class="kpi-value">${totalFunders}</div><div class="kpi-label">Total Funders Of All Time</div></div>
    </div>
  </div>

  <!-- PARTICIPANT METRICS -->
  <div class="section">
    <div class="section-title">👥 Participant Metrics</div>
    <table>
      <thead><tr><th>Program / Category</th><th>Participants</th><th>% of Total</th></tr></thead>
      <tbody>${programRows || '<tr><td colspan="3" style="color:#bdc3c7;text-align:center;">No program data</td></tr>'}</tbody>
    </table>
  </div>

  <!-- PARTNERS -->
  <div class="section">
    <div class="section-title">🤝 Program Partners (Top 5)</div>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-bottom:20px;">
      <div style="background:#f0faf4;padding:18px;border-radius:8px;text-align:center;">
        <div style="font-size:28px;font-weight:900;color:#27ae60;">${totalPartners}</div>
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;color:#7f8c8d;margin-top:4px;">Total Partners Of All Time</div>
      </div>
      <div style="background:#f0f4fe;padding:18px;border-radius:8px;text-align:center;">
        <div style="font-size:28px;font-weight:900;color:#3498db;">${activePartners}</div>
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;color:#7f8c8d;margin-top:4px;">Current Partners</div>
      </div>
    </div>
    <table>
      <thead><tr><th>Partner Name</th><th>Type</th><th>Contract Amount</th><th>Relationship Stage</th></tr></thead>
      <tbody>${partnerRows || '<tr><td colspan="4" style="color:#bdc3c7;text-align:center;">No partner data</td></tr>'}</tbody>
    </table>
  </div>

  <!-- FUNDERS -->
  <div class="section">
    <div class="section-title">💰 Funders & Contributions (Top 5 — AmeriCorps Excluded)</div>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-bottom:20px;">
      <div style="background:#fef9f0;padding:18px;border-radius:8px;text-align:center;">
        <div style="font-size:28px;font-weight:900;color:#f39c12;">${totalFunders}</div>
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;color:#7f8c8d;margin-top:4px;">Total Funders Of All Time</div>
      </div>
      <div style="background:#f0faf4;padding:18px;border-radius:8px;text-align:center;">
        <div style="font-size:28px;font-weight:900;color:#27ae60;">$${totalRaised.toLocaleString()}</div>
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;color:#7f8c8d;margin-top:4px;">Total Funds Yr. To Date Raised (Calendar Year Jan 1–Dec 1)</div>
      </div>
    </div>
    <table>
      <thead><tr><th>Funder Name</th><th>Grant / Contract Amount</th><th>Relationship Stage</th></tr></thead>
      <tbody>${funderRows || '<tr><td colspan="3" style="color:#bdc3c7;text-align:center;">No funder data</td></tr>'}</tbody>
    </table>
  </div>

  <!-- MARKETING -->
  <div class="section">
    <div class="section-title">📢 Marketing & Outreach</div>
    <div style="background:#f0f4fe;padding:18px;border-radius:8px;text-align:center;margin-bottom:20px;display:inline-block;min-width:180px;">
      <div style="font-size:32px;font-weight:900;color:#3498db;">${totalNewsletterSent.toLocaleString()}</div>
      <div style="font-size:11px;font-weight:600;text-transform:uppercase;color:#7f8c8d;margin-top:4px;">Total Newsletter Subs — ${monthName} ${year}</div>
    </div>
  </div>

  <!-- HIGHLIGHTS & NEXT STEPS -->
  <div class="section">
    <div class="section-title">🌟 Highlights &amp; Next Steps
      <span class="edit-hint no-print">— click any row below to type before saving as PDF</span>
    </div>
    <table>
      <thead><tr><th style="width:220px;">Category</th><th>Notes</th></tr></thead>
      <tbody>
        <tr>
          <td><strong>✅ Highlights &amp; Wins</strong></td>
          <td class="editable-cell" contenteditable="true" data-placeholder="Click here to add highlights and wins for ${monthName}…"></td>
        </tr>
        <tr>
          <td><strong>⚠️ Challenges</strong></td>
          <td class="editable-cell" contenteditable="true" data-placeholder="Click here to add challenges faced this month…"></td>
        </tr>
        <tr>
          <td><strong>🎯 Goals for Next Month</strong></td>
          <td class="editable-cell" contenteditable="true" data-placeholder="Click here to add goals for next month…"></td>
        </tr>
        <tr>
          <td><strong>📣 Shoutouts &amp; Recognition</strong></td>
          <td class="editable-cell" contenteditable="true" data-placeholder="Click here to recognize team members, partners, or funders…"></td>
        </tr>
      </tbody>
    </table>
  </div>

</div>

<div class="footer">
  Birmingham Corps Leadership Report — ${monthName} ${year}<br>
  Data pulled live from Monday.com CRM on ${generatedAt} (CT)<br>
  <strong>CONFIDENTIAL — For internal leadership use only</strong>
</div>

</body>
</html>`;

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    body: html
  };
};
