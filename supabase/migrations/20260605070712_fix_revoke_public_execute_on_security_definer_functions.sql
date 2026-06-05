/*
  # Fix: Revoke public EXECUTE on SECURITY DEFINER functions

  These functions are meant to be called ONLY by database triggers,
  never by users via /rest/v1/rpc/. Revoke EXECUTE from anon, 
  authenticated, and public roles.
*/

-- handle_new_user(): trigger on auth.users INSERT
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;

-- notify_admin_on_signup(): trigger on profiles INSERT
REVOKE EXECUTE ON FUNCTION public.notify_admin_on_signup() FROM anon, authenticated, public;

-- seed_user_settings(): trigger on profiles UPDATE (status change)
REVOKE EXECUTE ON FUNCTION public.seed_user_settings() FROM anon, authenticated, public;

-- Also revoke on the helper functions used in RLS policies
-- These are called internally by RLS evaluation, not via RPC,
-- but lock them down for defense in depth
REVOKE EXECUTE ON FUNCTION public.is_active_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_admin_user() FROM anon, authenticated, public;

-- Verify: no public execute remains
-- (These should return empty results after the revokes)
