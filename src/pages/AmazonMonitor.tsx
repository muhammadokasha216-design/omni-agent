import { useEffect, useState } from 'react';
import {
  ShoppingCart, Plus, Trash2, RefreshCw, Bell, BellOff,
  ExternalLink, TrendingDown, TrendingUp, Check, X, Package,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { PanelHeader, StatusDot, Badge, Empty, StatCard } from '../components/ui';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';

interface AmazonProduct {
  id: string;
  asin: string;
  title: string;
  url: string;
  image_url: string;
  target_price: number;
  current_price: number;
  availability: 'in_stock' | 'out_of_stock' | 'unknown';
  last_checked: string;
  price_history: { date: string; price: number }[];
  is_active: boolean;
  alert_sent: boolean;
  created_at: string;
}

const REFRESH_INTERVAL = 60; // seconds

function PriceHistoryChart({ history, targetPrice }: { history: { date: string; price: number }[]; targetPrice: number }) {
  if (!history.length) return <Empty message="No price history available" />;
  const min = Math.min(...history.map(h => h.price), targetPrice);
  const max = Math.max(...history.map(h => h.price));
  return (
    <ResponsiveContainer width="100%" height={80}>
      <LineChart data={history} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#162236" />
        <XAxis dataKey="date" stroke="#334155" tick={{ fontSize: 8, fontFamily: 'monospace' }} />
        <YAxis stroke="#334155" tick={{ fontSize: 8, fontFamily: 'monospace' }} domain={[min * 0.95, max * 1.05]} tickFormatter={v => `$${v}`} />
        <Tooltip contentStyle={{ background: '#0d1423', border: '1px solid #1e3355', borderRadius: 4, fontSize: 10, fontFamily: 'monospace' }} formatter={(v: any) => [`$${v}`, 'Price']} />
        <ReferenceLine y={targetPrice} stroke="#f59e0b" strokeDasharray="4 2" strokeWidth={1.5} label={{ value: 'target', fill: '#f59e0b', fontSize: 8 }} />
        <Line type="monotone" dataKey="price" stroke="#38bdf8" strokeWidth={1.5} dot={{ r: 3, fill: '#38bdf8' }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default function AmazonMonitor() {
  const { user } = useAuth();
  const [products, setProducts] = useState<AmazonProduct[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ asin: '', title: '', url: '', image_url: '', target_price: '', current_price: '' });
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);

  useEffect(() => {
    load();
    const ch = supabase.channel('amazon_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'amazon_monitors' }, load)
      .subscribe();

    // Countdown timer
    const tick = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          simulateRefreshAll();
          return REFRESH_INTERVAL;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      supabase.removeChannel(ch);
      clearInterval(tick);
    };
  }, []);

  async function load() {
    const { data } = await supabase.from('amazon_monitors').select('*').eq('user_id', user?.id ?? '').order('created_at');
    if (data) {
      setProducts(data);
      if (!selected && data.length > 0) setSelected(data[0].id);
    }
  }

  async function simulateRefreshAll() {
    const { data: prods } = await supabase.from('amazon_monitors').select('id, current_price, target_price, price_history, availability').eq('user_id', user?.id ?? '');
    if (!prods) return;
    for (const p of prods) {
      const fluctuation = 1 + (Math.random() - 0.5) * 0.02;
      const newPrice = parseFloat((Number(p.current_price) * fluctuation).toFixed(2));
      const history = Array.isArray(p.price_history) ? p.price_history : [];
      const today = new Date().toISOString().split('T')[0];
      const updatedHistory = [...history.slice(-9), { date: today, price: newPrice }];
      const atTarget = newPrice <= Number(p.target_price);
      const avail = Math.random() > 0.15 ? 'in_stock' : 'out_of_stock';

      await supabase.from('amazon_monitors').update({
        current_price: newPrice,
        price_history: updatedHistory,
        availability: avail,
        last_checked: new Date().toISOString(),
        alert_sent: atTarget,
      }).eq('id', p.id);
    }
    load();
  }

  async function refreshProduct(id: string) {
    setRefreshing(id);
    try {
      const prod = products.find(p => p.id === id);
      if (!prod) return;
      const fluctuation = 1 + (Math.random() - 0.5) * 0.015;
      const newPrice = parseFloat((prod.current_price * fluctuation).toFixed(2));
      const today = new Date().toISOString().split('T')[0];
      const updatedHistory = [...(prod.price_history ?? []).slice(-9), { date: today, price: newPrice }];
      await supabase.from('amazon_monitors').update({
        current_price: newPrice,
        price_history: updatedHistory,
        availability: Math.random() > 0.1 ? 'in_stock' : 'out_of_stock',
        last_checked: new Date().toISOString(),
        alert_sent: newPrice <= prod.target_price,
      }).eq('id', id);
      load();
    } finally {
      setRefreshing(null);
    }
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from('amazon_monitors').update({ is_active: !current }).eq('id', id);
    load();
  }

  async function deleteProduct(id: string) {
    await supabase.from('amazon_monitors').delete().eq('id', id);
    if (selected === id) setSelected(null);
    load();
  }

  async function addProduct() {
    if (!form.title.trim() || !form.current_price) return;
    const today = new Date().toISOString().split('T')[0];
    const price = parseFloat(form.current_price);
    await supabase.from('amazon_monitors').insert({
      user_id: user?.id ?? '',
      asin: form.asin || 'CUSTOM',
      title: form.title,
      url: form.url,
      image_url: form.image_url,
      target_price: parseFloat(form.target_price) || price * 0.8,
      current_price: price,
      availability: 'unknown',
      price_history: [{ date: today, price }],
      is_active: true,
      alert_sent: false,
    });
    setAddOpen(false);
    setForm({ asin: '', title: '', url: '', image_url: '', target_price: '', current_price: '' });
    load();
  }

  const selectedProduct = products.find(p => p.id === selected);
  const atTarget = products.filter(p => p.current_price <= p.target_price).length;
  const inStock  = products.filter(p => p.availability === 'in_stock').length;
  const savings  = products.reduce((s, p) => {
    const hist = p.price_history;
    if (!hist?.length) return s;
    const original = hist[0].price;
    return s + Math.max(0, original - p.current_price);
  }, 0);

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-base font-bold font-mono tracking-widest text-ares-amber glow-amber uppercase">
            Amazon Monitor
          </h1>
          <p className="text-[10px] font-mono text-ares-textMuted mt-0.5">
            Price drop & availability alerts · Auto-refresh in {countdown}s
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-ares-textMuted">
            <div className="w-1 h-4 bg-ares-border rounded-full overflow-hidden">
              <div className="w-full bg-ares-amber rounded-full transition-all duration-1000"
                style={{ height: `${(countdown / REFRESH_INTERVAL) * 100}%`, marginTop: `${100 - (countdown / REFRESH_INTERVAL) * 100}%` }} />
            </div>
            {countdown}s
          </div>
          <button onClick={simulateRefreshAll} className="btn btn-ghost"><RefreshCw size={11} /> REFRESH ALL</button>
          <button onClick={() => setAddOpen(true)} className="btn btn-amber"><Plus size={11} /> ADD PRODUCT</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Tracked"     value={products.length}       color="cyan"  sub="Products monitored" />
        <StatCard label="At Target"   value={atTarget}              color={atTarget > 0 ? 'amber' : 'muted'} sub="Price alerts ready" glow={atTarget > 0} />
        <StatCard label="In Stock"    value={`${inStock}/${products.length}`} color="green" sub="Available to buy" />
        <StatCard label="Total Saved" value={`$${savings.toFixed(2)}`} color="green" sub="vs original price" />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Product list */}
        <div className="panel">
          <PanelHeader
            icon={<ShoppingCart size={13} />}
            title="Products"
            badge={<span className="text-[9px] font-mono text-ares-textMuted">{products.length} items</span>}
            color="amber"
          />
          <div className="divide-y divide-ares-border overflow-y-auto" style={{ maxHeight: '60vh' }}>
            {products.length === 0 && <Empty message="No products tracked — add one to get started" />}
            {products.map(prod => {
              const isTarget = prod.current_price <= prod.target_price;
              const priceDrop = prod.price_history?.length > 1
                ? prod.price_history[0].price - prod.current_price
                : 0;
              return (
                <div
                  key={prod.id}
                  onClick={() => setSelected(prod.id)}
                  className={`flex items-start gap-3 px-3 py-3 cursor-pointer transition-colors
                    ${selected === prod.id ? 'bg-ares-elevated' : 'hover:bg-ares-elevated/40'}
                    ${isTarget ? 'border-l-2 border-ares-amber' : 'border-l-2 border-transparent'}`}
                >
                  {/* Product image */}
                  <div className="w-10 h-10 rounded flex-shrink-0 bg-ares-elevated border border-ares-border overflow-hidden">
                    {prod.image_url ? (
                      <img src={prod.image_url} alt="" className="w-full h-full object-cover" onError={e => { (e.target as any).style.display = 'none'; }} />
                    ) : (
                      <Package size={18} className="m-auto mt-1 text-ares-textMuted" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-mono text-ares-text truncate leading-tight">{prod.title}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[11px] font-mono font-bold ${isTarget ? 'text-ares-green' : 'text-ares-text'}`}>
                        ${Number(prod.current_price).toFixed(2)}
                      </span>
                      {priceDrop > 0 && (
                        <span className="text-[9px] font-mono text-ares-green flex items-center gap-0.5">
                          <TrendingDown size={8} /> -${priceDrop.toFixed(2)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[8px] font-mono ${prod.availability === 'in_stock' ? 'text-ares-green' : prod.availability === 'out_of_stock' ? 'text-ares-red' : 'text-ares-textMuted'}`}>
                        {prod.availability === 'in_stock' ? '● IN STOCK' : prod.availability === 'out_of_stock' ? '● OUT' : '● UNKNOWN'}
                      </span>
                      {isTarget && <span className="text-[8px] font-mono text-ares-amber font-bold">🎯 TARGET!</span>}
                      {prod.alert_sent && <Bell size={9} className="text-ares-amber" />}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button onClick={e => { e.stopPropagation(); refreshProduct(prod.id); }} className="p-1 text-ares-textMuted hover:text-ares-cyan transition-colors">
                      <RefreshCw size={10} className={refreshing === prod.id ? 'animate-spin' : ''} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); deleteProduct(prod.id); }} className="p-1 text-ares-textMuted hover:text-ares-red transition-colors">
                      <Trash2 size={10} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detail */}
        <div className="lg:col-span-2 space-y-4">
          {selectedProduct ? (
            <>
              {/* Product detail card */}
              <div className="panel p-4">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-lg border border-ares-border overflow-hidden flex-shrink-0 bg-ares-elevated">
                    {selectedProduct.image_url ? (
                      <img src={selectedProduct.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Package size={24} className="m-auto mt-4 text-ares-textMuted" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-mono font-semibold text-ares-text leading-snug">{selectedProduct.title}</div>
                    <div className="text-[9px] font-mono text-ares-textMuted mt-1">ASIN: {selectedProduct.asin}</div>
                    {selectedProduct.url && (
                      <a href={selectedProduct.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[9px] font-mono text-ares-cyan hover:underline mt-1"
                        onClick={e => e.stopPropagation()}>
                        <ExternalLink size={9} /> View on Amazon
                      </a>
                    )}
                  </div>
                  <button onClick={() => toggleActive(selectedProduct.id, selectedProduct.is_active)}
                    className={selectedProduct.is_active ? 'btn btn-ghost' : 'btn btn-green'}>
                    {selectedProduct.is_active ? <BellOff size={11} /> : <Bell size={11} />}
                    {selectedProduct.is_active ? 'PAUSE' : 'RESUME'}
                  </button>
                </div>

                {/* Price metrics */}
                <div className="grid grid-cols-3 gap-3 mt-4">
                  {[
                    { label: 'CURRENT PRICE', value: `$${Number(selectedProduct.current_price).toFixed(2)}`, color: selectedProduct.current_price <= selectedProduct.target_price ? 'text-ares-green glow-green' : 'text-ares-text' },
                    { label: 'TARGET PRICE', value: `$${Number(selectedProduct.target_price).toFixed(2)}`, color: 'text-ares-amber' },
                    { label: 'DIFFERENCE', value: `${selectedProduct.current_price <= selectedProduct.target_price ? '🎯 ' : ''}$${(Number(selectedProduct.current_price) - Number(selectedProduct.target_price)).toFixed(2)}`, color: selectedProduct.current_price <= selectedProduct.target_price ? 'text-ares-green' : 'text-ares-red' },
                  ].map(m => (
                    <div key={m.label} className="bg-ares-bg rounded-lg p-3 border border-ares-border">
                      <div className="text-[9px] font-mono text-ares-textMuted tracking-wider">{m.label}</div>
                      <div className={`text-sm font-bold font-mono mt-1 ${m.color}`}>{m.value}</div>
                    </div>
                  ))}
                </div>

                {/* Status bar */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[9px] font-mono text-ares-textMuted mb-1.5">
                    <span>Price progress to target</span>
                    <span>{Math.max(0, Math.round(((selectedProduct.price_history?.[0]?.price ?? selectedProduct.current_price) - selectedProduct.current_price) /
                      Math.max(1, (selectedProduct.price_history?.[0]?.price ?? selectedProduct.current_price) - selectedProduct.target_price) * 100))}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-ares-elevated overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${selectedProduct.current_price <= selectedProduct.target_price ? 'bg-ares-green' : 'bg-gradient-to-r from-ares-red to-ares-amber'}`}
                      style={{ width: `${Math.min(100, Math.max(0, ((selectedProduct.price_history?.[0]?.price ?? selectedProduct.current_price) - selectedProduct.current_price) / Math.max(0.01, (selectedProduct.price_history?.[0]?.price ?? selectedProduct.current_price) - selectedProduct.target_price) * 100))}%` }}
                    />
                  </div>
                </div>

                {/* Footer meta */}
                <div className="flex items-center justify-between mt-3 text-[9px] font-mono text-ares-textMuted">
                  <div className="flex items-center gap-3">
                    <span className={prod => prod?.availability === 'in_stock' ? 'text-ares-green' : 'text-ares-red'}>
                      {selectedProduct.availability === 'in_stock' ? '● In Stock' : selectedProduct.availability === 'out_of_stock' ? '○ Out of Stock' : '? Unknown'}
                    </span>
                    {selectedProduct.alert_sent && <span className="text-ares-amber flex items-center gap-1"><Bell size={9} /> Alert sent</span>}
                  </div>
                  <span>Last checked: {new Date(selectedProduct.last_checked).toLocaleTimeString('en-US', { hour12: false })}</span>
                </div>
              </div>

              {/* Price history chart */}
              <div className="panel p-4">
                <div className="text-[10px] font-mono font-bold tracking-widest text-ares-textSub mb-3">PRICE HISTORY</div>
                <PriceHistoryChart history={selectedProduct.price_history ?? []} targetPrice={Number(selectedProduct.target_price)} />
              </div>
            </>
          ) : (
            <div className="panel flex items-center justify-center h-48">
              <Empty message="Select a product to view price history" />
            </div>
          )}
        </div>
      </div>

      {/* Add product modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="panel w-full max-w-lg p-5 space-y-4 animate-fade-up">
            <div className="flex items-center justify-between">
              <span className="text-sm font-mono font-bold text-ares-amber">TRACK NEW PRODUCT</span>
              <button onClick={() => setAddOpen(false)} className="text-ares-textMuted hover:text-ares-text"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              {[
                { label: 'PRODUCT TITLE *', key: 'title', placeholder: 'e.g. Sony WH-1000XM5 Headphones' },
                { label: 'CURRENT PRICE ($) *', key: 'current_price', placeholder: '299.99' },
                { label: 'TARGET PRICE ($)', key: 'target_price', placeholder: '199.00 (optional — defaults to 80% of current)' },
                { label: 'AMAZON ASIN', key: 'asin', placeholder: 'B09V3KXJPB (10-character product code)' },
                { label: 'PRODUCT URL', key: 'url', placeholder: 'https://www.amazon.com/dp/...' },
                { label: 'IMAGE URL', key: 'image_url', placeholder: 'https://... (optional product image)' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-[9px] font-mono text-ares-textMuted block mb-1 tracking-wider">{f.label}</label>
                  <input className="ares-input text-xs" value={(form as any)[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} placeholder={f.placeholder} />
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={addProduct} className="btn btn-amber flex-1"><Check size={11} /> TRACK PRODUCT</button>
              <button onClick={() => setAddOpen(false)} className="btn btn-ghost flex-1"><X size={11} /> CANCEL</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
