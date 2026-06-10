import { supabase } from './supabase';

const SESSION_KEY = 'ares_session_id';

export class SessionManager {
  private static id: string | null = null;

  static async initialize(): Promise<void> {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      const { data, error } = await supabase
        .from('sessions')
        .insert({ session_token: crypto.randomUUID(), operator_name: 'Ares Operator' })
        .select()
        .single();
      if (error) throw new Error(`Session init failed: ${error.message}`);
      id = data.id;
      localStorage.setItem(SESSION_KEY, id!);
    }
    this.id = id;
  }

  static getSessionId(): string {
    if (!this.id) throw new Error('Session not initialized');
    return this.id;
  }

  static reset(): void {
    localStorage.removeItem(SESSION_KEY);
    this.id = null;
  }
}

