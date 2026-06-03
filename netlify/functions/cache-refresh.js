// Scheduled Cache Refresh Function
// Runs every 30 minutes to keep Monday.com data fresh in Netlify Blobs
// No more waiting for API calls on every dashboard load

const https = require('https');

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
        catch (e) { reject(new Error('Invalid JSON: ' + raw.substring(0, 200))); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function fetchBoard(boardId, apiKey) {
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
            value
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

  if (json.errors) throw new Error('Monday.com error: ' + JSON.stringify(json.errors));
  if (!json.data?.boards?.[0]) throw new Error('No board data returned');

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

exports.handler = async () => {
  const apiKey = process.env.MONDAY_API_KEY;
  if (!apiKey) {
    console.error('MONDAY_API_KEY not set');
    return { statusCode: 500, body: 'API key not configured' };
  }

  let store;
  try {
    const { getStore } = require('@netlify/blobs');
    store = getStore('monday-cache');
  } catch (err) {
    console.error('Blobs not available:', err.message);
    return { statusCode: 500, body: 'Blobs not available' };
  }

  const results = {};
  const errors = [];

  for (const [boardName, boardId] of Object.entries(BOARD_IDS)) {
    try {
      console.log(`Refreshing cache for ${boardName}...`);
      const items = await fetchBoard(boardId, apiKey);

      await store.set(boardName, JSON.stringify(items), {
        metadata: {
          cachedAt: Date.now(),
          count: items.length,
          board: boardName
        }
      });

      results[boardName] = items.length;
      console.log(`  Cached ${items.length} ${boardName} items`);
    } catch (err) {
      console.error(`  Error refreshing ${boardName}:`, err.message);
      errors.push(`${boardName}: ${err.message}`);
    }
  }

  const status = errors.length === 0 ? 'success' : errors.length < 3 ? 'partial' : 'failed';
  console.log('Cache refresh complete:', { status, results, errors });

  return {
    statusCode: 200,
    body: JSON.stringify({ status, results, errors, refreshedAt: new Date().toISOString() })
  };
};
