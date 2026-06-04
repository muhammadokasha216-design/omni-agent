import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { supabase } from './supabase';
import { useSettings } from './settings';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
type AgentMode = 'simulated' | 'live';

interface HeartbeatState {
  isAlive: boolean;
  lastPing: string | null;
  latencyMs: number | null;
  intervalSec: number;
}

interface AgentCtx {
  mode: AgentMode;
  connectionStatus: ConnectionStatus;
  dbConnected: boolean;
  telegramConnected: boolean;
  heartbeat: HeartbeatState;
  goLive: () => void;
  goSimulated: () => void;
  testConnection: () => Promise<{ db: boolean; telegram: boolean }>;
}

const AgentContext = createContext<AgentCtx>({
  mode: 'simulated',
  connectionStatus: 'disconnected',
  dbConnected: false,
  telegramConnected: false,
  heartbeat: { isAlive: false, lastPing: null, latencyMs: null, intervalSec: 30 },
  goLive: () => {},
  goSimulated: () => {},
  testConnection: async () => ({ db: false, telegram: false }),
});

export function useAgent() {
  return useContext(AgentContext);
}

export function AgentProvider({ children }: { children: ReactNode }) {
  const { settings, isConfigured, allConfigured, loaded } = useSettings();
  const [mode, setMode] = useState<AgentMode>('simulated');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [dbConnected, setDbConnected] = useState(false);
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [heartbeat, setHeartbeat] = useState<HeartbeatState>({
    isAlive: false, lastPing: null, latencyMs: null, intervalSec: 30,
  });
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Test database connection
  const testDb = useCallback(async (): Promise<boolean> => {
    try {
      const { error } = await supabase.from('sessions').select('id').limit(1);
      return !error;
    } catch {
      return false;
    }
  }, []);

  // Test Telegram connection by calling getMe via edge function
  const testTelegram = useCallback(async (): Promise<boolean> => {
    if (!isConfigured('telegram_bot_token')) return false;
    try {
      const { data, error } = await supabase.functions.invoke('telegram-relay', {
        body: { action: 'test' },
      });
      return !error && data?.ok;
    } catch {
      return false;
    }
  }, [isConfigured]);

  const testConnection = useCallback(async () => {
    setConnectionStatus('connecting');
    const [db, tg] = await Promise.all([testDb(), testTelegram()]);
    setDbConnected(db);
    setTelegramConnected(tg);
    setConnectionStatus(db ? 'connected' : 'error');
    return { db, telegram: tg };
  }, [testDb, testTelegram]);

  // When credentials are fully configured, auto-activate live mode
  useEffect(() => {
    if (!loaded) return;
    const telegramReady = allConfigured(['telegram_bot_token', 'telegram_chat_id']);
    const dbReady = dbConnected;

    if (telegramReady && dbReady && mode === 'simulated') {
      // Don't auto-switch — let user explicitly go live
    }
  }, [loaded, settings, dbConnected]);

  // Heartbeat loop — runs in live mode
  useEffect(() => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);

    if (mode === 'live') {
      const intervalSec = parseInt(settings.heartbeat_interval) || 30;
      const tick = async () => {
        const start = Date.now();
        const dbOk = await testDb();
        const latency = Date.now() - start;
        const now = new Date().toISOString();

        setHeartbeat(prev => ({
          ...prev,
          isAlive: dbOk,
          lastPing: now,
          latencyMs: latency,
          intervalSec,
        }));

        // Log heartbeat to agent_nodes for the primary node
        const { data: primaryNode } = await supabase
          .from('agent_nodes')
          .select('id')
          .eq('name', 'ARES-PRIMARY')
          .maybeSingle();

        if (primaryNode) {
          await supabase.from('agent_nodes').update({
            is_online: dbOk,
            last_heartbeat: now,
            updated_at: now,
          }).eq('id', primaryNode.id);

          await supabase.from('heartbeat_log').insert({
            node_id: primaryNode.id,
            status: dbOk ? 'online' : 'offline',
            latency_ms: latency,
          });
        }

        setDbConnected(dbOk);
      };

      tick(); // immediate first check
      heartbeatRef.current = setInterval(tick, intervalSec * 1000);
    } else {
      setHeartbeat({ isAlive: false, lastPing: null, latencyMs: null, intervalSec: 30 });
    }

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [mode, settings.heartbeat_interval, testDb]);

  const goLive = useCallback(async () => {
    setConnectionStatus('connecting');
    const result = await testConnection();
    if (result.db) {
      setMode('live');
      setDbConnected(true);
      setTelegramConnected(result.telegram);

      // Update primary node status
      const now = new Date().toISOString();
      await supabase.from('agent_nodes').update({
        is_online: true,
        last_heartbeat: now,
        updated_at: now,
      }).eq('name', 'ARES-PRIMARY');

      // Send Telegram notification if configured
      if (result.telegram) {
        try {
          await supabase.functions.invoke('telegram-relay', {
            body: {
              action: 'send',
              message: 'ARES OMNI-AGENT V3.0 ONLINE\nStatus: SYSTEM ACTIVE\nHeartbeat: 30s interval\nMode: LIVE',
            },
          });
        } catch { /* non-blocking */ }
      }

      // Insert system alert
      await supabase.from('system_alerts').insert({
        severity: 'info',
        source: 'agent',
        title: 'Agent Initialized — Live Mode',
        body: 'ARES OMNI-AGENT V3.0 is now running in LIVE mode. All systems connected.',
        is_read: false,
      });
    } else {
      setConnectionStatus('error');
    }
  }, [testConnection]);

  const goSimulated = useCallback(() => {
    setMode('simulated');
    setConnectionStatus('disconnected');
    setDbConnected(false);
    setTelegramConnected(false);
  }, []);

  return (
    <AgentContext.Provider value={{
      mode, connectionStatus, dbConnected, telegramConnected,
      heartbeat, goLive, goSimulated, testConnection,
    }}>
      {children}
    </AgentContext.Provider>
  );
}
