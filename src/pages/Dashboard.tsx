import { useEffect, useState, useCallback } from 'react';
import { Activity, TrendingUp, ShieldAlert, Send, Cpu, RefreshCw, Radio, WifiOff, Zap, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { StatCard } from '../components/ui';
import type { AgentNode, TradingBot, SystemAlert, TelegramMessage } from '../lib/types';
import type { Page } from '../components/Layout';
import { useAgent } from '../lib/agent';
import { useSettings } from '../lib/settings';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

interface SparkPoint { t: string; v: number; }
interface LivePrice { price: number; change: number; spark: SparkPoint[]; }

function seedSpark(base: number): SparkPoint[] {
  return Array.from({ length: 20 }, (_, i) => ({ t: `${i}`, v: base * (0.97 + Math.random() * 0.06) }));
}

interface Props { onNav: (p: Page) => void; }

export default function Dashboard({ onNav }: Props) {
  const { user } = useAuth();
  const [nodes, setNodes] = useState<AgentNode[]>([]);
  const [bots, setBots] = useState<TradingBot[]>([]);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [msgs, setMsgs] = useState<TelegramMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [btc, setBtc] = useState<LivePrice>({ price: 67842, change: 0, spark: seedSpark(67842) });
  const [eth, setEth] = useState<LivePrice>({ price: 3847,  change: 0, spark: seedSpark(3847)  });
  const [binanceLive, setBinanceLive] = useState(false);
  const { mode, connectionStatus, dbConnected, telegramConnected, heartbeat, goLive } = useAgent();
  const { allConfigured } = useSettings();

  const isLive = mode === 'live' && dbConnected;
  const telegramReady = allConfigured(['telegram_bot_token', 'telegram_chat_id']);

  const fetchLivePrices = useCallback(async () => {
    try {
      const res = await supabase.functions.invoke('binance-proxy?action=tickers', { body: {} });
      if (res.error || !res.data?.ok) throw new Error('Binance unavailable');
      const tickers: { symbol: string; price: number; change: number }[] = res.data.tickers;
      const btcT = tickers.find(t => t.symbol === 'BTC/USDT');
      const ethT = tickers.find(t => t.symbol === 'ETH/USDT');
      if (btcT) setBtc(prev => ({
        price: btcT.price, change: btcT.change,
        spark: [...prev.spark.slice(-19), { t: `${prev.spark.length}`, v: btcT.price }],
      }));
      if (ethT) setEth(prev => ({
        price: ethT.price, change: ethT.change,
        spark: [...prev.spark.slice(-19), { t: `${prev.spark.length}`, v: ethT.price }],
      }));
      setBinanceLive(true);
    } catch {
      setBinanceLive(false);
    }
  }, []);

  useEffect(() => { load(); fetchLivePrices(); }, []);
  useEffect(() => {
    const id = setInterval(fetchLivePrices, 5000);
    return () => clearInterval(id);
  }, [fetchLivePrices]);

  async function load() {
    setLoading(true);
    const [n, b, a, m] = await Promise.all([
      supabase.from('agent_nodes').select('*').eq('user_id', user?.id ?? '').order('created_at'),
      supabase.from('trading_bots').select('*').eq('user_id', user?.id ?? '').order('created_at'),
      supabase.from('system_alerts').select('*').eq('user_id', user?.id ?? '').order('triggered_at', { ascending: false }).limit(5),
      supabase.from('telegram_messages').select('*').eq('user_id', user?.id ?? '').order('created_at', { ascending: false }).limit(6),
    ]);
    if (n.data) setNodes(n.data);
    if (b.data) setBots(b.data);
    if (a.data) setAlerts(a.data);
    if (m.data) setMsgs(m.data);
    setLoading(false);
  }

  const onlineCount = nodes.filter(n => n.is_online).length;
  const activeBots  = bots.filter(b => b.is_active).length;
  const unread      = alerts.filter(a => !a.is_read).length;
  const totalPnl    = bots.reduce((s, b) => s + Number(b.pnl_usd), 0);

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold font-mono tracking-widest text-ares-amber glow-amber uppercase">
            Command Center
          </h1>
          <p className="text-[10px] font-mono text-ares-textMuted mt-0.5 tracking-wider">
            ARES OMNI-AGENT — {isLive ? 'LIVE MODE' : 'SIMULATED MODE'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { load(); fetchLivePrices(); }} className="btn btn-ghost">
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            REFRESH
          </button>
          {!isLive && (
            <button onClick={goLive} disabled={connectionStatus === 'connecting'} className="btn btn-green">
              {connectionStatus === 'connecting' ? <RefreshCw size={11} className="animate-spin" /> : <Radio size={11} />}
              {connectionStatus === 'connecting' ? 'CONNECTING...' : 'GO LIVE'}
            </button>
          )}
        </div>
      </div>

      {/* Status banner */}
      {isLive ? (
        <div className="panel p-3 border-ares-green/30 bg-ares-green/5">
          <div className="flex items-center gap-3">
            <Zap size={16} className="text-ares-green flex-shrink-0" />
            <div className="flex-1">
              <div className="text-[11px] font-mono font-bold text-ares-green">ARES OMNI-AGENT: LIVE MODE ACTIVE</div>
              <div className="text-[9px] font-mono text-ares-textMuted mt-0.5">
                {heartbeat.latencyMs !== null ? `Latency: ${heartbeat.latencyMs}ms · ` : ''}
                Heartbeat: {heartbeat.intervalSec}s
              </div>
            </div>
            <span className="w-2 h-2 rounded-full bg-ares-green pulse-online flex-shrink-0" />
          </div>
          {/* Connection status row */}
          <div className="flex items-center gap-4 mt-2 pt-2 border-t border-ares-green/10">
            <ConnStatus label="Database"  ok={dbConnected} />
            <ConnStatus label="Telegram"  ok={telegramConnected} />
            <ConnStatus label="Binance"   ok={binanceLive} />
          </div>
        </div>
      ) : (
        <div className="panel p-3 border-ares-amber/20 bg-ares-amber/5">
          <div className="flex items-center gap-3">
            <WifiOff size={16} className="text-ares-amber flex-shrink-0" />
            <div className="flex-1">
              <div className="text-[11px] font-mono font-bold text-ares-amber">SIMULATED MODE</div>
              <div className="text-[9px] font-mono text-ares-textMuted mt-0.5">
                {!telegramReady ? 'Configure Telegram in Settings to enable LIVE MODE' : 'Click "GO LIVE" to activate real connections'}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ConnStatus label="Binance" ok={binanceLive} />
              {!telegramReady && (
                <button onClick={() => onNav('settings')} className="btn btn-amber py-0.5 px-2 text-[9px]">SETUP</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Nodes Online"    value={`${onlineCount}/${nodes.length}`} sub="Active endpoints"   color="green"                          icon={<Cpu size={16} />}         glow />
        <StatCard label="Trading Bots"    value={`${activeBots}/${bots.length}`}   sub="Active strategies"  color="amber"                          icon={<TrendingUp size={16} />}  />
        <StatCard label="Security Alerts" value={unread}                            sub="Unacknowledged"     color={unread > 0 ? 'red' : 'muted'}   icon={<ShieldAlert size={16} />} glow={unread > 0} />
        <StatCard label="Total PnL"       value={`${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`} sub="Across all bots" color={totalPnl >= 0 ? 'green' : 'red'} icon={<Activity size={16} />} glow />
      </div>

      {/* Charts + nodes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* BTC */}
        <SparkCard
          symbol="BTC / USDT"
          price={btc.price}
          change={btc.change}
          spark={btc.spark}
          color="#f59e0b"
          gradId="btcGrad"
          live={binanceLive}
        />
        {/* ETH */}
        <SparkCard
          symbol="ETH / USDT"
          price={eth.price}
          change={eth.change}
          spark={eth.spark}
          color="#38bdf8"
          gradId="ethGrad"
          live={binanceLive}
        />

        {/* Agent nodes */}
        <div className="panel">
          <div className="panel-header">
            <Cpu size={13} className="text-ares-amber" />
            <span className="text-[10px] font-mono font-bold tracking-widest text-ares-text">NODES</span>
            <span className="ml-auto text-[10px] font-mono text-ares-textMuted">{nodes.length} registered</span>
          </div>
          <div className="divide-y divide-ares-border">
            {nodes.map(n => (
              <div key={n.id} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${n.is_online ? 'bg-ares-green pulse-online' : 'bg-ares-red pulse-offline'}`} />
                  <div>
                    <div className="text-[11px] font-mono font-semibold text-ares-text">{n.name}</div>
                    <div className="text-[9px] font-mono text-ares-textMuted uppercase">{n.type}</div>
                  </div>
                </div>
                <span className={`text-[9px] font-mono font-bold ${n.is_online ? 'text-ares-green' : 'text-ares-red'}`}>
                  {n.is_online ? '● ONLINE' : '○ OFFLINE'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Alerts + Telegram */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="panel">
          <div className="panel-header">
            <ShieldAlert size={13} className="text-ares-red" />
            <span className="text-[10px] font-mono font-bold tracking-widest text-ares-text">SECURITY ALERTS</span>
            <button onClick={() => onNav('security')} className="ml-auto text-[9px] font-mono text-ares-textMuted hover:text-ares-cyan transition-colors">VIEW ALL →</button>
          </div>
          <div className="divide-y divide-ares-border">
            {alerts.length === 0 && <div className="px-4 py-6 text-center text-[10px] font-mono text-ares-textMuted">No alerts</div>}
            {alerts.map(a => (
              <div key={a.id} className="flex items-start gap-3 px-4 py-2.5">
                <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${a.severity === 'critical' ? 'bg-ares-red' : a.severity === 'warning' ? 'bg-ares-amber' : 'bg-ares-cyan'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-mono font-semibold text-ares-text truncate">{a.title}</div>
                  <div className="text-[9px] font-mono text-ares-textMuted mt-0.5 truncate">{a.body}</div>
                </div>
                <span className={`text-[9px] font-mono font-bold uppercase flex-shrink-0 ${a.severity === 'critical' ? 'text-ares-red' : a.severity === 'warning' ? 'text-ares-amber' : 'text-ares-cyan'}`}>{a.severity}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <Send size={13} className="text-ares-cyan" />
            <span className="text-[10px] font-mono font-bold tracking-widest text-ares-text">TELEGRAM FEED</span>
            {telegramConnected && <span className="ml-2 text-[8px] font-mono text-ares-green">● LIVE</span>}
            <button onClick={() => onNav('telegram')} className="ml-auto text-[9px] font-mono text-ares-textMuted hover:text-ares-cyan transition-colors">OPEN →</button>
          </div>
          <div className="divide-y divide-ares-border max-h-52 overflow-y-auto">
            {msgs.length === 0 && <div className="px-4 py-6 text-center text-[10px] font-mono text-ares-textMuted">No messages</div>}
            {msgs.map(m => (
              <div key={m.id} className={`flex items-start gap-3 px-4 py-2.5 ${m.direction === 'outbound' ? 'bg-ares-elevated/30' : ''}`}>
                <span className={`text-[9px] font-mono font-bold flex-shrink-0 mt-0.5 ${m.direction === 'inbound' ? 'text-ares-amber' : 'text-ares-cyan'}`}>
                  {m.direction === 'inbound' ? '▶ IN' : '◀ OUT'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-mono text-ares-text truncate">{m.message_text}</div>
                  <div className="text-[9px] font-mono text-ares-textMuted mt-0.5">{new Date(m.created_at).toLocaleTimeString('en-US', { hour12: false })}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ConnStatus({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-1">
      {ok
        ? <CheckCircle size={10} className="text-ares-green flex-shrink-0" />
        : <XCircle    size={10} className="text-ares-red flex-shrink-0" />}
      <span className={`text-[9px] font-mono font-bold ${ok ? 'text-ares-green' : 'text-ares-red'}`}>{label}</span>
    </div>
  );
}

function SparkCard({ symbol, price, change, spark, color, gradId, live }: {
  symbol: string; price: number; change: number;
  spark: SparkPoint[]; color: string; gradId: string; live: boolean;
}) {
  const pos = change >= 0;
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-mono text-ares-textSub tracking-widest">{symbol}</span>
        {live
          ? <span className="text-[8px] font-mono text-ares-green flex items-center gap-1"><Radio size={7} className="animate-pulse" /> LIVE</span>
          : <span className="text-[8px] font-mono text-ares-textMuted">SIM</span>}
      </div>
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-sm font-mono font-bold tabular-nums" style={{ color }}>
          ${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span className={`text-[10px] font-mono font-bold ${pos ? 'text-ares-green' : 'text-ares-red'}`}>
          {pos ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
        </span>
      </div>
      <ResponsiveContainer width="100%" height={70}>
        <AreaChart data={spark} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#${gradId})`} dot={false} />
          <Tooltip contentStyle={{ background: '#0d1423', border: '1px solid #1e3355', borderRadius: 4, fontSize: 10, fontFamily: 'monospace' }} formatter={(v: any) => [`$${Number(v).toFixed(2)}`, 'Price']} labelFormatter={() => ''} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
