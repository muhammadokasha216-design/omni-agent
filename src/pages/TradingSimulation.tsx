import { useEffect, useState, useRef } from 'react';
import {
  TrendingUp, TrendingDown, Play, Square, RefreshCw, Plus, X, Check,
  BarChart2, Zap, Target, DollarSign, Activity,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { StatCard, PanelHeader, StatusDot, Empty } from '../components/ui';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Cell,
} from 'recharts';

interface SimTrade {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  entry_price: number;
  exit_price: number | null;
  status: 'open' | 'closed' | 'cancelled';
  strategy: string;
  pnl_usd: number | null;
  opened_at: string;
  closed_at: string | null;
}

const SYMBOLS = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT', 'ADA/USDT'];
const STRATEGIES = ['scalp', 'swing', 'grid', 'dca', 'breakout', 'arbitrage'];
const BASE: Record<string, number> = {
  'BTC/USDT': 67842, 'ETH/USDT': 3847, 'BNB/USDT': 567,
  'SOL/USDT': 172, 'XRP/USDT': 0.58, 'ADA/USDT': 0.45,
};

function genEquityCurve(trades: SimTrade[]) {
  let equity = 10000;
  const closed = trades.filter(t => t.status === 'closed' && t.pnl_usd !== null)
    .sort((a, b) => new Date(a.closed_at!).getTime() - new Date(b.closed_at!).getTime());
  return closed.map((t, i) => {
    equity += Number(t.pnl_usd);
    return { t: `T${i + 1}`, equity: parseFloat(equity.toFixed(2)) };
  });
}

function genPriceFeed(symbol: string, points = 80): { t: string; price: number }[] {
  let p = BASE[symbol] ?? 100;
  return Array.from({ length: points }, (_, i) => {
    p *= 1 + (Math.random() - 0.49) * 0.004;
    return { t: `${i}`, price: parseFloat(p.toFixed(4)) };
  });
}

const PAIR_COLORS: Record<string, string> = {
  'BTC/USDT': '#f59e0b', 'ETH/USDT': '#38bdf8', 'BNB/USDT': '#22d3a0',
  'SOL/USDT': '#a78bfa', 'XRP/USDT': '#fb923c', 'ADA/USDT': '#34d399',
};

