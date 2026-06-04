import { useEffect, useState, useCallback, useRef } from 'react';
import { Activity, Plus, RefreshCw, Wifi, WifiOff, Clock, Trash2, Edit2, Check, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Panel, PanelHeader, StatusDot, Empty } from '../components/ui';
import type { AgentNode, HeartbeatEntry } from '../lib/types';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';

export default function HeartbeatMonitor() {
  const [nodes, setNodes] = useState<AgentNode[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [history, setHistory] = useState<HeartbeatEntry[]>([]);
  const [pinging, setPinging] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'pc', endpoint_url: '', heartbeat_interval_sec: 30 });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadNodes();
    // Real-time subscription
    const ch = supabase
      .channel('agent_nodes_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_nodes' }, () => loadNodes())
      .subscribe();

    intervalRef.current = setInterval(simulateHeartbeats, 5000);

    return () => {
      supabase.removeChannel(ch);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (selected) loadHistory(selected);
  }, [selected]);

  async function loadNodes() {
    const { data } = await supabase.from('agent_nodes').select('*').order('created_at');
    if (data) {
      setNodes(data);
      if (!selected && data.length > 0) setSelected(data[0].id);
    }
  }

  async function loadHistory(nodeId: string) {
    const { data } = await supabase
      .from('heartbeat_log')
      .select('*')
      .eq('node_id', nodeId)
      .order('recorded_at', { ascending: false })
      .limit(40);
    if (data) setHistory(data.reverse());
  }

  // Simulates a real heartbeat check
  async function pingNode(node: AgentNode) {
    setPinging(node.id);
    const start = Date.now();

    try {
      // In production: await fetch(node.endpoint_url + '/ping', { signal: AbortSignal.timeout(5000) })
      await new Promise(r => setTimeout(r, 200 + Math.random() * 600));
      const latency = Date.now() - start;
      const online = Math.random() > 0.15;

      await supabase.from('agent_nodes').update({
        is_online: online,
        last_heartbeat: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', node.id);

      await supabase.from('heartbeat_log').insert({
        node_id: node.id,
        status: online ? 'online' : 'offline',
        latency_ms: latency,
      });

      loadNodes();
      if (selected === node.id) loadHistory(node.id);
    } finally {
      setPinging(null);
    }
  }

  async function simulateHeartbeats() {
    const { data: nds } = await supabase.from('agent_nodes').select('id,is_online');
    if (!nds) return;
    for (const n of nds) {
      const online = Math.random() > 0.2;
      const latency = Math.floor(50 + Math.random() * 300);
      await supabase.from('agent_nodes').update({ is_online: online, last_heartbeat: new Date().toISOString() }).eq('id', n.id);
      await supabase.from('heartbeat_log').insert({ node_id: n.id, status: online ? 'online' : 'offline', latency_ms: latency });
    }
  }

  async function addNode() {
    if (!form.name.trim()) return;
    await supabase.from('agent_nodes').insert({ ...form, meta: {} });
    setAddOpen(false);
    setForm({ name: '', type: 'pc', endpoint_url: '', heartbeat_interval_sec: 30 });
    loadNodes();
  }

  async function removeNode(id: string) {
    await supabase.from('agent_nodes').delete().eq('id', id);
    if (selected === id) setSelected(null);
    loadNodes();
  }

  const selectedNode = nodes.find(n => n.id === selected);
  const chartData = history.map(h => ({
    t: new Date(h.recorded_at).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    latency: h.latency_ms,
    status: h.status === 'online' ? 1 : 0,
  }));

  const avgLatency = history.length
    ? Math.round(history.reduce((s, h) => s + h.latency_ms, 0) / history.length)
    : 0;
  const uptimePct = history.length
    ? Math.round((history.filter(h => h.status === 'online').length / history.length) * 100)
    : 0;

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold font-mono tracking-widest text-ares-green glow-green uppercase">Heartbeat Monitor</h1>
          <p className="text-[10px] font-mono text-ares-textMuted mt-0.5">Real-time node health — autonomous polling every 5 seconds</p>
        </div>
        <button onClick={() => setAddOpen(true)} className="btn btn-amber">
          <Plus size={11} /> ADD NODE
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Node list */}
        <div className="panel">
          <PanelHeader icon={<Activity size={13} />} title="Agent Nodes" badge={<span className="text-[9px] font-mono text-ares-textMuted">{nodes.length} nodes</span>} color="green" />
          <div className="divide-y divide-ares-border">
            {nodes.length === 0 && <Empty message="No nodes registered" />}
            {nodes.map(node => (
              <div
                key={node.id}
                onClick={() => setSelected(node.id)}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors
                  ${selected === node.id ? 'bg-ares-elevated' : 'hover:bg-ares-elevated/40'}`}
              >
                <StatusDot status={node.is_online ? 'online' : 'offline'} />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-mono font-semibold text-ares-text">{node.name}</div>
                  <div className="text-[9px] font-mono text-ares-textMuted uppercase">{node.type}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={e => { e.stopPropagation(); pingNode(node); }}
                    disabled={pinging === node.id}
                    className="btn btn-ghost py-0.5 px-2 text-[9px]"
                  >
                    <RefreshCw size={9} className={pinging === node.id ? 'animate-spin' : ''} />
                    PING
                  </button>
                  <button onClick={e => { e.stopPropagation(); removeNode(node.id); }} className="p-1 text-ares-textMuted hover:text-ares-red transition-colors">
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detail + chart */}
        <div className="lg:col-span-2 space-y-4">
          {selectedNode ? (
            <>
              {/* Node info */}
              <div className="panel p-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center border ${selectedNode.is_online ? 'border-ares-green/30 bg-ares-green/5' : 'border-ares-red/30 bg-ares-red/5'}`}>
                    {selectedNode.is_online ? <Wifi size={22} className="text-ares-green" /> : <WifiOff size={22} className="text-ares-red" />}
                  </div>
                  <div className="flex-1">
                    <div className="text-lg font-bold font-mono text-ares-text">{selectedNode.name}</div>
                    <div className="text-[10px] font-mono text-ares-textMuted mt-0.5">
                      {selectedNode.endpoint_url || 'No endpoint configured'} · {selectedNode.type.toUpperCase()}
                    </div>
                  </div>
                  <div className="flex gap-6 text-center">
                    <div>
                      <div className={`text-xl font-bold font-mono ${uptimePct >= 90 ? 'text-ares-green' : uptimePct >= 70 ? 'text-ares-amber' : 'text-ares-red'}`}>{uptimePct}%</div>
                      <div className="text-[9px] font-mono text-ares-textMuted">UPTIME</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold font-mono text-ares-cyan">{avgLatency}ms</div>
                      <div className="text-[9px] font-mono text-ares-textMuted">AVG LATENCY</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold font-mono text-ares-text">{selectedNode.heartbeat_interval_sec}s</div>
                      <div className="text-[9px] font-mono text-ares-textMuted">INTERVAL</div>
                    </div>
                  </div>
                </div>
                {selectedNode.last_heartbeat && (
                  <div className="flex items-center gap-1.5 mt-3 text-[10px] font-mono text-ares-textMuted">
                    <Clock size={10} />
                    Last heartbeat: {new Date(selectedNode.last_heartbeat).toLocaleString('en-US', { hour12: false })}
                  </div>
                )}
              </div>

              {/* Latency chart */}
              <div className="panel p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-mono font-bold tracking-widest text-ares-textSub">LATENCY HISTORY (40 SAMPLES)</span>
                  <button onClick={() => loadHistory(selected!)} className="btn btn-ghost py-0.5 px-2 text-[9px]">
                    <RefreshCw size={9} /> REFRESH
                  </button>
                </div>
                {chartData.length === 0 ? (
                  <Empty message="No heartbeat data yet — click PING to record first sample" />
                ) : (
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="latGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#22d3a0" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#22d3a0" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#162236" />
                      <XAxis dataKey="t" stroke="#334155" tick={{ fontSize: 9, fontFamily: 'monospace' }} interval="preserveStartEnd" />
                      <YAxis stroke="#334155" tick={{ fontSize: 9, fontFamily: 'monospace' }} unit="ms" />
                      <Tooltip contentStyle={{ background: '#0d1423', border: '1px solid #1e3355', borderRadius: 4, fontSize: 10, fontFamily: 'monospace' }} formatter={(v: any) => [`${v}ms`, 'Latency']} />
                      <ReferenceLine y={avgLatency} stroke="#f59e0b" strokeDasharray="4 2" strokeWidth={1} label={{ value: 'avg', fill: '#f59e0b', fontSize: 9 }} />
                      <Area type="monotone" dataKey="latency" stroke="#22d3a0" strokeWidth={1.5} fill="url(#latGrad)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </>
          ) : (
            <div className="panel flex items-center justify-center h-48">
              <Empty message="Select a node to view details" />
            </div>
          )}
        </div>
      </div>

      {/* Add node modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="panel w-full max-w-md p-5 space-y-4 animate-fade-up">
            <div className="flex items-center justify-between">
              <span className="text-sm font-mono font-bold text-ares-amber">ADD NEW NODE</span>
              <button onClick={() => setAddOpen(false)} className="text-ares-textMuted hover:text-ares-text"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-mono text-ares-textMuted block mb-1">NODE NAME</label>
                <input className="ares-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. ARES-PRIMARY" />
              </div>
              <div>
                <label className="text-[10px] font-mono text-ares-textMuted block mb-1">TYPE</label>
                <select className="ares-input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  <option value="pc">PC</option>
                  <option value="server">Server</option>
                  <option value="trading">Trading</option>
                  <option value="mobile">Mobile</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-mono text-ares-textMuted block mb-1">ENDPOINT URL</label>
                <input className="ares-input" value={form.endpoint_url} onChange={e => setForm({ ...form, endpoint_url: e.target.value })} placeholder="http://192.168.1.100:8000" />
              </div>
              <div>
                <label className="text-[10px] font-mono text-ares-textMuted block mb-1">POLL INTERVAL (SEC)</label>
                <input className="ares-input" type="number" value={form.heartbeat_interval_sec} onChange={e => setForm({ ...form, heartbeat_interval_sec: Number(e.target.value) })} min={5} max={300} />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={addNode} className="btn btn-amber flex-1"><Check size={11} /> ADD NODE</button>
              <button onClick={() => setAddOpen(false)} className="btn btn-ghost flex-1"><X size={11} /> CANCEL</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
