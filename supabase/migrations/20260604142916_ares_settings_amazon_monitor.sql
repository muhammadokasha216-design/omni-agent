/*
  # Ares — Settings, Simulation & Amazon Monitor

  ## New Tables

  ### app_settings
  Stores user-configurable key-value pairs (API keys, tokens, etc).
  Replaces the need to edit .env files manually.
  - key (unique text), value (text, stored in DB — not for production secrets)
  - label (display name), category (telegram|binance|supabase|general)
  - is_secret (mask display), updated_at

  ### sim_trades
  Paper-trading simulation trades for the Trading Simulation tab.
  - symbol, side (buy|sell), quantity, entry_price, exit_price
  - status (open|closed), strategy, pnl_usd, opened_at, closed_at

  ### amazon_monitors
  Products being monitored for price drops/availability.
  - asin, title, url, image_url, target_price, current_price
  - availability (in_stock|out_of_stock|unknown), last_checked
  - price_history JSONB, is_active, alert_sent

  ## Security
  - RLS enabled, access via has_valid_session()
*/

-- ─── app_settings ─────────────────────────────────
CREATE TABLE IF NOT EXISTS app_settings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text UNIQUE NOT NULL,
  value       text NOT NULL DEFAULT '',
  label       text NOT NULL DEFAULT '',
  category    text NOT NULL DEFAULT 'general'
                CHECK (category IN ('telegram','binance','supabase','general')),
  is_secret   boolean NOT NULL DEFAULT false,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Settings: valid session select" ON app_settings FOR SELECT TO anon, authenticated USING (has_valid_session());
CREATE POLICY "Settings: valid session insert" ON app_settings FOR INSERT TO anon, authenticated WITH CHECK (has_valid_session());
CREATE POLICY "Settings: valid session update" ON app_settings FOR UPDATE TO anon, authenticated USING (has_valid_session()) WITH CHECK (has_valid_session());
CREATE POLICY "Settings: valid session delete" ON app_settings FOR DELETE TO anon, authenticated USING (has_valid_session());

-- Seed default setting keys (blank values — user fills them in)
INSERT INTO app_settings (key, label, category, is_secret) VALUES
  ('telegram_bot_token',  'Telegram Bot Token',   'telegram', true),
  ('telegram_chat_id',    'Telegram Chat ID',     'telegram', false),
  ('binance_api_key',     'Binance API Key',      'binance',  true),
  ('binance_secret',      'Binance Secret',       'binance',  true),
  ('supabase_url',        'Supabase Project URL', 'supabase', false),
  ('supabase_anon_key',   'Supabase Anon Key',    'supabase', true),
  ('heartbeat_interval',  'Heartbeat Interval (s)', 'general', false),
  ('dashboard_refresh',   'Dashboard Refresh (s)', 'general', false)
ON CONFLICT (key) DO NOTHING;

-- ─── sim_trades ────────────────────────────────────
CREATE TABLE IF NOT EXISTS sim_trades (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol      text NOT NULL DEFAULT 'BTC/USDT',
  side        text NOT NULL CHECK (side IN ('buy','sell')),
  quantity    numeric(18,8) NOT NULL DEFAULT 0,
  entry_price numeric(18,4) NOT NULL DEFAULT 0,
  exit_price  numeric(18,4),
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','cancelled')),
  strategy    text NOT NULL DEFAULT 'manual',
  pnl_usd     numeric(18,4),
  opened_at   timestamptz NOT NULL DEFAULT now(),
  closed_at   timestamptz
);

ALTER TABLE sim_trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SimTrades: valid session select" ON sim_trades FOR SELECT TO anon, authenticated USING (has_valid_session());
CREATE POLICY "SimTrades: valid session insert" ON sim_trades FOR INSERT TO anon, authenticated WITH CHECK (has_valid_session());
CREATE POLICY "SimTrades: valid session update" ON sim_trades FOR UPDATE TO anon, authenticated USING (has_valid_session()) WITH CHECK (has_valid_session());
CREATE POLICY "SimTrades: valid session delete" ON sim_trades FOR DELETE TO anon, authenticated USING (has_valid_session());

