/*
  # Drop the pg_net-based trigger — replaced by frontend invocation
  
  The telegram notification on signup is handled directly by the frontend
  (auth.tsx signUp) which calls telegram-relay?action=new_signup after
  the user is created. This avoids storing service_role keys in user tables.
*/

DROP TRIGGER IF EXISTS trg_notify_admin_telegram_on_signup ON public.profiles;
DROP FUNCTION IF EXISTS public.notify_admin_telegram_on_signup();
