import {cleanText, jsonResponse, parseJsonBody, requestIsSameOrigin} from '../_lib/http.js';

const SUBSCRIPTION_COUNTS = new Set(['0_2', '3_5', '6_plus']);
const PAIN_FREQUENCIES = new Set(['monthly', 'quarterly', 'rarely']);
const WILLINGNESS_OPTIONS = new Set(['yes_990', 'maybe', 'no']);

async function ensureSurveySchema(database) {
  await database.prepare(`
    CREATE TABLE IF NOT EXISTS demand_validation_responses (
      lead_id TEXT PRIMARY KEY,
      subscription_count TEXT CHECK (subscription_count IN ('0_2','3_5','6_plus')),
      pain_frequency TEXT CHECK (pain_frequency IN ('monthly','quarterly','rarely')),
      willingness_to_pay TEXT CHECK (willingness_to_pay IN ('yes_990','maybe','no')),
      opened_at TEXT NOT NULL,
      submitted_at TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (lead_id) REFERENCES waitlist_leads(id) ON DELETE CASCADE
    )
  `).run();
  await database.prepare(`
    CREATE INDEX IF NOT EXISTS demand_validation_willingness_idx
    ON demand_validation_responses (willingness_to_pay)
  `).run();
  await database.prepare(`
    CREATE INDEX IF NOT EXISTS demand_validation_submitted_at_idx
    ON demand_validation_responses (submitted_at DESC)
  `).run();
}

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
    const action = cleanText(body.action, 20);
    const leadId = cleanText(body.leadId, 80);
    if (!leadId) {
      return jsonResponse(400, {ok: false, message: 'ההרשמה לא זוהתה. נסו להירשם שוב.'});
    }

    const lead = await env.DB.prepare('SELECT id FROM waitlist_leads WHERE id = ? LIMIT 1')
      .bind(leadId)
      .first();
    if (!lead) {
      return jsonResponse(404, {ok: false, message: 'ההרשמה לא נמצאה. נסו להירשם שוב.'});
    }

    await ensureSurveySchema(env.DB);
    const now = new Date().toISOString();

    if (action === 'open') {
      await env.DB.prepare(`
        INSERT INTO demand_validation_responses (lead_id, opened_at, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(lead_id) DO UPDATE SET updated_at = excluded.updated_at
      `).bind(leadId, now, now).run();
      return jsonResponse(201, {ok: true});
    }

    if (action !== 'submit') {
      return jsonResponse(400, {ok: false, message: 'Invalid survey action'});
    }

    const subscriptionCount = cleanText(body.subscriptionCount, 20);
    const painFrequency = cleanText(body.painFrequency, 20);
    const willingnessToPay = cleanText(body.willingnessToPay, 20);
    if (!SUBSCRIPTION_COUNTS.has(subscriptionCount) ||
        !PAIN_FREQUENCIES.has(painFrequency) ||
        !WILLINGNESS_OPTIONS.has(willingnessToPay)) {
      return jsonResponse(400, {ok: false, message: 'יש לענות על כל שלוש השאלות.'});
    }

    await env.DB.prepare(`
      INSERT INTO demand_validation_responses (
        lead_id, subscription_count, pain_frequency, willingness_to_pay,
        opened_at, submitted_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(lead_id) DO UPDATE SET
        subscription_count = excluded.subscription_count,
        pain_frequency = excluded.pain_frequency,
        willingness_to_pay = excluded.willingness_to_pay,
        submitted_at = excluded.submitted_at,
        updated_at = excluded.updated_at
    `).bind(
      leadId,
      subscriptionCount,
      painFrequency,
      willingnessToPay,
      now,
      now,
      now
    ).run();

    return jsonResponse(200, {ok: true});
  } catch (error) {
    console.error('demand_survey_failed', {message: error.message, code: error.code});
    const message = error.code === 'SERVER_NOT_CONFIGURED'
      ? 'השאלון עדיין אינו זמין. נסו שוב מאוחר יותר.'
      : 'לא הצלחנו לשמור את התשובות. נסו שוב.';
    const status = error.statusCode && error.statusCode < 500 ? error.statusCode : 500;
    return jsonResponse(status, {ok: false, message});
  }
}

export function onRequest() {
  return jsonResponse(405, {ok: false, message: 'Method not allowed'});
}
