const https = require('https');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json'
};

const BOARD_ID = 18407896987;

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
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.MONDAY_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const {
    firstName, lastName, phone, email,
    program, cohort, industry, satisfaction,
    salaryBefore, salaryAfter, feedback, contactType
  } = body;

  if (!firstName || !lastName) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'First name and last name are required' }) };
  }

  const fullName = `${firstName.trim()} ${lastName.trim()}`;

  // Build column values
  const columnValues = {};

  if (phone) {
    const digitsOnly = phone.replace(/\D/g, '');
    if (digitsOnly.length >= 10) {
      columnValues['phone_mm28k3k7'] = { phone: digitsOnly, countryShortName: 'US' };
    }
  }

  if (email) {
    columnValues['email_mm28c8fj'] = { email: email.trim(), text: email.trim() };
  }

  if (program) {
    columnValues['color_mm2ybdsg'] = { label: program };
  }

  if (contactType) {
    columnValues['dropdown_mm28v4zz'] = contactType;
  } else {
    columnValues['dropdown_mm28v4zz'] = 'Career Navigator Participant';
  }

  if (cohort) {
    columnValues['text_mm2tbgbc'] = cohort;
  }

  if (satisfaction && !isNaN(parseInt(satisfaction))) {
    columnValues['rating_mm2tqwp1'] = { rating: parseInt(satisfaction) };
  }

  if (salaryBefore && !isNaN(parseFloat(salaryBefore))) {
    columnValues['numeric_mm28tx7a'] = parseFloat(salaryBefore);
  }

  if (salaryAfter && !isNaN(parseFloat(salaryAfter))) {
    columnValues['numeric_mm2yc563'] = parseFloat(salaryAfter);
  }

  const notes = [
    industry ? `Industry: ${industry}` : null,
    feedback ? `Feedback: ${feedback}` : null,
    `Submitted via intake form on ${new Date().toLocaleDateString('en-US', { timeZone: 'America/Chicago' })}`
  ].filter(Boolean).join('\n');

  if (notes) {
    columnValues['long_text_mm2855d2'] = { text: notes };
  }

  const mutation = `
    mutation {
      create_item(
        board_id: ${BOARD_ID},
        item_name: "${fullName.replace(/"/g, '\\"')}",
        column_values: ${JSON.stringify(JSON.stringify(columnValues))}
      ) {
        id
        name
      }
    }
  `;

  try {
    const result = await httpsPost(
      'https://api.monday.com/v2',
      { query: mutation },
      {
        'Content-Type': 'application/json',
        'Authorization': apiKey,
        'API-Version': '2024-01'
      }
    );

    if (result.errors) {
      console.error('Monday.com error:', result.errors);
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Monday.com error', details: result.errors }) };
    }

    const createdItem = result.data?.create_item;
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        success: true,
        message: `${fullName} has been added to the directory.`,
        itemId: createdItem?.id
      })
    };

  } catch (err) {
    console.error('Intake error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
