import { useEffect, useState, useRef } from 'react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Terminal, TrendingUp, Cpu, LayoutDashboard, Wifi, WifiOff, Activity, Zap, Plus, Trash2, Play, PauseCircle, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from './lib/supabase';
import { SessionManager } from './lib/session';

// ============ Real-time Chart Data ============
function generateChartData(points: number = 30) {
  return Array.from({ length: points }, (_, i) => ({
    time: `${i}m`,
    price: 67000 + Math.random() * 2000 - 1000,
    volume: Math.random() * 1000,
    agents: Math.floor(Math.random() * 4),
  }));
}

// ============ Agent Status Card ============
function AgentStatusCard({ agent }: { agent: any }) {
  return (
    <div className="bg-ose-surface border border-ose-border rounded-lg p-4 card-hover">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${agent.status === 'operational' ? 'bg-ose-green status-online' : 'bg-ose-amber'}`} />
          <span className="text-sm font-mono font-bold text-ose-text">{agent.name}</span>
        </div>
        <span className={`text-[10px] font-mono px-2 py-1 rounded border ${agent.role === 'market_analyst' ? 'border-ose-cyan/30 text-ose-cyan' : 'border-ose-green/30 text-ose-green'}`}>
          {agent.role.replace('_', ' ').toUpperCase()}
        </span>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between text-[10px] font-mono">
          <span className="text-ose-textMuted">Status</span>
          <span className="text-ose-text capitalize">{agent.status}</span>
        </div>
        <div className="flex justify-between text-[10px] font-mono">
          <span className="text-ose-textMuted">Model</span>
          <span className="text-ose-text">{agent.model.split('-')[1]}</span>
        </div>
        <div className="h-0.5 rounded-full bg-ose-elevated overflow-hidden mt-2">
          <div className="h-full bg-gradient-to-r from-ose-cyan to-ose-green" style={{ width: `${Math.random() * 40 + 60}%` }} />
        </div>
      </div>
    </div>
  );
}

// ============ Main App ============
export default function App() {
  const [page, setPage] = useState('overview');
  const [devices, setDevices] = useState<any[]>([]);
  const [commands, setCommands] = useState<any[]>([]);
  const [hooks, setHooks] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState(generateChartData());
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    initializeApp();
  }, []);

  async function initializeApp() {
    try {
      await SessionManager.initialize();

      // Load initial data
      await Promise.all([loadDevices(), loadCommands(), loadHooks()]);

      // Mock agent loading (would come from backend)
      setAgents([
        { name: 'Market Analyst', role: 'market_analyst', model: 'claude-3.5-sonnet', status: 'operational' },
        { name: 'Risk Manager', role: 'risk_manager', model: 'claude-3.5-sonnet', status: 'operational' },
        { name: 'Execution Engine', role: 'execution_engine', model: 'claude-3.5-sonnet', status: 'operational' },
        { name: 'Strategic Advisor', role: 'strategic_advisor', model: 'claude-3.5-sonnet', status: 'operational' },
      ]);

      // Connect WebSocket for real-time updates
      setupRealtime();

      // Simulate real-time chart updates
      const interval = setInterval(() => {
        setChartData(prev => {
          const newData = [...prev.slice(1), {
            time: `${prev.length}m`,
            price: prev[prev.length - 1].price + (Math.random() * 400 - 200),
            volume: Math.random() * 1000,
            agents: Math.floor(Math.random() * 4),
          }];
          return newData;
        });
      }, 2000);

      setLoading(false);
      return () => clearInterval(interval);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Initialization failed';
      setError(msg);
      setLoading(false);
    }
  }

  function setupRealtime() {
    const sessionId = SessionManager.getSessionId();
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const wsUrl = supabaseUrl.replace('https://', 'wss://') + '/realtime/v1/ws?apikey=' + import.meta.env.VITE_SUPABASE_ANON_KEY;

    wsRef.current = new WebSocket(wsUrl);
    wsRef.current.onmessage = (event) => {
      // Handle real-time updates
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'INSERT' && message.table === 'command_history') {
          setCommands(prev => [message.record, ...prev.slice(0, 9)]);
        }
      } catch (e) {
        console.error('WebSocket message error:', e);
      }
    };
  }

  async function loadDevices() {
    try {
      const { data } = await supabase.from('devices').select('*').order('created_at');
      setDevices(data || []);
    } catch (e) {
      console.error('Failed to load devices:', e);
    }
  }

  async function loadCommands() {
    try {
      const { data } = await supabase.from('command_history').select('*').order('created_at', { ascending: false }).limit(10);
      setCommands(data || []);
    } catch (e) {
      console.error('Failed to load commands:', e);
    }
  }

  async function loadHooks() {
    try {
      const { data } = await supabase.from('trading_hooks').select('*').order('created_at');
      setHooks(data || []);
    } catch (e) {
      console.error('Failed to load hooks:', e);
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
          <p className="text-lg font-mono text-ose-red mb-2">Initialization Failed</p>
          <p className="text-sm font-mono text-ose-textMuted">{error}</p>
        </div>
      </div>
    );
  }

  const onlineDevices = devices.filter(d => d.is_active).length;

  return (
    <div className="flex h-screen bg-ose-bg overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-ose-surface border-r border-ose-border flex flex-col">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-ose-border">
          <div className="w-8 h-8 rounded-sm bg-ose-elevated border border-ose-borderLit flex items-center justify-center">
            <Zap size={16} className="text-ose-cyan" />
          </div>
          <div>
            <div className="text-xs font-bold tracking-widest text-ose-cyan font-mono">OSE</div>
            <div className="text-[10px] text-ose-textMuted font-mono">v2.0 Institutional</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {[
            { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'terminal', label: 'AI Terminal', icon: Terminal },
            { id: 'trading', label: 'Trading', icon: TrendingUp },
            { id: 'agents', label: 'Agent Command Center', icon: Cpu },
          ].map(item => {
            const Icon = item.icon;
            const active = page === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-all ${active ? 'bg-ose-elevated border border-ose-borderLit text-ose-cyan' : 'text-ose-textSub hover:text-ose-text'}`}
              >
                <Icon size={16} />
                <span className="font-mono text-xs">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="px-4 py-3 border-t border-ose-border space-y-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono text-ose-textMuted">Agents</span>
            <span className="text-[10px] font-mono text-ose-cyan">{agents.length} Operational</span>
          </div>
          <div className="h-1 rounded-full bg-ose-elevated overflow-hidden">
            <div className="h-full bg-gradient-to-r from-ose-cyan to-ose-green" style={{ width: '100%' }} />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-6 py-3 border-b border-ose-border bg-ose-surface/80 backdrop-blur">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-ose-textMuted">//</span>
            <span className="text-sm font-mono text-ose-text font-bold">
              {['Dashboard', 'AI Terminal', 'Trading', 'Agent Command Center'].find((_, i) => ['overview', 'terminal', 'trading', 'agents'][i] === page)}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-ose-green status-online" />
              {onlineDevices}/{devices.length} Agents Online
            </span>
          </div>
        </header>

        {/* Pages */}
        <main className="flex-1 overflow-y-auto p-6">
          {page === 'overview' && (
            <div className="space-y-6">
              {/* Charts Grid */}
              <div className="grid grid-cols-2 gap-6">
                {/* Price Chart */}
                <div className="bg-ose-surface border border-ose-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-mono font-bold text-ose-text">BTC/USDT Real-time</h3>
                    <span className="text-xs font-mono text-ose-green">↑ 2.34%</span>
                  </div>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a2d4a" />
                      <XAxis dataKey="time" stroke="#3a5878" style={{ fontSize: 11 }} />
                      <YAxis stroke="#3a5878" style={{ fontSize: 11 }} domain={['dataMin - 500', 'dataMax + 500']} />
                      <Tooltip contentStyle={{ backgroundColor: '#0b1525', border: '1px solid #1a2d4a' }} />
                      <Line type="monotone" dataKey="price" stroke="#00c8ff" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Volume Chart */}
                <div className="bg-ose-surface border border-ose-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-mono font-bold text-ose-text">Trading Volume</h3>
                    <span className="text-xs font-mono text-ose-textMuted">Live</span>
                  </div>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a2d4a" />
                      <XAxis dataKey="time" stroke="#3a5878" style={{ fontSize: 11 }} />
                      <YAxis stroke="#3a5878" style={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: '#0b1525', border: '1px solid #1a2d4a' }} />
                      <Bar dataKey="volume" fill="#00e87a" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: 'Total Commands', value: commands.length, color: 'cyan' },
                  { label: 'Trading Hooks', value: hooks.length, color: 'amber' },
                  { label: 'Active Agents', value: agents.length, color: 'green' },
                  { label: 'Success Rate', value: '94%', color: 'green' },
                ].map((stat, i) => (
                  <div key={i} className="bg-ose-surface border border-ose-border rounded-lg p-4">
                    <div className={`text-lg font-bold font-mono mb-1 ${stat.color === 'cyan' ? 'text-ose-cyan' : stat.color === 'amber' ? 'text-ose-amber' : 'text-ose-green'}`}>
                      {stat.value}
                    </div>
                    <div className="text-[10px] font-mono text-ose-textMuted">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Recent Commands */}
              <div className="bg-ose-surface border border-ose-border rounded-lg overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-ose-border">
                  <Activity size={14} className="text-ose-cyan" />
                  <span className="text-xs font-mono text-ose-text tracking-wider">RECENT COMMANDS</span>
                </div>
                <div className="divide-y divide-ose-border max-h-60 overflow-y-auto">
                  {commands.slice(0, 5).map(cmd => (
                    <div key={cmd.id} className="flex items-start gap-3 px-4 py-2.5">
                      {cmd.status === 'success' && <CheckCircle size={11} className="text-ose-green mt-0.5" />}
                      {cmd.status === 'error' && <AlertTriangle size={11} className="text-ose-red mt-0.5" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono text-ose-text truncate">{cmd.raw_input || 'Command'}</p>
                        <p className="text-[10px] font-mono text-ose-textMuted">{new Date(cmd.created_at).toLocaleTimeString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {page === 'agents' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold font-mono text-ose-text mb-4">AGENT COMMAND CENTER</h2>
              <div className="grid grid-cols-2 gap-4">
                {agents.map((agent, i) => (
                  <AgentStatusCard key={i} agent={agent} />
                ))}
              </div>

              <div className="bg-ose-surface border border-ose-border rounded-lg p-4 mt-6">
                <h3 className="text-sm font-mono font-bold text-ose-text mb-3">Agent Workflow Pipeline</h3>
                <div className="flex items-center gap-4">
                  {['Market\nAnalysis', 'Risk\nAssessment', 'Execution\nPlanning', 'Strategic\nReview'].map((stage, i) => (
                    <div key={i} className="flex items-center flex-1">
                      <div className="flex-1">
                        <div className="bg-ose-elevated border border-ose-borderLit rounded-lg p-3 text-center">
                          <span className="text-[10px] font-mono text-ose-textMuted whitespace-pre-line">{stage}</span>
                        </div>
                      </div>
                      {i < 3 && <div className="w-8 h-0.5 bg-gradient-to-r from-ose-cyan to-ose-green" />}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {page !== 'overview' && page !== 'agents' && (
            <div className="text-center text-ose-textMuted font-mono text-sm">
              {page.charAt(0).toUpperCase() + page.slice(1)} page — Coming soon
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
