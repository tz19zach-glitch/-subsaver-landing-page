import {jsonResponse} from '../_lib/http.js';

const REPORT_OPENS_AT = Date.parse('2026-09-02T13:55:00Z');
const REPORT_CLOSES_AT = Date.parse('2026-09-02T14:15:00Z');

const EVENTS_QUERY = `
  SELECT
    COALESCE(NULLIF(json_extract(properties, '$.utm_term'), ''), 'unattributed') AS group_id,
    COALESCE(NULLIF(json_extract(properties, '$.utm_content'), ''), 'unknown') AS hook_id,
    event_name,
    COUNT(*) AS events,
    COUNT(DISTINCT NULLIF(session_id, '')) AS unique_visitors
  FROM landing_events
  WHERE json_extract(properties, '$.utm_source') = 'facebook'
    AND json_extract(properties, '$.utm_campaign') = 'phase1_demand'
  GROUP BY group_id, hook_id, event_name
  ORDER BY group_id, hook_id, event_name
`;

const LEADS_QUERY = `
  SELECT
    COALESCE(NULLIF(utm_term, ''), 'unattributed') AS group_id,
    COALESCE(NULLIF(utm_content, ''), 'unknown') AS hook_id,
    COUNT(*) AS leads
  FROM waitlist_leads
  WHERE utm_source = 'facebook'
    AND utm_campaign = 'phase1_demand'
  GROUP BY group_id, hook_id
  ORDER BY group_id, hook_id
`;

const SURVEY_QUERY = `
  SELECT
    COALESCE(NULLIF(l.utm_term, ''), 'unattributed') AS group_id,
    COALESCE(NULLIF(l.utm_content, ''), 'unknown') AS hook_id,
    COUNT(*) AS survey_opened,
    SUM(CASE WHEN d.submitted_at IS NOT NULL THEN 1 ELSE 0 END) AS survey_submitted,
    SUM(CASE WHEN d.willingness_to_pay = 'yes_99_year' THEN 1 ELSE 0 END) AS willing_yes,
    SUM(CASE WHEN d.willingness_to_pay = 'maybe' THEN 1 ELSE 0 END) AS willing_maybe,
    SUM(CASE WHEN d.willingness_to_pay = 'no' THEN 1 ELSE 0 END) AS willing_no
  FROM demand_validation_responses d
  JOIN waitlist_leads l ON l.id = d.lead_id
  WHERE l.utm_source = 'facebook'
    AND l.utm_campaign = 'phase1_demand'
  GROUP BY group_id, hook_id
  ORDER BY group_id, hook_id
`;

export async function buildCampaignReport(database) {
  const [events, leads, surveys] = await Promise.all([
    database.prepare(EVENTS_QUERY).all(),
    database.prepare(LEADS_QUERY).all(),
    database.prepare(SURVEY_QUERY).all()
  ]);

  return {
    generated_at: new Date().toISOString(),
    scope: {
      source: 'facebook',
      campaign: 'phase1_demand',
      contains_personal_data: false
    },
    events: events.results || [],
    leads: leads.results || [],
    surveys: surveys.results || []
  };
}

export async function onRequestGet({env}) {
  const now = Date.now();
  if (now < REPORT_OPENS_AT || now > REPORT_CLOSES_AT) {
    return jsonResponse(404, {ok: false, message: 'Not found'});
  }

  if (!env.DB) {
    return jsonResponse(503, {ok: false, message: 'Report unavailable'});
  }

  try {
    return jsonResponse(200, {ok: true, report: await buildCampaignReport(env.DB)});
  } catch (error) {
    console.error('campaign_report_failed', {message: error.message, code: error.code});
    return jsonResponse(500, {ok: false, message: 'Report unavailable'});
  }
}

export function onRequest() {
  return jsonResponse(405, {ok: false, message: 'Method not allowed'});
}
