create extension if not exists pgcrypto;

create table if not exists public.waitlist_leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 80),
  email text not null unique check (email = lower(email)),
  source text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  page_version text not null default 'unknown',
  consent boolean not null check (consent = true),
  consent_at timestamptz not null,
  status text not null default 'new' check (status in ('new','interview_invited','interviewed','beta','not_relevant')),
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists waitlist_leads_created_at_idx on public.waitlist_leads (created_at desc);
create index if not exists waitlist_leads_status_idx on public.waitlist_leads (status);

create table if not exists public.landing_events (
  id bigint generated always as identity primary key,
  event_name text not null check (event_name in ('page_view','cta_click','waitlist_open','waitlist_submit','waitlist_success','waitlist_error','faq_open')),
  session_id text,
  page_version text,
  path text,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists landing_events_created_at_idx on public.landing_events (created_at desc);
create index if not exists landing_events_event_name_idx on public.landing_events (event_name);
create index if not exists landing_events_session_id_idx on public.landing_events (session_id);

alter table public.waitlist_leads enable row level security;
alter table public.landing_events enable row level security;

revoke all on table public.waitlist_leads from anon, authenticated;
revoke all on table public.landing_events from anon, authenticated;
revoke all on sequence public.landing_events_id_seq from anon, authenticated;

comment on table public.waitlist_leads is 'Phase 0 waitlist leads. Accessed only by the server with the Supabase service role.';
comment on table public.landing_events is 'Minimal landing-page analytics without direct personal identifiers.';