-- Seed demo simulation trades
INSERT INTO sim_trades (symbol, side, quantity, entry_price, exit_price, status, strategy, pnl_usd, opened_at, closed_at)
VALUES
  ('BTC/USDT', 'buy',  0.05, 65200.00, 67842.50, 'closed', 'scalp',    132.13, now() - interval '2 hours',  now() - interval '1 hour 40 minutes'),
  ('ETH/USDT', 'sell', 0.5,  3920.00,  3847.20,  'closed', 'swing',     36.40, now() - interval '5 hours',  now() - interval '3 hours'),
  ('BNB/USDT', 'buy',  2.0,  554.50,   567.80,   'closed', 'dca',       26.60, now() - interval '8 hours',  now() - interval '6 hours'),
  ('SOL/USDT', 'buy',  10.0, 168.20,   172.40,   'closed', 'breakout',  42.00, now() - interval '12 hours', now() - interval '10 hours'),
  ('BTC/USDT', 'sell', 0.02, 67900.00, null,      'open',   'scalp',    null,  now() - interval '20 minutes', null),
  ('ETH/USDT', 'buy',  0.8,  3810.00,  null,      'open',   'grid',     null,  now() - interval '45 minutes', null)
ON CONFLICT DO NOTHING;

-- ─── amazon_monitors ──────────────────────────────
CREATE TABLE IF NOT EXISTS amazon_monitors (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asin          text NOT NULL DEFAULT '',
  title         text NOT NULL DEFAULT '',
  url           text NOT NULL DEFAULT '',
  image_url     text NOT NULL DEFAULT '',
  target_price  numeric(10,2) NOT NULL DEFAULT 0,
  current_price numeric(10,2) NOT NULL DEFAULT 0,
  availability  text NOT NULL DEFAULT 'unknown'
                  CHECK (availability IN ('in_stock','out_of_stock','unknown')),
  last_checked  timestamptz NOT NULL DEFAULT now(),
  price_history jsonb NOT NULL DEFAULT '[]',
  is_active     boolean NOT NULL DEFAULT true,
  alert_sent    boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE amazon_monitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Amazon: valid session select" ON amazon_monitors FOR SELECT TO anon, authenticated USING (has_valid_session());
CREATE POLICY "Amazon: valid session insert" ON amazon_monitors FOR INSERT TO anon, authenticated WITH CHECK (has_valid_session());
CREATE POLICY "Amazon: valid session update" ON amazon_monitors FOR UPDATE TO anon, authenticated USING (has_valid_session()) WITH CHECK (has_valid_session());
CREATE POLICY "Amazon: valid session delete" ON amazon_monitors FOR DELETE TO anon, authenticated USING (has_valid_session());

-- Seed demo Amazon monitors
INSERT INTO amazon_monitors (asin, title, url, image_url, target_price, current_price, availability, last_checked, price_history, is_active, alert_sent)
VALUES
  (
    'B0CHX3QBCH',
    'NVIDIA GeForce RTX 4090 24GB GDDR6X Graphics Card',
    'https://www.amazon.com/dp/B0CHX3QBCH',
    'https://images.pexels.com/photos/2582937/pexels-photo-2582937.jpeg?auto=compress&cs=tinysrgb&w=100',
    1499.00, 1649.99, 'in_stock',
    now() - interval '5 minutes',
    '[{"date":"2026-06-01","price":1699.99},{"date":"2026-06-02","price":1679.00},{"date":"2026-06-03","price":1649.99}]',
    true, false
  ),
  (
    'B0CRMR9SL9',
    'Apple MacBook Pro 14" M3 Pro — Space Black',
    'https://www.amazon.com/dp/B0CRMR9SL9',
    'https://images.pexels.com/photos/303383/pexels-photo-303383.jpeg?auto=compress&cs=tinysrgb&w=100',
    1799.00, 1799.00, 'in_stock',
    now() - interval '3 minutes',
    '[{"date":"2026-06-01","price":1999.00},{"date":"2026-06-02","price":1899.00},{"date":"2026-06-03","price":1799.00}]',
    true, true
  ),
  (
    'B09V3KXJPB',
    'Sony WH-1000XM5 Wireless Noise Canceling Headphones',
    'https://www.amazon.com/dp/B09V3KXJPB',
    'https://images.pexels.com/photos/3587478/pexels-photo-3587478.jpeg?auto=compress&cs=tinysrgb&w=100',
    199.00, 279.99, 'out_of_stock',
    now() - interval '8 minutes',
    '[{"date":"2026-06-01","price":349.99},{"date":"2026-06-02","price":299.99},{"date":"2026-06-03","price":279.99}]',
    true, false
  ),
  (
    'B0B3DQ7LQ3',
    'Logitech MX Master 3S — Performance Wireless Mouse',
    'https://www.amazon.com/dp/B0B3DQ7LQ3',
    'https://images.pexels.com/photos/5082579/pexels-photo-5082579.jpeg?auto=compress&cs=tinysrgb&w=100',
    79.00, 89.99, 'in_stock',
    now() - interval '2 minutes',
    '[{"date":"2026-06-01","price":99.99},{"date":"2026-06-02","price":94.99},{"date":"2026-06-03","price":89.99}]',
    true, false
  )
ON CONFLICT DO NOTHING;
