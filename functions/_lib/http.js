const MAX_BODY_BYTES = 16_384;

export function jsonResponse(status, payload) {
  return Response.json(payload, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

export function requestIsSameOrigin(request, configuredOrigin) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;

  const requestOrigin = new URL(request.url).origin;
  const allowedOrigin = String(configuredOrigin || '').replace(/\/$/, '');
  return origin === requestOrigin || Boolean(allowedOrigin && origin === allowedOrigin);
}

export async function parseJsonBody(request) {
  const contentLength = Number(request.headers.get('Content-Length') || 0);
  if (contentLength > MAX_BODY_BYTES) {
    const error = new Error('Payload too large');
    error.statusCode = 413;
    throw error;
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    const error = new Error('Payload too large');
    error.statusCode = 413;
    throw error;
  }

  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    const error = new Error('Invalid JSON');
    error.statusCode = 400;
    throw error;
  }
}

export function cleanText(value, maxLength = 200) {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

export function cleanEmail(value) {
  const email = cleanText(value, 254)?.toLowerCase();
  if (!email) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : null;
}
