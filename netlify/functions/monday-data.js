exports.handler = async (event) => {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  const BOARD_IDS = {
    participants: 18407896987,
    partners: 18407898758,
    marketing: 18411541832
  };

  const board = event.queryStringParameters && event.queryStringParameters.board;
  const boardId = BOARD_IDS[board];

  if (!boardId) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid board name. Use: participants, partners, or marketing' }) };
  }

  const apiKey = process.env.MONDAY_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Monday.com API key not configured' }) };
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
    const response = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey,
        'API-Version': '2024-01'
      },
      body: JSON.stringify({ query })
    });

    const json = await response.json();

    if (json.errors) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: json.errors }) };
    }

    const items = json.data.boards[0].items_page.items.map(item => {
      const rec = { id: item.id, name: item.name };
      item.column_values.forEach(col => {
        // Skip phone and email for privacy
        if (col.id !== 'phone_mm28k3k7' && col.id !== 'email_mm28c8fj') {
          rec[col.id] = col.text || '';
        }
      });
      return rec;
    });

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify(items)
    };
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
