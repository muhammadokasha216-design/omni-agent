import { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';
import Layout, { type Page } from './components/Layout';
import Dashboard from './pages/Dashboard';
import HeartbeatMonitor from './pages/HeartbeatMonitor';
import TelegramBot from './pages/TelegramBot';
import TradingBots from './pages/TradingBots';
import MarketData from './pages/MarketData';
import Security from './pages/Security';
import TradingSimulation from './pages/TradingSimulation';
import AmazonMonitor from './pages/AmazonMonitor';
import SettingsPage from './pages/SettingsPage';
import { SessionManager } from './lib/session';
import { supabase } from './lib/supabase';

export default function App() {
  const [page, setPage]           = useState<Page>('dashboard');
  const [booting, setBooting]     = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [unreadAlerts, setUnreadAlerts] = useState(0);

  useEffect(() => { boot(); }, []);

  async function boot() {
    try {
      await SessionManager.initialize();
      await loadAlertCount();
      // Subscribe to new alerts
      supabase.channel('alert_count')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'system_alerts' }, loadAlertCount)
        .subscribe();
      setBooting(false);
    } catch (err) {
      setBootError(err instanceof Error ? err.message : 'Unknown error');
      setBooting(false);
    }
  }

  async function loadAlertCount() {
    const { count } = await supabase
      .from('system_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false);
    setUnreadAlerts(count ?? 0);
  }

  if (booting) {
    return (
      <div className="min-h-screen bg-ares-bg flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="relative mx-auto w-16 h-16">
            <div className="absolute inset-0 rounded-full border-2 border-ares-amber/20 animate-ping-slow" />
            <div className="w-16 h-16 rounded-full bg-ares-surface border border-ares-borderLit flex items-center justify-center">
              <Zap size={28} className="text-ares-amber animate-heartbeat" />
            </div>
          </div>
          <div>
            <div className="text-sm font-mono font-bold tracking-widest text-ares-amber glow-amber">ARES</div>
            <div className="text-[10px] font-mono text-ares-textMuted mt-1 tracking-wider">OMNI-AGENT v3.0 — INITIALIZING</div>
          </div>
          <div className="flex justify-center gap-1 mt-2">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="w-1 h-1 rounded-full bg-ares-amber animate-pulse" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (bootError) {
    return (
      <div className="min-h-screen bg-ares-bg flex items-center justify-center p-4">
        <div className="panel max-w-md w-full p-6 text-center space-y-4">
          <Zap size={32} className="text-ares-red mx-auto" />
          <div className="text-sm font-mono font-bold text-ares-red">INITIALIZATION FAILED</div>
          <div className="text-[11px] font-mono text-ares-textMuted">{bootError}</div>
          <button onClick={() => { setBootError(null); setBooting(true); boot(); }} className="btn btn-amber mx-auto">
            RETRY
          </button>
        </div>
      </div>
    );
  }

  const pages: Record<Page, React.ReactNode> = {
    dashboard:  <Dashboard onNav={setPage} />,
    heartbeat:  <HeartbeatMonitor />,
    telegram:   <TelegramBot />,
    trading:    <TradingBots />,
    market:     <MarketData />,
    security:   <Security />,
    simulation: <TradingSimulation />,
    amazon:     <AmazonMonitor />,
    settings:   <SettingsPage />,
  };

  return (
    <Layout page={page} onNav={setPage} unreadAlerts={unreadAlerts}>
      {pages[page]}
    </Layout>
  );
}
