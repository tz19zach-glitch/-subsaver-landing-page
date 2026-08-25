# SubSaver — Phase 0

Phase 0 turns the existing landing page into a measurable waitlist funnel.

## What is implemented

- Waitlist form posts to a same-origin serverless API.
- Leads are validated, normalized, deduplicated and stored in Cloudflare D1.
- Consent and acquisition metadata are stored with each lead.
- Confirmation and owner-notification email integration is ready for Resend.
- Landing-page events are stored in a separate D1 table without direct personal identifiers.
- Privacy and terms pages are included.
- Secrets stay in server-side environment variables and are never embedded in the browser.
- The build publishes only the three public pages plus Cloudflare routing and security-header files.

## Zero-cost validation stack

- GitHub Free stores the public source repository.
- Cloudflare Pages serves the static site over a free `pages.dev` HTTPS address.
- Cloudflare Pages Functions provide the `/api` endpoints on the Workers Free plan.
- Cloudflare D1 Free stores waitlist leads and analytics events.
- Resend is optional and remains disabled until email delivery is intentionally configured.
- No custom domain or payment method is required for the validation stage.

The Vercel-compatible API remains in `api/` for reference only. The zero-cost validation deployment uses Cloudflare Pages Functions in `functions/` and a D1 database binding named `DB`.

## Required setup before public validation

1. Connect this repository to a Cloudflare Pages Free project and use `npm run build` with `dist` as the output directory.
2. Create a D1 Free database named `subsaver-phase0`.
3. Run `migrations/0001_phase0.sql` against the D1 database.
4. Bind the database to the Pages project with the binding name `DB`.
5. Leave every `RESEND_*` variable unset during the zero-cost validation stage.
6. Add Tal's approved contact address to the policy pages before public lead collection.
7. Deploy, then run the acceptance tests below.

## Acceptance tests

- New lead is visible in the D1 `waitlist_leads` table within one minute.
- Duplicate email does not create a second row.
- Success is shown only after the API confirms the database write.
- Network or server failure preserves the form and shows a clear error.
- Confirmation email is not expected until the optional Resend integration is intentionally enabled.
- `page_view`, `cta_click`, `waitlist_open`, `waitlist_submit`, `waitlist_success` and `waitlist_error` can be observed in `landing_events`.
- The page works on mobile and desktop over HTTPS.
- No service-role or email API key appears in page source or the repository.
