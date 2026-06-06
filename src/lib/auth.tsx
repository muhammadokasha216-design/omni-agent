import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from './supabase';

const ADMIN_EMAIL = 'muhammadokasha216@gmail.com';

export interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  display_name: string;
  is_approved: boolean;
  is_admin: boolean;
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
  profileMissing: boolean;
  isAdmin: boolean;
  isActive: boolean;
  isPending: boolean;
  isApproved: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  profile: null,
  loading: true,
  profileMissing: false,
  isAdmin: false,
  isActive: false,
  isPending: false,
  isApproved: false,
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
      // Admin bypass: always ensure owner account is active
      if (data.email === ADMIN_EMAIL || email === ADMIN_EMAIL) {
        if (data.account_status !== 'active' || data.role !== 'super_admin') {
          await supabase.from('profiles').update({
            account_status: 'active',
            role: 'super_admin',
          }).eq('user_id', uid);
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
  const [profileMissing, setProfileMissing] = useState(false);

  const loadProfile = useCallback(async (authUser: any) => {
    const p = await fetchProfile(authUser.id, authUser.email);

    // [v0] Debug: print exactly why the app does/doesn't advance past "Authenticating..."
    console.group('[v0][approval] profile resolved');
    console.log('user id:', authUser.id, 'email:', authUser.email);
    console.log('profile found:', !!p);
    console.log('is_approved:', p?.is_approved);
    console.log('account_status:', p?.account_status);
    console.log('is_admin:', p?.is_admin, 'role:', p?.role);
    console.groupEnd();

    if (p) {
      setProfile(p);
      setProfileMissing(false);
      // Update last_active (non-blocking)
      supabase.from('profiles').update({ last_active: new Date().toISOString() }).eq('user_id', authUser.id);
    } else {
      // No profile row exists yet — flag it so the gate can react instead of hanging forever.
      setProfileMissing(true);
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
        // Don't set loading here — loadProfile resolves the profile, logs the
        // approval status, and toggles profileMissing so the gate never hangs.
        await loadProfile(u);
      } else {
        setProfile(null);
        setProfileMissing(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        // [v0] Full Supabase auth error dump — classify Auth vs Config vs Network.
        const status = (error as any).status;
        const code = (error as any).code;
        let classification: 'AUTH' | 'CONFIG' | 'NETWORK' | 'UNKNOWN' = 'UNKNOWN';

        if (code === 'invalid_credentials' || status === 400) {
          classification = 'AUTH'; // wrong email/password, or user not in THIS project
        } else if (code === 'email_not_confirmed') {
          classification = 'AUTH';
        } else if (status === 401 || status === 403) {
          classification = 'CONFIG'; // bad/missing anon key or wrong project
        } else if (typeof status === 'undefined') {
          classification = 'NETWORK'; // request never reached Supabase (CORS/DNS/offline)
        }

        console.group('[v0][signIn] FAILED');
        console.log('classification:', classification);
        console.log('message:', error.message);
        console.log('status:', status);
        console.log('code:', code);
        console.log('name:', error.name);
        console.log('full error object:', error);
        console.log('raw JSON:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        console.groupEnd();

        return { error: error.message };
      }

      console.log('[v0][signIn] OK — user id:', data.user?.id, 'email:', data.user?.email);
      return { error: null };
    } catch (e: any) {
      // Thrown (not returned) errors are almost always transport-level failures.
      console.group('[v0][signIn] THREW (NETWORK / transport)');
      console.log('classification: NETWORK');
      console.log('message:', e?.message);
      console.log('name:', e?.name);
      console.log('full thrown object:', e);
      console.groupEnd();
      return { error: e?.message ?? 'Network error reaching Supabase' };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    if (!error && data.user) {
      // Notify admin via Telegram (non-blocking)
      supabase.functions.invoke('telegram-relay', {
        body: { action: 'new_signup', user_email: email, user_id: data.user.id },
      }).catch(() => { /* non-blocking */ });
    }
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setProfileMissing(false);
  }, []);

  const isAdmin = profile?.is_admin === true || profile?.role === 'super_admin' || profile?.role === 'admin';
  const isApproved = profile?.is_approved === true || profile?.account_status === 'active';
  const isActive = profile?.account_status === 'active';
  const isPending = !isApproved && profile?.account_status !== 'rejected' && profile?.account_status !== 'suspended';

  return (
    <AuthContext.Provider value={{
      user, profile, loading, profileMissing, isAdmin, isActive, isPending, isApproved,
      signIn, signUp, signOut, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
