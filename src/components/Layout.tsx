import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Activity, Send, TrendingUp, BarChart2,
  ShieldCheck, Menu, X, Zap, Bell, Circle,
  FlaskConical, ShoppingCart, Settings, Radio, WifiOff,
  Crown, LogOut, User,
} from 'lucide-react';
import { useAgent } from '../lib/agent';
import { useAuth } from '../lib/auth';

export type Page = 'dashboard' | 'heartbeat' | 'telegram' | 'trading' | 'market' | 'security' | 'simulation' | 'amazon' | 'settings' | 'admin' | 'orchestration';

const NAV_ALL: { id: Page; label: string; icon: React.FC<any>; color: string; group?: string; adminOnly?: boolean }[] = [
  { id: 'dashboard',      label: 'Command Center',  icon: LayoutDashboard, color: 'text-ares-amber' },
  { id: 'orchestration',  label: '10 Arms Agent',   icon: Zap,             color: 'text-ares-amber' },
  { id: 'heartbeat',      label: 'Heartbeat',       icon: Activity,        color: 'text-ares-green' },
  { id: 'telegram',       label: 'Telegram Bot',    icon: Send,            color: 'text-ares-cyan'  },
  { id: 'trading',        label: 'Trading Bots',    icon: TrendingUp,      color: 'text-ares-green' },
  { id: 'market',         label: 'Market Data',     icon: BarChart2,       color: 'text-ares-amber' },
  { id: 'security',       label: 'Security',        icon: ShieldCheck,     color: 'text-ares-red'   },
  { id: 'simulation',     label: 'Trade Sim',       icon: FlaskConical,    color: 'text-ares-amber', group: 'AUTO-PILOT' },
  { id: 'amazon',         label: 'Amazon Monitor',  icon: ShoppingCart,    color: 'text-ares-cyan',  group: 'AUTO-PILOT' },
  { id: 'admin',          label: 'Owner Dashboard',  icon: Crown,           color: 'text-ares-amber', group: 'ADMIN', adminOnly: true },
  { id: 'settings',       label: 'Settings',        icon: Settings,        color: 'text-ares-textSub', group: 'CONFIG' },
];

interface SidebarProps {
  page: Page;
  onNav: (p: Page) => void;
  unreadAlerts: number;
}

