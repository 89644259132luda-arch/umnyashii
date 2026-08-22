exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  try {
    const { amount, plan, returnUrl } = JSON.parse(event.body || '{}');
    if (!amount || !plan || !returnUrl) return { statusCode: 400, body: JSON.stringify({ error: 'Missing payment data' }) };
    const shopId = process.env.YOOKASSA_SHOP_ID;
    const secretKey = process.env.YOOKASSA_SECRET_KEY;
    if (!shopId || !secretKey) return { statusCode: 503, body: JSON.stringify({ error: 'YooKassa credentials are not configured' }) };
    const idempotence = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const auth = Buffer.from(`${shopId}:${secretKey}`).toString('base64');
    const response = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Idempotence-Key': idempotence,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: { value: Number(amount).toFixed(2), currency: 'RUB' },
        payment_method_data: { type: 'sbp' },
        confirmation: { type: 'redirect', return_url: returnUrl },
        capture: true,
        description: plan,
        metadata: { plan }
      })
    });
    const data = await response.json();
    if (!response.ok) return { statusCode: response.status, body: JSON.stringify({ error: data.description || 'YooKassa error' }) };
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payment_id: data.id, confirmation_url: data.confirmation && data.confirmation.confirmation_url }) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Payment service error' }) };
  }
};
