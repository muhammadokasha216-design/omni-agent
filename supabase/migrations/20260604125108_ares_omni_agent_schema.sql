/*
  # Ares Omni-Agent Dashboard — Database Schema

  ## New Tables

  ### agent_nodes
  Represents remote machines/nodes managed by Ares.
  - id, name, type (pc|mobile|server|trading), endpoint_url, api_key
  - is_online, last_heartbeat, heartbeat_interval_sec
  - meta JSONB (arbitrary metadata)

  ### heartbeat_log
  Time-series log of heartbeat events per node.
  - node_id (FK → agent_nodes), status (online|offline|degraded)
  - latency_ms, recorded_at

  ### telegram_messages
  Log of all messages sent/received via Telegram bot.
  - direction (inbound|outbound), chat_id, message_text
  - command (parsed command name), status, processed_at

  ### trading_bots
  Automated trading bot configurations.
  - name, exchange (binance|bybit|etc), symbol, strategy
  - is_active, last_run, pnl_usd, config JSONB

  ### trade_executions
  Individual trade records from bots.
  - bot_id (FK → trading_bots), side (buy|sell), symbol
  - quantity, price, status, pnl_usd, executed_at

  ### market_snapshots
  Point-in-time market data snapshots for charting.
  - symbol, price, volume_24h, change_24h_pct
  - bid, ask, recorded_at

  ### system_alerts
  Security and system alerts for the operator.
  - severity (info|warning|critical), source, title, body
  - is_read, triggered_at

  ## Security
  - RLS enabled on all tables
  - All access gated by has_valid_session() helper
*/

-- ─────────────────────────────────────────
-- agent_nodes
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_nodes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text NOT NULL,
  type                  text NOT NULL DEFAULT 'pc'
                          CHECK (type IN ('pc','mobile','server','trading')),
  endpoint_url          text NOT NULL DEFAULT '',
  api_key               text NOT NULL DEFAULT '',
  is_online             boolean NOT NULL DEFAULT false,
  last_heartbeat        timestamptz,
  heartbeat_interval_sec int NOT NULL DEFAULT 30,
  meta                  jsonb NOT NULL DEFAULT '{}',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE agent_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Nodes: valid session select"  ON agent_nodes FOR SELECT  TO anon, authenticated USING (has_valid_session());
CREATE POLICY "Nodes: valid session insert"  ON agent_nodes FOR INSERT  TO anon, authenticated WITH CHECK (has_valid_session());
CREATE POLICY "Nodes: valid session update"  ON agent_nodes FOR UPDATE  TO anon, authenticated USING (has_valid_session()) WITH CHECK (has_valid_session());
CREATE POLICY "Nodes: valid session delete"  ON agent_nodes FOR DELETE  TO anon, authenticated USING (has_valid_session());

