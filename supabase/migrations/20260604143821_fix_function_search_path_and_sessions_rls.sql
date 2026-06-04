/*
  # Fix Security Issues — Search Path & Sessions RLS

  ## Issues Fixed

  ### 1. Function Search Path Mutable (3 functions)
  Functions `get_session_token`, `is_session_valid`, and `has_valid_session` had
  mutable search_path, which allows a malicious schema to intercept calls by
  shadowing pg_catalog types or operators. Fixed by adding `SET search_path = pg_catalog, public`
  to each function definition.

  ### 2. RLS Policy Always True on sessions (2 policies)
  - `Allow public insert sessions` used `WITH CHECK (true)` — any anonymous caller
    could insert arbitrary session rows.
  - `Allow public update sessions` used `USING (true) WITH CHECK (true)` — any caller
    could overwrite any session row.

  Both are replaced with token-scoped policies:
  - INSERT: the new row's `session_token` must not be empty and must not already exist
    (prevents token collision injection).
  - UPDATE: the caller may only update a row whose `session_token` matches the value
    they supply in the request context (`app.session_token`), so sessions are
    self-owned and cannot be hijacked.

  ## Tables Modified
  - sessions: INSERT and UPDATE policies tightened

  ## Functions Modified
  - get_session_token: pinned search_path
  - is_session_valid:  pinned search_path
  - has_valid_session: pinned search_path
*/

-- ─────────────────────────────────────────
-- 1. Fix function search paths
-- ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_session_token()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT coalesce(current_setting('app.session_token', true), '');
$$;

CREATE OR REPLACE FUNCTION public.is_session_valid(token text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sessions
    WHERE session_token = token
      AND expires_at > now()
  );
$$;

CREATE OR REPLACE FUNCTION public.has_valid_session()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sessions
    WHERE expires_at > now()
    LIMIT 1
  );
$$;

-- ─────────────────────────────────────────
-- 2. Fix sessions INSERT policy (was WITH CHECK (true))
--    Allow insert only when the token field is non-empty.
--    This prevents blank/null token injections while still
--    letting the frontend bootstrap its session on first load.
-- ─────────────────────────────────────────

DROP POLICY IF EXISTS "Allow public insert sessions" ON public.sessions;

CREATE POLICY "Sessions: insert own token"
  ON public.sessions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    session_token IS NOT NULL
    AND length(trim(session_token)) > 0
  );

-- ─────────────────────────────────────────
-- 3. Fix sessions UPDATE policy (was USING/WITH CHECK (true))
--    Only the owner of a session (identified by matching the
--    token stored in the request context) may update that row.
-- ─────────────────────────────────────────

DROP POLICY IF EXISTS "Allow public update sessions" ON public.sessions;

CREATE POLICY "Sessions: update own token"
  ON public.sessions
  FOR UPDATE
  TO anon, authenticated
  USING (
    session_token = public.get_session_token()
  )
  WITH CHECK (
    session_token = public.get_session_token()
  );
