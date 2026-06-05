/*
  # Ares AI Agent Infrastructure

  Tables for: AI conversation memory, intruder tracking, approval gates,
  agent orchestration (10 Arms), and cron job state.
*/

-- ─────────────────────────────────────────────────────────
-- 1. AI CONVERSATION MEMORY
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('user','assistant','system')),
  content     text NOT NULL,
  metadata    jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_conversations: user select own" ON public.ai_conversations FOR SELECT
  TO authenticated USING (user_id = auth.uid() AND public.is_active_user());
CREATE POLICY "ai_conversations: admin select all" ON public.ai_conversations FOR SELECT
  TO authenticated USING (public.is_admin_user());
CREATE POLICY "ai_conversations: user insert own" ON public.ai_conversations FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_active_user());
CREATE POLICY "ai_conversations: user delete own" ON public.ai_conversations FOR DELETE
  TO authenticated USING (user_id = auth.uid() AND public.is_active_user());

-- ─────────────────────────────────────────────────────────
-- 2. INTRUDER TRACKING (failed login attempts)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL,
  ip_address  text,
  success     boolean NOT NULL DEFAULT false,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Only admins can see login attempts
CREATE POLICY "login_attempts: admin select" ON public.login_attempts FOR SELECT
  TO authenticated USING (public.is_admin_user());
CREATE POLICY "login_attempts: admin insert" ON public.login_attempts FOR INSERT
  TO authenticated WITH CHECK (public.is_admin_user());

-- ─────────────────────────────────────────────────────────
-- 3. BLACKLISTED IPs/EMAILS
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.blacklist (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type        text NOT NULL CHECK (type IN ('email','ip')),
  value       text NOT NULL UNIQUE,
  reason      text,
  blocked_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.blacklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blacklist: admin all" ON public.blacklist FOR ALL
  TO authenticated USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- ─────────────────────────────────────────────────────────
-- 4. APPROVAL GATES (sensitive action confirmations)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.approval_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (action_type IN (
    'delete_file','move_funds','public_post','security_change',
    'pause_trading','change_settings','other'
  )),
  description text NOT NULL,
  metadata    jsonb NOT NULL DEFAULT '{}',
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired')),
  responded_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "approval_requests: user select own" ON public.approval_requests FOR SELECT
  TO authenticated USING (user_id = auth.uid());
CREATE POLICY "approval_requests: admin select all" ON public.approval_requests FOR SELECT
  TO authenticated USING (public.is_admin_user());
CREATE POLICY "approval_requests: user insert own" ON public.approval_requests FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "approval_requests: admin update" ON public.approval_requests FOR UPDATE
  TO authenticated USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- ─────────────────────────────────────────────────────────
-- 5. AGENT ARMS (10-arm orchestration state)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_arms (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  arm_number  int NOT NULL CHECK (arm_number BETWEEN 1 AND 10),
  name        text NOT NULL,
  category    text NOT NULL CHECK (category IN ('trading','security','content','messaging','system')),
  description text NOT NULL DEFAULT '',
  is_active   boolean NOT NULL DEFAULT false,
  status      text NOT NULL DEFAULT 'idle' CHECK (status IN ('idle','running','paused','error')),
  config      jsonb NOT NULL DEFAULT '{}',
  last_run    timestamptz,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, arm_number)
);

ALTER TABLE public.agent_arms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_arms: user select own" ON public.agent_arms FOR SELECT
  TO authenticated USING (user_id = auth.uid() AND public.is_active_user());
CREATE POLICY "agent_arms: admin select all" ON public.agent_arms FOR SELECT
  TO authenticated USING (public.is_admin_user());
CREATE POLICY "agent_arms: user insert own" ON public.agent_arms FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_active_user());
CREATE POLICY "agent_arms: user update own" ON public.agent_arms FOR UPDATE
  TO authenticated USING (user_id = auth.uid() AND public.is_active_user())
  WITH CHECK (user_id = auth.uid() AND public.is_active_user());

-- ─────────────────────────────────────────────────────────
-- 6. RISK EVENTS (AI Risk Manager log)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.risk_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  severity    text NOT NULL CHECK (severity IN ('info','warning','critical')),
  category    text NOT NULL CHECK (category IN ('market','position','balance','api','unauthorized')),
  title       text NOT NULL,
  description text NOT NULL,
  is_resolved boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.risk_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "risk_events: user select own" ON public.risk_events FOR SELECT
  TO authenticated USING (user_id = auth.uid() AND public.is_active_user());
CREATE POLICY "risk_events: admin select all" ON public.risk_events FOR SELECT
  TO authenticated USING (public.is_admin_user());
CREATE POLICY "risk_events: user insert own" ON public.risk_events FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_active_user());
CREATE POLICY "risk_events: user update own" ON public.risk_events FOR UPDATE
  TO authenticated USING (user_id = auth.uid() AND public.is_active_user())
  WITH CHECK (user_id = auth.uid() AND public.is_active_user());

-- ─────────────────────────────────────────────────────────
-- 7. SEED DEFAULT 10 ARMS FOR EXISTING ADMIN
-- ─────────────────────────────────────────────────────────
INSERT INTO public.agent_arms (user_id, arm_number, name, category, description, is_active, status)
SELECT id, arm_number, name, category, description, is_active, status
FROM (
  SELECT u.id,
    1  as arm_number, 'Binance Trader Alpha'  as name, 'trading'   as category, 'Executes primary trading strategy on Binance' as description, false as is_active, 'idle' as status FROM auth.users u WHERE u.email = 'muhammadokasha216@gmail.com'
  UNION ALL SELECT u.id, 2,  'Binance Trader Beta',   'trading',   'Executes secondary/hedge trading strategy', false, 'idle' FROM auth.users u WHERE u.email = 'muhammadokasha216@gmail.com'
  UNION ALL SELECT u.id, 3,  'Front Door Guardian',   'security',  'Monitors sign-ups and login attempts', false, 'idle' FROM auth.users u WHERE u.email = 'muhammadokasha216@gmail.com'
  UNION ALL SELECT u.id, 4,  'Intruder Detector',      'security',  'Detects brute-force attacks and auto-locks', false, 'idle' FROM auth.users u WHERE u.email = 'muhammadokasha216@gmail.com'
  UNION ALL SELECT u.id, 5,  'Video Splitter',         'content',   'Splits long videos into short-form clips', false, 'idle' FROM auth.users u WHERE u.email = 'muhammadokasha216@gmail.com'
  UNION ALL SELECT u.id, 6,  'Cinematic Editor',       'content',   'Adds captions and cinematic effects to clips', false, 'idle' FROM auth.users u WHERE u.email = 'muhammadokasha216@gmail.com'
  UNION ALL SELECT u.id, 7,  'PC Organizer',            'system',    'Organizes files, screenshots, and projects', false, 'idle' FROM auth.users u WHERE u.email = 'muhammadokasha216@gmail.com'
  UNION ALL SELECT u.id, 8,  'File Cleaner',            'system',    'Cleans temp files and optimizes directories', false, 'idle' FROM auth.users u WHERE u.email = 'muhammadokasha216@gmail.com'
  UNION ALL SELECT u.id, 9,  'Message Filter',         'messaging', 'Filters incoming messages and auto-replies', false, 'idle' FROM auth.users u WHERE u.email = 'muhammadokasha216@gmail.com'
  UNION ALL SELECT u.id, 10, 'Social Auto-Poster',     'messaging', 'Posts content to social media at peak times', false, 'idle' FROM auth.users u WHERE u.email = 'muhammadokasha216@gmail.com'
) arms
ON CONFLICT (user_id, arm_number) DO NOTHING;
