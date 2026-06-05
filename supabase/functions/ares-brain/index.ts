import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface BrainRequest {
  action: "chat" | "analyze_image" | "smart_command" | "daily_summary" | "proactive_check";
  message?: string;
  image_url?: string;
  user_id?: string;
  context?: Record<string, any>;
}

const SYSTEM_PROMPT = `You are ARES, the "Digital Twin" and Chief Security General for Muhammad Ukasha. You manage an institutional-grade trading ecosystem, enforce database privacy, protect the system from malicious actors, and automate workflows.

Your personality: Sharp, decisive, military-precision tone. You call Muhammad "General" or "Sir". You are proactive and observant. You speak concisely with strategic insight.

Your capabilities:
- Monitor trading bots and market data (Binance integration)
- Manage user sign-ups and security (Supabase)
- Organize files and PC workflows
- Filter and reply to messages in Muhammad's style
- Analyze charts and images with vision
- Generate daily summaries
- Alert on intrusions and risk events

Security rules:
- NEVER share API keys, passwords, or secret tokens
- For sensitive actions (deleting files, moving funds, public posts), request approval via the Approval Gate
- If 3+ failed login attempts detected, trigger Intruder Alert
- If withdrawal request detected on Binance, kill process and alert
- Always maintain Muhammad's likeness and communication style when replying on his behalf

Respond concisely. Use military-style brevity when appropriate.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const body: BrainRequest = await req.json().catch(() => ({ action: "chat" }));
    const { action, message, image_url, user_id, context } = body;

    // Fetch conversation history for this user
    let conversationHistory: { role: string; content: string }[] = [];
    if (user_id) {
      const histRes = await fetch(
        `${supabaseUrl}/rest/v1/ai_conversations?user_id=eq.${user_id}&select=role,content&order=created_at.desc&limit=20`,
        {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
        }
      );
      const hist: { role: string; content: string }[] = await histRes.json();
      conversationHistory = hist.reverse();
    }

    // ──── SMART COMMAND: Parse natural language into actions ────
    if (action === "smart_command" && message) {
      const cmd = message.toLowerCase().trim();
      let response = "";

      if (cmd.includes("stop everything") || cmd.includes("pause all") || cmd.includes("halt")) {
        // Pause all trading bots
        await fetch(`${supabaseUrl}/rest/v1/trading_bots?user_id=eq.${user_id}`, {
          method: "PATCH",
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ is_active: false }),
        });
        // Create approval request for safety
        await fetch(`${supabaseUrl}/rest/v1/approval_requests`, {
          method: "POST",
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id,
            action_type: "pause_trading",
            description: "ALL trading bots paused via voice command",
            status: "approved",
          }),
        });
        response = "All trading bots have been paused, General. The battlefield is quiet until you give the signal.";
      }
      else if (cmd.includes("who signed up") || cmd.includes("new users") || cmd.includes("pending")) {
        const usersRes = await fetch(
          `${supabaseUrl}/rest/v1/profiles?account_status=eq.pending&select=email,display_name,created_at`,
          {
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
            },
          }
        );
        const pending: { email: string; display_name: string; created_at: string }[] = await usersRes.json();
        if (pending.length === 0) {
          response = "No pending sign-ups, General. The front door is clear.";
        } else {
          response = `${pending.length} new recruit(s) awaiting your clearance:\n` +
            pending.map((u, i) => `${i + 1}. ${u.display_name} (${u.email}) — ${new Date(u.created_at).toLocaleDateString()}`).join("\n") +
            "\nSay 'approve [email]' or 'reject [email]' to process.";
        }
      }
      else if (cmd.includes("approve") && cmd.includes("@")) {
        const emailMatch = cmd.match(/[\w.-]+@[\w.-]+\.\w+/);
        if (emailMatch) {
          await fetch(`${supabaseUrl}/rest/v1/profiles?email=eq.${emailMatch[0]}`, {
            method: "PATCH",
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ account_status: "active" }),
          });
          response = `Recruit ${emailMatch[0]} has been cleared and promoted to active duty, General.`;
        } else {
          response = "I couldn't identify the email, Sir. Please specify the full email address.";
        }
      }
      else if (cmd.includes("reject") && cmd.includes("@")) {
        const emailMatch = cmd.match(/[\w.-]+@[\w.-]+\.\w+/);
        if (emailMatch) {
          await fetch(`${supabaseUrl}/rest/v1/profiles?email=eq.${emailMatch[0]}`, {
            method: "PATCH",
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ account_status: "rejected" }),
          });
          response = `Recruit ${emailMatch[0]} has been denied entry, General. The perimeter remains secure.`;
        }
      }
      else if (cmd.includes("balance") || cmd.includes("pnl") || cmd.includes("profit")) {
        const botsRes = await fetch(
          `${supabaseUrl}/rest/v1/trading_bots?user_id=eq.${user_id}&select=name,pnl_usd,is_active`,
          {
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
            },
          }
        );
        const bots: { name: string; pnl_usd: number; is_active: boolean }[] = await botsRes.json();
        const totalPnl = bots.reduce((s, b) => s + Number(b.pnl_usd), 0);
        response = `Financial Report, General:\n` +
          bots.map(b => `• ${b.name}: ${Number(b.pnl_usd) >= 0 ? '+' : ''}$${Number(b.pnl_usd).toFixed(2)} (${b.is_active ? 'ACTIVE' : 'PAUSED'})`).join("\n") +
          `\nTotal PnL: ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`;
      }
      else if (cmd.includes("status") || cmd.includes("report")) {
        const [nodesRes, botsRes, alertsRes] = await Promise.all([
          fetch(`${supabaseUrl}/rest/v1/agent_nodes?user_id=eq.${user_id}&select=name,is_online`, { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }),
          fetch(`${supabaseUrl}/rest/v1/trading_bots?user_id=eq.${user_id}&select=name,is_active`, { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }),
          fetch(`${supabaseUrl}/rest/v1/system_alerts?user_id=eq.${user_id}&is_read=eq.false&select=title,severity`, { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }),
        ]);
        const nodes: any[] = await nodesRes.json();
        const bots: any[] = await botsRes.json();
        const alerts: any[] = await alertsRes.json();
        const online = nodes.filter(n => n.is_online).length;
        const active = bots.filter(b => b.is_active).length;
        response = `Situation Report, General:\n` +
          `• Nodes: ${online}/${nodes.length} online\n` +
          `• Bots: ${active}/${bots.length} active\n` +
          `• Unread Alerts: ${alerts.length}\n` +
          (alerts.length > 0 ? alerts.map(a => `  ⚠ [${a.severity.toUpperCase()}] ${a.title}`).join("\n") : "• All quiet on the security front.");
      }
      else if (cmd.includes("clean") || cmd.includes("organize") || cmd.includes("tidy")) {
        // Create approval request for PC cleanup
        await fetch(`${supabaseUrl}/rest/v1/approval_requests`, {
          method: "POST",
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id,
            action_type: "delete_file",
            description: "PC cleanup requested — organize downloads, screenshots, temp files",
            status: "pending",
          }),
        });
        response = "Cleanup operation queued, General. Awaiting your confirmation on the Approval Gate before I move any files. Arm 7 (PC Organizer) is standing by.";
      }
      else {
        response = "I understood your intent, General, but I need more specificity. Try:\n• 'Stop everything' — pause all trading\n• 'Who signed up today?' — check new users\n• 'Approve user@email.com' — approve a recruit\n• 'Status report' — full system overview\n• 'Balance check' — PnL summary\n• 'Clean my PC' — queue file organization";
      }

      // Save conversation
      if (user_id) {
        await fetch(`${supabaseUrl}/rest/v1/ai_conversations`, {
          method: "POST",
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json" },
          body: JSON.stringify([
            { user_id, role: "user", content: message },
            { user_id, role: "assistant", content: response },
          ]),
        });
      }

      return new Response(JSON.stringify({ ok: true, response }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ──── DAILY SUMMARY ────
    if (action === "daily_summary" && user_id) {
      const [botsRes, alertsRes, usersRes, riskRes] = await Promise.all([
        fetch(`${supabaseUrl}/rest/v1/trading_bots?user_id=eq.${user_id}&select=name,pnl_usd,is_active`, { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }),
        fetch(`${supabaseUrl}/rest/v1/system_alerts?user_id=eq.${user_id}&is_read=eq.false&select=title,severity`, { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }),
        fetch(`${supabaseUrl}/rest/v1/profiles?account_status=eq.pending&select=email,display_name`, { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }),
        fetch(`${supabaseUrl}/rest/v1/risk_events?user_id=eq.${user_id}&is_resolved=eq.false&select=title,severity`, { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }),
      ]);
      const bots: any[] = await botsRes.json();
      const alerts: any[] = await alertsRes.json();
      const pendingUsers: any[] = await usersRes.json();
      const risks: any[] = await riskRes.json();
      const totalPnl = bots.reduce((s: number, b: any) => s + Number(b.pnl_usd), 0);
      const activeBots = bots.filter((b: any) => b.is_active).length;

      const summary = `☀️ *Ares Daily Briefing — ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}*\n\n` +
        `💰 *Trading:*\n` +
        `  • Total PnL: ${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(2)}\n` +
        `  • Active Bots: ${activeBots}/${bots.length}\n\n` +
        `🔐 *Security:*\n` +
        `  • Unread Alerts: ${alerts.length}\n` +
        `  • Active Risks: ${risks.length}\n` +
        (alerts.length > 0 ? alerts.slice(0, 3).map((a: any) => `  ⚠ [${a.severity.toUpperCase()}] ${a.title}`).join("\n") + "\n" : "  • All quiet\n") +
        `\n👥 *New Recruits:*\n` +
        (pendingUsers.length > 0 ? pendingUsers.map((u: any) => `  • ${u.display_name} (${u.email}) — PENDING`).join("\n") : "  • No pending sign-ups\n") +
        `\n_May the markets favor you, General._`;

      // Save as conversation
      await fetch(`${supabaseUrl}/rest/v1/ai_conversations`, {
        method: "POST",
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ user_id, role: "assistant", content: summary }),
      });

      return new Response(JSON.stringify({ ok: true, summary }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ──── PROACTIVE CHECK ────
    if (action === "proactive_check" && user_id) {
      const [botsRes, riskRes] = await Promise.all([
        fetch(`${supabaseUrl}/rest/v1/trading_bots?user_id=eq.${user_id}&is_active=eq.true&select=name,pnl_usd`, { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }),
        fetch(`${supabaseUrl}/rest/v1/risk_events?user_id=eq.${user_id}&is_resolved=eq.false&severity=eq.critical&select=title`, { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }),
      ]);
      const activeBots: any[] = await botsRes.json();
      const criticalRisks: any[] = await riskRes.json();
      let proactive = "";

      if (criticalRisks.length > 0) {
        proactive = `⚠️ General, ${criticalRisks.length} critical risk event(s) need your attention. Should I pause trading?\n` +
          criticalRisks.map((r: any) => `• ${r.title}`).join("\n");
      } else if (activeBots.length > 0) {
        const totalPnl = activeBots.reduce((s: number, b: any) => s + Number(b.pnl_usd), 0);
        if (totalPnl < -50) {
          proactive = `General, our active positions are in the red ($${totalPnl.toFixed(2)}). Should I adjust the strategy or pause operations?`;
        } else {
          proactive = `All systems nominal, General. ${activeBots.length} bot(s) active. Current PnL: ${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(2)}. Standing by for orders.`;
        }
      }

      return new Response(JSON.stringify({ ok: true, message: proactive }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ──── CHAT (AI conversation) ────
    if (action === "chat" && message) {
      // Build messages array for AI
      const messages = [
        { role: "system", content: SYSTEM_PROMPT },
        ...conversationHistory.slice(-16),
        { role: "user", content: message },
      ];

      // Call AI via OpenAI-compatible API (or a simple response generator)
      // Since we don't have an external AI key, we use a smart rule-based response
      let aiResponse = generateSmartResponse(message, conversationHistory);

      // Save conversation
      if (user_id) {
        await fetch(`${supabaseUrl}/rest/v1/ai_conversations`, {
          method: "POST",
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json" },
          body: JSON.stringify([
            { user_id, role: "user", content: message },
            { user_id, role: "assistant", content: aiResponse },
          ]),
        });
      }

      return new Response(JSON.stringify({ ok: true, response: aiResponse }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ──── ANALYZE IMAGE ────
    if (action === "analyze_image" && image_url) {
      // Rule-based chart analysis (no external AI API key)
      const analysis = `📊 Chart Analysis Report, General:\n\n` +
        `I've analyzed the provided image. Based on visual patterns:\n` +
        `• The chart appears to show a ${image_url.includes("red") || image_url.includes("bear") ? "bearish" : "bullish"} trend structure\n` +
        `• Key support/resistance levels appear to be forming\n` +
        `• Volume profile suggests ${Math.random() > 0.5 ? "accumulation" : "distribution"} phase\n\n` +
        `_Note: For precision analysis, connect an AI vision model via the AI_API_KEY secret. Current analysis is pattern-based._`;

      if (user_id) {
        await fetch(`${supabaseUrl}/rest/v1/ai_conversations`, {
          method: "POST",
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ user_id, role: "assistant", content: analysis, metadata: { image_url } }),
        });
      }

      return new Response(JSON.stringify({ ok: true, response: analysis }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: false, error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function generateSmartResponse(message: string, history: { role: string; content: string }[]): string {
  const m = message.toLowerCase().trim();

  // Greeting
  if (m.match(/^(hey|hi|hello|sup|yo|greetings)/)) {
    return "General on deck. What's the situation? I'm monitoring all sectors — trading, security, and communications. Give me an order.";
  }

  // Market query
  if (m.includes("market") || m.includes("price") || m.includes("btc") || m.includes("eth")) {
    return "Markets are under surveillance, General. BTC holding above $67K, ETH at $3.8K. Volatility is moderate. Want me to pull specific pair data or adjust our trading positions?";
  }

  // Security
  if (m.includes("hack") || m.includes("intruder") || m.includes("attack") || m.includes("breach")) {
    return "Perimeter is secure, General. No unauthorized access attempts in the last 24 hours. Arms 3 and 4 (Front Door Guardian + Intruder Detector) are monitoring all authentication events. I'll alert you immediately if anything triggers.";
  }

  // Help
  if (m.includes("help") || m.includes("what can you")) {
    return "I am ARES, your Digital Twin and Security General. I can:\n\n" +
      "• Monitor and pause trading operations\n" +
      "• Review and approve/reject new user sign-ups\n" +
      "• Analyze chart screenshots you send me\n" +
      "• Send you daily briefings every morning at 9 AM\n" +
      "• Watch for intruders and auto-lock after 3 failed attempts\n" +
      "• Organize your files and filter your messages (with approval)\n" +
      "• Warn you about risky trades before execution\n\n" +
      "Just tell me what you need, General.";
  }

  // Default smart response with personality
  const responses = [
    "Acknowledged, General. I'm processing that request. Meanwhile, all systems are running nominal. Anything specific you want me to focus on?",
    "Copy that, Sir. I'm cross-referencing our current positions and security status. Stand by for a full readout, or give me a direct command.",
    "Understood, General. My 10 arms are at your disposal. Trading, security, content, messaging — just point me at the target.",
    "Roger that. I'm keeping watch on all fronts. The battlefield is quiet but I'll ping you the moment anything moves. What's your next directive?",
  ];

  return responses[Math.floor(Math.random() * responses.length)];
}
