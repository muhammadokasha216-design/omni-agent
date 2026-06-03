import { useEffect, useState, useRef, useCallback } from 'react';
import { Terminal, TrendingUp, Cpu, LayoutDashboard, Wifi, WifiOff, Menu, X, Zap, Activity, Plus, Trash2, Edit3, RefreshCw, CheckCircle, XCircle, Clock, ChevronRight, Copy, Send, Loader, TrendingDown, Play, PauseCircle, AlertTriangle, Eye, EyeOff, Key, Globe, Save, Smartphone } from 'lucide-react';
import { supabase } from './lib/supabase';
import { SessionManager } from './lib/session';
import type { Device, CommandRecord, CotStep, TradingHook, TradeAction } from './lib/types';

type Page = 'overview' | 'terminal' | 'trading' | 'devices';

// ============ Layout ============
function Layout({ page, onNavigate, children, onlineCount, totalCount }: { page: Page; onNavigate: (p: Page) => void; children: React.ReactNode; onlineCount: number; totalCount: number }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
  const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const NAV = [
    { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard },
    { id: 'terminal' as const, label: 'AI Terminal', icon: Terminal },
    { id: 'trading' as const, label: 'Trading', icon: TrendingUp },
    { id: 'devices' as const, label: 'Devices', icon: Cpu },
  ];

  return (
    <div className="flex h-screen bg-ose-bg overflow-hidden">
      <aside className={`fixed inset-y-0 left-0 z-40 w-60 flex-shrink-0 flex flex-col bg-ose-surface border-r border-ose-border transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0`}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-ose-border">
          <div className="relative">
            <div className="w-8 h-8 rounded-sm bg-ose-elevated border border-ose-borderLit flex items-center justify-center">
              <Zap size={16} className="text-ose-cyan" />
            </div>
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-ose-green status-online" />
          </div>
          <div>
            <div className="text-xs font-bold tracking-widest text-ose-cyan glow-cyan font-mono">OSE</div>
            <div className="text-[10px] text-ose-textMuted font-mono tracking-wider">OMNI-SYSTEM v2.0</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(item => {
            const active = page === item.id;
            const Icon = item.icon;
            return (
              <button key={item.id} onClick={() => { onNavigate(item.id); setMobileOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-all ${active ? 'bg-ose-elevated border border-ose-borderLit text-ose-cyan' : 'text-ose-textSub hover:text-ose-text hover:bg-ose-elevated border border-transparent'}`}>
                {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-ose-cyan rounded-r" />}
                <Icon size={16} />
                <span className="font-mono tracking-wide text-xs">{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="px-4 py-3 border-t border-ose-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono text-ose-textMuted tracking-wider uppercase">Agents</span>
            <span className="text-[10px] font-mono text-ose-textSub">{onlineCount}/{totalCount}</span>
          </div>
          <div className="h-1 rounded-full bg-ose-elevated overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-ose-cyan to-ose-green transition-all" style={{ width: totalCount > 0 ? `${(onlineCount / totalCount) * 100}%` : '0%' }} />
          </div>
        </div>
        <div className="px-4 py-3 border-t border-ose-border">
          <div className="flex items-center gap-2">
            <Activity size={10} className="text-ose-textMuted" />
            <div>
              <div className="text-[11px] font-mono text-ose-cyan">{timeStr}</div>
              <div className="text-[10px] font-mono text-ose-textMuted">{dateStr}</div>
            </div>
          </div>
        </div>
      </aside>

      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex items-center justify-between px-4 py-3 border-b border-ose-border bg-ose-surface/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <button className="lg:hidden text-ose-textSub hover:text-ose-text p-1" onClick={() => setMobileOpen(true)}>
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-ose-textMuted">//</span>
              <span className="text-xs font-mono text-ose-text font-medium">{NAV.find(n => n.id === page)?.label ?? 'OSE'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-mono text-ose-textMuted tabular-nums">
            <span className="w-1.5 h-1.5 rounded-full bg-ose-green status-online inline-block" />
            <span className="hidden sm:inline">SYSTEM NOMINAL</span>
            <span>{timeStr}</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}

// ============ Overview ============
function Overview() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [commands, setCommands] = useState<CommandRecord[]>([]);
  const [hooks, setHooks] = useState<TradingHook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [devRes, cmdRes, hooksRes] = await Promise.all([
      supabase.from('devices').select('*').order('created_at'),
      supabase.from('command_history').select('*').order('created_at', { ascending: false }).limit(10),
      supabase.from('trading_hooks').select('*').order('created_at'),
    ]);
    if (devRes.data) setDevices(devRes.data);
    if (cmdRes.data) setCommands(cmdRes.data);
    if (hooksRes.data) setHooks(hooksRes.data);
    setLoading(false);
  }

  const onlineDevices = devices.filter(d => d.is_active).length;
  const activeHooks = hooks.filter(h => h.is_active).length;
  const successCmds = commands.filter(c => c.status === 'success').length;
  const totalCmds = commands.length;

  return (
    <div className="p-4 space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-lg font-bold font-mono text-ose-text tracking-wide">SYSTEM <span className="text-ose-cyan glow-cyan">OVERVIEW</span></h1>
          <p className="text-xs text-ose-textMuted font-mono mt-0.5">Real-time operational status — all subsystems</p>
        </div>
        <button onClick={loadData} className="flex items-center gap-1.5 text-xs font-mono text-ose-textSub hover:text-ose-cyan border border-ose-border hover:border-ose-cyanDim px-3 py-1.5 rounded transition-all">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          REFRESH
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'AGENTS ONLINE', value: `${onlineDevices}/${devices.length}`, icon: Cpu, color: 'cyan' },
          { label: 'COMMANDS ISSUED', value: totalCmds, icon: Terminal, color: 'cyan' },
          { label: 'TRADING HOOKS', value: activeHooks, icon: TrendingUp, color: 'amber' },
          { label: 'SUCCESS RATE', value: totalCmds > 0 ? `${Math.round((successCmds / totalCmds) * 100)}%` : '—', icon: Activity, color: 'green' },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className={`bg-ose-surface border border-ose-border rounded-lg p-4 card-hover relative overflow-hidden border-opacity-30`}>
              <div className="absolute top-0 right-0 w-16 h-16 opacity-5">
                <Icon size={64} />
              </div>
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2 rounded bg-ose-elevated border border-opacity-30`}>
                  <Icon size={14} />
                </div>
              </div>
              <div className={`text-2xl font-bold font-mono mb-1`}>{stat.value}</div>
              <div className="text-xs text-ose-textMuted font-mono tracking-wide">{stat.label}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-ose-surface border border-ose-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-ose-border">
            <div className="flex items-center gap-2">
              <Cpu size={14} className="text-ose-cyan" />
              <span className="text-xs font-mono text-ose-text tracking-wider">REGISTERED AGENTS</span>
            </div>
            <span className="text-[10px] font-mono text-ose-textMuted">{devices.length} total</span>
          </div>
          <div className="divide-y divide-ose-border">
            {devices.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-xs font-mono text-ose-textMuted">No agents registered</p>
              </div>
            ) : (
              devices.map(device => (
                <div key={device.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${device.is_active ? 'bg-ose-green status-online' : 'bg-ose-textMuted'}`} />
                    <div>
                      <div className="text-xs font-mono text-ose-text">{device.name}</div>
                      <div className="text-[10px] font-mono text-ose-textMuted capitalize">{device.type} agent</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-[10px] font-mono ${device.is_active ? 'text-ose-green' : 'text-ose-textMuted'}`}>
                      {device.is_active ? 'ONLINE' : 'OFFLINE'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-ose-surface border border-ose-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-ose-border">
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-ose-cyan" />
              <span className="text-xs font-mono text-ose-text tracking-wider">COMMAND FEED</span>
            </div>
          </div>
          <div className="divide-y divide-ose-border">
            {commands.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-xs font-mono text-ose-textMuted">No commands issued yet</p>
              </div>
            ) : (
              commands.slice(0, 6).map(c => (
                <div key={c.id} className="flex items-start gap-3 px-4 py-2.5">
                  <div className="mt-0.5 flex-shrink-0">
                    {c.status === 'success' && <CheckCircle size={12} className="text-ose-green" />}
                    {c.status === 'error' && <XCircle size={12} className="text-ose-red" />}
                    {c.status !== 'success' && c.status !== 'error' && <Clock size={12} className="text-ose-amber" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-ose-text truncate">{c.raw_input || c.parsed_intent || 'Command'}</p>
                    <p className="text-[10px] font-mono text-ose-textMuted">{new Date(c.created_at).toLocaleTimeString('en-US', { hour12: false })}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ Terminal ============
function Terminal() {
  const [messages, setMessages] = useState<any[]>([
    { id: 'init', role: 'system', text: '— OSE AI Terminal initialized. Awaiting commands. —', timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }) },
    { id: 'welcome', role: 'agent', text: 'SYSTEM ONLINE. Command parsing and dispatch ready.', timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }) },
  ]);
  const [input, setInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [hooks, setHooks] = useState<TradingHook[]>([]);
  const [apiKey, setApiKey] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadContext();
    setApiKey(localStorage.getItem('ose_anthropic_key') ?? '');
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadContext() {
    const [devRes, hooksRes] = await Promise.all([
      supabase.from('devices').select('*').order('created_at'),
      supabase.from('trading_hooks').select('*').order('created_at'),
    ]);
    if (devRes.data) setDevices(devRes.data);
    if (hooksRes.data) setHooks(hooksRes.data);
  }

  const handleSubmit = useCallback(async () => {
    const raw = input.trim();
    if (!raw || processing) return;
    setInput('');
    setProcessing(true);

    const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
    const msgId = crypto.randomUUID();
    const agentId = crypto.randomUUID();

    setMessages(prev => [...prev, { id: msgId, role: 'user', text: raw, timestamp: ts }]);
    setMessages(prev => [...prev, { id: agentId, role: 'agent', text: 'Processing...', timestamp: ts, status: 'pending' }]);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

      const res = await fetch(`${supabaseUrl}/functions/v1/process-command`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', 'X-Anthropic-Key': apiKey },
        body: JSON.stringify({ input: raw, devices: devices.map(d => ({ id: d.id, name: d.name, type: d.type, is_active: d.is_active })), trading_hooks: hooks.map(h => ({ id: h.id, label: h.label, symbol: h.symbol, action: h.action })) }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Edge function error');

      await supabase.from('command_history').insert({ raw_input: raw, parsed_intent: data.intent ?? '', target_device: data.target_device_id ?? null, payload: data.payload ?? {}, status: data.should_dispatch ? 'dispatched' : 'success', response: data.reply ?? '', latency_ms: data.latency_ms ?? 0, cot_steps: data.cot_steps ?? [] });

      setMessages(prev => prev.map(m => m.id === agentId ? { ...m, text: data.reply ?? 'Command processed.', status: data.should_dispatch ? 'dispatched' : 'success', latency_ms: data.latency_ms } : m));
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      setMessages(prev => prev.map(m => m.id === agentId ? { ...m, text: `ERROR: ${errMsg}`, status: 'error' } : m));
    } finally {
      setProcessing(false);
      inputRef.current?.focus();
    }
  }, [input, processing, devices, hooks, apiKey]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-ose-border bg-ose-surface/60">
        <span className="text-[11px] font-mono text-ose-textMuted tracking-wider">OSE TERMINAL v2.0 — {devices.length} agents</span>
        {!apiKey && <span className="text-[10px] font-mono text-ose-amber">API KEY NOT SET</span>}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.map(msg => (
          <div key={msg.id} className={`mb-3 ${msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}`}>
            <div className={`max-w-[85%] ${msg.role === 'user' ? '' : 'w-full max-w-full'}`}>
              {msg.role === 'agent' && <div className="flex items-center gap-2 mb-1">
                <Terminal size={10} className="text-ose-cyan" />
                <span className="text-[10px] font-mono text-ose-cyan">OSE</span>
                {msg.status === 'success' && <CheckCircle size={10} className="text-ose-green ml-auto" />}
                {msg.status === 'error' && <XCircle size={10} className="text-ose-red ml-auto" />}
              </div>}
              <div className={`rounded-lg px-4 py-3 ${msg.role === 'user' ? 'bg-ose-elevated border border-ose-borderLit' : 'bg-ose-surface border border-ose-border'}`}>
                <p className="text-sm font-mono text-ose-text">{msg.text}</p>
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 pb-4">
        <div className="flex items-end gap-2 border border-ose-border hover:border-ose-cyanDim rounded-lg bg-ose-elevated transition-all">
          <span className="text-ose-cyan font-mono text-sm pl-3 pb-3 pt-3 flex-shrink-0">›</span>
          <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSubmit())} placeholder="Issue command..." rows={1} style={{ resize: 'none' }} className="flex-1 bg-transparent text-sm font-mono text-ose-text placeholder-ose-textMuted py-3 pr-2 outline-none border-none min-h-[46px] max-h-[120px] overflow-y-auto" />
          <button onClick={handleSubmit} disabled={!input.trim() || processing} className="m-2 p-2 rounded bg-ose-cyan/10 border border-ose-cyan/30 text-ose-cyan hover:bg-ose-cyan/20 disabled:opacity-30">
            {processing ? <Loader size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ Trading ============
const MARKET_DATA = [
  { symbol: 'BTC/USDT', price: 67842.50, change: 2.34, high: 68900, low: 66200, volume: '14.2B' },
  { symbol: 'ETH/USDT', price: 3847.20, change: -1.12, high: 3920, low: 3780, volume: '6.8B' },
  { symbol: 'AAPL', price: 189.74, change: 0.87, high: 191.20, low: 188.50, volume: '52.4M' },
];

function Trading() {
  const [hooks, setHooks] = useState<TradingHook[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState<string | null>(null);

  useEffect(() => { loadHooks(); }, []);

  async function loadHooks() {
    setLoading(true);
    const { data } = await supabase.from('trading_hooks').select('*').order('created_at');
    if (data) setHooks(data);
    setLoading(false);
  }

  async function toggleHook(hook: TradingHook) {
    await supabase.from('trading_hooks').update({ is_active: !hook.is_active, updated_at: new Date().toISOString() }).eq('id', hook.id);
    loadHooks();
  }

  const executeHook = useCallback(async (hook: TradingHook) => {
    if (!hook.is_active) return;
    setExecuting(hook.id);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      await fetch(`${supabaseUrl}/functions/v1/dispatch-webhook`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint_url: hook.api_endpoint, api_key: hook.api_key, payload: { action: hook.action, symbol: hook.symbol, quantity: hook.quantity } }),
      });
      await supabase.from('trading_hooks').update({ last_executed: new Date().toISOString() }).eq('id', hook.id);
    } catch {
      // noop
    } finally {
      setExecuting(null);
    }
  }, []);

  return (
    <div className="p-4 space-y-5 max-w-4xl mx-auto">
      <h1 className="text-lg font-bold font-mono text-ose-text tracking-wide">TRADING <span className="text-ose-cyan">DASHBOARD</span></h1>

      <div>
        <span className="text-[11px] font-mono text-ose-textMuted tracking-wider">MARKET TICKERS</span>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
          {MARKET_DATA.map(d => (
            <div key={d.symbol} className="bg-ose-surface border border-ose-border rounded-lg p-3">
              <div className="text-xs font-mono font-bold text-ose-text">{d.symbol}</div>
              <div className="text-lg font-bold font-mono text-ose-text mt-1">${d.price.toFixed(2)}</div>
              <div className={`text-[10px] font-mono ${d.change >= 0 ? 'text-ose-green' : 'text-ose-red'}`}>
                {d.change >= 0 ? '+' : ''}{d.change}%
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <span className="text-[11px] font-mono text-ose-textMuted tracking-wider">TRADING HOOKS ({hooks.length})</span>
        <div className="space-y-2 mt-2">
          {hooks.length === 0 ? (
            <div className="bg-ose-surface border border-dashed border-ose-border rounded-lg px-6 py-10 text-center">
              <p className="text-sm font-mono text-ose-textMuted">No hooks configured</p>
            </div>
          ) : (
            hooks.map(hook => (
              <div key={hook.id} className="bg-ose-surface border border-ose-border rounded-lg p-3 flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${hook.is_active ? 'bg-ose-green' : 'bg-ose-textMuted'}`} />
                <div className="flex-1">
                  <span className="text-sm font-mono font-bold text-ose-text">{hook.label}</span>
                  <span className="text-[10px] font-mono text-ose-textMuted ml-2">{hook.action} {hook.symbol}</span>
                </div>
                <button onClick={() => toggleHook(hook)} className={`p-1 rounded border ${hook.is_active ? 'border-ose-green/30 text-ose-green' : 'border-ose-border text-ose-textMuted'}`}>
                  {hook.is_active ? <PauseCircle size={13} /> : <Play size={13} />}
                </button>
                <button onClick={() => executeHook(hook)} disabled={!hook.is_active || executing === hook.id} className="flex items-center gap-1 px-3 py-1.5 text-xs font-mono font-bold text-ose-bg bg-ose-cyan rounded hover:bg-ose-cyan/90 disabled:opacity-40">
                  {executing === hook.id ? <RefreshCw size={11} className="animate-spin" /> : <Zap size={11} />}
                  FIRE
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ============ DeviceManager ============
function DeviceManager() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [anthropicKey, setAnthropicKey] = useState('');
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [keySaved, setKeySaved] = useState(false);

  useEffect(() => {
    loadDevices();
    setAnthropicKey(localStorage.getItem('ose_anthropic_key') ?? '');
  }, []);

  async function loadDevices() {
    const { data } = await supabase.from('devices').select('*').order('created_at');
    if (data) setDevices(data);
  }

  function saveAnthropicKey() {
    localStorage.setItem('ose_anthropic_key', anthropicKey);
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 2000);
  }

  return (
    <div className="p-4 space-y-5 max-w-4xl mx-auto">
      <h1 className="text-lg font-bold font-mono text-ose-text tracking-wide">DEVICE <span className="text-ose-cyan">MANAGER</span></h1>

      <div className="bg-ose-surface border border-ose-border rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-ose-border">
          <Key size={13} className="text-ose-amber" />
          <span className="text-xs font-mono text-ose-text tracking-wider">AI ENGINE CONFIGURATION</span>
        </div>
        <div className="p-4">
          <p className="text-[11px] font-mono text-ose-textMuted mb-3">Set your Anthropic API key for full AI command processing.</p>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input value={anthropicKey} onChange={e => setAnthropicKey(e.target.value)} type={showAnthropicKey ? 'text' : 'password'} placeholder="sk-ant-api03-..." className="w-full bg-ose-elevated border border-ose-border rounded px-3 py-2 text-xs font-mono text-ose-text placeholder-ose-textMuted focus:border-ose-cyan outline-none" />
              <button onClick={() => setShowAnthropicKey(!showAnthropicKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ose-textMuted">
                {showAnthropicKey ? <EyeOff size={11} /> : <Eye size={11} />}
              </button>
            </div>
            <button onClick={saveAnthropicKey} className={`flex items-center gap-1.5 px-4 py-2 rounded text-xs font-mono font-bold transition-all ${keySaved ? 'bg-ose-green/20 text-ose-green border border-ose-green/30' : 'bg-ose-elevated text-ose-cyan border border-ose-cyanDim'}`}>
              {keySaved ? <CheckCircle size={12} /> : <Save size={12} />}
              {keySaved ? 'SAVED' : 'SAVE'}
            </button>
          </div>
        </div>
      </div>

      <div>
        <span className="text-[11px] font-mono text-ose-textMuted tracking-wider">REGISTERED AGENTS ({devices.length})</span>
        <div className="space-y-2 mt-2">
          {devices.map(device => (
            <div key={device.id} className="bg-ose-surface border border-ose-border rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${device.is_active ? 'bg-ose-green status-online' : 'bg-ose-textMuted'}`} />
                  <span className="text-sm font-mono font-bold text-ose-text">{device.name}</span>
                  <span className="text-[10px] font-mono text-ose-textMuted capitalize">{device.type}</span>
                </div>
                <span className={`text-[10px] font-mono ${device.is_active ? 'text-ose-green' : 'text-ose-textMuted'}`}>
                  {device.is_active ? '● ONLINE' : '○ OFFLINE'}
                </span>
              </div>
              <p className="text-[10px] font-mono text-ose-textMuted mt-1 truncate">{device.endpoint_url}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============ Main App ============
export default function App() {
  const [page, setPage] = useState<Page>('overview');
  const [onlineCount, setOnlineCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializeSession();
  }, []);

  async function initializeSession() {
    try {
      await SessionManager.initialize();
      loadDeviceCounts();
      setLoading(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Initialization failed';
      setError(msg);
      setLoading(false);
    }
  }

  async function loadDeviceCounts() {
    try {
      const { data } = await supabase.from('devices').select('is_active');
      if (data) {
        setTotalCount(data.length);
        setOnlineCount(data.filter(d => d.is_active).length);
      }
    } catch (err) {
      console.error('Failed to load device counts:', err);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-ose-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-ose-cyan border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-mono text-ose-textMuted">Initializing OSE...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-ose-bg flex items-center justify-center">
        <div className="max-w-md text-center">
          <p className="text-lg font-mono text-ose-red mb-2">System Initialization Failed</p>
          <p className="text-sm font-mono text-ose-textMuted mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 text-xs font-mono font-bold text-ose-bg bg-ose-cyan rounded hover:bg-ose-cyan/90">
            RETRY
          </button>
        </div>
      </div>
    );
  }

  const pages: Record<Page, React.ReactNode> = {
    overview: <Overview />,
    terminal: <Terminal />,
    trading: <Trading />,
    devices: <DeviceManager />,
  };

  return (
    <Layout page={page} onNavigate={setPage} onlineCount={onlineCount} totalCount={totalCount}>
      {pages[page]}
    </Layout>
  );
}
