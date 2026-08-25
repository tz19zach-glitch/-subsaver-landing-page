import {cleanEmail, cleanText, parseJsonBody, requestIsSameOrigin, sendJson} from './_lib/http.js';
import {supabaseRequest} from './_lib/supabase.js';

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  })[character]);
}

async function sendEmail({to, subject, html, text}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from || !to) return {sent: false, reason: 'not_configured'};

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({from, to: [to], subject, html, text})
  });
  if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
  return {sent: true};
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, {ok: false, message: 'Method not allowed'});
  if (!requestIsSameOrigin(req)) return sendJson(res, 403, {ok: false, message: 'Origin not allowed'});

  try {
    const body = parseJsonBody(req);

    // Honeypot: respond normally without saving so bots cannot learn the filter.
    if (cleanText(body.website, 200)) return sendJson(res, 200, {ok: true, alreadyRegistered: false});

    const fullName = cleanText(body.name, 80);
    const email = cleanEmail(body.email);
    if (!fullName || fullName.length < 2) return sendJson(res, 400, {ok: false, message: 'יש להזין שם מלא.'});
    if (!email) return sendJson(res, 400, {ok: false, message: 'כתובת האימייל אינה תקינה.'});
    if (body.consent !== true) return sendJson(res, 400, {ok: false, message: 'נדרשת הסכמה למדיניות הפרטיות.'});

    const existing = await supabaseRequest(`waitlist_leads?email=eq.${encodeURIComponent(email)}&select=id&limit=1`, {
      method: 'GET'
    });
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
      user_agent: cleanText(req.headers['user-agent'], 500),
      updated_at: now
    };
    if (!alreadyRegistered) lead.status = 'new';

    await supabaseRequest('waitlist_leads?on_conflict=email', {
      method: 'POST',
      headers: {Prefer: 'resolution=merge-duplicates,return=minimal'},
      body: JSON.stringify(lead)
    });

    const emailJobs = [];
    if (!alreadyRegistered) {
      const safeName = escapeHtml(fullName);
      const safeEmail = escapeHtml(email);
      emailJobs.push(sendEmail({
        to: email,
        subject: 'נרשמת לרשימת ההמתנה של SubSaver',
        text: `היי ${fullName}, ההרשמה שלך ל־SubSaver נשמרה בהצלחה. נעדכן אותך כשהגרסה הראשונה תהיה מוכנה.`,
        html: `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.7"><h2>ברוכים הבאים ל־SubSaver</h2><p>היי ${safeName},</p><p>ההרשמה שלך לרשימת ההמתנה נשמרה בהצלחה. נעדכן אותך כשהגרסה הראשונה תהיה מוכנה.</p><p>צוות SubSaver</p></div>`
      }));
      emailJobs.push(sendEmail({
        to: process.env.WAITLIST_NOTIFY_EMAIL,
        subject: 'ליד חדש ב־SubSaver',
        text: `שם: ${fullName}\nאימייל: ${email}`,
        html: `<div dir="rtl" style="font-family:Arial,sans-serif"><h2>ליד חדש</h2><p><strong>שם:</strong> ${safeName}</p><p><strong>אימייל:</strong> ${safeEmail}</p></div>`
      }));
    }
    const emailResults = await Promise.allSettled(emailJobs);
    const confirmationEmailSent = emailResults[0]?.status === 'fulfilled' && emailResults[0].value.sent === true;

    return sendJson(res, 200, {ok: true, alreadyRegistered, confirmationEmailSent});
  } catch (error) {
    console.error('waitlist_signup_failed', {message: error.message, code: error.code});
    const message = error.code === 'SERVER_NOT_CONFIGURED'
      ? 'ההרשמה עדיין אינה זמינה. נסו שוב מאוחר יותר.'
      : 'לא הצלחנו לשמור את ההרשמה. נסו שוב.';
    return sendJson(res, error.statusCode && error.statusCode < 500 ? error.statusCode : 500, {ok: false, message});
  }
}
