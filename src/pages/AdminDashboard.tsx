import { useEffect, useState } from 'react';
import {
  Users, Shield, Check, X, Clock, Mail, UserCog, RefreshCw,
  Crown, Eye, Ban, ChevronDown, Search, AlertTriangle, Trash2,
  Send, Settings, TrendingUp, AlertCircle, Lock,
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

interface AuditLogEntry {
  id: string;
  admin_id: string;
  target_user_id: string | null;
  action_type: string;
  description: string | null;
  old_value: Record<string, any> | null;
  new_value: Record<string, any> | null;
  ip_address: string | null;
  created_at: string;
}

interface LoginAttempt {
  id: string;
  email: string;
  ip_address: string | null;
  success: boolean;
  attempted_at: string;
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

const ADMIN_EMAIL = 'muhammadokasha216@gmail.com';

type TabType = 'users' | 'audit' | 'login-attempts';

export default function AdminDashboard() {
  const { profile: myProfile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [actioning, setActioning] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loginAttempts, setLoginAttempts] = useState<LoginAttempt[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('users');

  useEffect(() => { load(); }, []);

  async function logAuditAction(
    actionType: string,
    targetUserId: string | null,
    description: string,
    oldValue: any,
    newValue: any
  ) {
    try {
      await supabase.from('admin_audit_log').insert({
        admin_id: myProfile?.user_id,
        target_user_id: targetUserId,
        action_type: actionType,
        description,
        old_value: oldValue,
        new_value: newValue,
        ip_address: null, // Could be enhanced to capture actual IP
      });
    } catch (e) {
      console.error('Failed to log audit action:', e);
    }
  }

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (data) setUsers(data as UserProfile[]);
    
    // Load approval requests
    const { data: approvalData } = await supabase.from('approval_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false });
    if (approvalData) setApprovals(approvalData as ApprovalRequest[]);
    
    // Load audit logs (last 50)
    const { data: auditData } = await supabase.from('admin_audit_log').select('*').order('created_at', { ascending: false }).limit(50);
    if (auditData) setAuditLogs(auditData as AuditLogEntry[]);
    
    // Load failed login attempts (last 24h)
    const { data: loginData } = await supabase
      .from('login_attempts')
      .select('*')
      .eq('success', false)
      .gte('attempted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('attempted_at', { ascending: false });
    if (loginData) setLoginAttempts(loginData as LoginAttempt[]);
    
    setLoading(false);
  }

  async function updateUser(userId: string, updates: Partial<UserProfile>) {
    // Prevent self-suspension
    if (userId === myProfile?.user_id) {
      if (updates.account_status === 'suspended' || (updates.role && updates.role !== myProfile.role)) {
        alert('🚫 Cannot modify your own account. Use account settings instead.');
        return;
      }
    }

    // Prevent downgrading super_admin
    const targetUser = users.find(u => u.user_id === userId);
    if (targetUser?.role === 'super_admin' && updates.role && updates.role !== 'super_admin') {
      alert('🔒 Cannot downgrade super_admin role. This account is protected.');
      return;
    }

    setActioning(userId);
    try {
      // Log the change
      let actionType = 'other';
      if (updates.account_status) {
        if (updates.account_status === 'active' && targetUser?.account_status === 'pending') actionType = 'approve_user';
        else if (updates.account_status === 'rejected') actionType = 'reject_user';
        else if (updates.account_status === 'suspended') actionType = 'suspend_user';
        else if (updates.account_status === 'active' && targetUser?.account_status === 'suspended') actionType = 'reactivate_user';
      } else if (updates.role) {
        actionType = 'change_role';
      }

      await logAuditAction(
        actionType,
        userId,
        `Updated ${Object.keys(updates).join(', ')}`,
        targetUser,
        { ...targetUser, ...updates }
      );

      const { error } = await supabase.from('profiles').update(updates).eq('user_id', userId);
      if (!error) {
        // If approving, send notification
        if (updates.account_status === 'active' && targetUser?.account_status === 'pending') {
          try {
            await supabase.functions.invoke('admin-notification', {
              body: { action: 'approved', user_email: targetUser?.email, user_id: userId },
            });
          } catch { /* non-blocking */ }
        } else if (updates.account_status === 'rejected') {
          try {
            await supabase.functions.invoke('admin-notification', {
              body: { action: 'rejected', user_email: targetUser?.email, user_id: userId },
            });
          } catch { /* non-blocking */ }
        }
        await load();
      } else {
        alert('Error updating user: ' + error.message);
      }
    } finally {
      setActioning(null);
    }
  }

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
        <StatCard label="Total Users" value={users.length} color="cyan" sub="All registered" />
        <StatCard label="Pending" value={users.filter(u => u.account_status === 'pending').length} color="amber" sub="Awaiting approval" />
        <StatCard label="Active" value={users.filter(u => u.account_status === 'active').length} color="green" sub="Approved users" />
        <StatCard label="Failed Logins (24h)" value={loginAttempts.length} color="red" sub="Security alert" glow={loginAttempts.length > 5} />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-ares-border overflow-x-auto">
        {(['users', 'audit', 'login-attempts'] as TabType[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-[9px] font-mono font-bold tracking-wider border-b-2 transition-all whitespace-nowrap
              ${activeTab === tab
                ? 'border-ares-amber text-ares-amber'
                : 'border-transparent text-ares-textMuted hover:text-ares-text'}`}
          >
            {tab === 'users' && <span className="flex items-center gap-1.5"><Users size={12} /> USERS</span>}
            {tab === 'audit' && <span className="flex items-center gap-1.5"><Shield size={12} /> AUDIT LOG</span>}
            {tab === 'login-attempts' && <span className="flex items-center gap-1.5"><AlertCircle size={12} /> LOGIN ATTEMPTS</span>}
          </button>
        ))}
      </div>

      {/* USERS TAB */}
      {activeTab === 'users' && (
        <div className="space-y-5">
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
                </button>
              ))}
            </div>
          </div>

          {/* User list */}
          <div className="panel">
            <PanelHeader
              icon={<Users size={13} />}
              title="Users"
              badge={<span className="text-[9px] font-mono text-ares-textMuted">{users.filter(u => {
                if (filter !== 'all' && u.account_status !== filter) return false;
                if (search && !u.email.toLowerCase().includes(search.toLowerCase()) && !u.display_name.toLowerCase().includes(search.toLowerCase())) return false;
                return true;
              }).length} shown</span>}
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
                  {users.filter(u => {
                    if (filter !== 'all' && u.account_status !== filter) return false;
                    if (search && !u.email.toLowerCase().includes(search.toLowerCase()) && !u.display_name.toLowerCase().includes(search.toLowerCase())) return false;
                    return true;
                  }).map(u => {
                    const sc = STATUS_CONFIG[u.account_status] ?? STATUS_CONFIG.pending;
                    const rc = ROLE_CONFIG[u.role] ?? ROLE_CONFIG.member;
                    const subc = SUB_CONFIG[u.subscription_status] ?? SUB_CONFIG.free;
                    const StatusIcon = sc.icon;
                    const isOwnAccount = u.user_id === myProfile?.user_id;
                    const isSuperAdmin = u.role === 'super_admin';
                    
                    return (
                      <tr key={u.id} className="hover:bg-ares-elevated/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-ares-elevated border border-ares-border flex items-center justify-center text-[9px] font-mono font-bold text-ares-textSub">
                              {u.display_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-ares-text font-semibold flex items-center gap-1">
                                {u.display_name}
                                {isSuperAdmin && <Crown size={10} className="text-ares-amber" />}
                              </div>
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
                          {isOwnAccount ? (
                            <div className="text-[8px] text-ares-amber font-mono flex items-center gap-1">
                              <Lock size={8} /> YOUR ACCOUNT
                            </div>
                          ) : (
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
                              {u.account_status === 'active' && (
                                <button
                                  onClick={() => updateUser(u.user_id, { account_status: 'suspended' })}
                                  disabled={actioning === u.user_id || isSuperAdmin}
                                  title={isSuperAdmin ? 'Cannot suspend super_admin account' : ''}
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
                              {!isSuperAdmin && (
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
                          )}
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
                disabled={users.filter(u => u.account_status === 'pending').length === 0}
                className="btn btn-green justify-center text-[9px]"
              >
                <Check size={10} /> APPROVE ALL PENDING ({users.filter(u => u.account_status === 'pending').length})
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
      )}

      {/* AUDIT LOG TAB */}
      {activeTab === 'audit' && (
        <div className="panel">
          <PanelHeader
            icon={<Shield size={13} />}
            title="Admin Audit Log"
            badge={<span className="text-[9px] font-mono text-ares-textMuted">{auditLogs.length} recent</span>}
            color="amber"
          />
          <div className="divide-y divide-ares-border max-h-96 overflow-y-auto">
            {auditLogs.length === 0 ? (
              <div className="px-4 py-8 text-center text-ares-textMuted text-[10px]">No audit logs yet</div>
            ) : (
              auditLogs.map(log => (
                <div key={log.id} className="px-4 py-3 flex items-start gap-3 hover:bg-ares-elevated/20 transition-colors">
                  <Shield size={12} className="text-ares-amber flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[9px] font-mono font-bold text-ares-amber uppercase">{log.action_type.replace(/_/g, ' ')}</span>
                      <span className="text-[8px] font-mono text-ares-textMuted">{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                    {log.description && <div className="text-[9px] text-ares-text mt-1">{log.description}</div>}
                    {log.ip_address && <div className="text-[8px] text-ares-textMuted mt-1">IP: {log.ip_address}</div>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* LOGIN ATTEMPTS TAB */}
      {activeTab === 'login-attempts' && (
        <div className="panel">
          <PanelHeader
            icon={<AlertCircle size={13} />}
            title="Failed Login Attempts (Last 24h)"
            badge={<span className={`text-[9px] font-mono ${loginAttempts.length > 5 ? 'text-ares-red bg-ares-red/10' : 'text-ares-textMuted'} px-1.5 py-0.5 rounded`}>{loginAttempts.length} attempts</span>}
            color={loginAttempts.length > 5 ? 'red' : 'cyan'}
          />
          <div className="divide-y divide-ares-border max-h-96 overflow-y-auto">
            {loginAttempts.length === 0 ? (
              <div className="px-4 py-8 text-center text-ares-textMuted text-[10px]">✓ No failed login attempts in the last 24 hours</div>
            ) : (
              <>
                {loginAttempts.length > 5 && (
                  <div className="px-4 py-2 bg-ares-red/10 border-b border-ares-red/30 flex items-center gap-2 text-ares-red text-[9px]">
                    <AlertTriangle size={12} /> {loginAttempts.length} failed attempts detected
                  </div>
                )}
                {loginAttempts.map(attempt => (
                  <div key={attempt.id} className="px-4 py-3 flex items-start gap-3">
                    <X size={12} className="text-ares-red flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[9px] font-mono font-bold text-ares-text">{attempt.email}</span>
                        <span className="text-[8px] font-mono text-ares-textMuted">{new Date(attempt.attempted_at).toLocaleString()}</span>
                      </div>
                      {attempt.ip_address && <div className="text-[8px] text-ares-textMuted mt-1">IP: {attempt.ip_address}</div>}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
