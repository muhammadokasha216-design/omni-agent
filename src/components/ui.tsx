// Shared UI primitives used throughout Ares
import type { ReactNode } from 'react';

interface PanelProps {
  children: ReactNode;
  className?: string;
}
export function Panel({ children, className = '' }: PanelProps) {
  return <div className={`panel ${className}`}>{children}</div>;
}

interface PanelHeaderProps {
  icon: ReactNode;
  title: string;
  badge?: ReactNode;
  action?: ReactNode;
  color?: 'amber' | 'green' | 'red' | 'cyan';
}
export function PanelHeader({ icon, title, badge, action, color = 'amber' }: PanelHeaderProps) {
  const colorMap = {
    amber: 'text-ares-amber',
    green: 'text-ares-green',
    red:   'text-ares-red',
    cyan:  'text-ares-cyan',
  };
  return (
    <div className="panel-header">
      <span className={colorMap[color]}>{icon}</span>
      <span className="text-xs font-mono font-bold tracking-widest text-ares-text uppercase">{title}</span>
      {badge && <span className="ml-auto">{badge}</span>}
      {action && <span className={badge ? 'ml-2' : 'ml-auto'}>{action}</span>}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: 'amber' | 'green' | 'red' | 'cyan' | 'muted';
  icon?: ReactNode;
  glow?: boolean;
}
export function StatCard({ label, value, sub, color = 'amber', icon, glow }: StatCardProps) {
  const valColor = {
    amber: 'text-ares-amber',
    green: 'text-ares-green',
    red:   'text-ares-red',
    cyan:  'text-ares-cyan',
    muted: 'text-ares-textSub',
  }[color];
  const glowClass = glow ? {
    amber: 'glow-amber',
    green: 'glow-green',
    red:   'glow-red',
    cyan:  'glow-cyan',
    muted: '',
  }[color] : '';
  return (
    <div className="panel card-hover p-4 flex flex-col gap-1">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-mono tracking-widest text-ares-textSub uppercase">{label}</span>
        {icon && <span className={`opacity-40 ${valColor}`}>{icon}</span>}
      </div>
      <span className={`text-2xl font-bold font-mono ${valColor} ${glowClass}`}>{value}</span>
      {sub && <span className="text-[10px] font-mono text-ares-textMuted mt-0.5">{sub}</span>}
    </div>
  );
}

interface DotProps { status: 'online' | 'offline' | 'degraded' | 'active' | 'inactive'; size?: number; }
export function StatusDot({ status, size = 8 }: DotProps) {
  const cls = {
    online:   'bg-ares-green  pulse-online',
    offline:  'bg-ares-red    pulse-offline',
    degraded: 'bg-ares-amber  pulse-warn',
    active:   'bg-ares-green  pulse-online',
    inactive: 'bg-ares-textMuted',
  }[status];
  return <span className={`inline-block rounded-full flex-shrink-0 ${cls}`} style={{ width: size, height: size }} />;
}

interface BadgeProps { type: string; children: ReactNode; }
export function Badge({ type, children }: BadgeProps) {
  return <span className={`badge badge-${type}`}>{children}</span>;
}

export function Divider() {
  return <div className="border-t border-ares-border my-3" />;
}

interface EmptyProps { message?: string; }
export function Empty({ message = 'No data available' }: EmptyProps) {
  return (
    <div className="flex items-center justify-center py-10 text-[11px] font-mono text-ares-textMuted">
      {message}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="w-5 h-5 border-2 border-ares-border border-t-ares-amber rounded-full animate-spin" />
  );
}
