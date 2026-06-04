import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from './supabase';

interface SettingsMap {
  telegram_bot_token: string;
  telegram_chat_id: string;
  binance_api_key: string;
  binance_secret: string;
  supabase_url: string;
  supabase_anon_key: string;
  heartbeat_interval: string;
  dashboard_refresh: string;
}

type SettingKey = keyof SettingsMap;

interface SettingsCtx {
  settings: SettingsMap;
  isConfigured: (key: SettingKey) => boolean;
  allConfigured: (keys: SettingKey[]) => boolean;
  refresh: () => Promise<void>;
  loaded: boolean;
}

const DEFAULTS: SettingsMap = {
  telegram_bot_token: '',
  telegram_chat_id: '',
  binance_api_key: '',
  binance_secret: '',
  supabase_url: '',
  supabase_anon_key: '',
  heartbeat_interval: '30',
  dashboard_refresh: '5',
};

const SettingsContext = createContext<SettingsCtx>({
  settings: DEFAULTS,
  isConfigured: () => false,
  allConfigured: () => false,
  refresh: async () => {},
  loaded: false,
});

export function useSettings() {
  return useContext(SettingsContext);
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SettingsMap>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('app_settings').select('key, value');
    if (data) {
      const map = { ...DEFAULTS };
      for (const row of data) {
        if (row.key in map) {
          (map as any)[row.key] = row.value ?? '';
        }
      }
      setSettings(map);
    }
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  const isConfigured = useCallback((key: SettingKey) => {
    return !!settings[key] && settings[key].trim().length > 0;
  }, [settings]);

  const allConfigured = useCallback((keys: SettingKey[]) => {
    return keys.every(k => isConfigured(k));
  }, [isConfigured]);

  return (
    <SettingsContext.Provider value={{ settings, isConfigured, allConfigured, refresh: load, loaded }}>
      {children}
    </SettingsContext.Provider>
  );
}
