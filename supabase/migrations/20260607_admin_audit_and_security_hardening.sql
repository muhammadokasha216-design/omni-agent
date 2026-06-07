/*
  # Admin Audit & Security Hardening

  Creates tables for:
  1. admin_audit_log - Logs all admin actions
  2. ip_whitelist - Trusted IPs for owner account
  3. Enables login_attempts table tracking
*/

-- ─────────────────────────────────────────────────────────
-- 1. ADMIN AUDIT LOG
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type text NOT NULL CHECK (action_type IN (
    'approve_user','reject_user','suspend_user','reactivate_user',
    'change_role','change_status','other'
  )),
  description text,
  old_value   jsonb,
  new_value   jsonb,
  ip_address  text,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Admins can view audit logs
CREATE POLICY "admin_audit_log: admin select all" ON public.admin_audit_log FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role IN ('super_admin','admin'))
  );

-- Admins can insert audit logs
CREATE POLICY "admin_audit_log: admin insert" ON public.admin_audit_log FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role IN ('super_admin','admin'))
  );

-- ─────────────────────────────────────────────────────────
-- 2. IP WHITELIST (for owner account)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ip_whitelist (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address  text NOT NULL,
  label       text,
  last_used   timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ip_whitelist ENABLE ROW LEVEL SECURITY;

-- Users can view their own whitelisted IPs
CREATE POLICY "ip_whitelist: user select own" ON public.ip_whitelist FOR SELECT
  TO authenticated USING (user_id = auth.uid());

-- Admins can view all whitelisted IPs
CREATE POLICY "ip_whitelist: admin select all" ON public.ip_whitelist FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'super_admin')
  );

-- Users can manage their own whitelist
CREATE POLICY "ip_whitelist: user manage own" ON public.ip_whitelist FOR ALL
  TO authenticated USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────
-- 3. ENSURE login_attempts TABLE IS PROPERLY INDEXED
-- ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_login_attempts_email_created 
  ON public.login_attempts(email, attempted_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_created 
  ON public.login_attempts(ip_address, attempted_at DESC);

-- ─────────────────────────────────────────────────────────
-- 4. PREVENT SUPER ADMIN SELF-SUSPENSION TRIGGER
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.prevent_super_admin_suspension()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  -- Prevent super_admin from being suspended or downgraded
  IF NEW.role = 'super_admin' AND OLD.role = 'super_admin' AND NEW.account_status = 'suspended' THEN
    RAISE EXCEPTION 'Cannot suspend super_admin account';
  END IF;
  
  -- Prevent any role from being set to something other than super_admin if currently super_admin
  -- (This protects against accidental downgrade)
  IF OLD.role = 'super_admin' AND NEW.role != 'super_admin' THEN
    RAISE EXCEPTION 'Cannot downgrade super_admin role';
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_super_admin_suspension_trigger ON public.profiles;
CREATE TRIGGER prevent_super_admin_suspension_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_super_admin_suspension();
