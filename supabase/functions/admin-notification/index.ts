import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const body = await req.json().catch(() => ({}));
    const { user_email, user_id, action } = body as {
      user_email?: string;
      user_id?: string;
      action?: "new_user" | "approved" | "rejected";
    };

    // Fetch admin's Telegram settings from app_settings
    const settingsRes = await fetch(
      `${supabaseUrl}/rest/v1/app_settings?key=in.(telegram_bot_token,telegram_chat_id)&select=key,value&user_id=eq.00000000-0000-0000-0000-000000000000`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    let settingsRows: { key: string; value: string }[] = [];
    try {
      settingsRows = await settingsRes.json();
    } catch {
      // Fallback: get settings without user_id filter (admin's settings)
      const fallbackRes = await fetch(
        `${supabaseUrl}/rest/v1/app_settings?key=in.(telegram_bot_token,telegram_chat_id)&select=key,value&limit=2`,
        {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
        }
      );
      settingsRows = await fallbackRes.json();
    }

    const tokenRow = settingsRows.find((r: any) => r.key === "telegram_bot_token");
    const chatRow  = settingsRows.find((r: any) => r.key === "telegram_chat_id");
    const botToken = tokenRow?.value ?? "";
    const chatId   = chatRow?.value ?? "";

    if (!botToken || !chatId) {
      return new Response(
        JSON.stringify({ ok: false, error: "Admin Telegram credentials not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let message = "";

    if (action === "new_user" || !action) {
      message =
        `🔔 *New User Registration*\n\n` +
        `Email: \`${user_email ?? "unknown"}\`\n` +
        `User ID: \`${user_id ?? "unknown"}\`\n\n` +
        `Reply with:\n` +
        `• \`/approve ${user_id}\` to activate\n` +
        `• \`/reject ${user_id}\` to deny access`;
    } else if (action === "approved") {
      message = `✅ *User Approved*\n\nEmail: \`${user_email ?? "unknown"}\`\nAccount has been activated.`;
    } else if (action === "rejected") {
      message = `❌ *User Rejected*\n\nEmail: \`${user_email ?? "unknown"}\`\nAccess has been denied.`;
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

    return new Response(
      JSON.stringify({ ok: data.ok === true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
