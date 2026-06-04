import { useEffect, useState, useRef } from 'react';
import { Send, Terminal, RefreshCw, Trash2, Plus, X, Check, Bot } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Panel, PanelHeader, Badge, Empty } from '../components/ui';
import type { TelegramMessage } from '../lib/types';

const COMMAND_DOCS = [
  { cmd: '/status',   desc: 'Get current status of all nodes and bots' },
  { cmd: '/balance',  desc: 'Show exchange balances and open PnL' },
  { cmd: '/start_bot <name>', desc: 'Activate a trading bot by name' },
  { cmd: '/stop_bot <name>',  desc: 'Deactivate a trading bot' },
  { cmd: '/ping <node>',      desc: 'Ping a specific agent node' },
  { cmd: '/alert',    desc: 'List unread security alerts' },
  { cmd: '/trades',   desc: 'Recent trade executions summary' },
  { cmd: '/help',     desc: 'Show all available commands' },
];

// Simulated bot responses
function getBotReply(cmd: string): string {
  const c = cmd.toLowerCase().trim();
  if (c === '/status')   return '✅ ARES-PRIMARY: OFFLINE | ARES-TRADING: OFFLINE | ARES-MOBILE: OFFLINE\n⚡ Bots: 0/3 active | Alerts: 2 unread';
  if (c === '/balance')  return '💰 BTC: 0.0423 | ETH: 1.24 | USDT: 1,204.30\n📈 Unrealized PnL: +$247.83 | Daily: +$42.10';
  if (c.startsWith('/start_bot')) return `✅ Bot "${c.split(' ')[1] || 'unknown'}" activation queued.`;
  if (c.startsWith('/stop_bot'))  return `⏹️ Bot "${c.split(' ')[1] || 'unknown'}" stopping...`;
  if (c.startsWith('/ping'))      return `🔔 Pinging ${c.split(' ')[1] || 'node'}... timeout (node offline)`;
  if (c === '/alert')    return '🚨 2 alerts:\n• [CRITICAL] Unauthorized access from 185.234.219.14\n• [WARNING] ARES-PRIMARY offline >90s';
  if (c === '/trades')   return '📊 Last 24h: 0 trades\nTotal PnL: +$295.18 | Win rate: 62%';
  if (c === '/help')     return COMMAND_DOCS.map(d => `${d.cmd} — ${d.desc}`).join('\n');
  return `❓ Unknown command: ${cmd}\nType /help for available commands.`;
}

export default function TelegramBot() {
  const [messages, setMessages] = useState<TelegramMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [chatId, setChatId] = useState('100000001');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
    const ch = supabase
      .channel('telegram_rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'telegram_messages' }, () => loadMessages())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadMessages() {
    const { data } = await supabase
      .from('telegram_messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(50);
    if (data) setMessages(data);
  }

  async function sendCommand() {
    const cmd = input.trim();
    if (!cmd || sending) return;
    setSending(true);
    setInput('');

    try {
      // Insert inbound message
      await supabase.from('telegram_messages').insert({
        direction: 'inbound',
        chat_id: chatId,
        message_text: cmd,
        command: cmd.startsWith('/') ? cmd.split(' ')[0].slice(1) : null,
        status: 'processed',
        processed_at: new Date().toISOString(),
      });

      // Simulate bot processing delay
      await new Promise(r => setTimeout(r, 400 + Math.random() * 600));

      // Insert outbound reply
      const reply = getBotReply(cmd);
      await supabase.from('telegram_messages').insert({
        direction: 'outbound',
        chat_id: chatId,
        message_text: reply,
        command: null,
        status: 'processed',
        processed_at: new Date().toISOString(),
      });

      loadMessages();
    } finally {
      setSending(false);
    }
  }

  async function clearHistory() {
    await supabase.from('telegram_messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    setMessages([]);
  }

  return (
    <div className="space-y-4 animate-fade-up h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold font-mono tracking-widest text-ares-cyan glow-cyan uppercase">Telegram Bot</h1>
          <p className="text-[10px] font-mono text-ares-textMuted mt-0.5">Remote command orchestration — simulated interface</p>
        </div>
        <button onClick={clearHistory} className="btn btn-ghost">
          <Trash2 size={11} /> CLEAR
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chat window */}
        <div className="lg:col-span-2 panel flex flex-col" style={{ height: '60vh' }}>
          <div className="panel-header flex-shrink-0">
            <Bot size={13} className="text-ares-cyan" />
            <span className="text-[10px] font-mono font-bold tracking-widest text-ares-text">ARES BOT</span>
            <span className="ml-2 text-[9px] font-mono text-ares-textMuted">@AresOmniBot · Chat {chatId}</span>
            <span className="ml-auto flex items-center gap-1.5 text-[9px] font-mono text-ares-green">
              <span className="w-1.5 h-1.5 rounded-full bg-ares-green animate-pulse" /> ONLINE
            </span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <Empty message="No messages — try /help to see available commands" />
              </div>
            )}
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.direction === 'inbound' ? 'justify-end' : 'justify-start'} animate-fade-up`}>
                <div className={`max-w-[75%] ${msg.direction === 'inbound' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                  <div className={`px-3 py-2 rounded-lg text-[11px] font-mono whitespace-pre-line leading-relaxed
                    ${msg.direction === 'inbound'
                      ? 'bg-ares-cyan/10 border border-ares-cyan/20 text-ares-text rounded-br-none'
                      : 'bg-ares-elevated border border-ares-border text-ares-text rounded-bl-none'
                    }`}
                  >
                    {msg.message_text}
                  </div>
                  <span className="text-[9px] font-mono text-ares-textMuted">
                    {new Date(msg.created_at).toLocaleTimeString('en-US', { hour12: false })}
                    {msg.direction === 'inbound' && msg.command && (
                      <span className="ml-2 text-ares-amber">/{msg.command}</span>
                    )}
                  </span>
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="px-3 py-2 rounded-lg bg-ares-elevated border border-ares-border text-[11px] font-mono text-ares-textMuted">
                  <span className="animate-blink">▋</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex-shrink-0 border-t border-ares-border p-3">
            <div className="flex gap-2">
              <span className="text-ares-cyan font-mono text-sm self-center flex-shrink-0">/</span>
              <input
                className="ares-input flex-1"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendCommand()}
                placeholder="Type a command... (e.g. /status, /balance, /help)"
              />
              <button onClick={sendCommand} disabled={!input.trim() || sending} className="btn btn-amber flex-shrink-0">
                {sending ? <RefreshCw size={11} className="animate-spin" /> : <Send size={11} />}
                SEND
              </button>
            </div>
          </div>
        </div>

        {/* Command reference */}
        <div className="panel">
          <PanelHeader icon={<Terminal size={13} />} title="Command Reference" color="cyan" />
          <div className="divide-y divide-ares-border">
            {COMMAND_DOCS.map(doc => (
              <button
                key={doc.cmd}
                onClick={() => setInput(doc.cmd.split(' ')[0])}
                className="w-full text-left px-4 py-2.5 hover:bg-ares-elevated/60 transition-colors"
              >
                <div className="text-[11px] font-mono font-semibold text-ares-cyan">{doc.cmd}</div>
                <div className="text-[9px] font-mono text-ares-textMuted mt-0.5">{doc.desc}</div>
              </button>
            ))}
          </div>

          <div className="px-4 py-3 border-t border-ares-border">
            <div className="text-[9px] font-mono text-ares-textMuted mb-2 uppercase tracking-wider">Chat ID</div>
            <input
              className="ares-input text-xs"
              value={chatId}
              onChange={e => setChatId(e.target.value)}
              placeholder="Telegram chat ID"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
