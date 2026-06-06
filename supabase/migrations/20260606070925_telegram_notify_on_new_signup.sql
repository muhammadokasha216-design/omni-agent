/*
  # Telegram notification on new user signup
  
  When a new profile is inserted with account_status = 'pending',
  call the telegram-relay edge function via pg_net to send an admin alert.
*/

CREATE OR REPLACE FUNCTION public.notify_admin_telegram_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _service_role_key text;
  _supabase_url     text;
  _function_url     text;
  _payload          jsonb;
BEGIN
  -- Only fire for pending (new) users, not updates or active users
  IF TG_OP = 'INSERT' AND NEW.account_status = 'pending' THEN
    _supabase_url     := current_setting('app.settings.supabase_url', true);
    _function_url     := _supabase_url || '/functions/v1/telegram-relay';
    _service_role_key := current_setting('app.settings.service_role_key', true);

    _payload := jsonb_build_object(
      'action',     'new_signup',
      'user_email', NEW.email,
      'user_id',    NEW.user_id::text
    );

    -- Use pg_net if available; silently skip if not
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
      PERFORM net.http_post(
        url     := _function_url,
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || _service_role_key
        ),
        body    := _payload
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Revoke public execute — trigger-only function
REVOKE EXECUTE ON FUNCTION public.notify_admin_telegram_on_signup() FROM anon, authenticated, public;

DROP TRIGGER IF EXISTS trg_notify_admin_telegram_on_signup ON public.profiles;
CREATE TRIGGER trg_notify_admin_telegram_on_signup
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_telegram_on_signup();
