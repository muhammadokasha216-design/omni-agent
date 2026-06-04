import { useEffect, useState } from 'react';
import { LayoutDashboard, Activity, TrendingUp, ShieldAlert, Send, Cpu, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { StatCard } from '../components/ui';
import type { AgentNode, TradingBot, SystemAlert, TelegramMessage } from '../lib/types';
import type { Page } from '../components/Layout';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

function genSparkline(base: number, len = 20) {
  return Array.from({ length: len }, (_, i) => ({
    t: `${i}m`,
    v: base * (0.96 + Math.random() * 0.08),
  }));
}

interface Props { onNav: (p: Page) => void; }

export default function Dashboard({ onNav }: Props) {
  const [nodes, setNodes] = useState<AgentNode[]>([]);
  const [bots, setBots] = useState<TradingBot[]>([]);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [msgs, setMsgs] = useState<TelegramMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [btcSpark] = useState(() => genSparkline(67800));
  const [ethSpark] = useState(() => genSparkline(3840));

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [n, b, a, m] = await Promise.all([
      supabase.from('agent_nodes').select('*').order('created_at'),
      supabase.from('trading_bots').select('*').order('created_at'),
      supabase.from('system_alerts').select('*').order('triggered_at', { ascending: false }).limit(5),
      supabase.from('telegram_messages').select('*').order('created_at', { ascending: false }).limit(6),
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
            ARES OMNI-AGENT — REAL-TIME OPERATIONAL STATUS
          </p>
        </div>
        <button onClick={load} className="btn btn-ghost">
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          REFRESH
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Nodes Online"   value={`${onlineCount}/${nodes.length}`} sub="Active endpoints"      color="green"  icon={<Cpu size={16} />}         glow />
        <StatCard label="Trading Bots"   value={`${activeBots}/${bots.length}`}   sub="Active strategies"     color="amber"  icon={<TrendingUp size={16} />}  />
        <StatCard label="Security Alerts" value={unread}                           sub="Unacknowledged"        color={unread > 0 ? 'red' : 'muted'} icon={<ShieldAlert size={16} />} glow={unread > 0} />
        <StatCard label="Total PnL"       value={`${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`} sub="Across all bots" color={totalPnl >= 0 ? 'green' : 'red'} icon={<Activity size={16} />} glow />
      </div>

      {/* Charts + nodes grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* BTC Sparkline */}
        <div className="panel p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-mono text-ares-textSub tracking-widest">BTC / USDT</span>
            <span className="text-sm font-mono font-bold text-ares-amber">$67,842</span>
          </div>
          <ResponsiveContainer width="100%" height={90}>
            <AreaChart data={btcSpark} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="btcGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke="#f59e0b" strokeWidth={1.5} fill="url(#btcGrad)" dot={false} />
              <Tooltip contentStyle={{ background: '#0d1423', border: '1px solid #1e3355', borderRadius: 4, fontSize: 10, fontFamily: 'monospace' }} formatter={(v: any) => [`$${Number(v).toFixed(2)}`, 'Price']} labelFormatter={() => ''} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* ETH Sparkline */}
        <div className="panel p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-mono text-ares-textSub tracking-widest">ETH / USDT</span>
            <span className="text-sm font-mono font-bold text-ares-cyan">$3,847</span>
          </div>
          <ResponsiveContainer width="100%" height={90}>
            <AreaChart data={ethSpark} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="ethGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#38bdf8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke="#38bdf8" strokeWidth={1.5} fill="url(#ethGrad)" dot={false} />
              <Tooltip contentStyle={{ background: '#0d1423', border: '1px solid #1e3355', borderRadius: 4, fontSize: 10, fontFamily: 'monospace' }} formatter={(v: any) => [`$${Number(v).toFixed(2)}`, 'Price']} labelFormatter={() => ''} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Agent nodes mini-grid */}
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

      {/* Alerts + Telegram feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Alerts */}
        <div className="panel">
          <div className="panel-header">
            <ShieldAlert size={13} className="text-ares-red" />
            <span className="text-[10px] font-mono font-bold tracking-widest text-ares-text">SECURITY ALERTS</span>
            <button onClick={() => onNav('security')} className="ml-auto text-[9px] font-mono text-ares-textMuted hover:text-ares-cyan transition-colors">VIEW ALL →</button>
          </div>
          <div className="divide-y divide-ares-border">
            {alerts.length === 0 && (
              <div className="px-4 py-6 text-center text-[10px] font-mono text-ares-textMuted">No alerts</div>
            )}
            {alerts.map(a => (
              <div key={a.id} className="flex items-start gap-3 px-4 py-2.5">
                <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                  a.severity === 'critical' ? 'bg-ares-red' : a.severity === 'warning' ? 'bg-ares-amber' : 'bg-ares-cyan'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-mono font-semibold text-ares-text truncate">{a.title}</div>
                  <div className="text-[9px] font-mono text-ares-textMuted mt-0.5 truncate">{a.body}</div>
                </div>
                <span className={`text-[9px] font-mono font-bold uppercase flex-shrink-0 ${
                  a.severity === 'critical' ? 'text-ares-red' : a.severity === 'warning' ? 'text-ares-amber' : 'text-ares-cyan'
                }`}>{a.severity}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Telegram feed */}
        <div className="panel">
          <div className="panel-header">
            <Send size={13} className="text-ares-cyan" />
            <span className="text-[10px] font-mono font-bold tracking-widest text-ares-text">TELEGRAM FEED</span>
            <button onClick={() => onNav('telegram')} className="ml-auto text-[9px] font-mono text-ares-textMuted hover:text-ares-cyan transition-colors">OPEN →</button>
          </div>
          <div className="divide-y divide-ares-border max-h-52 overflow-y-auto">
            {msgs.length === 0 && (
              <div className="px-4 py-6 text-center text-[10px] font-mono text-ares-textMuted">No messages</div>
            )}
            {msgs.map(m => (
              <div key={m.id} className={`flex items-start gap-3 px-4 py-2.5 ${m.direction === 'outbound' ? 'bg-ares-elevated/30' : ''}`}>
                <span className={`text-[9px] font-mono font-bold flex-shrink-0 mt-0.5 ${m.direction === 'inbound' ? 'text-ares-amber' : 'text-ares-cyan'}`}>
                  {m.direction === 'inbound' ? '▶ IN' : '◀ OUT'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-mono text-ares-text truncate">{m.message_text}</div>
                  <div className="text-[9px] font-mono text-ares-textMuted mt-0.5">
                    {new Date(m.created_at).toLocaleTimeString('en-US', { hour12: false })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
