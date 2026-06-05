import { useEffect, useState } from 'react';
import {
  Users, Shield, Check, X, Clock, Mail, UserCog, RefreshCw,
  Crown, Eye, Ban, ChevronDown, Search, AlertTriangle, Trash2,
  Send, Settings, TrendingUp,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth, type UserProfile } from '../lib/auth';
import { StatCard, PanelHeader, Empty } from '../components/ui';

interface ApprovalRequest {
  id: string;
  user_id: string;
  action_type: string;
  description: string;
  metadata: Record<string, any>;
  status: string;
  responded_at: string | null;
  created_at: string;
}

const ACTION_ICONS: Record<string, React.FC<any>> = {
  delete_file: Trash2,
  move_funds: TrendingUp,
  public_post: Send,
  security_change: Shield,
  pause_trading: Ban,
  change_settings: Settings,
  other: AlertTriangle,
};

type StatusFilter = 'all' | 'pending' | 'active' | 'rejected' | 'suspended';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.FC<any> }> = {
  pending:   { label: 'Pending',   color: 'text-ares-amber',     icon: Clock },
  active:    { label: 'Active',     color: 'text-ares-green',     icon: Check },
  rejected:  { label: 'Rejected',   color: 'text-ares-red',      icon: X },
  suspended: { label: 'Suspended',  color: 'text-ares-textMuted', icon: Ban },
};

const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
  super_admin: { label: 'Super Admin', color: 'text-ares-amber' },
  admin:       { label: 'Admin',       color: 'text-ares-cyan' },
  member:      { label: 'Member',      color: 'text-ares-textSub' },
  viewer:      { label: 'Viewer',      color: 'text-ares-textMuted' },
};

const SUB_CONFIG: Record<string, { label: string; color: string }> = {
  free:       { label: 'Free',       color: 'text-ares-textMuted' },
  trial:      { label: 'Trial',      color: 'text-ares-cyan' },
  pro:        { label: 'Pro',        color: 'text-ares-amber' },
  enterprise: { label: 'Enterprise', color: 'text-ares-green' },
};

