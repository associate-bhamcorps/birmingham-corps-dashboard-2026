
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

exports.handler = async (event) => {
  const board = event.queryStringParameters && event.queryStringParameters.board;
  const boardId = BOARD_IDS[board];

  if (!boardId) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid board. Use: participants, partners, or marketing' }) };
  }

  const apiKey = process.env.MONDAY_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'MONDAY_API_KEY environment variable is not set' }) };
  }

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

  try {
    const json = await httpsPost(
      'https://api.monday.com/v2',
      { query },
      {
        'Content-Type': 'application/json',
        'Authorization': apiKey,
        'API-Version': '2024-01'
      }
    );

    if (json.errors) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: json.errors }) };
    }

    if (!json.data || !json.data.boards || !json.data.boards[0]) {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Unexpected API response', raw: JSON.stringify(json).substring(0, 500) }) };
    }

    const items = json.data.boards[0].items_page.items.map(item => {
      const rec = { id: item.id, name: item.name };
      item.column_values.forEach(col => {
        if (col.id !== 'phone_mm28k3k7' && col.id !== 'email_mm28c8fj') {
          rec[col.id] = col.text || '';
        }
      });
      return rec;
    });

    return { statusCode: 200, headers: CORS, body: JSON.stringify(items) };

  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
