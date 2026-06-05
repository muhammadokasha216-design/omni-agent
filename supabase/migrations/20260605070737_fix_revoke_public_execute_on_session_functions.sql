/*
  # Fix: Revoke public EXECUTE on session helper functions
*/

REVOKE EXECUTE ON FUNCTION public.get_session_token() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.has_valid_session() FROM anon, authenticated, public;
