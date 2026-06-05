/*
  # Ares SaaS Multi-Tenant Transformation

  ## What this does
  1. Creates a `profiles` table linked to auth.users with role, account_status, subscription columns
  2. Seeds the admin account (muhammadokasha216@gmail.com) as super_admin with ACTIVE status
  3. Adds `user_id` column to every data table for multi-tenant isolation
  4. Replaces ALL existing RLS policies with user-scoped policies using auth.uid()
  5. Creates a trigger that auto-creates a profile row on signup (status: PENDING)

  ## Roles
  - super_admin: Full access to all data + admin dashboard
  - admin: Can manage users, view all data
  - member: Can manage own data only
  - viewer: Read-only access to own data

  ## Account Status Flow
  PENDING → ACTIVE (approved) or REJECTED
  Only ACTIVE users can access dashboard features.
*/

-- ─────────────────────────────────────────────────────────
-- 1. PROFILES TABLE
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email             text NOT NULL,
  display_name      text NOT NULL DEFAULT '',
  role              text NOT NULL DEFAULT 'member'
                      CHECK (role IN ('super_admin','admin','member','viewer')),
  account_status    text NOT NULL DEFAULT 'pending'
                      CHECK (account_status IN ('pending','active','rejected','suspended')),
  subscription_status text NOT NULL DEFAULT 'free'
                      CHECK (subscription_status IN ('free','trial','pro','enterprise')),
  team              text,
  last_active       timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "profiles: read own" ON public.profiles FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- Admins can read all profiles
CREATE POLICY "profiles: admin read all" ON public.profiles FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role IN ('super_admin','admin'))
  );

-- Users can update their own display_name
CREATE POLICY "profiles: update own" ON public.profiles FOR UPDATE
  TO authenticated USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can update any profile (for approval/rejection)
CREATE POLICY "profiles: admin update all" ON public.profiles FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role IN ('super_admin','admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role IN ('super_admin','admin'))
  );

-- Insert is handled by trigger only — no direct insert policy needed
-- (the trigger runs as SECURITY DEFINER)

-- ─────────────────────────────────────────────────────────
-- 2. AUTO-CREATE PROFILE ON SIGNUP
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name, role, account_status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    CASE WHEN NEW.email = 'muhammadokasha216@gmail.com' THEN 'super_admin' ELSE 'member' END,
    CASE WHEN NEW.email = 'muhammadokasha216@gmail.com' THEN 'active' ELSE 'pending' END
  );
  RETURN NEW;
END;
$$;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────────────────
-- 3. SEED ADMIN PROFILE (in case already exists)
-- ─────────────────────────────────────────────────────────
INSERT INTO public.profiles (user_id, email, display_name, role, account_status)
SELECT id, email, 'Ukasha', 'super_admin', 'active'
FROM auth.users
WHERE email = 'muhammadokasha216@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET
  role = 'super_admin',
  account_status = 'active';

-- ─────────────────────────────────────────────────────────
-- 4. ADD user_id TO ALL DATA TABLES
-- ─────────────────────────────────────────────────────────

-- agent_nodes
ALTER TABLE public.agent_nodes ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
UPDATE public.agent_nodes SET user_id = (SELECT id FROM auth.users WHERE email = 'muhammadokasha216@gmail.com' LIMIT 1) WHERE user_id IS NULL;

-- trading_bots
ALTER TABLE public.trading_bots ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
UPDATE public.trading_bots SET user_id = (SELECT id FROM auth.users WHERE email = 'muhammadokasha216@gmail.com' LIMIT 1) WHERE user_id IS NULL;

-- trade_executions
ALTER TABLE public.trade_executions ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
UPDATE public.trade_executions SET user_id = (SELECT id FROM auth.users WHERE email = 'muhammadokasha216@gmail.com' LIMIT 1) WHERE user_id IS NULL;

