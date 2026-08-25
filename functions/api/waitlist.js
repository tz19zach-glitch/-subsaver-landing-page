import {cleanEmail, cleanText, jsonResponse, parseJsonBody, requestIsSameOrigin} from '../_lib/http.js';
import {supabaseRequest} from '../_lib/supabase.js';

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

    const existing = await supabaseRequest(
      env,
      `waitlist_leads?email=eq.${encodeURIComponent(email)}&select=id&limit=1`,
      {method: 'GET'}
    );
    const alreadyRegistered = Array.isArray(existing) && existing.length > 0;
    const now = new Date().toISOString();
    const lead = {
      full_name: fullName,
      email,
      source: cleanText(body.source, 500) || 'direct',
      utm_source: cleanText(body.utm_source, 120),
      utm_medium: cleanText(body.utm_medium, 120),
      utm_campaign: cleanText(body.utm_campaign, 120),
      utm_content: cleanText(body.utm_content, 120),
      utm_term: cleanText(body.utm_term, 120),
      page_version: cleanText(body.page_version, 40) || 'unknown',
      consent: true,
      consent_at: now,
      user_agent: cleanText(request.headers.get('User-Agent'), 500),
      updated_at: now
    };
    if (!alreadyRegistered) lead.status = 'new';

    await supabaseRequest(env, 'waitlist_leads?on_conflict=email', {
      method: 'POST',
      headers: {Prefer: 'resolution=merge-duplicates,return=minimal'},
      body: JSON.stringify(lead)
    });

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

    return jsonResponse(200, {ok: true, alreadyRegistered, confirmationEmailSent});
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
