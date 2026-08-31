-- Phase 1 demand-validation dashboard queries for Cloudflare D1.

-- 1. Facebook visitors and page views by group and post variant.
SELECT
  COALESCE(json_extract(properties, '$.utm_term'), 'unknown') AS group_code,
  COALESCE(json_extract(properties, '$.utm_content'), 'unknown') AS post_variant,
  COUNT(*) AS page_views,
  COUNT(DISTINCT session_id) AS visitors
FROM landing_events
WHERE event_name = 'page_view'
  AND json_extract(properties, '$.utm_source') = 'facebook'
  AND json_extract(properties, '$.utm_campaign') = 'phase1_demand'
GROUP BY group_code, post_variant
ORDER BY visitors DESC;

-- 2. Funnel events by group. New attribution is available from page version v2 onward.
SELECT
  COALESCE(json_extract(properties, '$.utm_term'), 'unknown') AS group_code,
  event_name,
  COUNT(*) AS events,
  COUNT(DISTINCT session_id) AS visitors
FROM landing_events
WHERE json_extract(properties, '$.utm_source') = 'facebook'
  AND json_extract(properties, '$.utm_campaign') = 'phase1_demand'
GROUP BY group_code, event_name
ORDER BY group_code, events DESC;

-- 3. Registrations by Facebook group and post variant.
SELECT
  COALESCE(utm_term, 'unknown') AS group_code,
  COALESCE(utm_content, 'unknown') AS post_variant,
  COUNT(*) AS registrations
FROM waitlist_leads
WHERE utm_source = 'facebook'
  AND utm_campaign = 'phase1_demand'
GROUP BY group_code, post_variant
ORDER BY registrations DESC;

-- 4. Demand-survey completion and willingness to pay.
SELECT
  COUNT(*) AS survey_opened,
  SUM(CASE WHEN submitted_at IS NOT NULL THEN 1 ELSE 0 END) AS survey_completed,
  SUM(CASE WHEN willingness_to_pay = 'yes_99_year' THEN 1 ELSE 0 END) AS willing_to_pay,
  SUM(CASE WHEN willingness_to_pay = 'maybe' THEN 1 ELSE 0 END) AS maybe_willing,
  SUM(CASE WHEN willingness_to_pay = 'no' THEN 1 ELSE 0 END) AS not_willing
FROM demand_validation_responses;
