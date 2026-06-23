import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

class RateLimiter {
  private requests = new Map<string, { count: number; resetAt: number }>();
  constructor(private maxRequests: number, private windowMs: number) {}
  isRateLimited(ip: string): boolean {
    const now = Date.now();
    for (const [key, val] of this.requests) { if (val.resetAt <= now) this.requests.delete(key); }
    const entry = this.requests.get(ip);
    if (!entry) { this.requests.set(ip, { count: 1, resetAt: now + this.windowMs }); return false; }
    if (entry.resetAt <= now) { this.requests.set(ip, { count: 1, resetAt: now + this.windowMs }); return false; }
    entry.count++;
    return entry.count > this.maxRequests;
  }
}
const rateLimiter = new RateLimiter(5, 60_000);

import { corsFor } from "../_shared/cors.ts";

const logStep = (step: string, details?: unknown) => {
  console.log(`[EMAIL-NOTIFICATIONS] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimiter.isRateLimited(clientIP)) {
    return new Response(JSON.stringify({ error: "Muitas requisições. Tente novamente em breve." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" } });
  }

  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user?.email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    logStep("User authenticated", { email: user.email });

    // Fetch pending payments (due within 3 days)
    const { data: alertas } = await supabase
      .from("vw_alertas_financeiros")
      .select("*")
      .or("status_alerta.eq.proximo_vencimento,status_alerta.eq.vencido");

    // Fetch overdue client tasks
    const { data: tarefasAtrasadas } = await supabase
      .from("cliente_tarefas")
      .select("titulo, data_vencimento, id_cliente, dim_cliente:dim_cliente!cliente_tarefas_id_cliente_fkey(nome)")
      .eq("concluida", false)
      .lt("data_vencimento", new Date().toISOString().split("T")[0]);

    // Fetch pending budgets (not converted, created > 7 days ago)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { data: orcamentosPendentes } = await supabase
      .from("fato_orcamento")
      .select("codigo_orcamento, receita_esperada, data_orcamento, dim_cliente:dim_cliente!fk_orcamento_cliente(nome)")
      .eq("orcamento_convertido", false)
      .is("situacao", null)
      .lt("data_orcamento", sevenDaysAgo.toISOString().split("T")[0])
      .limit(10);

    const hasAlerts = (alertas?.length || 0) > 0;
    const hasTasks = (tarefasAtrasadas?.length || 0) > 0;
    const hasBudgets = (orcamentosPendentes?.length || 0) > 0;

    if (!hasAlerts && !hasTasks && !hasBudgets) {
      logStep("No notifications to send");
      return new Response(JSON.stringify({ sent: false, reason: "no_alerts" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build HTML email
    const sections: string[] = [];

    if (hasAlerts) {
      const rows = alertas!.map(a => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #eee">${a.cliente_nome || "—"}</td>
          <td style="padding:8px;border-bottom:1px solid #eee">${a.codigo_orcamento || "—"}</td>
          <td style="padding:8px;border-bottom:1px solid #eee">R$ ${(a.receita_esperada || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
          <td style="padding:8px;border-bottom:1px solid #eee">
            <span style="color:${a.status_alerta === "vencido" ? "#dc2626" : "#f59e0b"};font-weight:600">
              ${a.status_alerta === "vencido" ? "⚠️ Vencido" : "⏰ Próximo"}
            </span>
          </td>
        </tr>
      `).join("");

      sections.push(`
        <h2 style="color:#1a1a1a;font-size:16px;margin:24px 0 12px">💰 Pagamentos Pendentes (${alertas!.length})</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <thead><tr style="background:#f5f5f5">
            <th style="padding:8px;text-align:left">Cliente</th>
            <th style="padding:8px;text-align:left">Código</th>
            <th style="padding:8px;text-align:left">Valor</th>
            <th style="padding:8px;text-align:left">Status</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `);
    }

    if (hasTasks) {
      const taskItems = tarefasAtrasadas!.map(t => {
        const clienteNome = (t as any).dim_cliente?.nome || "—";
        return `<li style="margin:4px 0;color:#333">${t.titulo} — <em>${clienteNome}</em> (venceu em ${t.data_vencimento})</li>`;
      }).join("");

      sections.push(`
        <h2 style="color:#1a1a1a;font-size:16px;margin:24px 0 12px">📋 Tarefas Atrasadas (${tarefasAtrasadas!.length})</h2>
        <ul style="padding-left:20px;font-size:14px">${taskItems}</ul>
      `);
    }

    if (hasBudgets) {
      const budgetItems = orcamentosPendentes!.map(o => {
        const clienteNome = (o as any).dim_cliente?.nome || "—";
        return `<li style="margin:4px 0;color:#333">${o.codigo_orcamento || "S/N"} — ${clienteNome} — R$ ${(o.receita_esperada || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</li>`;
      }).join("");

      sections.push(`
        <h2 style="color:#1a1a1a;font-size:16px;margin:24px 0 12px">📝 Orçamentos Pendentes há +7 dias (${orcamentosPendentes!.length})</h2>
        <ul style="padding-left:20px;font-size:14px">${budgetItems}</ul>
      `);
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#ffffff">
        <div style="text-align:center;margin-bottom:24px">
          <h1 style="color:#1a1a1a;font-size:20px;margin:0">📊 Resumo de Notificações</h1>
          <p style="color:#666;font-size:13px;margin:4px 0 0">GeoGestor — ${new Date().toLocaleDateString("pt-BR")}</p>
        </div>
        ${sections.join("")}
        <hr style="border:none;border-top:1px solid #eee;margin:32px 0">
        <p style="color:#999;font-size:12px;text-align:center">
          Este email foi enviado automaticamente pelo GeoGestor.<br>
          <a href="https://geogestor.lovable.app" style="color:#666">Acessar o sistema</a>
        </p>
      </body>
      </html>
    `;

    // Send via Resend
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: "GeoGestor <notifications@resend.dev>",
        to: [user.email],
        subject: `📊 GeoGestor — ${alertas?.length || 0} pagamentos, ${tarefasAtrasadas?.length || 0} tarefas atrasadas`,
        html,
      }),
    });

    if (!emailResponse.ok) {
      const errText = await emailResponse.text();
      logStep("Resend error", { status: emailResponse.status, body: errText });
      throw new Error(`Resend error: ${emailResponse.status}`);
    }

    const emailResult = await emailResponse.json();
    logStep("Email sent", { emailId: emailResult.id });

    return new Response(JSON.stringify({ 
      sent: true, 
      emailId: emailResult.id,
      summary: {
        pagamentos: alertas?.length || 0,
        tarefas_atrasadas: tarefasAtrasadas?.length || 0,
        orcamentos_pendentes: orcamentosPendentes?.length || 0,
      }
    }), {
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
