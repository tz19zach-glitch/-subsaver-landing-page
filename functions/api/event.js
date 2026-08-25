import {cleanText, jsonResponse, parseJsonBody, requestIsSameOrigin} from '../_lib/http.js';
import {supabaseRequest} from '../_lib/supabase.js';

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

    await supabaseRequest(env, 'landing_events', {
      method: 'POST',
      headers: {Prefer: 'return=minimal'},
      body: JSON.stringify({
        event_name: eventName,
        session_id: properties.session_id,
        page_version: properties.page_version,
        path: properties.path,
        properties
      })
    });

    return jsonResponse(201, {ok: true});
  } catch (error) {
    console.error('analytics_event_failed', {message: error.message, code: error.code});
    return jsonResponse(error.statusCode || 500, {ok: false, message: 'Event was not recorded'});
  }
}

export function onRequest() {
  return jsonResponse(405, {ok: false, message: 'Method not allowed'});
}
