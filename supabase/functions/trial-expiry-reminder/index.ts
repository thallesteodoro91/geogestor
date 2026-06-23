import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

import { corsFor } from "../_shared/cors.ts";

const logStep = (step: string, details?: unknown) => {
  console.log(`[TRIAL-EXPIRY-REMINDER] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Shared-secret guard — only trusted cron schedulers may invoke this endpoint
  const cronSecret = Deno.env.get("CRON_SECRET");
  const providedSecret = req.headers.get("x-cron-secret");
  if (!cronSecret || providedSecret !== cronSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    logStep("Looking for trialing subscriptions expiring in ~2 days");

    // Find tenants with trialing status expiring between now and 2.5 days from now
    // (window ensures daily cron doesn't miss anyone)
    const now = new Date();
    const twoDaysFromNow = new Date(now.getTime() + 2.5 * 24 * 60 * 60 * 1000);
    const oneDayFromNow = new Date(now.getTime() + 1.5 * 24 * 60 * 60 * 1000);

    const { data: expiringSubscriptions, error: subError } = await supabase
      .from("tenant_subscriptions")
      .select("tenant_id, current_period_end, plan:subscription_plans(name)")
      .eq("status", "trialing")
      .gte("current_period_end", oneDayFromNow.toISOString())
      .lte("current_period_end", twoDaysFromNow.toISOString());

    if (subError) {
      logStep("Error fetching subscriptions", subError);
      throw subError;
    }

    if (!expiringSubscriptions || expiringSubscriptions.length === 0) {
      logStep("No expiring trials found");
      return new Response(JSON.stringify({ sent: 0, reason: "no_expiring_trials" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep(`Found ${expiringSubscriptions.length} expiring trial(s)`);

    let sentCount = 0;

    for (const sub of expiringSubscriptions) {
      try {
        // Get tenant admin user email
        const { data: members, error: memberError } = await supabase
          .from("tenant_members")
          .select("user_id")
          .eq("tenant_id", sub.tenant_id)
          .eq("role", "admin");

        if (memberError || !members?.length) {
          logStep("No admin found for tenant", { tenant_id: sub.tenant_id });
          continue;
        }

        for (const member of members) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("email, full_name")
            .eq("id", member.user_id)
            .single();

          if (!profile?.email) continue;

          const periodEnd = new Date(sub.current_period_end!);
          const daysLeft = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          const expiryDate = periodEnd.toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          });

          const userName = profile.full_name || profile.email.split("@")[0];
          const planName = (sub.plan as any)?.name || "Completo";

          const html = `
<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:0;background:#ffffff">
  <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 24px;text-align:center;border-radius:0 0 24px 24px">
    <h1 style="color:#ffffff;font-size:24px;margin:0">⏰ Seu período de avaliação está acabando</h1>
  </div>
  
  <div style="padding:32px 24px">
    <p style="color:#333;font-size:16px;line-height:1.6;margin:0 0 16px">
      Olá, <strong>${userName}</strong>!
    </p>
    
    <p style="color:#333;font-size:16px;line-height:1.6;margin:0 0 16px">
      Seu período de avaliação do plano <strong>${planName}</strong> no GeoGestor expira em 
      <strong style="color:#dc2626">${daysLeft} dia${daysLeft !== 1 ? "s" : ""}</strong> 
      (${expiryDate}).
    </p>
    
    <p style="color:#333;font-size:16px;line-height:1.6;margin:0 0 24px">
      Após essa data, o acesso ao sistema será bloqueado. Assine agora para continuar usando todas as ferramentas sem interrupção.
    </p>

    <div style="text-align:center;margin:32px 0">
      <a href="https://geogestor.lovable.app/assinatura" 
         style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600;display:inline-block">
        ✨ Assinar agora
      </a>
    </div>

    <div style="background:#f8f9fa;border-radius:12px;padding:20px;margin:24px 0">
      <h3 style="color:#1a1a1a;font-size:14px;margin:0 0 12px">O que você ganha ao assinar:</h3>
      <ul style="color:#555;font-size:14px;line-height:1.8;margin:0;padding-left:20px">
        <li>Gestão financeira completa com KPIs e relatórios</li>
        <li>Importação de mapas KML/KMZ</li>
        <li>Geração de orçamentos em PDF</li>
        <li>Suporte prioritário</li>
        <li>Acesso offline via PWA</li>
      </ul>
    </div>

    <p style="color:#999;font-size:13px;text-align:center;margin:24px 0 0">
      Planos a partir de <strong style="color:#6366f1">R$ 70/mês</strong> no plano anual
    </p>
  </div>

  <hr style="border:none;border-top:1px solid #eee;margin:0">
  <p style="color:#999;font-size:12px;text-align:center;padding:16px 24px">
    Este email foi enviado automaticamente pelo GeoGestor.<br>
    <a href="https://geogestor.lovable.app" style="color:#6366f1">Acessar o sistema</a>
  </p>
</body>
</html>`;

          const emailResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${resendKey}`,
            },
            body: JSON.stringify({
              from: "GeoGestor <notifications@resend.dev>",
              to: [profile.email],
              subject: `⏰ Seu período de avaliação expira em ${daysLeft} dia${daysLeft !== 1 ? "s" : ""} — GeoGestor`,
              html,
            }),
          });

          if (emailResponse.ok) {
            const result = await emailResponse.json();
            logStep("Email sent", { email: profile.email, emailId: result.id });
            sentCount++;
          } else {
            const errText = await emailResponse.text();
            logStep("Resend error", { email: profile.email, status: emailResponse.status, body: errText });
          }
        }
      } catch (tenantError) {
        logStep("Error processing tenant", { tenant_id: sub.tenant_id, error: String(tenantError) });
      }
    }

    logStep(`Done. Sent ${sentCount} email(s)`);

    return new Response(JSON.stringify({ sent: sentCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
