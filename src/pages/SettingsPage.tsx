import { useEffect, useState } from 'react';
import { Settings, Save, Eye, EyeOff, Check, RefreshCw, AlertTriangle, Shield, Bot, Coins, Database } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { PanelHeader, Empty, Spinner } from '../components/ui';

interface Setting {
  id: string;
  key: string;
  value: string;
  label: string;
  category: string;
  is_secret: boolean;
  updated_at: string;
}

const CATEGORY_META: Record<string, { label: string; icon: React.FC<any>; color: string; description: string }> = {
  telegram: {
    label: 'Telegram Bot',
    icon: Bot,
    color: 'text-ares-cyan',
    description: 'Connect your Telegram bot for remote commands and alerts. Create a bot via @BotFather.',
  },
  binance: {
    label: 'Binance Exchange',
    icon: Coins,
    color: 'text-ares-amber',
    description: 'Binance API credentials for live trading. Use read-only keys for monitoring only.',
  },
  supabase: {
    label: 'Supabase Database',
    icon: Database,
    color: 'text-ares-green',
    description: 'Your Supabase project credentials. Find these in your Supabase dashboard under Project Settings.',
  },
  general: {
    label: 'General',
    icon: Settings,
    color: 'text-ares-textSub',
    description: 'General dashboard behavior settings.',
  },
};

const PLACEHOLDERS: Record<string, string> = {
  telegram_bot_token:  '7312940821:AAExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  telegram_chat_id:    '-100xxxxxxxxxx or 1234567890',
  binance_api_key:     'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  binance_secret:      'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  supabase_url:        'https://xxxxxxxxxxxxxxxxxxxx.supabase.co',
  supabase_anon_key:   'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  heartbeat_interval:  '30',
  dashboard_refresh:   '5',
};

