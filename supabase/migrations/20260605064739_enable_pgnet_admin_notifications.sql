/*
  # Enable pg_net and auto-notify admin on new user signup

  When a new profile is inserted (status: pending), this trigger
  calls the admin-notification edge function via pg_net, which
  sends a Telegram message to the admin about the new registration.
*/

-- Enable pg_net for async HTTP from DB
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- Trigger function to call admin-notification edge function on new signup
CREATE OR REPLACE FUNCTION public.notify_admin_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  supabase_url text;
  supabase_anon_key text;
  function_url text;
BEGIN
  -- Only notify on new pending accounts (not admin auto-activation)
  IF NEW.account_status = 'pending' AND (OLD IS NULL OR OLD.account_status IS NULL OR OLD.account_status != 'pending') THEN
    -- Get project URL from settings
    SELECT value INTO supabase_url FROM public.app_settings WHERE key = 'supabase_url' LIMIT 1;
    SELECT value INTO supabase_anon_key FROM public.app_settings WHERE key = 'supabase_anon_key' LIMIT 1;

    IF supabase_url IS NOT NULL AND supabase_url != '' THEN
      function_url := supabase_url || '/functions/v1/admin-notification';

      -- Fire-and-forget HTTP POST
      PERFORM net.http_post(
        url := function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || COALESCE(supabase_anon_key, ''),
          'apikey', COALESCE(supabase_anon_key, '')
        ),
        body := jsonb_build_object(
          'action', 'new_user',
          'user_email', NEW.email,
          'user_id', NEW.user_id::text
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger to profiles table
DROP TRIGGER IF EXISTS on_new_signup ON public.profiles;
CREATE TRIGGER on_new_signup
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.notify_admin_on_signup();
