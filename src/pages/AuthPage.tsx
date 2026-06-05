import { useState } from 'react';
import { Zap, Eye, EyeOff, ArrowRight, Shield, Check, AlertTriangle } from 'lucide-react';
import { useAuth } from '../lib/auth';

type AuthView = 'login' | 'signup' | 'pending' | 'rejected';

export default function AuthPage() {
  const { signIn, signUp, isPending, profile } = useAuth();
  const [view, setView] = useState<AuthView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [signedUp, setSignedUp] = useState(false);

  // If user is pending/rejected, show the appropriate screen
  if (isPending || profile?.account_status === 'rejected') {
    return <PendingScreen status={profile?.account_status ?? 'pending'} />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    if (view === 'signup') {
      if (!displayName.trim()) { setError('Display name is required'); setSubmitting(false); return; }
      if (password.length < 6) { setError('Password must be at least 6 characters'); setSubmitting(false); return; }
      const { error: err } = await signUp(email, password, displayName);
      if (err) { setError(err); setSubmitting(false); return; }
      setSignedUp(true);
      setSubmitting(false);
      return;
    }

    const { error: err } = await signIn(email, password);
    if (err) { setError(err); }
    setSubmitting(false);
  }

  if (signedUp) {
    return (
      <div className="min-h-screen bg-ares-bg flex items-center justify-center p-4">
        <div className="panel max-w-md w-full p-8 text-center space-y-5 animate-fade-up">
          <div className="w-14 h-14 rounded-xl bg-ares-amber/10 border border-ares-amber/30 flex items-center justify-center mx-auto">
            <Check size={28} className="text-ares-amber" />
          </div>
          <div>
            <div className="text-lg font-mono font-bold text-ares-text">Registration Submitted</div>
            <div className="text-[11px] font-mono text-ares-textSub mt-2 leading-relaxed">
              Your account is awaiting approval from the administrator.<br />
              You will receive access once your account is reviewed.
            </div>
          </div>
          <div className="bg-ares-bg rounded-lg p-4 border border-ares-border">
            <div className="text-[10px] font-mono text-ares-textMuted mb-1">REGISTERED EMAIL</div>
            <div className="text-sm font-mono text-ares-amber">{email}</div>
          </div>
          <button onClick={() => { setSignedUp(false); setView('login'); }} className="btn btn-amber w-full justify-center">
            Back to Login <ArrowRight size={11} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ares-bg flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background grid */}
      <div className="absolute inset-0 grid-overlay opacity-20" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-ares-amber/3 blur-[120px]" />

      <div className="relative z-10 w-full max-w-md animate-fade-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="relative mx-auto w-14 h-14 mb-4">
            <div className="absolute inset-0 rounded-xl border-2 border-ares-amber/20 animate-ping-slow" />
            <div className="w-14 h-14 rounded-xl bg-ares-surface border border-ares-borderLit flex items-center justify-center">
              <Zap size={28} className="text-ares-amber" style={{ filter: 'drop-shadow(0 0 8px rgba(245,158,11,0.6))' }} />
            </div>
          </div>
          <div className="text-xl font-bold font-mono tracking-[0.3em] text-ares-amber glow-amber">ARES</div>
          <div className="text-[10px] font-mono text-ares-textMuted tracking-widest mt-1">OMNI-AGENT PLATFORM</div>
        </div>

        {/* Auth form */}
        <div className="panel p-6 space-y-5">
          {/* Tab switcher */}
          <div className="flex rounded-lg bg-ares-bg border border-ares-border overflow-hidden">
            {(['login', 'signup'] as const).map(v => (
              <button
                key={v}
                onClick={() => { setView(v); setError(null); }}
                className={`flex-1 py-2.5 text-[11px] font-mono font-bold tracking-widest transition-all
                  ${view === v
                    ? 'bg-ares-amber/10 text-ares-amber border-b-2 border-ares-amber'
                    : 'text-ares-textMuted hover:text-ares-textSub border-b-2 border-transparent'
                  }`}
              >
                {v === 'login' ? 'SIGN IN' : 'SIGN UP'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {view === 'signup' && (
              <div>
                <label className="text-[9px] font-mono text-ares-textMuted block mb-1.5 tracking-wider">DISPLAY NAME</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  className="ares-input text-xs"
                  placeholder="Enter your display name"
                  autoFocus={view === 'signup'}
                />
              </div>
            )}

            <div>
              <label className="text-[9px] font-mono text-ares-textMuted block mb-1.5 tracking-wider">EMAIL</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="ares-input text-xs"
                placeholder="you@example.com"
                autoFocus={view === 'login'}
                required
              />
            </div>

            <div>
              <label className="text-[9px] font-mono text-ares-textMuted block mb-1.5 tracking-wider">PASSWORD</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="ares-input text-xs pr-8"
                  placeholder={view === 'signup' ? 'Min 6 characters' : 'Enter your password'}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ares-textMuted hover:text-ares-textSub transition-colors"
                >
                  {showPw ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-[10px] font-mono text-ares-red bg-ares-red/5 border border-ares-red/20 rounded-lg px-3 py-2">
                <AlertTriangle size={12} className="flex-shrink-0" />
                {error}
              </div>
            )}

            <button type="submit" disabled={submitting} className="btn btn-amber w-full justify-center py-2.5 text-xs">
              {submitting ? (
                <span className="flex items-center gap-2">Authenticating<span className="animate-pulse">...</span></span>
              ) : (
                <>
                  {view === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}
                  <ArrowRight size={12} />
                </>
              )}
            </button>
          </form>

          {/* Trust indicators */}
          <div className="flex items-center justify-center gap-4 text-[9px] font-mono text-ares-textMuted">
            <span className="flex items-center gap-1"><Shield size={9} /> Encrypted</span>
            <span className="flex items-center gap-1"><Shield size={9} /> SOC 2 Compliant</span>
            <span className="flex items-center gap-1"><Shield size={9} /> Private Approval</span>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-4 text-[9px] font-mono text-ares-textMuted">
          Ares Omni-Agent Platform &copy; 2026 — Private Access Only
        </div>
      </div>
    </div>
  );
}

function PendingScreen({ status }: { status: string }) {
  return (
    <div className="min-h-screen bg-ares-bg flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 grid-overlay opacity-20" />
      <div className="relative z-10 panel max-w-md w-full p-8 text-center space-y-5 animate-fade-up">
        {status === 'rejected' ? (
          <>
            <div className="w-14 h-14 rounded-xl bg-ares-red/10 border border-ares-red/30 flex items-center justify-center mx-auto">
              <AlertTriangle size={28} className="text-ares-red" />
            </div>
            <div>
              <div className="text-lg font-mono font-bold text-ares-red">Access Denied</div>
              <div className="text-[11px] font-mono text-ares-textSub mt-2 leading-relaxed">
                Your account registration was not approved. If you believe this is an error, please contact the administrator.
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-xl bg-ares-amber/10 border border-ares-amber/30 flex items-center justify-center mx-auto">
              <Zap size={28} className="text-ares-amber animate-pulse" />
            </div>
            <div>
              <div className="text-lg font-mono font-bold text-ares-amber">Awaiting Approval</div>
              <div className="text-[11px] font-mono text-ares-textSub mt-2 leading-relaxed">
                Your account is awaiting approval from Muhammad Ukasha.<br />
                You will gain access to the dashboard once your account is reviewed and activated.
              </div>
            </div>
            <div className="bg-ares-bg rounded-lg p-4 border border-ares-border">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono text-ares-textMuted">STATUS</span>
                <span className="badge badge-degraded text-[9px]">PENDING</span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[9px] font-mono text-ares-textMuted">REVIEW</span>
                <span className="text-[9px] font-mono text-ares-amber">In Progress</span>
              </div>
            </div>
            <div className="flex justify-center gap-1.5 mt-2">
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-ares-amber animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