function maskValue(v: string) {
  if (!v) return '';
  if (v.length <= 8) return '•'.repeat(v.length);
  return v.slice(0, 4) + '•'.repeat(Math.min(v.length - 8, 28)) + v.slice(-4);
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Setting[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('app_settings').select('*').eq('user_id', user?.id ?? '').order('category').order('key');
    if (data) {
      setSettings(data);
      const init: Record<string, string> = {};
      data.forEach((s: Setting) => { init[s.key] = s.value; });
      setEdits(init);
    }
    setLoading(false);
  }

  async function saveSetting(key: string) {
    const setting = settings.find(s => s.key === key);
    if (!setting) return;
    setSaving(key);
    try {
      await supabase
        .from('app_settings')
        .update({ value: edits[key] ?? '', updated_at: new Date().toISOString() })
        .eq('key', key);
      setSaved(prev => ({ ...prev, [key]: true }));
      setTimeout(() => setSaved(prev => ({ ...prev, [key]: false })), 2000);
      load();
    } finally {
      setSaving(null);
    }
  }

  async function saveAll() {
    setSaving('__all__');
    try {
      for (const key of Object.keys(edits)) {
        await supabase
          .from('app_settings')
          .update({ value: edits[key] ?? '', updated_at: new Date().toISOString() })
          .eq('key', key);
      }
      setSaved(prev => ({ ...prev, __all__: true }));
      setTimeout(() => setSaved(prev => ({ ...prev, __all__: false })), 2000);
      load();
    } finally {
      setSaving(null);
    }
  }

  const categories = ['telegram', 'binance', 'supabase', 'general'];
  const grouped = categories.reduce((acc, cat) => {
    acc[cat] = settings.filter(s => s.category === cat);
    return acc;
  }, {} as Record<string, Setting[]>);

  const configuredCount = settings.filter(s => s.value).length;
  const totalCount = settings.length;

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold font-mono tracking-widest text-ares-amber glow-amber uppercase">Configuration</h1>
          <p className="text-[10px] font-mono text-ares-textMuted mt-0.5">
            Paste your API keys here — no .env editing required · {configuredCount}/{totalCount} configured
          </p>
        </div>
        <button onClick={saveAll} disabled={saving === '__all__'} className="btn btn-amber">
          {saving === '__all__' ? <RefreshCw size={11} className="animate-spin" /> :
           saved.__all__ ? <Check size={11} /> : <Save size={11} />}
          {saved.__all__ ? 'SAVED!' : 'SAVE ALL'}
        </button>
      </div>

      {/* Progress bar */}
      <div className="panel p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono text-ares-textMuted">CONFIGURATION PROGRESS</span>
          <span className="text-[10px] font-mono text-ares-amber font-bold">{configuredCount}/{totalCount} KEYS SET</span>
        </div>
        <div className="h-1.5 rounded-full bg-ares-elevated overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-ares-amber to-ares-green transition-all duration-500"
            style={{ width: totalCount > 0 ? `${(configuredCount / totalCount) * 100}%` : '0%' }}
          />
        </div>
        {configuredCount < totalCount && (
          <p className="text-[9px] font-mono text-ares-textMuted mt-2 flex items-center gap-1.5">
            <AlertTriangle size={9} className="text-ares-amber" />
            {totalCount - configuredCount} key(s) not yet configured. Some features may not work until all keys are set.
          </p>
        )}
      </div>

      {/* Security notice */}
      <div className="panel p-4 border-ares-amber/20 bg-ares-amber/5">
        <div className="flex items-start gap-3">
          <Shield size={16} className="text-ares-amber flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-[11px] font-mono font-bold text-ares-amber mb-1">SECURITY NOTICE</div>
            <p className="text-[10px] font-mono text-ares-textSub leading-relaxed">
              Keys stored here are saved to your Supabase database and protected by Row-Level Security.
              Only sessions you authorize can read them. For production use, prefer environment variables (VITE_*) in your Vercel deployment settings.
              Never share your Supabase service key or Binance secret on the frontend.
            </p>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-10"><Spinner /></div>
      )}

      {/* Category groups */}
      {!loading && categories.map(cat => {
        const items = grouped[cat] ?? [];
        const meta = CATEGORY_META[cat];
        const Icon = meta.icon;
        const filled = items.filter(s => edits[s.key]).length;
        return (
          <div key={cat} className="panel overflow-hidden">
            {/* Category header */}
            <div className="panel-header border-b border-ares-border bg-ares-raised">
              <Icon size={14} className={meta.color} />
              <span className="text-[11px] font-mono font-bold tracking-widest text-ares-text uppercase">{meta.label}</span>
              <span className="ml-2 text-[9px] font-mono text-ares-textMuted">{filled}/{items.length} set</span>
              <div className="ml-auto text-[9px] font-mono text-ares-textMuted max-w-xs text-right hidden lg:block">
                {meta.description}
              </div>
            </div>

            <div className="divide-y divide-ares-border">
              {items.map(s => {
                const isDirty = edits[s.key] !== s.value;
                const isVis = visible[s.key];
                const isSaving = saving === s.key;
                const isSaved = saved[s.key];
                return (
                  <div key={s.key} className="px-4 py-3 flex items-center gap-3 flex-wrap lg:flex-nowrap">
                    {/* Label */}
                    <div className="w-full lg:w-48 flex-shrink-0">
                      <div className="text-[10px] font-mono font-semibold text-ares-text">{s.label}</div>
                      <div className="text-[9px] font-mono text-ares-textMuted mt-0.5 uppercase tracking-wider">{s.key}</div>
                    </div>

                    {/* Input */}
                    <div className="flex-1 relative">
                      <input
                        type={s.is_secret && !isVis ? 'password' : 'text'}
                        className="ares-input pr-8 text-xs"
                        value={edits[s.key] ?? ''}
                        onChange={e => setEdits(prev => ({ ...prev, [s.key]: e.target.value }))}
                        placeholder={PLACEHOLDERS[s.key] ?? `Enter ${s.label.toLowerCase()}...`}
                      />
                      {s.is_secret && (
                        <button
                          onClick={() => setVisible(prev => ({ ...prev, [s.key]: !prev[s.key] }))}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ares-textMuted hover:text-ares-text transition-colors"
                        >
                          {isVis ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                      )}
                    </div>

                    {/* Status + save */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {edits[s.key] ? (
                        <span className="badge badge-active text-[9px]">SET</span>
                      ) : (
                        <span className="badge badge-inactive text-[9px]">EMPTY</span>
                      )}
                      <button
                        onClick={() => saveSetting(s.key)}
                        disabled={!isDirty || isSaving}
                        className={`btn py-1 px-3 text-[9px] ${isDirty ? 'btn-amber' : 'btn-ghost'}`}
                      >
                        {isSaving ? <RefreshCw size={9} className="animate-spin" /> :
                         isSaved ? <Check size={9} /> : <Save size={9} />}
                        {isSaved ? 'SAVED' : 'SAVE'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* How to get keys */}
      <div className="panel p-4 space-y-3">
        <div className="text-[10px] font-mono font-bold tracking-widest text-ares-textSub">HOW TO GET YOUR KEYS</div>
        {[
          { icon: Bot, color: 'text-ares-cyan', title: 'Telegram Bot Token', steps: ['Open Telegram and search for @BotFather', 'Send /newbot and follow the instructions', 'Copy the token (format: 12345:ABC...)', 'Get your Chat ID by messaging @userinfobot'] },
          { icon: Coins, color: 'text-ares-amber', title: 'Binance API Key', steps: ['Log in to Binance and go to Profile → API Management', 'Create a new API key (label it "Ares")', 'Enable "Read Info" and "Spot & Margin Trading" permissions', 'Copy both the API Key and Secret Key immediately'] },
          { icon: Database, color: 'text-ares-green', title: 'Supabase Keys', steps: ['Open your Supabase project dashboard', 'Go to Project Settings → API', 'Copy the Project URL and the anon/public key', 'Never use the service_role key on the frontend'] },
        ].map(g => {
          const Icon = g.icon;
          return (
            <div key={g.title} className="bg-ares-bg rounded-lg p-3 border border-ares-border">
              <div className="flex items-center gap-2 mb-2">
                <Icon size={12} className={g.color} />
                <span className="text-[10px] font-mono font-bold text-ares-text">{g.title}</span>
              </div>
              <ol className="space-y-0.5">
                {g.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-[9px] font-mono text-ares-textMuted">
                    <span className="text-ares-textMuted flex-shrink-0">{i + 1}.</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          );
        })}
      </div>
    </div>
  );
}
