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
    const { task } = body as { task?: "daily_summary" | "proactive_check" | "intruder_scan" };

    // Fetch all active admins for notifications
    const adminsRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?role=in.(super_admin,admin)&account_status=eq.active&select=user_id,email`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    );
    const admins: { user_id: string; email: string }[] = await adminsRes.json();

    if (admins.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, message: "No active admins found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ──── DAILY SUMMARY (9 AM) ────
    if (task === "daily_summary") {
      for (const admin of admins) {
        // Call ares-brain for summary
        const brainRes = await fetch(`${supabaseUrl}/functions/v1/ares-brain`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseKey}`,
            apikey: supabaseKey,
          },
          body: JSON.stringify({
            action: "daily_summary",
            user_id: admin.user_id,
          }),
        });
        const brainData = await brainRes.json();

        if (brainData.ok && brainData.summary) {
          // Send via Telegram
          const tgRes = await fetch(`${supabaseUrl}/functions/v1/telegram-relay`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseKey}`,
              apikey: supabaseKey,
            },
            body: JSON.stringify({
              action: "send",
              message: brainData.summary,
            }),
          });
        }
      }

      return new Response(
        JSON.stringify({ ok: true, sent: admins.length }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ──── PROACTIVE CHECK (every 30 min) ────
    if (task === "proactive_check") {
      const notifications: string[] = [];

      for (const admin of admins) {
        const brainRes = await fetch(`${supabaseUrl}/functions/v1/ares-brain`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseKey}`,
            apikey: supabaseKey,
          },
          body: JSON.stringify({
            action: "proactive_check",
            user_id: admin.user_id,
          }),
        });
        const brainData = await brainRes.json();

        if (brainData.ok && brainData.message) {
          // Only send if there's something worth notifying about
          if (brainData.message.includes("critical") || brainData.message.includes("red") || brainData.message.includes("risk")) {
            await fetch(`${supabaseUrl}/functions/v1/telegram-relay`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${supabaseKey}`,
                apikey: supabaseKey,
              },
              body: JSON.stringify({
                action: "send",
                message: brainData.message,
              }),
            });
            notifications.push(admin.email);
          }
        }
      }

      return new Response(
        JSON.stringify({ ok: true, notifications_sent: notifications.length, to: notifications }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ──── INTRUDER SCAN ────
    if (task === "intruder_scan") {
      // Check for 3+ failed attempts in last hour
      const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      const attemptsRes = await fetch(
        `${supabaseUrl}/rest/v1/login_attempts?success=eq.false&attempted_at=gte.${cutoff}&select=email,ip_address`,
        {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
        }
      );
      const attempts: { email: string; ip_address: string }[] = await attemptsRes.json();

      // Count per email
      const counts: Record<string, { count: number; ips: Set<string> }> = {};
      for (const a of attempts) {
        if (!counts[a.email]) counts[a.email] = { count: 0, ips: new Set() };
        counts[a.email].count++;
        if (a.ip_address) counts[a.email].ips.add(a.ip_address);
      }

      const intruders: { email: string; attempts: number; ips: string[] }[] = [];
      for (const [email, data] of Object.entries(counts)) {
        if (data.count >= 3) {
          intruders.push({ email, attempts: data.count, ips: Array.from(data.ips) });

          // Check if already blacklisted
          const blRes = await fetch(
            `${supabaseUrl}/rest/v1/blacklist?value=eq.${email}&select=id`,
            {
              headers: {
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`,
              },
            }
          );
          const bl: any[] = await blRes.json();

          if (bl.length === 0) {
            // Auto-lock the user if exists
            await fetch(`${supabaseUrl}/rest/v1/profiles?email=eq.${email}`, {
              method: "PATCH",
              headers: {
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ account_status: "suspended" }),
            });

            // Add to blacklist
            await fetch(`${supabaseUrl}/rest/v1/blacklist`, {
              method: "POST",
              headers: {
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                type: "email",
                value: email,
                reason: `${data.count} failed login attempts in 1 hour from IPs: ${Array.from(data.ips).join(", ")}`,
              }),
            });

            // Also blacklist IPs
            for (const ip of data.ips) {
              await fetch(`${supabaseUrl}/rest/v1/blacklist`, {
                method: "POST",
                headers: {
                  apikey: supabaseKey,
                  Authorization: `Bearer ${supabaseKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  type: "ip",
                  value: ip,
                  reason: `Source of brute-force against ${email}`,
                }),
              });
            }
          }
        }
      }

      // Alert admins via Telegram
      if (intruders.length > 0) {
        const alertMsg = `🚨 *INTRUDER ALERT*\n\n` +
          intruders.map(i =>
            `• Email: \`${i.email}\` — ${i.attempts} failed attempts from ${i.ips.length} IP(s)\n  IPs: ${i.ips.join(", ")}\n  Status: AUTO-SUSPENDED & BLACKLISTED`
          ).join("\n\n") +
          `\n\nReply /allow ${intruders[0]?.email ?? ""} to release, or /block to keep locked.`;

        await fetch(`${supabaseUrl}/functions/v1/telegram-relay`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseKey}`,
            apikey: supabaseKey,
          },
          body: JSON.stringify({ action: "send", message: alertMsg }),
        });
      }

      return new Response(
        JSON.stringify({ ok: true, intruders_detected: intruders.length, intruders }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: false, error: "Unknown task. Use: daily_summary, proactive_check, intruder_scan" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
