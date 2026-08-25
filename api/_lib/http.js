const MAX_BODY_BYTES = 16_384;

export function sendJson(res, status, payload) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(status).json(payload);
}

export function requestIsSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;

  const forwardedProto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  const requestOrigin = host ? `${forwardedProto}://${host}` : '';
  const configuredOrigin = String(process.env.SITE_ORIGIN || '').replace(/\/$/, '');

  return origin === requestOrigin || Boolean(configuredOrigin && origin === configuredOrigin);
}

export function parseJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const raw = typeof req.body === 'string' ? req.body : '';
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
    const error = new Error('Payload too large');
    error.statusCode = 413;
    throw error;
  }
  return raw ? JSON.parse(raw) : {};
}

export function cleanText(value, maxLength = 200) {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

export function cleanEmail(value) {
  const email = cleanText(value, 254)?.toLowerCase();
  if (!email) return null;
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  return valid ? email : null;
}
