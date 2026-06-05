import { useEffect, useState } from 'react';
import { TrendingUp, Plus, Play, Square, RefreshCw, X, Check, Trash2, BarChart2, ShieldAlert, AlertTriangle, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { PanelHeader, StatusDot, Badge, Empty } from '../components/ui';
import type { TradingBot, TradeExecution } from '../lib/types';

interface RiskEvent {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  category: string;
  title: string;
  description: string;
  is_resolved: boolean;
  created_at: string;
}
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

export default function TradingBots() {
  const { user } = useAuth();
  const [bots, setBots] = useState<TradingBot[]>([]);
  const [trades, setTrades] = useState<TradeExecution[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [botTrades, setBotTrades] = useState<TradeExecution[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', exchange: 'binance', symbol: 'BTC/USDT', strategy: 'scalp' });
  const [riskEvents, setRiskEvents] = useState<RiskEvent[]>([]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel('bots_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trading_bots' }, load)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trade_executions' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    if (selected) loadBotTrades(selected);
  }, [selected]);

  async function load() {
    const [b, t] = await Promise.all([
      supabase.from('trading_bots').select('*').eq('user_id', user?.id ?? '').order('created_at'),
      supabase.from('trade_executions').select('*').eq('user_id', user?.id ?? '').order('executed_at', { ascending: false }).limit(20),
    ]);
    if (b.data) { setBots(b.data); if (!selected && b.data.length > 0) setSelected(b.data[0].id); }
    if (t.data) setTrades(t.data);
    // Load risk events
    const { data: risks } = await supabase.from('risk_events').select('*').eq('user_id', user?.id ?? '').order('created_at', { ascending: false }).limit(10);
    if (risks) setRiskEvents(risks as RiskEvent[]);
  }

  async function loadBotTrades(botId: string) {
    const { data } = await supabase
      .from('trade_executions')
      .select('*')
      .eq('user_id', user?.id ?? '')
      .eq('bot_id', botId)
      .order('executed_at', { ascending: false })
      .limit(30);
    if (data) setBotTrades(data);
  }

  async function toggleBot(bot: TradingBot) {
    setToggling(bot.id);
    try {
      const active = !bot.is_active;

      // AI Risk Manager: warn if activating with high exposure
      if (active) {
        const activeBots = bots.filter(b => b.is_active && b.id !== bot.id);
        const activePnl = activeBots.reduce((s, b) => s + Number(b.pnl_usd), 0);
        const totalExposure = activeBots.length + 1;
        const currentLoss = Math.abs(totalPnl);

        // Check if risk is too high
        if (currentLoss > 100 && totalExposure >= 3) {
          await supabase.from('risk_events').insert({
            user_id: user?.id ?? '',
            severity: 'critical',
            category: 'position',
            title: 'High Exposure Warning',
            description: `Activating ${bot.name} would bring total active bots to ${totalExposure}. Current loss is $${currentLoss.toFixed(2)}. Consider reducing exposure.`,
            is_resolved: false,
          });
        } else if (currentLoss > 50 && totalExposure >= 2) {
          await supabase.from('risk_events').insert({
            user_id: user?.id ?? '',
            severity: 'warning',
            category: 'balance',
            title: 'Moderate Risk Detected',
            description: `Current PnL is negative ($${currentLoss.toFixed(2)}). Adding ${bot.name} increases exposure. Monitor closely.`,
            is_resolved: false,
          });
        }
      }

      await supabase.from('trading_bots').update({ is_active: active, last_run: active ? new Date().toISOString() : bot.last_run }).eq('id', bot.id);

      // Simulate a trade when activating
      if (active) {
        const side = Math.random() > 0.5 ? 'buy' : 'sell';
        const prices: Record<string, number> = { 'BTC/USDT': 67842, 'ETH/USDT': 3847, 'BNB/USDT': 567 };
        const price = (prices[bot.symbol] ?? 100) * (1 + (Math.random() - 0.5) * 0.001);
        const qty = parseFloat((Math.random() * 0.1 + 0.01).toFixed(4));
        const pnl = parseFloat((Math.random() * 30 - 10).toFixed(2));
        await supabase.from('trade_executions').insert({
          user_id: user?.id ?? '',
          bot_id: bot.id, side, symbol: bot.symbol, quantity: qty, price,
          status: 'filled', pnl_usd: pnl,
        });
        await supabase.from('trading_bots').update({ pnl_usd: Number(bot.pnl_usd) + pnl }).eq('id', bot.id);
      }
      load();
    } finally {
      setToggling(null);
    }
  }

  async function deleteBot(id: string) {
    await supabase.from('trading_bots').delete().eq('id', id);
    if (selected === id) setSelected(null);
    load();
  }

  async function addBot() {
    if (!form.name.trim()) return;
    await supabase.from('trading_bots').insert({ user_id: user?.id ?? '', ...form, pnl_usd: 0, config: {} });
    setAddOpen(false);
    setForm({ name: '', exchange: 'binance', symbol: 'BTC/USDT', strategy: 'scalp' });
    load();
  }

  const totalPnl = bots.reduce((s, b) => s + Number(b.pnl_usd), 0);
  const selectedBot = bots.find(b => b.id === selected);

  // PnL bar chart data
  const pnlData = bots.map(b => ({ name: b.name.split('-')[0], pnl: Number(b.pnl_usd) }));

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold font-mono tracking-widest text-ares-amber glow-amber uppercase">Trading Bots</h1>
          <p className="text-[10px] font-mono text-ares-textMuted mt-0.5">Modular trading backend — SQLAlchemy connection pooling</p>
        </div>
        <div className="flex gap-2">
          <span className={`text-lg font-bold font-mono ${totalPnl >= 0 ? 'text-ares-green' : 'text-ares-red'}`}>
            {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
          </span>
          <button onClick={() => setAddOpen(true)} className="btn btn-amber"><Plus size={11} /> NEW BOT</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bot list */}
        <div className="panel">
          <PanelHeader icon={<TrendingUp size={13} />} title="Bot Registry" badge={<span className="text-[9px] font-mono text-ares-textMuted">{bots.filter(b => b.is_active).length} active</span>} color="amber" />
          <div className="divide-y divide-ares-border">
            {bots.length === 0 && <Empty message="No bots configured" />}
            {bots.map(bot => (
              <div
                key={bot.id}
                onClick={() => setSelected(bot.id)}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors
                  ${selected === bot.id ? 'bg-ares-elevated' : 'hover:bg-ares-elevated/40'}`}
              >
                <StatusDot status={bot.is_active ? 'active' : 'inactive'} />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-mono font-semibold text-ares-text truncate">{bot.name}</div>
                  <div className="text-[9px] font-mono text-ares-textMuted">{bot.exchange} · {bot.symbol}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-mono font-bold ${Number(bot.pnl_usd) >= 0 ? 'text-ares-green' : 'text-ares-red'}`}>
                    {Number(bot.pnl_usd) >= 0 ? '+' : ''}${Number(bot.pnl_usd).toFixed(2)}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); toggleBot(bot); }}
                    disabled={toggling === bot.id}
                    className={bot.is_active ? 'btn btn-red py-0.5 px-2 text-[9px]' : 'btn btn-green py-0.5 px-2 text-[9px]'}
                  >
                    {toggling === bot.id ? <RefreshCw size={9} className="animate-spin" /> : bot.is_active ? <Square size={9} /> : <Play size={9} />}
                    {bot.is_active ? 'STOP' : 'RUN'}
                  </button>
                  <button onClick={e => { e.stopPropagation(); deleteBot(bot.id); }} className="p-1 text-ares-textMuted hover:text-ares-red">
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detail */}
        <div className="lg:col-span-2 space-y-4">
          {/* PnL Chart */}
          {pnlData.length > 0 && (
            <div className="panel p-4">
              <div className="text-[10px] font-mono font-bold tracking-widest text-ares-textSub mb-3">BOT PNL COMPARISON ($)</div>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={pnlData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#162236" />
                  <XAxis dataKey="name" stroke="#334155" tick={{ fontSize: 9, fontFamily: 'monospace' }} />
                  <YAxis stroke="#334155" tick={{ fontSize: 9, fontFamily: 'monospace' }} unit="$" />
                  <Tooltip contentStyle={{ background: '#0d1423', border: '1px solid #1e3355', borderRadius: 4, fontSize: 10, fontFamily: 'monospace' }} formatter={(v: any) => [`$${Number(v).toFixed(2)}`, 'PnL']} />
                  <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                    {pnlData.map((entry, i) => (
                      <Cell key={i} fill={entry.pnl >= 0 ? '#22d3a0' : '#f43f5e'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Selected bot details */}
          {selectedBot && (
            <div className="panel p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-mono font-bold text-ares-text">{selectedBot.name}</div>
                  <div className="text-[10px] font-mono text-ares-textMuted mt-0.5">
                    {selectedBot.exchange.toUpperCase()} · {selectedBot.symbol} · {selectedBot.strategy.toUpperCase()}
                  </div>
                </div>
                <span className={`badge ${selectedBot.is_active ? 'badge-active' : 'badge-inactive'}`}>
                  {selectedBot.is_active ? '● ACTIVE' : '○ INACTIVE'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {Object.entries(selectedBot.config).map(([k, v]) => (
                  <div key={k} className="bg-ares-bg rounded p-2 border border-ares-border">
                    <div className="text-[9px] font-mono text-ares-textMuted uppercase">{k.replace(/_/g, ' ')}</div>
                    <div className="text-[11px] font-mono text-ares-text mt-0.5">{String(v)}</div>
                  </div>
                ))}
              </div>
              {/* Recent trades */}
              <div>
                <div className="text-[9px] font-mono text-ares-textMuted tracking-widest mb-2">RECENT EXECUTIONS</div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {botTrades.length === 0 && <Empty message="No trades recorded — start bot to execute" />}
                  {botTrades.map(t => (
                    <div key={t.id} className="flex items-center gap-3 text-[10px] font-mono py-1 border-b border-ares-border last:border-0">
                      <span className={`font-bold w-7 ${t.side === 'buy' ? 'text-ares-green' : 'text-ares-red'}`}>{t.side.toUpperCase()}</span>
                      <span className="text-ares-text">{t.symbol}</span>
                      <span className="text-ares-textSub">{Number(t.quantity).toFixed(4)}</span>
                      <span className="text-ares-textSub">@ ${Number(t.price).toFixed(2)}</span>
                      {t.pnl_usd !== null && (
                        <span className={`ml-auto font-bold ${Number(t.pnl_usd) >= 0 ? 'text-ares-green' : 'text-ares-red'}`}>
                          {Number(t.pnl_usd) >= 0 ? '+' : ''}${Number(t.pnl_usd).toFixed(2)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI Risk Manager */}
      <div className="panel">
        <div className="panel-header">
          <ShieldAlert size={13} className="text-ares-red" />
          <span className="text-[10px] font-mono font-bold tracking-widest text-ares-text">AI RISK MANAGER</span>
          {riskEvents.filter(r => !r.is_resolved).length > 0 && (
            <span className="ml-2 text-[9px] font-mono font-bold text-ares-red bg-ares-red/10 px-1.5 py-0.5 rounded">
              {riskEvents.filter(r => !r.is_resolved).length} ACTIVE
            </span>
          )}
          {totalPnl < -50 && (
            <span className="ml-2 flex items-center gap-1 text-[9px] font-mono text-ares-amber">
              <AlertTriangle size={9} /> LOSS EXCEEDS $50
            </span>
          )}
        </div>
        <div className="divide-y divide-ares-border">
          {riskEvents.length === 0 && (
            <div className="px-4 py-4 flex items-center gap-2 text-[10px] font-mono text-ares-green">
              <Zap size={12} /> All clear — no risk events detected. Your positions are within safe parameters.
            </div>
          )}
          {riskEvents.map(r => (
            <div key={r.id} className="flex items-start gap-3 px-4 py-3">
              <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                r.severity === 'critical' ? 'bg-ares-red animate-pulse' : r.severity === 'warning' ? 'bg-ares-amber' : 'bg-ares-cyan'
              }`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-mono font-bold ${
                    r.severity === 'critical' ? 'text-ares-red' : r.severity === 'warning' ? 'text-ares-amber' : 'text-ares-cyan'
                  }`}>[{r.severity.toUpperCase()}]</span>
                  <span className="text-[10px] font-mono font-semibold text-ares-text">{r.title}</span>
                </div>
                <div className="text-[9px] font-mono text-ares-textMuted mt-0.5">{r.description}</div>
              </div>
              {!r.is_resolved && (
                <button
                  onClick={async () => {
                    await supabase.from('risk_events').update({ is_resolved: true }).eq('id', r.id);
                    load();
                  }}
                  className="btn btn-ghost py-0.5 px-2 text-[8px]"
                >
                  <Check size={8} /> DISMISS
                </button>
              )}
              {r.is_resolved && <span className="text-[8px] font-mono text-ares-textMuted">RESOLVED</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Add bot modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="panel w-full max-w-md p-5 space-y-4 animate-fade-up">
            <div className="flex items-center justify-between">
              <span className="text-sm font-mono font-bold text-ares-amber">NEW TRADING BOT</span>
              <button onClick={() => setAddOpen(false)} className="text-ares-textMuted hover:text-ares-text"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              {[
                { label: 'BOT NAME', key: 'name', placeholder: 'e.g. BTC-Scalper' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-[10px] font-mono text-ares-textMuted block mb-1">{f.label}</label>
                  <input className="ares-input" value={(form as any)[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} placeholder={f.placeholder} />
                </div>
              ))}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'EXCHANGE', key: 'exchange', options: ['binance', 'bybit', 'okx', 'kraken'] },
                  { label: 'SYMBOL', key: 'symbol', options: ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT'] },
                  { label: 'STRATEGY', key: 'strategy', options: ['scalp', 'grid', 'dca', 'swing', 'arbitrage'] },
                ].map(s => (
                  <div key={s.key}>
                    <label className="text-[10px] font-mono text-ares-textMuted block mb-1">{s.label}</label>
                    <select className="ares-input text-xs" value={(form as any)[s.key]} onChange={e => setForm({ ...form, [s.key]: e.target.value })}>
                      {s.options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={addBot} className="btn btn-amber flex-1"><Check size={11} /> CREATE</button>
              <button onClick={() => setAddOpen(false)} className="btn btn-ghost flex-1"><X size={11} /> CANCEL</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