-- telegram_messages
ALTER TABLE public.telegram_messages ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
UPDATE public.telegram_messages SET user_id = (SELECT id FROM auth.users WHERE email = 'muhammadokasha216@gmail.com' LIMIT 1) WHERE user_id IS NULL;

-- heartbeat_log
ALTER TABLE public.heartbeat_log ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
UPDATE public.heartbeat_log SET user_id = (SELECT id FROM auth.users WHERE email = 'muhammadokasha216@gmail.com' LIMIT 1) WHERE user_id IS NULL;

-- system_alerts
ALTER TABLE public.system_alerts ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
UPDATE public.system_alerts SET user_id = (SELECT id FROM auth.users WHERE email = 'muhammadokasha216@gmail.com' LIMIT 1) WHERE user_id IS NULL;

-- market_snapshots
ALTER TABLE public.market_snapshots ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
UPDATE public.market_snapshots SET user_id = (SELECT id FROM auth.users WHERE email = 'muhammadokasha216@gmail.com' LIMIT 1) WHERE user_id IS NULL;

-- app_settings (user-specific keys)
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
UPDATE public.app_settings SET user_id = (SELECT id FROM auth.users WHERE email = 'muhammadokasha216@gmail.com' LIMIT 1) WHERE user_id IS NULL;

-- sim_trades
ALTER TABLE public.sim_trades ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
UPDATE public.sim_trades SET user_id = (SELECT id FROM auth.users WHERE email = 'muhammadokasha216@gmail.com' LIMIT 1) WHERE user_id IS NULL;

-- amazon_monitors
ALTER TABLE public.amazon_monitors ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
UPDATE public.amazon_monitors SET user_id = (SELECT id FROM auth.users WHERE email = 'muhammadokasha216@gmail.com' LIMIT 1) WHERE user_id IS NULL;

-- sessions
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
UPDATE public.sessions SET user_id = (SELECT id FROM auth.users WHERE email = 'muhammadokasha216@gmail.com' LIMIT 1) WHERE user_id IS NULL;

-- devices
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
UPDATE public.devices SET user_id = (SELECT id FROM auth.users WHERE email = 'muhammadokasha216@gmail.com' LIMIT 1) WHERE user_id IS NULL;

-- command_history
ALTER TABLE public.command_history ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
UPDATE public.command_history SET user_id = (SELECT id FROM auth.users WHERE email = 'muhammadokasha216@gmail.com' LIMIT 1) WHERE user_id IS NULL;

-- trading_hooks
ALTER TABLE public.trading_hooks ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
UPDATE public.trading_hooks SET user_id = (SELECT id FROM auth.users WHERE email = 'muhammadokasha216@gmail.com' LIMIT 1) WHERE user_id IS NULL;

-- webhook_logs
ALTER TABLE public.webhook_logs ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
UPDATE public.webhook_logs SET user_id = (SELECT id FROM auth.users WHERE email = 'muhammadokasha216@gmail.com' LIMIT 1) WHERE user_id IS NULL;

-- ─────────────────────────────────────────────────────────
-- 5. REPLACE ALL RLS POLICIES WITH MULTI-TENANT POLICIES
-- ─────────────────────────────────────────────────────────

-- Helper: is current user active?
CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
      AND account_status = 'active'
  );
$$;

-- Helper: is current user admin?
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin')
      AND account_status = 'active'
  );
$$;

-- ──── Reusable policy generator pattern ────
-- For each table, we create:
-- 1. SELECT: active users see own data; admins see all
-- 2. INSERT: active users insert with own user_id
-- 3. UPDATE: active users update own data; admins update all
-- 4. DELETE: active users delete own data; admins delete all

