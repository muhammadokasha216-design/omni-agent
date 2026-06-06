import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BINANCE_BASE = "https://api.binance.com";
const SYMBOLS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT"];

// Map Binance symbol -> display symbol
const DISPLAY: Record<string, string> = {
  BTCUSDT: "BTC/USDT",
  ETHUSDT: "ETH/USDT",
  BNBUSDT: "BNB/USDT",
  SOLUSDT: "SOL/USDT",
};

interface Ticker24h {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  volume: string;
  quoteVolume: string;
  highPrice: string;
  lowPrice: string;
  openPrice: string;
}

interface KlineRow {
  t: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "tickers";
    const symbol = (url.searchParams.get("symbol") ?? "BTCUSDT").toUpperCase();
    const interval = url.searchParams.get("interval") ?? "1m";
    const limit = parseInt(url.searchParams.get("limit") ?? "60");

    if (action === "tickers") {
      // Fetch 24h stats for all 4 pairs in one call
      const params = SYMBOLS.map(s => `symbol=${s}`).join("&");
      // Use the bulk ticker endpoint (more efficient)
      const res = await fetch(
        `${BINANCE_BASE}/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(SYMBOLS))}`,
        { headers: { "User-Agent": "ARES-Agent/3.0" } }
      );

      if (!res.ok) {
        throw new Error(`Binance API error: ${res.status}`);
      }

      const rows: Ticker24h[] = await res.json();
      const tickers = rows.map(r => ({
        symbol: DISPLAY[r.symbol] ?? r.symbol,
        price: parseFloat(r.lastPrice),
        change: parseFloat(r.priceChangePercent),
        vol: formatVol(parseFloat(r.quoteVolume)),
        high: parseFloat(r.highPrice),
        low: parseFloat(r.lowPrice),
        open: parseFloat(r.openPrice),
      }));

      return new Response(JSON.stringify({ ok: true, tickers }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "klines") {
      // Fetch real candlestick data
      const klineRes = await fetch(
        `${BINANCE_BASE}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${Math.min(limit, 100)}`,
        { headers: { "User-Agent": "ARES-Agent/3.0" } }
      );

      if (!klineRes.ok) {
        throw new Error(`Binance klines error: ${klineRes.status}`);
      }

      // Binance kline format: [openTime, open, high, low, close, volume, closeTime, ...]
      const raw: any[][] = await klineRes.json();
      const candles: KlineRow[] = raw.map((k, i) => ({
        t: formatTime(k[0], interval),
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
      }));

      return new Response(JSON.stringify({ ok: true, candles }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "price") {
      // Quick single price lookup
      const res = await fetch(
        `${BINANCE_BASE}/api/v3/ticker/price?symbol=${symbol}`,
        { headers: { "User-Agent": "ARES-Agent/3.0" } }
      );
      if (!res.ok) throw new Error(`Binance price error: ${res.status}`);
      const data = await res.json();
      return new Response(
        JSON.stringify({ ok: true, symbol, price: parseFloat(data.price) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: false, error: "Unknown action. Use: tickers | klines | price" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function formatVol(quoteVol: number): string {
  if (quoteVol >= 1e9) return `$${(quoteVol / 1e9).toFixed(1)}B`;
  if (quoteVol >= 1e6) return `$${(quoteVol / 1e6).toFixed(1)}M`;
  return `$${(quoteVol / 1e3).toFixed(1)}K`;
}

function formatTime(ts: number, interval: string): string {
  const d = new Date(ts);
  if (interval.endsWith("m")) return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  if (interval.endsWith("h")) return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}h`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
