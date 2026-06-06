import { Zap, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

export default function PendingPage() {
  const { profile, refreshProfile } = useAuth();

  return (
    <div className="min-h-screen bg-ares-bg flex items-center justify-center p-4">
      <div className="panel max-w-md w-full p-8 text-center space-y-5">
        <div className="relative mx-auto w-16 h-16">
          <div className="absolute inset-0 rounded-full border-2 border-ares-amber/20 animate-ping-slow" />
          <div className="w-16 h-16 rounded-full bg-ares-surface border border-ares-borderLit flex items-center justify-center">
            <Send size={26} className="text-ares-amber animate-heartbeat" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-sm font-mono font-bold tracking-widest text-ares-amber glow-amber">
            REGISTRATION SUBMITTED
          </h1>
          <p className="text-[12px] font-mono text-ares-textMuted leading-relaxed">
            Awaiting Telegram Bot Approval from Administrator.
          </p>
        </div>

        {profile?.email && (
          <div className="text-[10px] font-mono text-ares-textMuted/70 tracking-wider border-t border-ares-borderLit/40 pt-4">
            {profile.email}
          </div>
        )}

        <div className="flex items-center justify-center gap-2 pt-1">
          <button onClick={() => refreshProfile()} className="btn btn-ghost text-xs">
            <Zap size={12} className="mr-1" /> Check Status
          </button>
          <button onClick={() => supabase.auth.signOut()} className="btn btn-ghost text-xs">
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
