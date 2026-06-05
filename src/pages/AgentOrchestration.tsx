import { useEffect, useState } from 'react';
import {
  Zap, Play, Square, RefreshCw, ShieldAlert, TrendingUp,
  Video, FolderOpen, MessageSquare, Monitor, Check, X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { PanelHeader, StatusDot, Badge, Empty } from '../components/ui';

interface AgentArm {
  id: string;
  arm_number: number;
  name: string;
  category: 'trading' | 'security' | 'content' | 'messaging' | 'system';
  description: string;
  is_active: boolean;
  status: 'idle' | 'running' | 'paused' | 'error';
  config: Record<string, any>;
  last_run: string | null;
  updated_at: string;
}

const CATEGORY_CONFIG: Record<string, { color: string; icon: React.FC<any>; label: string }> = {
  trading:   { color: 'text-ares-green', icon: TrendingUp,   label: 'TRADING' },
  security:  { color: 'text-ares-red',   icon: ShieldAlert,  label: 'SECURITY' },
  content:   { color: 'text-ares-cyan',  icon: Video,        label: 'CONTENT' },
  messaging: { color: 'text-ares-amber', icon: MessageSquare, label: 'MESSAGING' },
  system:    { color: 'text-ares-textSub', icon: Monitor,     label: 'SYSTEM' },
};

const ARM_DESCRIPTIONS: Record<number, { title: string; desc: string; emoji: string }> = {
  1:  { title: 'Binance Trader Alpha', desc: 'Primary trading strategy execution on Binance', emoji: '📊' },
  2:  { title: 'Binance Trader Beta',  desc: 'Secondary hedge/counter strategy on Binance', emoji: '📈' },
  3:  { title: 'Front Door Guardian',  desc: 'Monitors sign-ups and login attempts', emoji: '🚪' },
  4:  { title: 'Intruder Detector',    desc: 'Detects brute-force attacks and auto-locks', emoji: '🔍' },
  5:  { title: 'Video Splitter',       desc: 'Splits long videos into short-form clips', emoji: '✂️' },
  6:  { title: 'Cinematic Editor',     desc: 'Adds captions and cinematic effects to clips', emoji: '🎬' },
  7:  { title: 'PC Organizer',         desc: 'Organizes files, screenshots, and projects', emoji: '📂' },
  8:  { title: 'File Cleaner',         desc: 'Cleans temp files and optimizes directories', emoji: '🧹' },
  9:  { title: 'Message Filter',       desc: 'Filters incoming messages and auto-replies', emoji: '💬' },
  10: { title: 'Social Auto-Poster',   desc: 'Posts content to social media at peak times', emoji: '📱' },
};

export default function AgentOrchestration() {
  const { user } = useAuth();
  const [arms, setArms] = useState<AgentArm[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('agent_arms').select('*').eq('user_id', user?.id ?? '').order('arm_number');
    if (data) setArms(data as AgentArm[]);
    setLoading(false);
  }

  async function toggleArm(arm: AgentArm) {
    setToggling(arm.id);
    const newActive = !arm.is_active;
    const newStatus = newActive ? 'running' : 'idle';

    await supabase.from('agent_arms').update({
      is_active: newActive,
      status: newStatus,
      last_run: newActive ? new Date().toISOString() : arm.last_run,
    }).eq('id', arm.id);

    // If starting a trading arm, check risk
    if (newActive && arm.category === 'trading') {
      const activeTradingArms = arms.filter(a => a.is_active && a.category === 'trading' && a.id !== arm.id).length;
      if (activeTradingArms >= 2) {
        await supabase.from('risk_events').insert({
          user_id: user?.id ?? '',
          severity: 'warning',
          category: 'position',
          title: 'Multiple Trading Arms Active',
          description: `${activeTradingArms + 1} trading arms now active. Consider monitoring exposure closely.`,
          is_resolved: false,
        });
      }
    }

    await load();
    setToggling(null);
  }

  const activeCount = arms.filter(a => a.is_active).length;
  const runningCount = arms.filter(a => a.status === 'running').length;

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold font-mono tracking-widest text-ares-amber glow-amber uppercase">
            Agent Orchestration
          </h1>
          <p className="text-[10px] font-mono text-ares-textMuted mt-0.5">
            Ares — 10-Arm Digital Twin · {activeCount}/10 arms active
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => arms.forEach(a => a.is_active && toggleArm(a))} className="btn btn-red text-[9px]" disabled={activeCount === 0}>
            <Square size={9} /> HALT ALL
          </button>
          <button onClick={load} className="btn btn-ghost">
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* 10-Arm Status Overview */}
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: 10 }, (_, i) => i + 1).map(armNum => {
          const arm = arms.find(a => a.arm_number === armNum);
          const info = ARM_DESCRIPTIONS[armNum];
          const cat = CATEGORY_CONFIG[arm?.category ?? 'system'];
          const CatIcon = cat.icon;
          return (
            <div key={armNum} className={`panel p-3 text-center transition-all ${arm?.is_active ? 'border-ares-green/30' : 'border-ares-border'}`}>
              <div className="text-lg mb-1">{info.emoji}</div>
              <div className="text-[9px] font-mono font-bold text-ares-text tracking-wider">ARM {armNum}</div>
              <StatusDot status={arm?.is_active ? (arm.status === 'running' ? 'active' : 'idle') : 'offline'} />
              <div className={`text-[8px] font-mono mt-1 ${arm?.is_active ? 'text-ares-green' : 'text-ares-textMuted'}`}>
                {arm?.is_active ? arm.status.toUpperCase() : 'OFFLINE'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detailed arm list by category */}
      {['trading', 'security', 'content', 'system', 'messaging'].map(cat => {
        const catArms = arms.filter(a => a.category === cat);
        if (catArms.length === 0) return null;
        const catConfig = CATEGORY_CONFIG[cat];
        const CatIcon = catConfig.icon;
        return (
          <div key={cat} className="panel">
            <PanelHeader
              icon={<CatIcon size={13} />}
              title={catConfig.label}
              badge={<span className={`text-[9px] font-mono ${catConfig.color}`}>{catArms.filter(a => a.is_active).length}/{catArms.length} active</span>}
              color={cat === 'trading' ? 'green' : cat === 'security' ? 'red' : cat === 'content' ? 'cyan' : 'amber'}
            />
            <div className="divide-y divide-ares-border">
              {catArms.map(arm => {
                const info = ARM_DESCRIPTIONS[arm.arm_number];
                return (
                  <div key={arm.id} className="flex items-center gap-4 px-4 py-3">
                    <div className="text-xl flex-shrink-0">{info.emoji}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono font-bold text-ares-text">{arm.name}</span>
                        <span className="text-[8px] font-mono text-ares-textMuted">ARM {arm.arm_number}</span>
                      </div>
                      <div className="text-[9px] font-mono text-ares-textMuted mt-0.5">{arm.description}</div>
                      {arm.last_run && (
                        <div className="text-[8px] font-mono text-ares-textMuted mt-0.5">
                          Last run: {new Date(arm.last_run).toLocaleString('en-US', { hour12: false })}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`badge text-[8px] ${
                        arm.status === 'running' ? 'badge-active' :
                        arm.status === 'paused' ? 'badge-degraded' :
                        arm.status === 'error' ? 'badge-critical' : 'badge-inactive'
                      }`}>
                        {arm.status.toUpperCase()}
                      </span>
                      <button
                        onClick={() => toggleArm(arm)}
                        disabled={toggling === arm.id}
                        className={arm.is_active ? 'btn btn-red py-0.5 px-2.5 text-[9px]' : 'btn btn-green py-0.5 px-2.5 text-[9px]'}
                      >
                        {toggling === arm.id ? <RefreshCw size={9} className="animate-spin" /> : arm.is_active ? <Square size={9} /> : <Play size={9} />}
                        {arm.is_active ? 'STOP' : 'START'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Sovereign Approval Gate notice */}
      <div className="panel p-4 border-ares-amber/20 bg-ares-amber/5">
        <div className="flex items-center gap-3">
          <ShieldAlert size={16} className="text-ares-amber flex-shrink-0" />
          <div>
            <div className="text-[11px] font-mono font-bold text-ares-amber">Sovereign Approval Gate</div>
            <div className="text-[9px] font-mono text-ares-textMuted mt-0.5">
              High-impact actions (deleting files, moving large funds, publishing content) require your confirmation via a push notification before execution. The first time any arm attempts a sensitive action, you will receive a Yes/No prompt.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
