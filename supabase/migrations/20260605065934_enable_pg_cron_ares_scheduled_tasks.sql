/*
  # Enable pg_cron for Ares scheduled tasks

  - Daily summary at 9 AM (UTC)
  - Proactive check every 30 minutes
  - Intruder scan every 15 minutes
*/

CREATE EXTENSION IF NOT EXISTS pg_cron SCHEMA extensions;

-- Schedule: Daily summary at 9:00 AM UTC
SELECT cron.schedule(
  'ares-daily-summary',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT value FROM public.app_settings WHERE key = 'supabase_url' LIMIT 1) || '/functions/v1/ares-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM public.app_settings WHERE key = 'supabase_anon_key' LIMIT 1),
      'apikey', (SELECT value FROM public.app_settings WHERE key = 'supabase_anon_key' LIMIT 1)
    ),
    body := jsonb_build_object('task', 'daily_summary')
  );
  $$
);

-- Schedule: Proactive check every 30 minutes
SELECT cron.schedule(
  'ares-proactive-check',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT value FROM public.app_settings WHERE key = 'supabase_url' LIMIT 1) || '/functions/v1/ares-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM public.app_settings WHERE key = 'supabase_anon_key' LIMIT 1),
      'apikey', (SELECT value FROM public.app_settings WHERE key = 'supabase_anon_key' LIMIT 1)
    ),
    body := jsonb_build_object('task', 'proactive_check')
  );
  $$
);

-- Schedule: Intruder scan every 15 minutes
SELECT cron.schedule(
  'ares-intruder-scan',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT value FROM public.app_settings WHERE key = 'supabase_url' LIMIT 1) || '/functions/v1/ares-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM public.app_settings WHERE key = 'supabase_anon_key' LIMIT 1),
      'apikey', (SELECT value FROM public.app_settings WHERE key = 'supabase_anon_key' LIMIT 1)
    ),
    body := jsonb_build_object('task', 'intruder_scan')
  );
  $$
);