-- ──── agent_nodes ────
DROP POLICY IF EXISTS "Devices: valid session can select" ON public.agent_nodes;
DROP POLICY IF EXISTS "Devices: valid session can insert" ON public.agent_nodes;
DROP POLICY IF EXISTS "Devices: valid session can update" ON public.agent_nodes;
DROP POLICY IF EXISTS "Devices: valid session can delete" ON public.agent_nodes;
DROP POLICY IF EXISTS "Devices: authenticated session can select" ON public.agent_nodes;
DROP POLICY IF EXISTS "Devices: authenticated session can insert" ON public.agent_nodes;
DROP POLICY IF EXISTS "Devices: authenticated session can update" ON public.agent_nodes;
DROP POLICY IF EXISTS "Devices: authenticated session can delete" ON public.agent_nodes;

CREATE POLICY "agent_nodes: user select own" ON public.agent_nodes FOR SELECT
  TO authenticated USING (user_id = auth.uid() AND public.is_active_user());
CREATE POLICY "agent_nodes: admin select all" ON public.agent_nodes FOR SELECT
  TO authenticated USING (public.is_admin_user());
CREATE POLICY "agent_nodes: user insert own" ON public.agent_nodes FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_active_user());
CREATE POLICY "agent_nodes: user update own" ON public.agent_nodes FOR UPDATE
  TO authenticated USING (user_id = auth.uid() AND public.is_active_user())
  WITH CHECK (user_id = auth.uid() AND public.is_active_user());
CREATE POLICY "agent_nodes: admin update all" ON public.agent_nodes FOR UPDATE
  TO authenticated USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());
CREATE POLICY "agent_nodes: user delete own" ON public.agent_nodes FOR DELETE
  TO authenticated USING (user_id = auth.uid() AND public.is_active_user());
CREATE POLICY "agent_nodes: admin delete all" ON public.agent_nodes FOR DELETE
  TO authenticated USING (public.is_admin_user());

-- ──── trading_bots ────
DROP POLICY IF EXISTS "trading_bots_select" ON public.trading_bots;
DROP POLICY IF EXISTS "trading_bots_insert" ON public.trading_bots;
DROP POLICY IF EXISTS "trading_bots_update" ON public.trading_bots;
DROP POLICY IF EXISTS "trading_bots_delete" ON public.trading_bots;

CREATE POLICY "trading_bots: user select own" ON public.trading_bots FOR SELECT
  TO authenticated USING (user_id = auth.uid() AND public.is_active_user());
CREATE POLICY "trading_bots: admin select all" ON public.trading_bots FOR SELECT
  TO authenticated USING (public.is_admin_user());
CREATE POLICY "trading_bots: user insert own" ON public.trading_bots FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_active_user());
CREATE POLICY "trading_bots: user update own" ON public.trading_bots FOR UPDATE
  TO authenticated USING (user_id = auth.uid() AND public.is_active_user())
  WITH CHECK (user_id = auth.uid() AND public.is_active_user());
CREATE POLICY "trading_bots: admin update all" ON public.trading_bots FOR UPDATE
  TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "trading_bots: user delete own" ON public.trading_bots FOR DELETE
  TO authenticated USING (user_id = auth.uid() AND public.is_active_user());
CREATE POLICY "trading_bots: admin delete all" ON public.trading_bots FOR DELETE
  TO authenticated USING (public.is_admin_user());

-- ──── trade_executions ────
DROP POLICY IF EXISTS "trade_executions_select" ON public.trade_executions;
DROP POLICY IF EXISTS "trade_executions_insert" ON public.trade_executions;
DROP POLICY IF EXISTS "trade_executions_update" ON public.trade_executions;
DROP POLICY IF EXISTS "trade_executions_delete" ON public.trade_executions;

CREATE POLICY "trade_executions: user select own" ON public.trade_executions FOR SELECT
  TO authenticated USING (user_id = auth.uid() AND public.is_active_user());
CREATE POLICY "trade_executions: admin select all" ON public.trade_executions FOR SELECT
  TO authenticated USING (public.is_admin_user());