function Sidebar({ page, onNav, unreadAlerts }: SidebarProps) {
  const { mode, dbConnected } = useAgent();
  const { profile, signOut } = useAuth();
  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'admin';
  const isLive = mode === 'live' && dbConnected;

  // Filter nav items: admin-only items hidden for non-admins
  const NAV = NAV_ALL.filter(item => !item.adminOnly || isAdmin);

  const now = new Date();
  return (
    <aside className="w-56 flex-shrink-0 flex flex-col bg-ares-surface border-r border-ares-border relative overflow-hidden">
      {/* Grid overlay */}
      <div className="grid-overlay opacity-30" />

      {/* Logo */}
      <div className="relative z-10 flex items-center gap-3 px-5 py-4 border-b border-ares-border">
        <div className="relative flex-shrink-0">
          <div className="w-9 h-9 rounded bg-ares-elevated border border-ares-borderLit flex items-center justify-center">
            <Zap size={18} className="text-ares-amber" style={{ filter: 'drop-shadow(0 0 6px rgba(245,158,11,0.8))' }} />
          </div>
          <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${isLive ? 'bg-ares-green pulse-online' : 'bg-ares-textMuted'}`} />
        </div>
        <div>
          <div className="text-sm font-bold font-mono tracking-widest text-ares-amber glow-amber">ARES</div>
          <div className="text-[9px] font-mono text-ares-textMuted tracking-wider">OMNI-AGENT v3.0</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map((item, idx) => {
          const Icon = item.icon;
          const active = page === item.id;
          const prevItem = NAV[idx - 1];
          const showGroupLabel = item.group && item.group !== prevItem?.group;
          return (
            <div key={item.id}>
              {showGroupLabel && (
                <div className="px-3 pt-3 pb-1 text-[8px] font-mono tracking-widest text-ares-textMuted uppercase">
                  {item.group}
                </div>
              )}
              <button
                onClick={() => onNav(item.id)}
                className={`relative w-full flex items-center gap-2.5 px-3 py-2 rounded text-left transition-all duration-150
                  ${active
                    ? 'bg-ares-elevated border border-ares-borderLit'
                    : 'border border-transparent hover:bg-ares-elevated/50 hover:border-ares-border'
                  }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-ares-amber rounded-r"
                    style={{ boxShadow: '0 0 8px rgba(245,158,11,0.8)' }} />
                )}
                <Icon size={14} className={active ? item.color : 'text-ares-textSub'} />
                <span className={`text-[11px] font-mono font-medium tracking-wide ${active ? 'text-ares-text' : 'text-ares-textSub'}`}>
                  {item.label}
                </span>
                {item.id === 'security' && unreadAlerts > 0 && (
                  <span className="ml-auto text-[9px] font-mono font-bold bg-ares-red text-white rounded px-1.5 py-0.5 min-w-[18px] text-center">
                    {unreadAlerts}
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </nav>

      {/* User info + sign out */}
      <div className="relative z-10 border-t border-ares-border">
        <div className="px-4 py-2.5 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-ares-elevated border border-ares-border flex items-center justify-center">
            <User size={12} className="text-ares-textSub" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-mono font-semibold text-ares-text truncate">{profile?.display_name ?? 'User'}</div>
            <div className="text-[8px] font-mono text-ares-textMuted truncate">{profile?.email}</div>
          </div>
          <button onClick={signOut} className="p-1 text-ares-textMuted hover:text-ares-red transition-colors" title="Sign Out">
            <LogOut size={12} />
          </button>
        </div>
        <div className="px-4 py-2 border-t border-ares-border">
          <div className="text-xs font-mono text-ares-textSub tabular-nums">
            {now.toLocaleTimeString('en-US', { hour12: false })}
            <span className="text-ares-textMuted ml-2 text-[10px]">UTC{now.getTimezoneOffset() <= 0 ? '+' : ''}{-now.getTimezoneOffset() / 60}</span>
          </div>
          <div className="text-[10px] font-mono text-ares-textMuted mt-0.5">
            {now.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
        </div>
      </div>
    </aside>
  );
}

interface LayoutProps {
  page: Page;
  onNav: (p: Page) => void;
  children: React.ReactNode;
  unreadAlerts: number;
}

export default function Layout({ page, onNav, children, unreadAlerts }: LayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [clock, setClock] = useState(new Date());
  const { mode, connectionStatus, dbConnected, telegramConnected, heartbeat, goLive } = useAgent();

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const isLive = mode === 'live' && dbConnected;
  const statusColor = isLive
    ? 'text-ares-green fill-ares-green'
    : connectionStatus === 'connecting'
    ? 'text-ares-amber fill-ares-amber'
    : 'text-ares-red fill-ares-red';
  const statusText = isLive
    ? 'SYSTEM ACTIVE'
    : connectionStatus === 'connecting'
    ? 'CONNECTING...'
    : 'SIMULATED';

  const currentNav = NAV_ALL.find(n => n.id === page);

  return (
    <div className="flex h-screen bg-ares-bg overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex">
        <Sidebar page={page} onNav={onNav} unreadAlerts={unreadAlerts} />
      </div>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="flex-shrink-0">
            <Sidebar page={page} onNav={p => { onNav(p); setMobileOpen(false); }} unreadAlerts={unreadAlerts} />
          </div>
          <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="flex items-center justify-between px-4 py-2.5 border-b border-ares-border bg-ares-surface/80 backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-1.5 rounded hover:bg-ares-elevated text-ares-textSub" onClick={() => setMobileOpen(true)}>
              <Menu size={18} />
            </button>
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-[11px] font-mono">
              <span className="text-ares-textMuted">ARES</span>
              <span className="text-ares-textMuted">/</span>
              <span className="text-ares-text font-semibold tracking-wide uppercase">{currentNav?.label ?? 'Dashboard'}</span>
            </div>
          </div>

          {/* Right side: status + time */}
          <div className="flex items-center gap-4 text-[10px] font-mono text-ares-textSub">
            <div className="hidden sm:flex items-center gap-1.5">
              <Circle size={6} className={`${statusColor} animate-pulse`} />
              <span className={`tracking-wider ${isLive ? 'text-ares-green font-bold' : connectionStatus === 'connecting' ? 'text-ares-amber' : 'text-ares-textMuted'}`}>
                {statusText}
              </span>
              {isLive && telegramConnected && (
                <span className="text-ares-cyan ml-1">TG</span>
              )}
              {isLive && heartbeat.latencyMs !== null && (
                <span className="text-ares-textMuted ml-1">{heartbeat.latencyMs}ms</span>
              )}
            </div>
            {!isLive && (
              <button onClick={goLive} className="btn btn-green py-0.5 px-2.5 text-[9px]">
                <Radio size={9} /> GO LIVE
              </button>
            )}
            {unreadAlerts > 0 && (
              <button onClick={() => onNav('security')} className="flex items-center gap-1 text-ares-red">
                <Bell size={12} />
                <span>{unreadAlerts}</span>
              </button>
            )}
            <span className="tabular-nums text-ares-textSub hidden sm:block">
              {clock.toLocaleTimeString('en-US', { hour12: false })}
            </span>
          </div>
        </header>

        {/* Ticker tape */}
        <TickerTape />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 lg:p-5">
          {children}
        </main>
      </div>
    </div>
  );
}

// Live ticker strip
const TICKERS = [
  { symbol: 'BTC/USDT', price: 67842.50, change: +2.34 },
  { symbol: 'ETH/USDT', price: 3847.20,  change: -1.12 },
  { symbol: 'BNB/USDT', price: 567.80,   change: +0.88 },
  { symbol: 'SOL/USDT', price: 172.40,   change: +3.21 },
  { symbol: 'XRP/USDT', price: 0.5823,   change: -0.43 },
  { symbol: 'ADA/USDT', price: 0.4471,   change: +1.05 },
  { symbol: 'DOGE/USDT',price: 0.1634,   change: +4.72 },
  { symbol: 'MATIC/USDT',price: 0.8921,  change: -2.18 },
];

function TickerTape() {
  const [prices, setPrices] = useState(TICKERS);

  useEffect(() => {
    const t = setInterval(() => {
      setPrices(prev => prev.map(p => ({
        ...p,
        price: p.price * (1 + (Math.random() - 0.5) * 0.001),
        change: p.change + (Math.random() - 0.5) * 0.1,
      })));
    }, 3000);
    return () => clearInterval(t);
  }, []);

  const items = [...prices, ...prices];

  return (
    <div className="ticker-wrap bg-ares-surface/60 border-b border-ares-border flex-shrink-0">
      <div className="ticker-inner py-1">
        {items.map((t, i) => (
          <span key={i} className="inline-flex items-center gap-2 text-[10px] font-mono mx-6">
            <span className="text-ares-textSub font-bold">{t.symbol}</span>
            <span className="text-ares-text tabular-nums">${t.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
            <span className={t.change >= 0 ? 'text-ares-green' : 'text-ares-red'}>
              {t.change >= 0 ? '▲' : '▼'} {Math.abs(t.change).toFixed(2)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
