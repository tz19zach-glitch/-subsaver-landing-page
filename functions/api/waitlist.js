import {cleanEmail, cleanText, jsonResponse, parseJsonBody, requestIsSameOrigin} from '../_lib/http.js';

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  })[character]);
}

async function sendEmail(env, {to, subject, html, text}) {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL || !to) {
    return {sent: false, reason: 'not_configured'};
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({from: env.RESEND_FROM_EMAIL, to: [to], subject, html, text})
  });
  if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
  return {sent: true};
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

    // Honeypot: respond normally without saving so bots cannot learn the filter.
    if (cleanText(body.website, 200)) {
      return jsonResponse(200, {ok: true, alreadyRegistered: false});
    }

    const fullName = cleanText(body.name, 80);
    const email = cleanEmail(body.email);
    if (!fullName || fullName.length < 2) {
      return jsonResponse(400, {ok: false, message: 'יש להזין שם מלא.'});
    }
    if (!email) return jsonResponse(400, {ok: false, message: 'כתובת האימייל אינה תקינה.'});
    if (body.consent !== true) {
      return jsonResponse(400, {ok: false, message: 'נדרשת הסכמה למדיניות הפרטיות.'});
    }

    const existing = await env.DB.prepare('SELECT id FROM waitlist_leads WHERE email = ? LIMIT 1')
      .bind(email)
      .first();
    const alreadyRegistered = Boolean(existing);
    const now = new Date().toISOString();
    const newLeadId = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO waitlist_leads (
        id, full_name, email, source, utm_source, utm_medium, utm_campaign,
        utm_content, utm_term, page_version, consent, consent_at, status,
        user_agent, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 'new', ?, ?)
      ON CONFLICT(email) DO UPDATE SET
        full_name = excluded.full_name,
        source = excluded.source,
        utm_source = excluded.utm_source,
        utm_medium = excluded.utm_medium,
        utm_campaign = excluded.utm_campaign,
        utm_content = excluded.utm_content,
        utm_term = excluded.utm_term,
        page_version = excluded.page_version,
        consent = 1,
        consent_at = excluded.consent_at,
        user_agent = excluded.user_agent,
        updated_at = excluded.updated_at
    `).bind(
      newLeadId,
      fullName,
      email,
      cleanText(body.source, 500) || 'direct',
      cleanText(body.utm_source, 120),
      cleanText(body.utm_medium, 120),
      cleanText(body.utm_campaign, 120),
      cleanText(body.utm_content, 120),
      cleanText(body.utm_term, 120),
      cleanText(body.page_version, 40) || 'unknown',
      now,
      cleanText(request.headers.get('User-Agent'), 500),
      now
    ).run();

    const emailJobs = [];
    if (!alreadyRegistered) {
      const safeName = escapeHtml(fullName);
      const safeEmail = escapeHtml(email);
      emailJobs.push(sendEmail(env, {
        to: email,
        subject: 'נרשמת לרשימת ההמתנה של SubSaver',
        text: `היי ${fullName}, ההרשמה שלך ל־SubSaver נשמרה בהצלחה. נעדכן אותך כשהגרסה הראשונה תהיה מוכנה.`,
        html: `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.7"><h2>ברוכים הבאים ל־SubSaver</h2><p>היי ${safeName},</p><p>ההרשמה שלך לרשימת ההמתנה נשמרה בהצלחה. נעדכן אותך כשהגרסה הראשונה תהיה מוכנה.</p><p>צוות SubSaver</p></div>`
      }));
      emailJobs.push(sendEmail(env, {
        to: env.WAITLIST_NOTIFY_EMAIL,
        subject: 'ליד חדש ב־SubSaver',
        text: `שם: ${fullName}\nאימייל: ${email}`,
        html: `<div dir="rtl" style="font-family:Arial,sans-serif"><h2>ליד חדש</h2><p><strong>שם:</strong> ${safeName}</p><p><strong>אימייל:</strong> ${safeEmail}</p></div>`
      }));
    }
    const emailResults = await Promise.allSettled(emailJobs);
    const confirmationEmailSent = emailResults[0]?.status === 'fulfilled' && emailResults[0].value.sent === true;

    return jsonResponse(200, {
      ok: true,
      alreadyRegistered,
      confirmationEmailSent,
      leadId: existing?.id || newLeadId
    });
  } catch (error) {
    console.error('waitlist_signup_failed', {message: error.message, code: error.code});
    const message = error.code === 'SERVER_NOT_CONFIGURED'
      ? 'ההרשמה עדיין אינה זמינה. נסו שוב מאוחר יותר.'
      : 'לא הצלחנו לשמור את ההרשמה. נסו שוב.';
    const status = error.statusCode && error.statusCode < 500 ? error.statusCode : 500;
    return jsonResponse(status, {ok: false, message});
  }
}

export function onRequest() {
  return jsonResponse(405, {ok: false, message: 'Method not allowed'});
}
