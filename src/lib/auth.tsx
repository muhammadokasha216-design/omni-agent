import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from './supabase';

const ADMIN_EMAIL = 'muhammadokasha216@gmail.com';

export interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  display_name: string;
  role: 'super_admin' | 'admin' | 'member' | 'viewer';
  account_status: 'pending' | 'active' | 'rejected' | 'suspended';
  subscription_status: 'free' | 'trial' | 'pro' | 'enterprise';
  team: string | null;
  last_active: string;
  created_at: string;
}

interface AuthCtx {
  user: any | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isActive: boolean;
  isPending: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isActive: false,
  isPending: false,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

async function fetchProfile(uid: string, email?: string): Promise<UserProfile | null> {
  // Try up to 3 times with increasing delays (handles trigger race condition)
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, attempt * 800));

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', uid)
      .maybeSingle();

    if (data) {
      // Admin bypass: always ensure owner account is active and super_admin
      if (data.email === ADMIN_EMAIL || email === ADMIN_EMAIL) {
        if (data.account_status !== 'active' || data.role !== 'super_admin') {
          // Emergency override: restore corrupted super_admin profile
          try {
            await supabase.from('profiles').update({
              account_status: 'active',
              role: 'super_admin',
            }).eq('user_id', uid);
          } catch (e) {
            console.error('[Ares] Failed to restore super_admin profile:', e);
          }
          return { ...data, account_status: 'active', role: 'super_admin' } as UserProfile;
        }
      }
      return data as UserProfile;
    }

    if (!error) break; // data is null but no error = profile genuinely doesn't exist yet
  }

  // Profile not found after retries — if this is the owner, create a synthetic active profile
  if (email === ADMIN_EMAIL) {
    return {
      id: uid,
      user_id: uid,
      email: ADMIN_EMAIL,
      display_name: 'UKASHA',
      role: 'super_admin',
      account_status: 'active',
      subscription_status: 'free',
      team: null,
      last_active: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
  }

  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (authUser: any) => {
    const p = await fetchProfile(authUser.id, authUser.email);
    if (p) {
      setProfile(p);
      // Update last_active (non-blocking)
      supabase.from('profiles').update({ last_active: new Date().toISOString() }).eq('user_id', authUser.id);
    }
    return p;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user);
  }, [user, loadProfile]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        await loadProfile(u);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        // Don't set loading here — profile will resolve and trigger re-render
        const p = await fetchProfile(u.id, u.email);
        if (mounted && p) setProfile(p);
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    if (!error && data.user) {
      // Notify admin via Telegram with LLM processing (non-blocking)
      (async () => {
        try {
          const userId = data.user.id;
          const prompt = `A new user just signed up.\nEmail: ${email}\nUser ID: ${userId}\nDisplay Name: ${displayName}\nPlease generate a notification for the administrators. Format it so it looks good on Telegram. Include the exact commands to approve or reject: /approve ${userId} and /reject ${userId}`;
          
          const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
          const aiRes = await fetch(`${backendUrl}/api/agents/agent/user_onboarding/prompt?prompt=${encodeURIComponent(prompt)}`, {
            method: 'POST'
          });
          
          let finalMessage = '';
          if (aiRes.ok) {
            const aiData = await aiRes.json();
            finalMessage = aiData.response;
          } else {
            finalMessage = `🆕 *New User Registration Request*\n\n📧 Email: \`${email}\`\n🆔 ID: \`${userId}\`\n\nReply with:\n/approve ${userId}\n/reject ${userId}`;
          }

          await supabase.functions.invoke('telegram-relay', {
            body: { action: 'send', message: finalMessage },
          });
        } catch (e) {
          console.error('[Ares] LLM Telegram relay error:', e);
          // Fallback to direct relay call in case of backend network failure
          supabase.functions.invoke('telegram-relay', {
            body: { action: 'new_signup', user_email: email, user_id: data.user.id },
          }).catch(() => {});
        }
      })();
    }
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'admin';
  const isActive = profile?.account_status === 'active';
  const isPending = profile?.account_status === 'pending';

  return (
    <AuthContext.Provider value={{
      user, profile, loading, isAdmin, isActive, isPending,
      signIn, signUp, signOut, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
