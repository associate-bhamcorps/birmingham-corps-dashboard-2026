// monday-data.js — Live data proxy with Netlify Blobs cache layer
// - Serves cached data (refreshed every 30 min by cache-refresh.js)
// - Falls back to live Monday.com API if cache is empty or stale
// - Add ?live=1 to bypass cache and force fresh API call
// - Add ?board=participants|partners|marketing

const https = require('https');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json'
};

const BOARD_IDS = {
  participants: 18407896987,
  partners: 18407898758,
  marketing: 18411541832
};

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

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

async function fetchFromMonday(boardId, apiKey) {
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
  if (!json.data?.boards?.[0]) throw new Error('Unexpected API response');

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

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  const params = event.queryStringParameters || {};
  const board = params.board;
  const forceLive = params.live === '1';
  const boardId = BOARD_IDS[board];

  if (!boardId) {
    return {
      statusCode: 400,
      headers: CORS,
      body: JSON.stringify({ error: 'Invalid board. Use: participants, partners, or marketing' })
    };
  }

  const apiKey = process.env.MONDAY_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: 'MONDAY_API_KEY environment variable is not set' })
    };
  }

  // ── Try Netlify Blobs cache (Feature 5) ──────────────────────────────────
  if (!forceLive) {
    try {
      const { getStore } = require('@netlify/blobs');
      const store = getStore('monday-cache');
      const result = await store.getWithMetadata(board);

      if (result && result.metadata) {
        const age = Date.now() - (result.metadata.cachedAt || 0);
        if (age < CACHE_TTL_MS) {
          console.log(`Cache HIT for ${board} (age: ${Math.round(age / 1000)}s)`);
          return {
            statusCode: 200,
            headers: {
              ...CORS,
              'X-Cache': 'HIT',
              'X-Cache-Age': String(Math.round(age / 1000)),
              'X-Cache-Count': String(result.metadata.count || '?')
            },
            body: result.data
          };
        } else {
          console.log(`Cache STALE for ${board} (age: ${Math.round(age / 1000)}s) — fetching live`);
        }
      } else {
        console.log(`Cache MISS for ${board} — fetching live`);
      }
    } catch (cacheErr) {
      // Cache unavailable — not fatal, fall through to live API
      console.warn(`Cache unavailable for ${board}:`, cacheErr.message);
    }
  }

  // ── Fetch live from Monday.com ────────────────────────────────────────────
  try {
    const items = await fetchFromMonday(boardId, apiKey);

    // Store in cache for next request
    try {
      const { getStore } = require('@netlify/blobs');
      const store = getStore('monday-cache');
      await store.set(board, JSON.stringify(items), {
        metadata: { cachedAt: Date.now(), count: items.length, board }
      });
      console.log(`Cached ${items.length} ${board} items`);
    } catch (cacheWriteErr) {
      console.warn('Cache write failed (non-fatal):', cacheWriteErr.message);
    }

    return {
      statusCode: 200,
      headers: { ...CORS, 'X-Cache': 'MISS' },
      body: JSON.stringify(items)
    };

  } catch (err) {
    console.error('Monday.com fetch error:', err.message);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message })
    };
  }
};