CREATE POLICY "trade_executions: user insert own" ON public.trade_executions FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_active_user());
CREATE POLICY "trade_executions: user update own" ON public.trade_executions FOR UPDATE
  TO authenticated USING (user_id = auth.uid() AND public.is_active_user())
  WITH CHECK (user_id = auth.uid() AND public.is_active_user());
CREATE POLICY "trade_executions: user delete own" ON public.trade_executions FOR DELETE
  TO authenticated USING (user_id = auth.uid() AND public.is_active_user());
CREATE POLICY "trade_executions: admin delete all" ON public.trade_executions FOR DELETE
  TO authenticated USING (public.is_admin_user());

-- ──── telegram_messages ────
DROP POLICY IF EXISTS "telegram_messages_select" ON public.telegram_messages;
DROP POLICY IF EXISTS "telegram_messages_insert" ON public.telegram_messages;
DROP POLICY IF EXISTS "telegram_messages_update" ON public.telegram_messages;
DROP POLICY IF EXISTS "telegram_messages_delete" ON public.telegram_messages;

CREATE POLICY "telegram_messages: user select own" ON public.telegram_messages FOR SELECT
  TO authenticated USING (user_id = auth.uid() AND public.is_active_user());
CREATE POLICY "telegram_messages: admin select all" ON public.telegram_messages FOR SELECT
  TO authenticated USING (public.is_admin_user());
CREATE POLICY "telegram_messages: user insert own" ON public.telegram_messages FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_active_user());
CREATE POLICY "telegram_messages: user update own" ON public.telegram_messages FOR UPDATE
  TO authenticated USING (user_id = auth.uid() AND public.is_active_user())
  WITH CHECK (user_id = auth.uid() AND public.is_active_user());
CREATE POLICY "telegram_messages: user delete own" ON public.telegram_messages FOR DELETE
  TO authenticated USING (user_id = auth.uid() AND public.is_active_user());
CREATE POLICY "telegram_messages: admin delete all" ON public.telegram_messages FOR DELETE
  TO authenticated USING (public.is_admin_user());

-- ──── heartbeat_log ────
DROP POLICY IF EXISTS "heartbeat_log_select" ON public.heartbeat_log;
DROP POLICY IF EXISTS "heartbeat_log_insert" ON public.heartbeat_log;
DROP POLICY IF EXISTS "heartbeat_log_update" ON public.heartbeat_log;
DROP POLICY IF EXISTS "heartbeat_log_delete" ON public.heartbeat_log;

CREATE POLICY "heartbeat_log: user select own" ON public.heartbeat_log FOR SELECT
  TO authenticated USING (user_id = auth.uid() AND public.is_active_user());
CREATE POLICY "heartbeat_log: admin select all" ON public.heartbeat_log FOR SELECT
  TO authenticated USING (public.is_admin_user());
CREATE POLICY "heartbeat_log: user insert own" ON public.heartbeat_log FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_active_user());
CREATE POLICY "heartbeat_log: user delete own" ON public.heartbeat_log FOR DELETE
  TO authenticated USING (user_id = auth.uid() AND public.is_active_user());
CREATE POLICY "heartbeat_log: admin delete all" ON public.heartbeat_log FOR DELETE
  TO authenticated USING (public.is_admin_user());

-- ──── system_alerts ────
DROP POLICY IF EXISTS "system_alerts_select" ON public.system_alerts;
DROP POLICY IF EXISTS "system_alerts_insert" ON public.system_alerts;
DROP POLICY IF EXISTS "system_alerts_update" ON public.system_alerts;
DROP POLICY IF EXISTS "system_alerts_delete" ON public.system_alerts;

CREATE POLICY "system_alerts: user select own" ON public.system_alerts FOR SELECT
  TO authenticated USING (user_id = auth.uid() AND public.is_active_user());
CREATE POLICY "system_alerts: admin select all" ON public.system_alerts FOR SELECT
  TO authenticated USING (public.is_admin_user());
