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

## Zero-cost validation stack

- GitHub Free stores the public source repository.
- Cloudflare Pages serves the static site over a free `pages.dev` HTTPS address.
- Cloudflare Pages Functions provide the `/api` endpoints on the Workers Free plan.
- Supabase Free stores waitlist leads and analytics events.
- Resend is optional and remains disabled until email delivery is intentionally configured.
- No custom domain or payment method is required for the validation stage.

The Vercel-compatible API remains in `api/` for portability. The zero-cost commercial validation deployment uses the Cloudflare-compatible API in `functions/`.

## Required setup before public validation

1. Create or select a Supabase project.
2. Run `supabase/migrations/001_phase0_waitlist.sql` in the Supabase SQL editor.
3. Connect this repository to a Cloudflare Pages Free project.
4. Add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `SITE_ORIGIN` as encrypted Cloudflare project variables.
5. Leave every `RESEND_*` variable unset during the zero-cost validation stage.
6. Add Tal's approved contact address to the policy pages before public lead collection.
7. Deploy to the free `pages.dev` HTTPS address, then run the acceptance tests below.

## Acceptance tests

- New lead is visible in `waitlist_leads` within one minute.
- Duplicate email does not create a second row.
- Success is shown only after the API confirms the database write.
- Network or server failure preserves the form and shows a clear error.
- Confirmation email reaches the test inbox.
- `page_view`, `cta_click`, `waitlist_open`, `waitlist_submit`, `waitlist_success` and `waitlist_error` can be observed in `landing_events`.
- The page works on mobile and desktop over HTTPS.
- No service-role or email API key appears in page source or the repository.
