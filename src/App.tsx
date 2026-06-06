import { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';
import { Analytics } from '@vercel/analytics/react';
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
import AgentOrchestration from './pages/AgentOrchestration';
import AuthPage from './pages/AuthPage';
import { supabase } from './lib/supabase';
import { AuthProvider, useAuth } from './lib/auth';
import { SettingsProvider } from './lib/settings';
import { AgentProvider } from './lib/agent';

function Spinner({ label }: { label: string }) {
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
          <div className="text-[10px] font-mono text-ares-textMuted mt-1 tracking-wider">{label}</div>
        </div>
      </div>
    </div>
  );
}

function AppInner() {
  const { user, profile, loading, isActive, isPending } = useAuth();
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

  // 1. Auth + profile still loading
  if (loading) return <Spinner label="OMNI-AGENT v3.0 — LOADING" />;

  // 2. No session → login/signup
  if (!user) return <AuthPage />;

  // 3. Session exists but profile not yet resolved → wait for it
  if (!profile) return <Spinner label="AUTHENTICATING..." />;

  // 4. Rejected account
  if (profile.account_status === 'rejected') {
    return (
      <div className="min-h-screen bg-ares-bg flex items-center justify-center p-4">
        <div className="panel max-w-md w-full p-6 text-center space-y-4">
          <Zap size={32} className="text-ares-red mx-auto" />
          <div className="text-sm font-mono font-bold text-ares-red">ACCESS DENIED</div>
          <div className="text-[11px] font-mono text-ares-textMuted">
            Your account has been rejected. Contact the administrator for assistance.
          </div>
          <button onClick={() => supabase.auth.signOut()} className="btn btn-ghost text-xs">Sign Out</button>
        </div>
      </div>
    );
  }

  // 5. Pending approval
  if (isPending) {
    return (
      <div className="min-h-screen bg-ares-bg flex items-center justify-center p-4">
        <div className="panel max-w-md w-full p-6 text-center space-y-4">
          <Zap size={32} className="text-ares-amber mx-auto animate-heartbeat" />
          <div className="text-sm font-mono font-bold text-ares-amber">AWAITING CLEARANCE</div>
          <div className="text-[11px] font-mono text-ares-textMuted">
            Your account is pending administrator approval. You will be notified when access is granted.
          </div>
          <button onClick={() => supabase.auth.signOut()} className="btn btn-ghost text-xs">Sign Out</button>
        </div>
      </div>
    );
  }

  // 6. Suspended or unknown status
  if (!isActive) {
    return (
      <div className="min-h-screen bg-ares-bg flex items-center justify-center p-4">
        <div className="panel max-w-md w-full p-6 text-center space-y-4">
          <Zap size={32} className="text-ares-amber mx-auto" />
          <div className="text-sm font-mono font-bold text-ares-amber">
            Account Status: {profile.account_status.toUpperCase()}
          </div>
          <div className="text-[11px] font-mono text-ares-textMuted">
            Your account is {profile.account_status}. Please contact the administrator.
          </div>
          <button onClick={() => supabase.auth.signOut()} className="btn btn-ghost text-xs">Sign Out</button>
        </div>
      </div>
    );
  }

  // 7. Active — show dashboard
  const pages: Record<Page, React.ReactNode> = {
    dashboard:     <Dashboard onNav={setPage} />,
    heartbeat:     <HeartbeatMonitor />,
    telegram:      <TelegramBot />,
    trading:       <TradingBots />,
    market:        <MarketData />,
    security:      <Security />,
    simulation:    <TradingSimulation />,
    amazon:        <AmazonMonitor />,
    settings:      <SettingsPage />,
    admin:         <AdminDashboard />,
    orchestration: <AgentOrchestration />,
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

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
      <Analytics />
    </AuthProvider>
  );
}