-- ─────────────────────────────────────────
-- heartbeat_log
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS heartbeat_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id       uuid REFERENCES agent_nodes(id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'online'
                  CHECK (status IN ('online','offline','degraded')),
  latency_ms    int NOT NULL DEFAULT 0,
  recorded_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE heartbeat_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Heartbeat: valid session select" ON heartbeat_log FOR SELECT TO anon, authenticated USING (has_valid_session());
CREATE POLICY "Heartbeat: valid session insert" ON heartbeat_log FOR INSERT TO anon, authenticated WITH CHECK (has_valid_session());

CREATE INDEX IF NOT EXISTS heartbeat_log_node_id_idx ON heartbeat_log (node_id, recorded_at DESC);

-- ─────────────────────────────────────────
-- telegram_messages
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS telegram_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direction     text NOT NULL DEFAULT 'inbound'
                  CHECK (direction IN ('inbound','outbound')),
  chat_id       text NOT NULL DEFAULT '',
  message_text  text NOT NULL DEFAULT '',
  command       text,
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','processed','failed')),
  processed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE telegram_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Telegram: valid session select" ON telegram_messages FOR SELECT TO anon, authenticated USING (has_valid_session());
CREATE POLICY "Telegram: valid session insert" ON telegram_messages FOR INSERT TO anon, authenticated WITH CHECK (has_valid_session());
CREATE POLICY "Telegram: valid session update" ON telegram_messages FOR UPDATE TO anon, authenticated USING (has_valid_session()) WITH CHECK (has_valid_session());

-- ─────────────────────────────────────────
-- trading_bots
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trading_bots (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  exchange      text NOT NULL DEFAULT 'binance',
  symbol        text NOT NULL DEFAULT 'BTC/USDT',
  strategy      text NOT NULL DEFAULT 'manual',
  is_active     boolean NOT NULL DEFAULT false,
  last_run      timestamptz,
  pnl_usd       numeric(18,6) NOT NULL DEFAULT 0,
  config        jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE trading_bots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bots: valid session select" ON trading_bots FOR SELECT TO anon, authenticated USING (has_valid_session());
CREATE POLICY "Bots: valid session insert" ON trading_bots FOR INSERT TO anon, authenticated WITH CHECK (has_valid_session());
CREATE POLICY "Bots: valid session update" ON trading_bots FOR UPDATE TO anon, authenticated USING (has_valid_session()) WITH CHECK (has_valid_session());
CREATE POLICY "Bots: valid session delete" ON trading_bots FOR DELETE TO anon, authenticated USING (has_valid_session());

-- ─────────────────────────────────────────
-- trade_executions
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trade_executions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id        uuid REFERENCES trading_bots(id) ON DELETE SET NULL,
  side          text NOT NULL CHECK (side IN ('buy','sell')),
  symbol        text NOT NULL,
  quantity      numeric(18,8) NOT NULL DEFAULT 0,
  price         numeric(18,6) NOT NULL DEFAULT 0,
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','filled','cancelled','error')),
  pnl_usd       numeric(18,6),
  exchange_order_id text,
  executed_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE trade_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trades: valid session select" ON trade_executions FOR SELECT TO anon, authenticated USING (has_valid_session());
CREATE POLICY "Trades: valid session insert" ON trade_executions FOR INSERT TO anon, authenticated WITH CHECK (has_valid_session());
CREATE POLICY "Trades: valid session update" ON trade_executions FOR UPDATE TO anon, authenticated USING (has_valid_session()) WITH CHECK (has_valid_session());

CREATE INDEX IF NOT EXISTS trade_executions_bot_id_idx ON trade_executions (bot_id, executed_at DESC);

-- ─────────────────────────────────────────
-- market_snapshots
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS market_snapshots (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol        text NOT NULL,
  price         numeric(18,6) NOT NULL DEFAULT 0,
  volume_24h    numeric(24,2) NOT NULL DEFAULT 0,
  change_24h_pct numeric(8,4) NOT NULL DEFAULT 0,
  bid           numeric(18,6) NOT NULL DEFAULT 0,
  ask           numeric(18,6) NOT NULL DEFAULT 0,
  recorded_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE market_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Market: valid session select" ON market_snapshots FOR SELECT TO anon, authenticated USING (has_valid_session());
CREATE POLICY "Market: valid session insert" ON market_snapshots FOR INSERT TO anon, authenticated WITH CHECK (has_valid_session());

CREATE INDEX IF NOT EXISTS market_snapshots_symbol_idx ON market_snapshots (symbol, recorded_at DESC);

-- ─────────────────────────────────────────
-- system_alerts
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_alerts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  severity      text NOT NULL DEFAULT 'info'
                  CHECK (severity IN ('info','warning','critical')),
  source        text NOT NULL DEFAULT 'system',
  title         text NOT NULL DEFAULT '',
  body          text NOT NULL DEFAULT '',
  is_read       boolean NOT NULL DEFAULT false,
  triggered_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE system_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alerts: valid session select" ON system_alerts FOR SELECT TO anon, authenticated USING (has_valid_session());
CREATE POLICY "Alerts: valid session insert" ON system_alerts FOR INSERT TO anon, authenticated WITH CHECK (has_valid_session());
CREATE POLICY "Alerts: valid session update" ON system_alerts FOR UPDATE TO anon, authenticated USING (has_valid_session()) WITH CHECK (has_valid_session());

-- ─────────────────────────────────────────
-- Seed demo data
-- ─────────────────────────────────────────
INSERT INTO agent_nodes (name, type, endpoint_url, is_online, last_heartbeat, heartbeat_interval_sec, meta)
VALUES
  ('ARES-PRIMARY', 'pc', 'http://localhost:8000', false, now() - interval '90 seconds', 30, '{"os":"Windows 11","cpu":"i9-13900K","ram_gb":64}'),
  ('ARES-TRADING', 'trading', 'http://localhost:8001', false, now() - interval '5 minutes', 15, '{"exchange":"Binance","pairs":["BTC/USDT","ETH/USDT"]}'),
  ('ARES-MOBILE', 'mobile', '', false, null, 60, '{"platform":"Android","version":"14"}')
ON CONFLICT DO NOTHING;

INSERT INTO trading_bots (name, exchange, symbol, strategy, is_active, pnl_usd, config)
VALUES
  ('BTCUSDT-Scalper', 'binance', 'BTC/USDT', 'scalp', false, 247.83, '{"leverage":3,"stop_loss_pct":0.5,"take_profit_pct":1.2}'),
  ('ETHUSDT-Grid', 'binance', 'ETH/USDT', 'grid', false, -42.10, '{"grid_levels":10,"range_low":3200,"range_high":4000}'),
  ('BNB-DCA', 'binance', 'BNB/USDT', 'dca', false, 89.45, '{"interval_hours":6,"amount_usd":50}')
ON CONFLICT DO NOTHING;

INSERT INTO system_alerts (severity, source, title, body)
VALUES
  ('info',     'system',   'Dashboard Initialized',        'Ares Omni-Agent v3.0 loaded successfully.'),
  ('warning',  'heartbeat','Node Offline: ARES-PRIMARY',   'No heartbeat received from ARES-PRIMARY in the last 90 seconds.'),
  ('critical', 'security', 'Unauthorized Access Attempt',  'Blocked login attempt detected from IP 185.234.219.14 at 04:31 UTC.')
ON CONFLICT DO NOTHING;

INSERT INTO telegram_messages (direction, chat_id, message_text, command, status, processed_at)
VALUES
  ('inbound',  '100000001', '/status',          'status',   'processed', now() - interval '10 minutes'),
  ('outbound', '100000001', 'All systems nominal. 3 nodes registered, 0 online.', null, 'processed', now() - interval '10 minutes'),
  ('inbound',  '100000001', '/balance',         'balance',  'processed', now() - interval '5 minutes'),
  ('outbound', '100000001', 'BTC Balance: 0.042 BTC | USDT: 1,204.30 | PnL: +$247.83', null, 'processed', now() - interval '5 minutes')
ON CONFLICT DO NOTHING;
