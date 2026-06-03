import { createClient } from '@supabase/supabase-js';

const SESSION_ID_KEY = 'ose_session_id';
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const tempClient = createClient(supabaseUrl, supabaseAnonKey);

export class SessionManager {
  private static sessionId: string | null = null;

  static async initialize(): Promise<void> {
    let sessionId = localStorage.getItem(SESSION_ID_KEY);

    if (!sessionId) {
      const { data, error } = await tempClient
        .from('sessions')
        .insert({
          session_token: crypto.randomUUID(),
          operator_name: 'OSE Operator',
        })
        .select()
        .single();

      if (error) throw new Error(`Failed to create session: ${error.message}`);
      if (!data) throw new Error('No session data returned');

      sessionId = data.id;
      localStorage.setItem(SESSION_ID_KEY, sessionId);
    }

    this.sessionId = sessionId;
  }

  static getSessionId(): string {
    if (!this.sessionId) throw new Error('Session not initialized');
    return this.sessionId;
  }

  static async updateActivity(): Promise<void> {
    if (!this.sessionId) return;
    await tempClient
      .from('sessions')
      .update({ last_activity: new Date().toISOString() })
      .eq('id', this.sessionId);
  }

  static async destroy(): Promise<void> {
    localStorage.removeItem(SESSION_ID_KEY);
    this.sessionId = null;
  }
}