export default function TradingSimulation() {
  const [trades, setTrades] = useState<SimTrade[]>([]);
  const [selectedSym, setSelectedSym] = useState('BTC/USDT');
  const [priceFeed, setPriceFeed] = useState<Record<string, { t: string; price: number }[]>>(() =>
    Object.fromEntries(SYMBOLS.map(s => [s, genPriceFeed(s)]))
  );
  const [form, setForm] = useState({ symbol: 'BTC/USDT', side: 'buy', quantity: '0.01', strategy: 'scalp' });
  const [executing, setExecuting] = useState(false);
  const [autoTrade, setAutoTrade] = useState(false);
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadTrades();
    // Live price feed updates
    feedRef.current = setInterval(() => {
      setPriceFeed(prev => {
        const next = { ...prev };
        SYMBOLS.forEach(sym => {
          const arr = prev[sym];
          const last = arr[arr.length - 1].price;
          const newPrice = last * (1 + (Math.random() - 0.49) * 0.003);
          next[sym] = [...arr.slice(1), { t: String(arr.length), price: parseFloat(newPrice.toFixed(4)) }];
        });
        return next;
      });
    }, 1500);

    const ch = supabase.channel('sim_trades_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sim_trades' }, loadTrades)
      .subscribe();

    return () => {
      if (feedRef.current) clearInterval(feedRef.current);
      if (autoRef.current) clearInterval(autoRef.current);
      supabase.removeChannel(ch);
    };
  }, []);

  useEffect(() => {
    if (autoRef.current) clearInterval(autoRef.current);
    if (autoTrade) {
      autoRef.current = setInterval(runAutoTrade, 8000);
    }
  }, [autoTrade]);

  async function loadTrades() {
    const { data } = await supabase.from('sim_trades').select('*').order('opened_at', { ascending: false }).limit(50);
    if (data) setTrades(data);
  }

  async function executeTrade() {
    setExecuting(true);
    const sym = form.symbol;
    const price = priceFeed[sym]?.at(-1)?.price ?? BASE[sym];
    const qty = parseFloat(form.quantity);

    try {
      await supabase.from('sim_trades').insert({
        symbol: sym,
        side: form.side,
        quantity: qty,
        entry_price: price,
        status: 'open',
        strategy: form.strategy,
      });
      // Auto-close after a simulated delay
      setTimeout(() => closeTrade(sym, price, qty, form.side), 3000 + Math.random() * 7000);
    } finally {
      setExecuting(false);
    }
  }

  async function closeTrade(symbol: string, entryPrice: number, qty: number, side: string) {
    const { data: open } = await supabase
      .from('sim_trades').select('id').eq('status', 'open').eq('symbol', symbol).order('opened_at').limit(1);
    if (!open?.length) return;

    const exitPrice = priceFeed[symbol]?.at(-1)?.price ?? entryPrice * (1 + (Math.random() - 0.45) * 0.01);
    const priceDiff = side === 'buy' ? exitPrice - entryPrice : entryPrice - exitPrice;
    const pnl = parseFloat((priceDiff * qty).toFixed(4));

    await supabase.from('sim_trades').update({
      status: 'closed',
      exit_price: exitPrice,
      pnl_usd: pnl,
      closed_at: new Date().toISOString(),
    }).eq('id', open[0].id);
  }

  async function runAutoTrade() {
    const sym = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    const side = Math.random() > 0.5 ? 'buy' : 'sell';
    const qty = parseFloat((Math.random() * 0.1 + 0.005).toFixed(4));
    const price = priceFeed[sym]?.at(-1)?.price ?? BASE[sym];
    const strategy = STRATEGIES[Math.floor(Math.random() * STRATEGIES.length)];

    await supabase.from('sim_trades').insert({ symbol: sym, side, quantity: qty, entry_price: price, status: 'open', strategy });
    setTimeout(() => closeTrade(sym, price, qty, side), 2000 + Math.random() * 6000);
  }

  async function clearClosed() {
    await supabase.from('sim_trades').delete().eq('status', 'closed');
    loadTrades();
  }

  // Computed stats
  const closed = trades.filter(t => t.status === 'closed');
  const open = trades.filter(t => t.status === 'open');
  const totalPnl = closed.reduce((s, t) => s + Number(t.pnl_usd ?? 0), 0);
  const wins = closed.filter(t => Number(t.pnl_usd) > 0).length;
  const winRate = closed.length > 0 ? Math.round((wins / closed.length) * 100) : 0;
  const equityCurve = genEquityCurve(trades);
  const currentPrice = priceFeed[selectedSym]?.at(-1)?.price ?? 0;
  const prevPrice = priceFeed[selectedSym]?.at(-2)?.price ?? currentPrice;
  const priceUp = currentPrice >= prevPrice;
  const color = PAIR_COLORS[selectedSym] ?? '#f59e0b';

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-base font-bold font-mono tracking-widest text-ares-amber glow-amber uppercase">
            Trading Simulation
          </h1>
          <p className="text-[10px] font-mono text-ares-textMuted mt-0.5">
            Paper trading with real-time simulated prices · No real funds at risk
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={clearClosed} className="btn btn-ghost">CLEAR CLOSED</button>
          <button
            onClick={() => setAutoTrade(v => !v)}
            className={autoTrade ? 'btn btn-red' : 'btn btn-green'}
          >
            {autoTrade ? <><Square size={11} /> STOP AUTO</> : <><Zap size={11} /> AUTO TRADE</>}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total PnL"   value={`${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`} color={totalPnl >= 0 ? 'green' : 'red'} sub="Simulated USD" glow />
        <StatCard label="Win Rate"    value={`${winRate}%`}         color={winRate >= 50 ? 'green' : 'red'} sub={`${wins}/${closed.length} trades`} />
        <StatCard label="Open Trades" value={open.length}           color="amber" sub="Awaiting close" />
        <StatCard label="Total Trades" value={trades.length}        color="cyan"  sub="All time" />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Execute trade panel */}
        <div className="panel">
          <PanelHeader icon={<Target size={13} />} title="Execute Trade" color="amber" />
          <div className="p-4 space-y-3">
            {/* Symbol selector */}
            <div>
              <label className="text-[9px] font-mono text-ares-textMuted block mb-1.5 tracking-wider">SYMBOL</label>
              <div className="grid grid-cols-3 gap-1.5">
                {SYMBOLS.map(sym => (
                  <button
                    key={sym}
                    onClick={() => { setSelectedSym(sym); setForm(f => ({ ...f, symbol: sym })); }}
                    className={`text-[9px] font-mono py-1.5 rounded border transition-all
                      ${form.symbol === sym
                        ? 'border-ares-amber/50 bg-ares-amber/10 text-ares-amber'
                        : 'border-ares-border text-ares-textMuted hover:border-ares-borderLit'}`}
                  >
                    {sym.split('/')[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* Side */}
            <div>
              <label className="text-[9px] font-mono text-ares-textMuted block mb-1.5 tracking-wider">SIDE</label>
              <div className="grid grid-cols-2 gap-2">
                {(['buy', 'sell'] as const).map(side => (
                  <button
                    key={side}
                    onClick={() => setForm(f => ({ ...f, side }))}
                    className={`py-2 text-[11px] font-mono font-bold rounded border transition-all
                      ${form.side === side
                        ? side === 'buy'
                          ? 'border-ares-green/50 bg-ares-green/10 text-ares-green'
                          : 'border-ares-red/50 bg-ares-red/10 text-ares-red'
                        : 'border-ares-border text-ares-textMuted hover:border-ares-borderLit'}`}
                  >
                    {side === 'buy' ? '▲ LONG' : '▼ SHORT'}
                  </button>
                ))}
              </div>
            </div>

            {/* Qty + strategy */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] font-mono text-ares-textMuted block mb-1 tracking-wider">QUANTITY</label>
                <input className="ares-input text-xs" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
              </div>
              <div>
                <label className="text-[9px] font-mono text-ares-textMuted block mb-1 tracking-wider">STRATEGY</label>
                <select className="ares-input text-xs" value={form.strategy} onChange={e => setForm(f => ({ ...f, strategy: e.target.value }))}>
                  {STRATEGIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Current price display */}
            <div className="bg-ares-bg rounded-lg p-3 border border-ares-border flex items-center justify-between">
              <span className="text-[9px] font-mono text-ares-textMuted">CURRENT PRICE</span>
              <span className={`text-sm font-bold font-mono tabular-nums ${priceUp ? 'text-ares-green' : 'text-ares-red'}`}>
                ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: currentPrice < 10 ? 4 : 2 })}
              </span>
            </div>

            <button onClick={executeTrade} disabled={executing} className="btn btn-amber w-full justify-center py-2.5">
              {executing ? <RefreshCw size={11} className="animate-spin" /> : <Play size={11} />}
              {executing ? 'EXECUTING...' : `${form.side.toUpperCase()} ${form.quantity} ${form.symbol.split('/')[0]}`}
            </button>
          </div>

          {/* Open trades */}
          {open.length > 0 && (
            <div className="border-t border-ares-border">
              <div className="px-4 py-2 text-[9px] font-mono text-ares-textMuted tracking-wider">OPEN POSITIONS ({open.length})</div>
              {open.map(t => (
                <div key={t.id} className="flex items-center gap-2 px-4 py-2 border-t border-ares-border">
                  <span className={`text-[9px] font-mono font-bold w-6 ${t.side === 'buy' ? 'text-ares-green' : 'text-ares-red'}`}>{t.side === 'buy' ? '▲' : '▼'}</span>
                  <span className="text-[10px] font-mono text-ares-text flex-1">{t.symbol}</span>
                  <span className="text-[9px] font-mono text-ares-textMuted">{Number(t.quantity).toFixed(4)}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-ares-amber animate-pulse flex-shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Charts */}
        <div className="lg:col-span-2 space-y-4">
          {/* Live price chart */}
          <div className="panel p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-mono font-bold text-ares-text">{selectedSym}</span>
                <span className="text-xl font-bold font-mono tabular-nums" style={{ color }}>
                  ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: currentPrice < 10 ? 4 : 2 })}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {SYMBOLS.map(sym => (
                  <button key={sym} onClick={() => setSelectedSym(sym)}
                    className={`w-2 h-2 rounded-full transition-all ${selectedSym === sym ? 'scale-125' : 'opacity-40 hover:opacity-70'}`}
                    style={{ backgroundColor: PAIR_COLORS[sym] }}
                    title={sym}
                  />
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={priceFeed[selectedSym]} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="simGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={color} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#162236" />
                <XAxis dataKey="t" stroke="#334155" tick={{ fontSize: 8, fontFamily: 'monospace' }} interval={15} />
                <YAxis stroke="#334155" tick={{ fontSize: 9, fontFamily: 'monospace' }} domain={['auto', 'auto']}
                  tickFormatter={v => `$${Number(v) < 10 ? Number(v).toFixed(3) : Number(v).toFixed(0)}`} />
                <Tooltip contentStyle={{ background: '#0d1423', border: '1px solid #1e3355', borderRadius: 4, fontSize: 10, fontFamily: 'monospace' }}
                  formatter={(v: any) => [`$${Number(v).toFixed(4)}`, 'Price']} labelFormatter={() => ''} />
                <Area type="monotone" dataKey="price" stroke={color} strokeWidth={1.5} fill="url(#simGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Equity curve */}
          {equityCurve.length > 1 && (
            <div className="panel p-4">
              <div className="text-[10px] font-mono font-bold tracking-widest text-ares-textSub mb-3">EQUITY CURVE</div>
              <ResponsiveContainer width="100%" height={100}>
                <LineChart data={equityCurve} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#162236" />
                  <XAxis dataKey="t" stroke="#334155" tick={{ fontSize: 8 }} />
                  <YAxis stroke="#334155" tick={{ fontSize: 9, fontFamily: 'monospace' }} tickFormatter={v => `$${v}`} />
                  <Tooltip contentStyle={{ background: '#0d1423', border: '1px solid #1e3355', borderRadius: 4, fontSize: 10, fontFamily: 'monospace' }} formatter={(v: any) => [`$${v}`, 'Equity']} />
                  <ReferenceLine y={10000} stroke="#334155" strokeDasharray="4 2" />
                  <Line type="monotone" dataKey="equity" stroke={totalPnl >= 0 ? '#22d3a0' : '#f43f5e'} strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Trade history */}
      <div className="panel">
        <PanelHeader icon={<Activity size={13} />} title="Trade History" badge={<span className="text-[9px] font-mono text-ares-textMuted">{trades.length} total</span>} color="amber" />
        <div className="overflow-x-auto">
          <table className="w-full text-[10px] font-mono">
            <thead>
              <tr className="border-b border-ares-border">
                {['TIME', 'SYMBOL', 'SIDE', 'QTY', 'ENTRY', 'EXIT', 'PnL', 'STRATEGY', 'STATUS'].map(h => (
                  <th key={h} className="text-left px-4 py-2 text-ares-textMuted font-normal tracking-wider text-[9px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ares-border">
              {trades.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-ares-textMuted">No trades yet — execute your first trade or enable Auto Trade</td></tr>
              )}
              {trades.map(t => (
                <tr key={t.id} className="hover:bg-ares-elevated/30 transition-colors">
                  <td className="px-4 py-2 text-ares-textMuted">{new Date(t.opened_at).toLocaleTimeString('en-US', { hour12: false })}</td>
                  <td className="px-4 py-2 text-ares-text font-semibold">{t.symbol}</td>
                  <td className={`px-4 py-2 font-bold ${t.side === 'buy' ? 'text-ares-green' : 'text-ares-red'}`}>{t.side.toUpperCase()}</td>
                  <td className="px-4 py-2 text-ares-textSub">{Number(t.quantity).toFixed(4)}</td>
                  <td className="px-4 py-2 tabular-nums text-ares-textSub">${Number(t.entry_price).toFixed(2)}</td>
                  <td className="px-4 py-2 tabular-nums text-ares-textSub">{t.exit_price ? `$${Number(t.exit_price).toFixed(2)}` : '—'}</td>
                  <td className={`px-4 py-2 tabular-nums font-bold ${t.pnl_usd === null ? 'text-ares-textMuted' : Number(t.pnl_usd) >= 0 ? 'text-ares-green' : 'text-ares-red'}`}>
                    {t.pnl_usd === null ? '—' : `${Number(t.pnl_usd) >= 0 ? '+' : ''}$${Number(t.pnl_usd).toFixed(2)}`}
                  </td>
                  <td className="px-4 py-2 text-ares-textMuted capitalize">{t.strategy}</td>
                  <td className="px-4 py-2">
                    <span className={`badge ${t.status === 'open' ? 'badge-degraded' : t.status === 'closed' ? 'badge-active' : 'badge-offline'}`}>
                      {t.status === 'open' && <span className="w-1.5 h-1.5 rounded-full bg-ares-amber animate-pulse inline-block mr-1" />}
                      {t.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
