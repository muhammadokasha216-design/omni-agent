import { useEffect, useState, useRef, useCallback } from 'react';
import { TrendingUp, TrendingDown, Radio, WifiOff, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

interface PricePoint { t: string; open: number; close: number; high: number; low: number; volume: number; }
interface TickerData { symbol: string; price: number; change: number; vol: string; high: number; low: number; }

const PAIRS = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT'];
const BINANCE_SYMBOLS: Record<string, string> = {
  'BTC/USDT': 'BTCUSDT', 'ETH/USDT': 'ETHUSDT', 'BNB/USDT': 'BNBUSDT', 'SOL/USDT': 'SOLUSDT',
};
const FALLBACK_PRICES: Record<string, number> = {
  'BTC/USDT': 67842, 'ETH/USDT': 3847, 'BNB/USDT': 567, 'SOL/USDT': 172,
};

function TickerCard({ symbol, price, change, vol, selected, onClick }: TickerData & { selected: boolean; onClick: () => void }) {
  const pos = change >= 0;
  return (
    <button
      onClick={onClick}
      className={`panel p-3 text-left card-hover transition-all duration-150 w-full ${selected ? 'border-ares-borderGlow' : ''}`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-mono font-bold text-ares-textSub">{symbol}</span>
        <span className={`text-[9px] font-mono font-bold ${pos ? 'text-ares-green' : 'text-ares-red'}`}>
          {pos ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
        </span>
      </div>
      <div className="text-base font-bold font-mono tabular-nums text-ares-text">
        ${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: price < 1 ? 4 : 2 })}
      </div>
      <div className="text-[9px] font-mono text-ares-textMuted mt-0.5">Vol: {vol}</div>
    </button>
  );
}

export default function MarketData() {
  const [selected, setSelected] = useState('BTC/USDT');
  const [tickers, setTickers] = useState<TickerData[]>(() =>
    PAIRS.map(sym => ({ symbol: sym, price: FALLBACK_PRICES[sym], change: 0, vol: '…', high: 0, low: 0 }))
  );
  const [candles, setCandles] = useState<PricePoint[]>([]);
  const [timeframe, setTimeframe] = useState<'1m' | '5m' | '15m' | '1h'>('1m');
  const [liveMode, setLiveMode] = useState(false);
  const [binanceError, setBinanceError] = useState<string | null>(null);
  const [loadingCandles, setLoadingCandles] = useState(false);
  const tickerInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const rtChannel = useRef<any>(null);

  const fetchTickers = useCallback(async () => {
    try {
      const res = await supabase.functions.invoke('binance-proxy?action=tickers', { body: {} });
      if (res.error || !res.data?.ok) throw new Error(res.error?.message ?? res.data?.error ?? 'Unknown');

      setTickers(res.data.tickers);
      setLiveMode(true);
      setBinanceError(null);

      // Persist to market_snapshots for Realtime + historical queries
      await Promise.all((res.data.tickers as TickerData[]).map((t: TickerData) =>
        supabase.from('market_snapshots').upsert({
          symbol: t.symbol,
          price: t.price,
          change_24h_pct: t.change,
          recorded_at: new Date().toISOString(),
        }, { onConflict: 'symbol' })
      ));
    } catch (err: any) {
      setBinanceError(err.message ?? 'Binance unavailable');
      setLiveMode(false);
      // Fall back to simulated micro-updates
      setTickers(prev => prev.map(t => ({
        ...t,
        price: t.price * (1 + (Math.random() - 0.5) * 0.0004),
        change: t.change + (Math.random() - 0.5) * 0.01,
      })));
    }
  }, []);

  const fetchCandles = useCallback(async (sym: string, tf: string) => {
    setLoadingCandles(true);
    try {
      const binanceSym = BINANCE_SYMBOLS[sym] ?? 'BTCUSDT';
      const res = await supabase.functions.invoke(
        `binance-proxy?action=klines&symbol=${binanceSym}&interval=${tf}&limit=60`,
        { body: {} }
      );
      if (res.error || !res.data?.ok) throw new Error(res.data?.error ?? 'Klines failed');
      setCandles(res.data.candles);
    } catch {
      // Synthetic fallback from current price
      const base = tickers.find(t => t.symbol === sym)?.price ?? FALLBACK_PRICES[sym] ?? 100;
      let p = base;
      setCandles(Array.from({ length: 60 }, (_, i) => {
        const chg = p * (Math.random() - 0.49) * 0.006;
        const open = p; p += chg; const close = p;
        const spread = Math.abs(chg) * 1.5;
        return { t: `${i}${tf}`, open, close, high: Math.max(open, close) + spread, low: Math.min(open, close) - spread, volume: Math.random() * 500 + 100 };
      }));
    } finally {
      setLoadingCandles(false);
    }
  }, [tickers]);

  useEffect(() => {
    fetchTickers();
    tickerInterval.current = setInterval(fetchTickers, 5000);

    rtChannel.current = supabase
      .channel('market-stream')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'market_snapshots' }, (payload: any) => {
        const snap = payload.new as any;
        if (snap?.symbol) {
          setTickers(prev => prev.map(t =>
            t.symbol === snap.symbol
              ? { ...t, price: Number(snap.price ?? t.price), change: Number(snap.change_24h_pct ?? t.change) }
              : t
          ));
        }
      })
      .subscribe();

    return () => {
      if (tickerInterval.current) clearInterval(tickerInterval.current);
      if (rtChannel.current) supabase.removeChannel(rtChannel.current);
    };
  }, [fetchTickers]);

  useEffect(() => {
    fetchCandles(selected, timeframe);
  }, [selected, timeframe]);

  const ticker = tickers.find(t => t.symbol === selected) ?? tickers[0];
  const priceUp = candles.length > 1 && candles[candles.length - 1].close >= candles[candles.length - 2].close;
  const areaData = candles.map(c => ({ t: c.t, price: c.close, volume: c.volume }));

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold font-mono tracking-widest text-ares-amber glow-amber uppercase">Market Data</h1>
          <div className="flex items-center gap-3 mt-0.5">
            {liveMode ? (
              <span className="flex items-center gap-1 text-[9px] font-mono text-ares-green">
                <Radio size={8} className="animate-pulse" /> BINANCE LIVE — 5s updates
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[9px] font-mono text-ares-amber">
                <WifiOff size={8} /> SIMULATED{binanceError ? ` — ${binanceError}` : ''}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { fetchTickers(); fetchCandles(selected, timeframe); }} className="btn btn-ghost">
            <RefreshCw size={10} /> REFRESH
          </button>
          <div className="flex gap-1">
            {(['1m', '5m', '15m', '1h'] as const).map(tf => (
              <button key={tf} onClick={() => setTimeframe(tf)} className={`btn ${timeframe === tf ? 'btn-amber' : 'btn-ghost'} py-1 px-3`}>
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Ticker strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tickers.map(t => (
          <TickerCard key={t.symbol} {...t} selected={selected === t.symbol} onClick={() => setSelected(t.symbol)} />
        ))}
      </div>

      {/* Main chart */}
      <div className="panel p-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold font-mono text-ares-text">{selected}</span>
              <span className={`text-2xl font-bold font-mono tabular-nums ${priceUp ? 'text-ares-green' : 'text-ares-red'}`}>
                ${ticker?.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className={`flex items-center gap-1 text-sm font-mono font-bold ${(ticker?.change ?? 0) >= 0 ? 'text-ares-green' : 'text-ares-red'}`}>
                {(ticker?.change ?? 0) >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {(ticker?.change ?? 0) >= 0 ? '+' : ''}{(ticker?.change ?? 0).toFixed(2)}%
              </span>
            </div>
            <div className="flex gap-4 mt-1 text-[10px] font-mono text-ares-textMuted">
              <span>24h Vol: {ticker?.vol}</span>
              {(ticker?.high ?? 0) > 0 && <span>H: ${ticker!.high.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>}
              {(ticker?.low ?? 0) > 0 && <span>L: ${ticker!.low.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>}
              <span>TF: {timeframe}</span>
            </div>
          </div>
          <div className={`px-3 py-1.5 rounded border text-[10px] font-mono font-bold ${priceUp ? 'text-ares-green border-ares-green/30 bg-ares-green/5' : 'text-ares-red border-ares-red/30 bg-ares-red/5'}`}>
            {priceUp ? '▲ BULLISH' : '▼ BEARISH'}
          </div>
        </div>

        {loadingCandles ? (
          <div className="flex items-center justify-center h-[220px]">
            <RefreshCw size={16} className="text-ares-amber animate-spin" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={areaData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={priceUp ? '#22d3a0' : '#f43f5e'} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={priceUp ? '#22d3a0' : '#f43f5e'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#162236" />
              <XAxis dataKey="t" stroke="#334155" tick={{ fontSize: 9, fontFamily: 'monospace' }} interval={9} />
              <YAxis stroke="#334155" tick={{ fontSize: 9, fontFamily: 'monospace' }} domain={['auto', 'auto']} tickFormatter={v => `$${Number(v).toFixed(0)}`} />
              <Tooltip
                contentStyle={{ background: '#0d1423', border: '1px solid #1e3355', borderRadius: 4, fontSize: 10, fontFamily: 'monospace' }}
                formatter={(v: any) => [`$${Number(v).toFixed(2)}`, 'Price']}
              />
              <Area type="monotone" dataKey="price" stroke={priceUp ? '#22d3a0' : '#f43f5e'} strokeWidth={1.5} fill="url(#priceGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Volume chart */}
      <div className="panel p-4">
        <div className="text-[10px] font-mono font-bold tracking-widest text-ares-textSub mb-3">
          VOLUME ({timeframe}) {liveMode && <span className="text-ares-green ml-2">● REAL</span>}
        </div>
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={areaData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#162236" vertical={false} />
            <XAxis dataKey="t" stroke="#334155" tick={{ fontSize: 9, fontFamily: 'monospace' }} interval={9} />
            <YAxis stroke="#334155" tick={{ fontSize: 9, fontFamily: 'monospace' }} />
            <Tooltip contentStyle={{ background: '#0d1423', border: '1px solid #1e3355', borderRadius: 4, fontSize: 10, fontFamily: 'monospace' }} formatter={(v: any) => [Number(v).toFixed(2), 'Volume']} />
            <Bar dataKey="volume" fill="#38bdf8" opacity={0.7} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