CREATE POLICY "system_alerts: user insert own" ON public.system_alerts FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_active_user());
CREATE POLICY "system_alerts: admin insert all" ON public.system_alerts FOR INSERT
  TO authenticated WITH CHECK (public.is_admin_user());
CREATE POLICY "system_alerts: user update own" ON public.system_alerts FOR UPDATE
  TO authenticated USING (user_id = auth.uid() AND public.is_active_user())
  WITH CHECK (user_id = auth.uid() AND public.is_active_user());
CREATE POLICY "system_alerts: admin update all" ON public.system_alerts FOR UPDATE
  TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- ──── market_snapshots ────
DROP POLICY IF EXISTS "market_snapshots_select" ON public.market_snapshots;
DROP POLICY IF EXISTS "market_snapshots_insert" ON public.market_snapshots;
DROP POLICY IF EXISTS "market_snapshots_update" ON public.market_snapshots;
DROP POLICY IF EXISTS "market_snapshots_delete" ON public.market_snapshots;

CREATE POLICY "market_snapshots: user select own" ON public.market_snapshots FOR SELECT
  TO authenticated USING (user_id = auth.uid() AND public.is_active_user());
CREATE POLICY "market_snapshots: admin select all" ON public.market_snapshots FOR SELECT
  TO authenticated USING (public.is_admin_user());
CREATE POLICY "market_snapshots: user insert own" ON public.market_snapshots FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_active_user());
CREATE POLICY "market_snapshots: user delete own" ON public.market_snapshots FOR DELETE
  TO authenticated USING (user_id = auth.uid() AND public.is_active_user());

-- ──── app_settings ────
DROP POLICY IF EXISTS "Settings: valid session select" ON public.app_settings;
DROP POLICY IF EXISTS "Settings: valid session insert" ON public.app_settings;
DROP POLICY IF EXISTS "Settings: valid session update" ON public.app_settings;
DROP POLICY IF EXISTS "Settings: valid session delete" ON public.app_settings;

CREATE POLICY "app_settings: user select own" ON public.app_settings FOR SELECT
  TO authenticated USING (user_id = auth.uid() AND public.is_active_user());
CREATE POLICY "app_settings: admin select all" ON public.app_settings FOR SELECT
  TO authenticated USING (public.is_admin_user());
CREATE POLICY "app_settings: user insert own" ON public.app_settings FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_active_user());
CREATE POLICY "app_settings: user update own" ON public.app_settings FOR UPDATE
  TO authenticated USING (user_id = auth.uid() AND public.is_active_user())
  WITH CHECK (user_id = auth.uid() AND public.is_active_user());
CREATE POLICY "app_settings: user delete own" ON public.app_settings FOR DELETE
  TO authenticated USING (user_id = auth.uid() AND public.is_active_user());
CREATE POLICY "app_settings: admin update all" ON public.app_settings FOR UPDATE
  TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- ──── sim_trades ────
DROP POLICY IF EXISTS "SimTrades: valid session select" ON public.sim_trades;
DROP POLICY IF EXISTS "SimTrades: valid session insert" ON public.sim_trades;
DROP POLICY IF EXISTS "SimTrades: valid session update" ON public.sim_trades;
DROP POLICY IF EXISTS "SimTrades: valid session delete" ON public.sim_trades;

CREATE POLICY "sim_trades: user select own" ON public.sim_trades FOR SELECT
  TO authenticated USING (user_id = auth.uid() AND public.is_active_user());
CREATE POLICY "sim_trades: admin select all" ON public.sim_trades FOR SELECT
  TO authenticated USING (public.is_admin_user());
CREATE POLICY "sim_trades: user insert own" ON public.sim_trades FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_active_user());
CREATE POLICY "sim_trades: user update own" ON public.sim_trades FOR UPDATE
  TO authenticated USING (user_id = auth.uid() AND public.is_active_user())
  WITH CHECK (user_id = auth.uid() AND public.is_active_user());
