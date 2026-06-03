// Weekly Monday.com Data Backup Script
// Run by GitHub Actions every Sunday — saves JSON snapshots to data/backups/
// Also keeps a rolling "latest" file for easy access

const https = require('https');
const fs = require('fs');
const path = require('path');

const BOARD_IDS = {
  participants: 18407896987,
  partners: 18407898758,
  marketing: 18411541832
};

function httpsPost(url, data, headers) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const options = {
      method: 'POST',
      headers: { ...headers, 'Content-Length': Buffer.byteLength(body) }
    };
    const req = https.request(url, options, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch (e) { reject(new Error('Invalid JSON: ' + raw.substring(0, 300))); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function fetchBoard(name, boardId, apiKey) {
  const query = `{
    boards(ids: [${boardId}]) {
      items_page(limit: 500) {
        items {
          id
          name
          column_values {
            id
            type
            text
          }
        }
      }
    }
  }`;

  const json = await httpsPost(
    'https://api.monday.com/v2',
    { query },
    {
      'Content-Type': 'application/json',
      'Authorization': apiKey,
      'API-Version': '2024-01'
    }
  );

  if (json.errors) throw new Error(JSON.stringify(json.errors));
  if (!json.data?.boards?.[0]) throw new Error('No board data');

  // Strip phone/email from backups too
  return json.data.boards[0].items_page.items.map(item => {
    const rec = { id: item.id, name: item.name };
    item.column_values.forEach(col => {
      if (col.id !== 'phone_mm28k3k7' && col.id !== 'email_mm28c8fj') {
        rec[col.id] = col.text || '';
      }
    });
    return rec;
  });
}

async function run() {
  const apiKey = process.env.MONDAY_API_KEY;
  if (!apiKey) {
    console.error('ERROR: MONDAY_API_KEY environment variable is not set');
    process.exit(1);
  }

  const date = new Date().toISOString().split('T')[0];
  const backupDir = path.join('data', 'backups', date);
  const latestDir = path.join('data', 'latest');

  fs.mkdirSync(backupDir, { recursive: true });
  fs.mkdirSync(latestDir, { recursive: true });

  const summary = {
    date,
    generatedAt: new Date().toISOString(),
    boards: {}
  };

  let hasErrors = false;

  for (const [name, boardId] of Object.entries(BOARD_IDS)) {
    try {
      console.log(`Fetching ${name} (board ${boardId})...`);
      const items = await fetchBoard(name, boardId, apiKey);

      // Dated backup
      const datePath = path.join(backupDir, `${name}.json`);
      fs.writeFileSync(datePath, JSON.stringify(items, null, 2));

      // Latest (always overwrite)
      const latestPath = path.join(latestDir, `${name}.json`);
      fs.writeFileSync(latestPath, JSON.stringify(items, null, 2));

      summary.boards[name] = { count: items.length, file: datePath };
      console.log(`  ✓ ${items.length} ${name} items saved`);

    } catch (err) {
      console.error(`  ✗ Error backing up ${name}:`, err.message);
      summary.boards[name] = { error: err.message };
      hasErrors = true;
    }
  }

  // Write summary
  fs.writeFileSync(path.join(backupDir, 'summary.json'), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(latestDir, 'summary.json'), JSON.stringify(summary, null, 2));

  console.log('\nBackup summary:', JSON.stringify(summary, null, 2));

  if (hasErrors) {
    console.error('\nWARNING: Some boards failed to back up.');
    process.exit(1);
  } else {
    console.log('\nAll boards backed up successfully.');
  }
}

run().catch(err => {
  console.error('Fatal backup error:', err);
  process.exit(1);
});
