// Auto-Generated Monthly Report
// Visit: /.netlify/functions/report  (or  ?month=May&year=2026)
// Shows live data. Click "Save as PDF" in the browser to export.

const https = require('https');

const BOARD_IDS = {
  participants: 18407896987,
  partners: 18407898758,
  marketing: 18411541832
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

async function getData(boardName, apiKey) {
  // Try cache first
  try {
    const { getStore } = require('@netlify/blobs');
    const store = getStore('monday-cache');
    const result = await store.getWithMetadata(boardName);
    if (result && result.metadata) {
      const age = Date.now() - (result.metadata.cachedAt || 0);
      if (age < 3600000) return JSON.parse(result.data);
    }
  } catch (_) {}

  // Fall back to live API
  const boardId = BOARD_IDS[boardName];
  const query = `{ boards(ids: [${boardId}]) { items_page(limit: 500) { items { id name column_values { id type text value } } } } }`;
  const json = await httpsPost('https://api.monday.com/v2', { query }, {
    'Content-Type': 'application/json', 'Authorization': apiKey, 'API-Version': '2024-01'
  });
  if (!json.data?.boards?.[0]) throw new Error('No data for ' + boardName);
  return json.data.boards[0].items_page.items.map(item => {
    const rec = { id: item.id, name: item.name };
    item.column_values.forEach(col => {
      if (col.id !== 'phone_mm28k3k7' && col.id !== 'email_mm28c8fj') rec[col.id] = col.text || '';
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

  let participants, partners, marketing;
  try {
    [participants, partners, marketing] = await Promise.all([
      getData('participants', apiKey),
      getData('partners', apiKey),
      getData('marketing', apiKey)
    ]);
  } catch (err) {
    return { statusCode: 500, body: `Error loading data: ${err.message}` };
  }

  // Compute metrics
  const totalParticipants = participants.length;
  const activeParticipants = participants.filter(p => p.color_mm28tqgd === 'Active').length;
  const inactiveParticipants = participants.filter(p => p.color_mm28tqgd === 'Inactive').length;

  const programCounts = {};
  participants.forEach(p => {
    const pr = p.color_mm2ybdsg || 'Unassigned';
    programCounts[pr] = (programCounts[pr] || 0) + 1;
  });

  const totalPartners = partners.length;
  const totalContributions = partners.reduce((s, p) => s + (parseFloat(p.numeric_mm2886n2) || 0), 0);
  const totalSlots = partners.reduce((s, p) => s + (parseFloat(p.numeric_mm28kjd9) || 0), 0);

  const topPartners = [...partners]
    .sort((a, b) => (parseFloat(b.numeric_mm2886n2) || 0) - (parseFloat(a.numeric_mm2886n2) || 0))
    .slice(0, 5);

  const totalCampaigns = marketing.length;
  const avgCTR = marketing.length > 0
    ? (marketing.reduce((s, m) => s + (parseFloat(m.numeric_mm31cfpz) || 0), 0) / marketing.length).toFixed(2)
    : '0';
  const totalOpens = marketing.reduce((s, m) => s + (parseFloat(m.numeric_mm31zz9j) || 0), 0);

  const programRows = Object.entries(programCounts)
    .sort(([,a],[,b]) => b - a)
    .map(([name, count]) => `<tr><td>${name}</td><td>${count}</td><td>${((count/totalParticipants)*100).toFixed(1)}%</td></tr>`)
    .join('');

  const partnerRows = topPartners.map(p => `
    <tr>
      <td>${p.name}</td>
      <td>$${parseFloat(p.numeric_mm2886n2 || 0).toLocaleString()}</td>
      <td>${parseFloat(p.numeric_mm28kjd9 || 0)}</td>
      <td>${p.color_mm28m1nh || '—'}</td>
    </tr>`).join('');

  const marketingRows = marketing.map(m => `
    <tr>
      <td>${m.name}</td>
      <td>${m.dropdown_mm31wyzn || '—'}</td>
      <td>${parseFloat(m.numeric_mm31cfpz || 0).toFixed(2)}%</td>
      <td>${parseInt(m.numeric_mm31zz9j || 0).toLocaleString()}</td>
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
    color: white;
    padding: 40px 60px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 6px solid #e74c3c;
  }
  .header-left h1 { font-size: 28px; font-weight: 900; letter-spacing: -0.5px; }
  .header-left p { opacity: 0.7; font-size: 14px; margin-top: 4px; }
  .header-right { text-align: right; }
  .header-right .period { font-size: 22px; font-weight: 700; }
  .header-right .generated { font-size: 11px; opacity: 0.6; margin-top: 4px; }

  .no-print {
    background: #e74c3c;
    color: white;
    padding: 12px 24px;
    text-align: center;
    font-size: 14px;
    font-weight: 600;
  }
  .no-print button {
    background: white;
    color: #e74c3c;
    border: none;
    padding: 8px 20px;
    border-radius: 6px;
    font-weight: 700;
    cursor: pointer;
    margin-left: 16px;
    font-size: 14px;
  }

  .content { max-width: 1000px; margin: 0 auto; padding: 40px 30px; }

  .section { background: white; border-radius: 10px; padding: 30px; margin-bottom: 28px; box-shadow: 0 2px 8px rgba(0,0,0,0.07); }
  .section-title {
    font-size: 18px; font-weight: 700; color: #2c3e50;
    margin-bottom: 20px; padding-bottom: 12px;
    border-bottom: 3px solid #e74c3c;
    display: flex; align-items: center; gap: 10px;
  }

  .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
  .kpi-card {
    text-align: center; padding: 24px 16px; border-radius: 10px; color: white;
  }
  .kpi-card.blue  { background: linear-gradient(135deg, #3498db, #2980b9); }
  .kpi-card.green { background: linear-gradient(135deg, #27ae60, #229954); }
  .kpi-card.red   { background: linear-gradient(135deg, #e74c3c, #c0392b); }
  .kpi-card.purple{ background: linear-gradient(135deg, #9b59b6, #8e44ad); }
  .kpi-card.orange{ background: linear-gradient(135deg, #f39c12, #d68910); }
  .kpi-card.teal  { background: linear-gradient(135deg, #16a085, #1abc9c); }
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

  @media print {
    .no-print { display: none !important; }
    body { background: white; }
    .section { box-shadow: none; border: 1px solid #ddd; }
    .report-header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .kpi-card { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>

<div class="no-print">
  📋 Preview Mode —
  <button onclick="window.print()">🖨️ Save as PDF / Print</button>
  <button onclick="window.location.reload()" style="background:rgba(255,255,255,0.2);color:white;margin-left:8px;">↻ Refresh Data</button>
</div>

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
      <div class="kpi-card blue"><div class="kpi-value">${totalParticipants}</div><div class="kpi-label">Total Participants</div></div>
      <div class="kpi-card green"><div class="kpi-value">${activeParticipants}</div><div class="kpi-label">Active Participants</div></div>
      <div class="kpi-card red"><div class="kpi-value">${inactiveParticipants}</div><div class="kpi-label">Alumni / Inactive</div></div>
      <div class="kpi-card purple"><div class="kpi-value">${totalPartners}</div><div class="kpi-label">Total Partners</div></div>
      <div class="kpi-card orange"><div class="kpi-value">$${(totalContributions/1000).toFixed(0)}K</div><div class="kpi-label">Total Contributions</div></div>
      <div class="kpi-card teal"><div class="kpi-value">${totalCampaigns}</div><div class="kpi-label">Active Campaigns</div></div>
    </div>
  </div>

  <!-- PARTICIPANT METRICS -->
  <div class="section">
    <div class="section-title">👥 Participant Metrics</div>
    <table>
      <thead><tr><th>Program / Category</th><th>Participants</th><th>% of Total</th></tr></thead>
      <tbody>${programRows}</tbody>
    </table>
  </div>

  <!-- PARTNERSHIP & DONOR METRICS -->
  <div class="section">
    <div class="section-title">🤝 Top Partners & Contributions</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:20px;">
      <div style="background:#f0faf4;padding:18px;border-radius:8px;text-align:center;">
        <div style="font-size:28px;font-weight:900;color:#27ae60;">${totalPartners}</div>
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;color:#7f8c8d;margin-top:4px;">Total Partners</div>
      </div>
      <div style="background:#fef9f0;padding:18px;border-radius:8px;text-align:center;">
        <div style="font-size:28px;font-weight:900;color:#f39c12;">$${(totalContributions/1000).toFixed(0)}K</div>
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;color:#7f8c8d;margin-top:4px;">Total Contributions</div>
      </div>
      <div style="background:#f0f4fe;padding:18px;border-radius:8px;text-align:center;">
        <div style="font-size:28px;font-weight:900;color:#3498db;">${totalSlots}</div>
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;color:#7f8c8d;margin-top:4px;">Available Placements</div>
      </div>
    </div>
    <table>
      <thead><tr><th>Partner Name</th><th>Contribution</th><th>Job Slots</th><th>Relationship Stage</th></tr></thead>
      <tbody>${partnerRows}</tbody>
    </table>
  </div>

  <!-- MARKETING PERFORMANCE -->
  <div class="section">
    <div class="section-title">📢 Marketing Performance</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:20px;">
      <div style="background:#fdf0f0;padding:18px;border-radius:8px;text-align:center;">
        <div style="font-size:28px;font-weight:900;color:#e74c3c;">${totalCampaigns}</div>
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;color:#7f8c8d;margin-top:4px;">Campaigns</div>
      </div>
      <div style="background:#f0faf4;padding:18px;border-radius:8px;text-align:center;">
        <div style="font-size:28px;font-weight:900;color:#27ae60;">${avgCTR}%</div>
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;color:#7f8c8d;margin-top:4px;">Avg Click-Through</div>
      </div>
      <div style="background:#f0f4fe;padding:18px;border-radius:8px;text-align:center;">
        <div style="font-size:28px;font-weight:900;color:#3498db;">${totalOpens.toLocaleString()}</div>
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;color:#7f8c8d;margin-top:4px;">Newsletter Opens</div>
      </div>
    </div>
    <table>
      <thead><tr><th>Campaign Name</th><th>Channel</th><th>CTR</th><th>Opens</th></tr></thead>
      <tbody>${marketingRows}</tbody>
    </table>
  </div>

  <!-- HIGHLIGHTS & NEXT STEPS -->
  <div class="section">
    <div class="section-title">🌟 Highlights & Next Steps</div>
    <table>
      <thead><tr><th>Category</th><th>Notes</th></tr></thead>
      <tbody>
        <tr><td><strong>Highlights & Wins</strong></td><td style="color:#7f8c8d;font-style:italic;">[Add highlights here]</td></tr>
        <tr><td><strong>Challenges</strong></td><td style="color:#7f8c8d;font-style:italic;">[Add challenges here]</td></tr>
        <tr><td><strong>Goals for Next Month</strong></td><td style="color:#7f8c8d;font-style:italic;">[Add goals here]</td></tr>
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
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body: html
  };
};
