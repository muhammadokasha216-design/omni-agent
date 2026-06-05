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
import AdminDashboard from './pages/AdminDashboard';
import AuthPage from './pages/AuthPage';
import { supabase } from './lib/supabase';
import { AuthProvider, useAuth } from './lib/auth';
import { SettingsProvider } from './lib/settings';
import { AgentProvider } from './lib/agent';

function AppInner() {
  const { user, profile, loading: authLoading, isActive, isPending } = useAuth();
  const [page, setPage] = useState<Page>('dashboard');
  const [unreadAlerts, setUnreadAlerts] = useState(0);

  useEffect(() => {
    if (user && isActive) loadAlertCount();
  }, [user, isActive]);

  async function loadAlertCount() {
    const { count } = await supabase
      .from('system_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false)
      .eq('user_id', user?.id ?? '');
    setUnreadAlerts(count ?? 0);
  }

  // Auth loading screen
  if (authLoading) {
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
            <div className="text-[10px] font-mono text-ares-textMuted mt-1 tracking-wider">OMNI-AGENT v3.0 — LOADING</div>
          </div>
        </div>
      </div>
    );
  }

  // Not authenticated → show login/signup
  if (!user) {
    return <AuthPage />;
  }

  // Authenticated but pending approval → show pending screen
  if (isPending || profile?.account_status === 'rejected') {
    return <AuthPage />;
  }

  // Authenticated and active → show dashboard
  if (isActive) {
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
      admin:      <AdminDashboard />,
    };

    return (
      <SettingsProvider>
        <AgentProvider>
          <Layout page={page} onNav={setPage} unreadAlerts={unreadAlerts}>
            {pages[page]}
          </Layout>
        </AgentProvider>
      </SettingsProvider>
    );
  }

  // Fallback: account exists but status unclear (suspended, etc.)
  return (
    <div className="min-h-screen bg-ares-bg flex items-center justify-center p-4">
      <div className="panel max-w-md w-full p-6 text-center space-y-4">
        <Zap size={32} className="text-ares-amber mx-auto" />
        <div className="text-sm font-mono font-bold text-ares-amber">Account Status: {profile?.account_status?.toUpperCase() ?? 'UNKNOWN'}</div>
        <div className="text-[11px] font-mono text-ares-textMuted">
          Your account is currently {profile?.account_status ?? 'unavailable'}. Please contact the administrator.
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
