import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RelayRequest {
  action: "test" | "send" | "new_signup";
  message?: string;
  chat_id?: string;
  user_email?: string;
  user_id?: string;
}

async function getSettings(supabaseUrl: string, supabaseKey: string) {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/app_settings?key=in.(telegram_bot_token,telegram_chat_id)&select=key,value`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
    }
  );
  const rows: { key: string; value: string }[] = await res.json();
  return {
    botToken: rows.find(r => r.key === "telegram_bot_token")?.value ?? "",
    chatId:   rows.find(r => r.key === "telegram_chat_id")?.value ?? "",
  };
}

async function sendTelegram(botToken: string, chatId: string, text: string): Promise<{ ok: boolean; message_id?: number; error?: string }> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });
  const data = await res.json();
  if (data.ok) return { ok: true, message_id: data.result?.message_id };
  return { ok: false, error: data.description ?? "Unknown Telegram error" };
}

async function logMessage(supabaseUrl: string, supabaseKey: string, payload: Record<string, unknown>) {
  await fetch(`${supabaseUrl}/rest/v1/telegram_messages`, {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(payload),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const { botToken, chatId: defaultChatId } = await getSettings(supabaseUrl, supabaseKey);

    if (!botToken) {
      return new Response(
        JSON.stringify({ ok: false, error: "telegram_bot_token not configured in app_settings" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: RelayRequest = await req.json().catch(() => ({ action: "test" }));

    // ── TEST ─────────────────────────────────────────────────────────────────
    if (body.action === "test") {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      const data = await res.json();
      return new Response(
        JSON.stringify({ ok: data.ok === true, bot: data.result?.username ?? null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── SEND ─────────────────────────────────────────────────────────────────
    if (body.action === "send") {
      const chatId  = body.chat_id || defaultChatId;
      const message = body.message ?? "ARES OMNI-AGENT — Ping";

      if (!chatId) {
        return new Response(
          JSON.stringify({ ok: false, error: "No chat_id provided or configured" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const result = await sendTelegram(botToken, chatId, message);

      await logMessage(supabaseUrl, supabaseKey, {
        direction: "outbound",
        chat_id: chatId,
        message_text: message,
        status: result.ok ? "processed" : "failed",
        processed_at: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({ ok: result.ok, message_id: result.message_id, error: result.error }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── NEW SIGNUP ────────────────────────────────────────────────────────────
    if (body.action === "new_signup") {
      const chatId     = defaultChatId;
      const userEmail  = body.user_email ?? "unknown";
      const userId     = body.user_id    ?? "unknown";

      if (!chatId) {
        return new Response(
          JSON.stringify({ ok: false, error: "telegram_chat_id not configured" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const message =
        `🆕 *New User Registration Request*\n\n` +
        `📧 Email: \`${userEmail}\`\n` +
        `🆔 ID: \`${userId}\`\n\n` +
        `Reply with:\n` +
        `/approve ${userId}\n` +
        `/reject ${userId}`;

      const result = await sendTelegram(botToken, chatId, message);

      await logMessage(supabaseUrl, supabaseKey, {
        direction: "outbound",
        chat_id: chatId,
        message_text: message,
        status: result.ok ? "processed" : "failed",
        processed_at: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({ ok: result.ok, message_id: result.message_id, error: result.error }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: false, error: "Unknown action. Use: test | send | new_signup" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
