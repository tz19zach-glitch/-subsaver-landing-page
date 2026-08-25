# SubSaver — Phase 0

Phase 0 turns the existing landing page into a measurable waitlist funnel.

## What is implemented

- Waitlist form posts to a same-origin serverless API.
- Leads are validated, normalized, deduplicated and stored in Supabase.
- Consent and acquisition metadata are stored with each lead.
- Confirmation and owner-notification email integration is ready for Resend.
- Landing-page events are stored in a separate Supabase table without direct personal identifiers.
- Privacy and terms pages are included.
- Secrets stay in server-side environment variables and are never embedded in the browser.

## Required setup before production

1. Create or select a Supabase project.
2. Run `supabase/migrations/001_phase0_waitlist.sql` in the Supabase SQL editor.
3. Connect this repository to Vercel.
4. Add every variable listed in `.env.example` to the Vercel project settings.
5. Verify a sending domain in Resend and set `RESEND_FROM_EMAIL`.
6. Add Tal's approved contact address to the policy pages before public lead collection.
7. Deploy, then run the acceptance tests below.

## Acceptance tests

- New lead is visible in `waitlist_leads` within one minute.
- Duplicate email does not create a second row.
- Success is shown only after the API confirms the database write.
- Network or server failure preserves the form and shows a clear error.
- Confirmation email reaches the test inbox.
- `page_view`, `cta_click`, `waitlist_open`, `waitlist_submit`, `waitlist_success` and `waitlist_error` can be observed in `landing_events`.
- The page works on mobile and desktop over HTTPS.
- No service-role or email API key appears in page source or the repository.