export default function AdminDashboard() {
  const { profile: myProfile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [actioning, setActioning] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (data) setUsers(data as UserProfile[]);
    // Load approval requests
    const { data: approvalData } = await supabase.from('approval_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false });
    if (approvalData) setApprovals(approvalData as ApprovalRequest[]);
    setLoading(false);
  }

  async function updateUser(userId: string, updates: Partial<UserProfile>) {
    setActioning(userId);
    try {
      const { error } = await supabase.from('profiles').update(updates).eq('user_id', userId);
      if (!error) {
        // If approving, send notification
        if (updates.account_status === 'active') {
          const user = users.find(u => u.user_id === userId);
          try {
            await supabase.functions.invoke('admin-notification', {
              body: { action: 'approved', user_email: user?.email, user_id: userId },
            });
          } catch { /* non-blocking */ }
        } else if (updates.account_status === 'rejected') {
          const user = users.find(u => u.user_id === userId);
          try {
            await supabase.functions.invoke('admin-notification', {
              body: { action: 'rejected', user_email: user?.email, user_id: userId },
            });
          } catch { /* non-blocking */ }
        }
        await load();
      }
    } finally {
      setActioning(null);
    }
  }

  const filtered = users.filter(u => {
    if (filter !== 'all' && u.account_status !== filter) return false;
    if (search && !u.email.toLowerCase().includes(search.toLowerCase()) && !u.display_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const pendingCount = users.filter(u => u.account_status === 'pending').length;
  const activeCount  = users.filter(u => u.account_status === 'active').length;
  const totalCount   = users.length;

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-base font-bold font-mono tracking-widest text-ares-amber glow-amber uppercase">
            Owner Dashboard
          </h1>
          <p className="text-[10px] font-mono text-ares-textMuted mt-0.5">
            User management & platform administration · Super Admin only
          </p>
        </div>
        <button onClick={load} className="btn btn-ghost">
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> REFRESH
        </button>
      </div>

      {/* Admin badge */}
      <div className="panel p-3 flex items-center gap-3 border-ares-amber/20 bg-ares-amber/5">
        <Crown size={16} className="text-ares-amber flex-shrink-0" />
        <div className="flex-1">
          <div className="text-[11px] font-mono font-bold text-ares-amber">
            Super Admin: {myProfile?.display_name ?? myProfile?.email}
          </div>
          <div className="text-[9px] font-mono text-ares-textMuted mt-0.5">
            You have full access to all platform data and user management
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Users"   value={totalCount}                  color="cyan"   sub="All registered" />
        <StatCard label="Pending"        value={pendingCount}                color="amber"  sub="Awaiting approval" glow={pendingCount > 0} />
        <StatCard label="Active"         value={activeCount}                 color="green"  sub="Approved users" />
        <StatCard label="Rejected"       value={users.filter(u => u.account_status === 'rejected').length} color="red" sub="Denied access" />
      </div>

      {/* Filters + search */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ares-textMuted" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="ares-input text-xs pl-7"
            placeholder="Search by email or name..."
          />
        </div>
        <div className="flex items-center gap-1">
          {(['all', 'pending', 'active', 'rejected', 'suspended'] as StatusFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-[9px] font-mono tracking-wider rounded transition-all border
                ${filter === f
                  ? 'border-ares-amber/40 bg-ares-amber/10 text-ares-amber'
                  : 'border-ares-border text-ares-textMuted hover:border-ares-borderLit'}`}
            >
              {f.toUpperCase()}
              {f === 'pending' && pendingCount > 0 && (
                <span className="ml-1 bg-ares-amber text-ares-bg rounded px-1 text-[8px] font-bold">{pendingCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* User list */}
      <div className="panel">
        <PanelHeader
          icon={<Users size={13} />}
          title="Users"
          badge={<span className="text-[9px] font-mono text-ares-textMuted">{filtered.length} shown</span>}
          color="amber"
        />
        <div className="overflow-x-auto">
          <table className="w-full text-[10px] font-mono">
            <thead>
              <tr className="border-b border-ares-border">
                {['USER', 'EMAIL', 'ROLE', 'STATUS', 'SUBSCRIPTION', 'JOINED', 'ACTIONS'].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-ares-textMuted font-normal tracking-wider text-[9px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ares-border">
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-ares-textMuted">No users match your filter</td></tr>
              )}
              {filtered.map(u => {
                const sc = STATUS_CONFIG[u.account_status] ?? STATUS_CONFIG.pending;
                const rc = ROLE_CONFIG[u.role] ?? ROLE_CONFIG.member;
                const subc = SUB_CONFIG[u.subscription_status] ?? SUB_CONFIG.free;
                const StatusIcon = sc.icon;
                return (
                  <tr key={u.id} className="hover:bg-ares-elevated/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-ares-elevated border border-ares-border flex items-center justify-center text-[9px] font-mono font-bold text-ares-textSub">
                          {u.display_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-ares-text font-semibold">{u.display_name}</div>
                          {u.team && <div className="text-[8px] text-ares-textMuted">Team: {u.team}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ares-textSub">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`${rc.color} font-bold`}>{rc.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 ${sc.color} font-bold`}>
                        <StatusIcon size={9} /> {sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`${subc.color}`}>{subc.label}</span>
                    </td>
                    <td className="px-4 py-3 text-ares-textMuted">
                      {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {u.account_status === 'pending' && (
                          <>
                            <button
                              onClick={() => updateUser(u.user_id, { account_status: 'active' })}
                              disabled={actioning === u.user_id}
                              className="btn btn-green py-0.5 px-2 text-[8px]"
                            >
                              <Check size={8} /> APPROVE
                            </button>
                            <button
                              onClick={() => updateUser(u.user_id, { account_status: 'rejected' })}
                              disabled={actioning === u.user_id}
                              className="btn btn-red py-0.5 px-2 text-[8px]"
                            >
                              <X size={8} /> REJECT
                            </button>
                          </>
                        )}
                        {u.account_status === 'active' && u.user_id !== myProfile?.user_id && (
                          <button
                            onClick={() => updateUser(u.user_id, { account_status: 'suspended' })}
                            disabled={actioning === u.user_id}
                            className="btn btn-ghost py-0.5 px-2 text-[8px]"
                          >
                            <Ban size={8} /> SUSPEND
                          </button>
                        )}
                        {u.account_status === 'suspended' && (
                          <button
                            onClick={() => updateUser(u.user_id, { account_status: 'active' })}
                            disabled={actioning === u.user_id}
                            className="btn btn-green py-0.5 px-2 text-[8px]"
                          >
                            <Check size={8} /> REACTIVATE
                          </button>
                        )}
                        {u.account_status === 'rejected' && (
                          <button
                            onClick={() => updateUser(u.user_id, { account_status: 'active' })}
                            disabled={actioning === u.user_id}
                            className="btn btn-ghost py-0.5 px-2 text-[8px]"
                          >
                            <Check size={8} /> RECONSIDER
                          </button>
                        )}
                        {/* Role change */}
                        {u.user_id !== myProfile?.user_id && (
                          <select
                            value={u.role}
                            onChange={e => updateUser(u.user_id, { role: e.target.value as any })}
                            disabled={actioning === u.user_id}
                            className="ares-input text-[8px] py-0.5 px-1.5 w-20"
                          >
                            <option value="member">Member</option>
                            <option value="viewer">Viewer</option>
                            <option value="admin">Admin</option>
                          </select>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Approval Gate */}
      {approvals.length > 0 && (
        <div className="panel">
          <PanelHeader
            icon={<Shield size={13} />}
            title="Sovereign Approval Gate"
            badge={<span className="text-[9px] font-mono text-ares-amber bg-ares-amber/10 px-1.5 py-0.5 rounded">{approvals.length} PENDING</span>}
            color="amber"
          />
          <div className="divide-y divide-ares-border">
            {approvals.map(a => {
              const ActionIcon = ACTION_ICONS[a.action_type] ?? AlertTriangle;
              return (
                <div key={a.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded bg-ares-amber/10 border border-ares-amber/30 flex items-center justify-center flex-shrink-0">
                    <ActionIcon size={14} className="text-ares-amber" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold text-ares-amber uppercase">{a.action_type.replace(/_/g, ' ')}</span>
                      <span className="text-[8px] font-mono text-ares-textMuted">
                        {new Date(a.created_at).toLocaleString('en-US', { hour12: false })}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-ares-text mt-0.5">{a.description}</div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={async () => {
                        await supabase.from('approval_requests').update({
                          status: 'approved',
                          responded_at: new Date().toISOString(),
                        }).eq('id', a.id);
                        load();
                      }}
                      className="btn btn-green py-0.5 px-2 text-[8px]"
                    >
                      <Check size={8} /> APPROVE
                    </button>
                    <button
                      onClick={async () => {
                        await supabase.from('approval_requests').update({
                          status: 'rejected',
                          responded_at: new Date().toISOString(),
                        }).eq('id', a.id);
                        load();
                      }}
                      className="btn btn-red py-0.5 px-2 text-[8px]"
                    >
                      <X size={8} /> REJECT
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="panel p-4 space-y-3">
        <div className="text-[10px] font-mono font-bold tracking-widest text-ares-textSub">QUICK ACTIONS</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            onClick={async () => {
              const pendingUsers = users.filter(u => u.account_status === 'pending');
              for (const u of pendingUsers) {
                await updateUser(u.user_id, { account_status: 'active' });
              }
            }}
            disabled={pendingCount === 0}
            className="btn btn-green justify-center text-[9px]"
          >
            <Check size={10} /> APPROVE ALL PENDING ({pendingCount})
          </button>
          <button
            onClick={async () => {
              const rejectedUsers = users.filter(u => u.account_status === 'rejected');
              for (const u of rejectedUsers) {
                await updateUser(u.user_id, { account_status: 'active' });
              }
            }}
            className="btn btn-ghost justify-center text-[9px]"
          >
            <RefreshCw size={10} /> REACTIVATE ALL REJECTED
          </button>
          <button
            onClick={load}
            className="btn btn-ghost justify-center text-[9px]"
          >
            <RefreshCw size={10} /> REFRESH DATA
          </button>
        </div>
      </div>
    </div>
  );
}
