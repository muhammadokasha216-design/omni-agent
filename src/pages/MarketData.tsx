import { useEffect, useState, useRef } from 'react';
import { BarChart2, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PanelHeader, Empty } from '../components/ui';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  Legend, ReferenceLine,
} from 'recharts';

interface PricePoint { t: string; open: number; close: number; high: number; low: number; volume: number; }

const PAIRS = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT'];
const BASE_PRICES: Record<string, number> = {
  'BTC/USDT': 67842, 'ETH/USDT': 3847, 'BNB/USDT': 567, 'SOL/USDT': 172,
};

function genCandles(symbol: string, count = 60): PricePoint[] {
  let price = BASE_PRICES[symbol] ?? 100;
  return Array.from({ length: count }, (_, i) => {
    const change = price * (Math.random() - 0.49) * 0.006;
    const open = price;
    price += change;
    const close = price;
    const spread = Math.abs(change) * 1.5;
    return {
      t: `${i}m`,
      open,
      close,
      high: Math.max(open, close) + spread,
      low:  Math.min(open, close) - spread,
      volume: Math.random() * 500 + 100,
    };
  });
}

interface TickerCardProps {
  symbol: string;
  price: number;
  change: number;
  vol: string;
  selected: boolean;
  onClick: () => void;
}
function TickerCard({ symbol, price, change, vol, selected, onClick }: TickerCardProps) {
  const pos = change >= 0;
  return (
    <button
      onClick={onClick}
      className={`panel p-3 text-left card-hover transition-all duration-150 w-full
        ${selected ? 'border-ares-borderGlow' : ''}`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-mono font-bold text-ares-textSub">{symbol}</span>
        <span className={`text-[9px] font-mono font-bold ${pos ? 'text-ares-green' : 'text-ares-red'}`}>
          {pos ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
        </span>
      </div>
      <div className={`text-base font-bold font-mono tabular-nums ${pos ? 'text-ares-text' : 'text-ares-text'}`}>
        ${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: price < 1 ? 4 : 2 })}
      </div>
      <div className="text-[9px] font-mono text-ares-textMuted mt-0.5">Vol: {vol}</div>
    </button>
  );
}

export default function MarketData() {
  const [selected, setSelected] = useState('BTC/USDT');
  const [tickers, setTickers] = useState(() =>
    PAIRS.map(sym => ({
      symbol: sym,
      price: BASE_PRICES[sym],
      change: (Math.random() - 0.45) * 6,
      vol: `$${(Math.random() * 14 + 1).toFixed(1)}B`,
    }))
  );
  const [candles, setCandles] = useState<PricePoint[]>(() => genCandles('BTC/USDT'));
  const [timeframe, setTimeframe] = useState<'1m' | '5m' | '15m' | '1h'>('1m');
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setCandles(genCandles(selected));
    tickRef.current = setInterval(() => {
      setTickers(prev => prev.map(t => ({
        ...t,
        price: t.price * (1 + (Math.random() - 0.5) * 0.0008),
        change: t.change + (Math.random() - 0.5) * 0.05,
      })));
      setCandles(prev => {
        const last = prev[prev.length - 1];
        const newPrice = last.close * (1 + (Math.random() - 0.5) * 0.003);
        const spread = Math.abs(newPrice - last.close) * 1.5;
        const newCandle: PricePoint = {
          t: `${prev.length}m`,
          open: last.close,
          close: newPrice,
          high: Math.max(last.close, newPrice) + spread,
          low:  Math.min(last.close, newPrice) - spread,
          volume: Math.random() * 500 + 100,
        };
        return [...prev.slice(-59), newCandle];
      });
    }, 2000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [selected]);

  const ticker = tickers.find(t => t.symbol === selected)!;
  const priceUp = candles.length > 1 && candles[candles.length - 1].close >= candles[candles.length - 2].close;

  // Build area data from candles
  const areaData = candles.map(c => ({ t: c.t, price: c.close, volume: c.volume }));

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold font-mono tracking-widest text-ares-amber glow-amber uppercase">Market Data</h1>
          <p className="text-[10px] font-mono text-ares-textMuted mt-0.5">Real-time streaming — 2s update interval</p>
        </div>
        <div className="flex gap-1">
          {(['1m', '5m', '15m', '1h'] as const).map(tf => (
            <button key={tf} onClick={() => setTimeframe(tf)} className={`btn ${timeframe === tf ? 'btn-amber' : 'btn-ghost'} py-1 px-3`}>
              {tf}
            </button>
          ))}
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
              <span>Timeframe: {timeframe}</span>
            </div>
          </div>
          <div className={`px-3 py-1.5 rounded border text-[10px] font-mono font-bold ${priceUp ? 'text-ares-green border-ares-green/30 bg-ares-green/5' : 'text-ares-red border-ares-red/30 bg-ares-red/5'}`}>
            {priceUp ? '▲ BULLISH' : '▼ BEARISH'}
          </div>
        </div>

        {/* Price area chart */}
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
      </div>

      {/* Volume chart */}
      <div className="panel p-4">
        <div className="text-[10px] font-mono font-bold tracking-widest text-ares-textSub mb-3">VOLUME ({timeframe})</div>
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={areaData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#162236" vertical={false} />
            <XAxis dataKey="t" stroke="#334155" tick={{ fontSize: 9, fontFamily: 'monospace' }} interval={9} />
            <YAxis stroke="#334155" tick={{ fontSize: 9, fontFamily: 'monospace' }} />
            <Tooltip contentStyle={{ background: '#0d1423', border: '1px solid #1e3355', borderRadius: 4, fontSize: 10, fontFamily: 'monospace' }} formatter={(v: any) => [Number(v).toFixed(0), 'Volume']} />
            <Bar dataKey="volume" fill="#38bdf8" opacity={0.7} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
