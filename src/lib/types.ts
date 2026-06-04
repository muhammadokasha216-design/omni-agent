// All domain types for Ares Omni-Agent Dashboard

export type NodeType = 'pc' | 'mobile' | 'server' | 'trading';
export type NodeStatus = 'online' | 'offline' | 'degraded';
export type AlertSeverity = 'info' | 'warning' | 'critical';
export type TradeSide = 'buy' | 'sell';
export type TradeStatus = 'pending' | 'filled' | 'cancelled' | 'error';
export type BotStatus = 'active' | 'inactive';
export type TelegramDirection = 'inbound' | 'outbound';
export type MsgStatus = 'pending' | 'processed' | 'failed';

export interface AgentNode {
  id: string;
  name: string;
  type: NodeType;
  endpoint_url: string;
  api_key: string;
  is_online: boolean;
  last_heartbeat: string | null;
  heartbeat_interval_sec: number;
  meta: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface HeartbeatEntry {
  id: string;
  node_id: string;
  status: NodeStatus;
  latency_ms: number;
  recorded_at: string;
}

export interface TelegramMessage {
  id: string;
  direction: TelegramDirection;
  chat_id: string;
  message_text: string;
  command: string | null;
  status: MsgStatus;
  processed_at: string | null;
  created_at: string;
}

export interface TradingBot {
  id: string;
  name: string;
  exchange: string;
  symbol: string;
  strategy: string;
  is_active: boolean;
  last_run: string | null;
  pnl_usd: number;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TradeExecution {
  id: string;
  bot_id: string | null;
  side: TradeSide;
  symbol: string;
  quantity: number;
  price: number;
  status: TradeStatus;
  pnl_usd: number | null;
  exchange_order_id: string | null;
  executed_at: string;
}

export interface MarketSnapshot {
  id: string;
  symbol: string;
  price: number;
  volume_24h: number;
  change_24h_pct: number;
  bid: number;
  ask: number;
  recorded_at: string;
}

export interface SystemAlert {
  id: string;
  severity: AlertSeverity;
  source: string;
  title: string;
  body: string;
  is_read: boolean;
  triggered_at: string;
}

// Chart point for price/volume charts
export interface ChartPoint {
  t: string;
  price: number;
  volume: number;
}

// Ticker data for the live ticker strip
export interface TickerItem {
  symbol: string;
  price: number;
  change: number;
}
