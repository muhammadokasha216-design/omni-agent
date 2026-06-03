export type DeviceType = 'pc' | 'mobile' | 'trading';
export type CommandStatus = 'pending' | 'dispatched' | 'success' | 'error';
export type TradeAction = 'buy' | 'sell' | 'close' | 'alert';

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  endpoint_url: string;
  api_key: string;
  is_active: boolean;
  last_ping: string | null;
  meta: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CotStep {
  step: 'parse' | 'target' | 'generate' | 'dispatch' | 'verify';
  label: string;
  detail: string;
  status: 'pending' | 'running' | 'done' | 'error';
  timestamp: string;
}

export interface CommandRecord {
  id: string;
  raw_input: string;
  parsed_intent: string;
  target_device: string | null;
  payload: Record<string, unknown>;
  status: CommandStatus;
  response: string;
  latency_ms: number;
  cot_steps: CotStep[];
  created_at: string;
}

export interface TradingHook {
  id: string;
  label: string;
  exchange: string;
  symbol: string;
  action: TradeAction;
  quantity: string;
  api_endpoint: string;
  api_key: string;
  is_active: boolean;
  last_executed: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebhookLog {
  id: string;
  command_id: string | null;
  device_id: string | null;
  payload: Record<string, unknown>;
  http_status: number;
  response_body: string;
  latency_ms: number;
  created_at: string;
}

export interface TickerData {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
  volume: string;
  high: number;
  low: number;
}

export interface ProcessCommandRequest {
  input: string;
  devices: Device[];
  trading_hooks: TradingHook[];
}

export interface ProcessCommandResponse {
  intent: string;
  target: 'pc' | 'mobile' | 'trading' | 'system' | 'unknown';
  target_device_id: string | null;
  payload: Record<string, unknown>;
  cot_steps: CotStep[];
  reply: string;
  should_dispatch: boolean;
}
