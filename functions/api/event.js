import {cleanText, jsonResponse, parseJsonBody, requestIsSameOrigin} from '../_lib/http.js';

const ALLOWED_EVENTS = new Set([
  'page_view',
  'cta_click',
  'waitlist_open',
  'waitlist_submit',
  'waitlist_success',
  'waitlist_error',
  'faq_open'
]);

export async function onRequestPost({request, env}) {
  if (!requestIsSameOrigin(request, env.SITE_ORIGIN)) {
    return jsonResponse(403, {ok: false, message: 'Origin not allowed'});
  }

  try {
    if (!env.DB) {
      const error = new Error('Database binding is not configured');
      error.code = 'SERVER_NOT_CONFIGURED';
      throw error;
    }

    const body = await parseJsonBody(request);
    const eventName = cleanText(body.event, 40);
    if (!eventName || !ALLOWED_EVENTS.has(eventName)) {
      return jsonResponse(400, {ok: false, message: 'Invalid event'});
    }

    const source = body.properties && typeof body.properties === 'object' ? body.properties : {};
    const properties = {
      session_id: cleanText(source.session_id, 80),
      page_version: cleanText(source.page_version, 40),
      path: cleanText(source.path, 200),
      referrer: cleanText(source.referrer, 500),
      utm_source: cleanText(source.utm_source, 120),
      utm_medium: cleanText(source.utm_medium, 120),
      utm_campaign: cleanText(source.utm_campaign, 120),
      cta_position: cleanText(source.cta_position, 40),
      question: cleanText(source.question, 300),
      already_registered: source.already_registered === true,
      reason: cleanText(source.reason, 80)
    };

    await env.DB.prepare(`
      INSERT INTO landing_events (event_name, session_id, page_version, path, properties)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      eventName,
      properties.session_id,
      properties.page_version,
      properties.path,
      JSON.stringify(properties)
    ).run();

    return jsonResponse(201, {ok: true});
  } catch (error) {
    console.error('analytics_event_failed', {message: error.message, code: error.code});
    return jsonResponse(error.statusCode || 500, {ok: false, message: 'Event was not recorded'});
  }
}

export function onRequest() {
  return jsonResponse(405, {ok: false, message: 'Method not allowed'});
}