CREATE POLICY "sim_trades: user delete own" ON public.sim_trades FOR DELETE
  TO authenticated USING (user_id = auth.uid() AND public.is_active_user());

-- ──── amazon_monitors ────
DROP POLICY IF EXISTS "Amazon: valid session select" ON public.amazon_monitors;
DROP POLICY IF EXISTS "Amazon: valid session insert" ON public.amazon_monitors;
DROP POLICY IF EXISTS "Amazon: valid session update" ON public.amazon_monitors;
DROP POLICY IF EXISTS "Amazon: valid session delete" ON public.amazon_monitors;

CREATE POLICY "amazon_monitors: user select own" ON public.amazon_monitors FOR SELECT
  TO authenticated USING (user_id = auth.uid() AND public.is_active_user());
CREATE POLICY "amazon_monitors: admin select all" ON public.amazon_monitors FOR SELECT
  TO authenticated USING (public.is_admin_user());
CREATE POLICY "amazon_monitors: user insert own" ON public.amazon_monitors FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_active_user());
CREATE POLICY "amazon_monitors: user update own" ON public.amazon_monitors FOR UPDATE
  TO authenticated USING (user_id = auth.uid() AND public.is_active_user())
  WITH CHECK (user_id = auth.uid() AND public.is_active_user());
CREATE POLICY "amazon_monitors: user delete own" ON public.amazon_monitors FOR DELETE
  TO authenticated USING (user_id = auth.uid() AND public.is_active_user());

-- ──── sessions ────
DROP POLICY IF EXISTS "Allow public read sessions" ON public.sessions;
DROP POLICY IF EXISTS "Sessions: insert own token" ON public.sessions;
DROP POLICY IF EXISTS "Sessions: update own token" ON public.sessions;

CREATE POLICY "sessions: user select own" ON public.sessions FOR SELECT
  TO authenticated USING (user_id = auth.uid());
CREATE POLICY "sessions: user insert own" ON public.sessions FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "sessions: user update own" ON public.sessions FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ──── devices ────
DROP POLICY IF EXISTS "Devices: valid session can select" ON public.devices;
DROP POLICY IF EXISTS "Devices: valid session can insert" ON public.devices;
DROP POLICY IF EXISTS "Devices: valid session can update" ON public.devices;
DROP POLICY IF EXISTS "Devices: valid session can delete" ON public.devices;

CREATE POLICY "devices: user select own" ON public.devices FOR SELECT
  TO authenticated USING (user_id = auth.uid() AND public.is_active_user());
CREATE POLICY "devices: admin select all" ON public.devices FOR SELECT
  TO authenticated USING (public.is_admin_user());
CREATE POLICY "devices: user insert own" ON public.devices FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_active_user());
CREATE POLICY "devices: user update own" ON public.devices FOR UPDATE
  TO authenticated USING (user_id = auth.uid() AND public.is_active_user())
  WITH CHECK (user_id = auth.uid() AND public.is_active_user());
CREATE POLICY "devices: user delete own" ON public.devices FOR DELETE
  TO authenticated USING (user_id = auth.uid() AND public.is_active_user());

-- ──── command_history ────
DROP POLICY IF EXISTS "Commands: valid session can select" ON public.command_history;
DROP POLICY IF EXISTS "Commands: valid session can insert" ON public.command_history;
DROP POLICY IF EXISTS "Commands: valid session can update" ON public.command_history;

CREATE POLICY "command_history: user select own" ON public.command_history FOR SELECT
  TO authenticated USING (user_id = auth.uid() AND public.is_active_user());
CREATE POLICY "command_history: admin select all" ON public.command_history FOR SELECT
  TO authenticated USING (public.is_admin_user());
