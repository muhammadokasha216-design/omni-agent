import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RelayRequest {
  action: "test" | "send";
  message?: string;
  chat_id?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Fetch bot token and chat_id from app_settings table
    const settingsRes = await fetch(`${supabaseUrl}/rest/v1/app_settings?key=in.(telegram_bot_token,telegram_chat_id)&select=key,value`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
    });

    const settingsRows: { key: string; value: string }[] = await settingsRes.json();
    const tokenRow = settingsRows.find(r => r.key === "telegram_bot_token");
    const chatRow  = settingsRows.find(r => r.key === "telegram_chat_id");

    const botToken = tokenRow?.value ?? "";
    const defaultChatId = chatRow?.value ?? "";

    if (!botToken) {
      return new Response(
        JSON.stringify({ ok: false, error: "telegram_bot_token not configured in app_settings" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: RelayRequest = await req.json().catch(() => ({ action: "test" }));

    // Test action: call getMe to verify token works
    if (body.action === "test") {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      const data = await res.json();
      return new Response(
        JSON.stringify({ ok: data.ok === true, bot: data.result?.username ?? null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send action: send a message to the configured chat
    if (body.action === "send") {
      const chatId = body.chat_id || defaultChatId;
      const message = body.message ?? "ARES OMNI-AGENT — Ping";

      if (!chatId) {
        return new Response(
          JSON.stringify({ ok: false, error: "No chat_id provided or configured" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "Markdown",
        }),
      });

      const data = await res.json();

      // Log the outbound message
      await fetch(`${supabaseUrl}/rest/v1/telegram_messages`, {
        method: "POST",
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          direction: "outbound",
          chat_id: chatId,
          message_text: message,
          status: data.ok ? "processed" : "failed",
          processed_at: new Date().toISOString(),
        }),
      });

      return new Response(
        JSON.stringify({ ok: data.ok === true, message_id: data.result?.message_id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: false, error: "Unknown action. Use 'test' or 'send'." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
