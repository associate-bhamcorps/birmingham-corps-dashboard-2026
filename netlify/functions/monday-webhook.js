// Monday.com Webhook Handler
// Receives events when Monday.com board data changes → invalidates the cache
// Setup in Monday.com: Admin > Integrations > Webhooks > Add webhook URL:
//   https://dashboard.birminghamcorps.org/.netlify/functions/monday-webhook

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json'
};

const BOARD_MAP = {
  18407896987: 'participants',
  18407898758: 'partners',
  18411541832: 'marketing'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid body' }) };
  }

  // Monday.com challenge verification (sent on first webhook setup)
  if (body.challenge) {
    console.log('Webhook challenge received:', body.challenge);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challenge: body.challenge })
    };
  }

  // Process the actual webhook event
  const webhookEvent = body.event;
  if (!webhookEvent) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ received: true }) };
  }

  const boardId = webhookEvent.boardId;
  const boardName = BOARD_MAP[boardId];
  const eventType = webhookEvent.type;

  console.log(`Monday.com webhook: ${eventType} on board ${boardId} (${boardName || 'unknown'})`);

  if (!boardName) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ received: true, note: 'Unknown board, no cache action' }) };
  }

  // Invalidate cache for this board using Netlify Blobs
  try {
    const { getStore } = require('@netlify/blobs');
    const store = getStore('monday-cache');
    await store.delete(boardName);
    console.log(`Cache invalidated for board: ${boardName}`);
  } catch (err) {
    // Cache invalidation failure is non-fatal — data will refresh on next scheduled run
    console.warn('Cache invalidation failed (non-fatal):', err.message);
  }

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({
      received: true,
      board: boardName,
      event: eventType,
      cacheInvalidated: true
    })
  };
};
