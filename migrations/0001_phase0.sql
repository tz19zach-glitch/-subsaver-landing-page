CREATE TABLE IF NOT EXISTS waitlist_leads (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL CHECK (length(full_name) BETWEEN 2 AND 80),
  email TEXT NOT NULL UNIQUE CHECK (email = lower(email)),
  source TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  page_version TEXT NOT NULL DEFAULT 'unknown',
  consent INTEGER NOT NULL CHECK (consent = 1),
  consent_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','interview_invited','interviewed','beta','not_relevant')),
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS waitlist_leads_created_at_idx ON waitlist_leads (created_at DESC);
CREATE INDEX IF NOT EXISTS waitlist_leads_status_idx ON waitlist_leads (status);

CREATE TABLE IF NOT EXISTS landing_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_name TEXT NOT NULL CHECK (event_name IN ('page_view','cta_click','waitlist_open','waitlist_submit','waitlist_success','waitlist_error','faq_open')),
  session_id TEXT,
  page_version TEXT,
  path TEXT,
  properties TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS landing_events_created_at_idx ON landing_events (created_at DESC);
CREATE INDEX IF NOT EXISTS landing_events_event_name_idx ON landing_events (event_name);
CREATE INDEX IF NOT EXISTS landing_events_session_id_idx ON landing_events (session_id);
