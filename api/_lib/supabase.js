function getConfig() {
  const baseUrl = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceKey) {
    const error = new Error('Server is not configured');
    error.code = 'SERVER_NOT_CONFIGURED';
    throw error;
  }
  return {baseUrl, serviceKey};
}

export async function supabaseRequest(path, options = {}) {
  const {baseUrl, serviceKey} = getConfig();
  const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(data?.message || data?.hint || 'Database request failed');
    error.statusCode = response.status;
    error.details = data;
    throw error;
  }
  return data;
}