CREATE POLICY "command_history: user insert own" ON public.command_history FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_active_user());
CREATE POLICY "command_history: user update own" ON public.command_history FOR UPDATE
  TO authenticated USING (user_id = auth.uid() AND public.is_active_user())
  WITH CHECK (user_id = auth.uid() AND public.is_active_user());

-- ──── trading_hooks ────
DROP POLICY IF EXISTS "Hooks: valid session can select" ON public.trading_hooks;
DROP POLICY IF EXISTS "Hooks: valid session can insert" ON public.trading_hooks;
DROP POLICY IF EXISTS "Hooks: valid session can update" ON public.trading_hooks;
DROP POLICY IF EXISTS "Hooks: valid session can delete" ON public.trading_hooks;

CREATE POLICY "trading_hooks: user select own" ON public.trading_hooks FOR SELECT
  TO authenticated USING (user_id = auth.uid() AND public.is_active_user());
CREATE POLICY "trading_hooks: admin select all" ON public.trading_hooks FOR SELECT
  TO authenticated USING (public.is_admin_user());
CREATE POLICY "trading_hooks: user insert own" ON public.trading_hooks FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_active_user());
CREATE POLICY "trading_hooks: user update own" ON public.trading_hooks FOR UPDATE
  TO authenticated USING (user_id = auth.uid() AND public.is_active_user())
  WITH CHECK (user_id = auth.uid() AND public.is_active_user());
CREATE POLICY "trading_hooks: user delete own" ON public.trading_hooks FOR DELETE
  TO authenticated USING (user_id = auth.uid() AND public.is_active_user());

-- ──── webhook_logs ────
DROP POLICY IF EXISTS "Logs: valid session can select" ON public.webhook_logs;
DROP POLICY IF EXISTS "Logs: valid session can insert" ON public.webhook_logs;

CREATE POLICY "webhook_logs: user select own" ON public.webhook_logs FOR SELECT
  TO authenticated USING (user_id = auth.uid() AND public.is_active_user());
CREATE POLICY "webhook_logs: admin select all" ON public.webhook_logs FOR SELECT
  TO authenticated USING (public.is_admin_user());
CREATE POLICY "webhook_logs: user insert own" ON public.webhook_logs FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_active_user());

-- ─────────────────────────────────────────────────────────
-- 6. SEED DEFAULT SETTINGS FOR EACH USER ON APPROVAL
-- ─────────────────────────────────────────────────────────
-- When a user is activated, they need default settings rows.
CREATE OR REPLACE FUNCTION public.seed_user_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  -- Only seed when account_status changes to 'active'
  IF NEW.account_status = 'active' AND (OLD.account_status IS NULL OR OLD.account_status != 'active') THEN
    INSERT INTO public.app_settings (key, value, label, category, is_secret, user_id)
    VALUES
      ('telegram_bot_token',  '', 'Telegram Bot Token',   'telegram', true,  NEW.user_id),
      ('telegram_chat_id',    '', 'Telegram Chat ID',     'telegram', false, NEW.user_id),
      ('binance_api_key',     '', 'Binance API Key',      'binance',  true,  NEW.user_id),
      ('binance_secret',      '', 'Binance Secret',       'binance',  true,  NEW.user_id),
      ('supabase_url',        '', 'Supabase Project URL', 'supabase', false, NEW.user_id),
      ('supabase_anon_key',   '', 'Supabase Anon Key',    'supabase', true,  NEW.user_id),
      ('heartbeat_interval',  '30', 'Heartbeat Interval (s)', 'general', false, NEW.user_id),
      ('dashboard_refresh',   '5',  'Dashboard Refresh (s)',  'general', false, NEW.user_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_status_change ON public.profiles;
CREATE TRIGGER on_profile_status_change
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.seed_user_settings();

-- ─────────────────────────────────────────────────────────
-- 7. Disable email confirmation (for SaaS flow)
-- ─────────────────────────────────────────────────────────
-- This is done via Supabase Dashboard → Auth → Settings
-- or via the auth config API. We note it here for documentation.
