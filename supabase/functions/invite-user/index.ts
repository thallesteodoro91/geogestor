import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

// --- Rate Limiter ---
class RateLimiter {
  private requests = new Map<string, { count: number; resetAt: number }>();
  constructor(private maxRequests: number, private windowMs: number) {}

  isRateLimited(ip: string): boolean {
    const now = Date.now();
    for (const [key, val] of this.requests) {
      if (val.resetAt <= now) this.requests.delete(key);
    }
    const entry = this.requests.get(ip);
    if (!entry) {
      this.requests.set(ip, { count: 1, resetAt: now + this.windowMs });
      return false;
    }
    if (entry.resetAt <= now) {
      this.requests.set(ip, { count: 1, resetAt: now + this.windowMs });
      return false;
    }
    entry.count++;
    return entry.count > this.maxRequests;
  }
}

const rateLimiter = new RateLimiter(5, 60_000);

import { corsFor } from "../_shared/cors.ts";

interface InviteRequest {
  email: string;
  role: "admin" | "user";
}

serve(async (req: Request): Promise<Response> => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting
  const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimiter.isRateLimited(clientIP)) {
    console.warn(JSON.stringify({ timestamp: new Date().toISOString(), event: "rate_limited", ip: clientIP, function: "invite-user" }));
    return new Response(
      JSON.stringify({ error: "Muitas requisições. Tente novamente em breve." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" } }
    );
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header");
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("User auth error:", userError);
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log("User authenticated:", user.id);

    const { email, role }: InviteRequest = await req.json();
    if (!email || !role) {
      return new Response(JSON.stringify({ error: "Email e role são obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log("Invite request:", { email, role });

    const { data: memberData, error: memberError } = await supabase
      .from("tenant_members").select("tenant_id, role").eq("user_id", user.id).single();

    if (memberError || !memberData) {
      console.error("Tenant member error:", memberError);
      return new Response(JSON.stringify({ error: "Usuário não pertence a nenhum tenant" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (memberData.role !== "admin") {
      return new Response(JSON.stringify({ error: "Apenas administradores podem convidar usuários" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const tenantId = memberData.tenant_id;
    console.log("Tenant ID:", tenantId);

    const { data: limitCheck, error: limitError } = await supabase.rpc("check_user_limit", { p_tenant_id: tenantId });

    if (limitError) {
      console.error("Limit check error:", limitError);
      return new Response(JSON.stringify({ error: "Erro ao verificar limite de usuários" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const limit = limitCheck?.[0];
    if (!limit?.can_invite) {
      return new Response(JSON.stringify({ error: `Limite de usuários atingido (${limit?.current_users}/${limit?.max_users}). Faça upgrade do plano.` }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log("Limit check passed:", limit);

    const { data: existingInvite } = await supabase
      .from("tenant_invites").select("id").eq("tenant_id", tenantId).eq("email", email.toLowerCase()).is("accepted_at", null).gt("expires_at", new Date().toISOString()).maybeSingle();

    if (existingInvite) {
      return new Response(JSON.stringify({ error: "Já existe um convite pendente para este email" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data: invite, error: inviteError } = await supabase
      .from("tenant_invites")
      .insert({ tenant_id: tenantId, email: email.toLowerCase(), role, token, expires_at: expiresAt.toISOString(), created_by: user.id })
      .select().single();

    if (inviteError) {
      console.error("Invite creation error:", inviteError);
      return new Response(JSON.stringify({ error: "Erro ao criar convite" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log("Invite created:", invite.id);

    const { data: tenant } = await supabase.from("tenants").select("name").eq("id", tenantId).single();

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey) {
      try {
        const resend = new Resend(resendApiKey);
        const appUrl = Deno.env.get("APP_URL") || "https://geogestor.lovable.app";
        const inviteUrl = `${appUrl}/aceitar-convite?token=${token}`;

        await resend.emails.send({
          from: "GeoGestor <noreply@resend.dev>",
          to: [email],
          subject: `Convite para ${tenant?.name || "GeoGestor"}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #1a365d;">Você foi convidado!</h1>
              <p>Você recebeu um convite para participar de <strong>${tenant?.name || "uma empresa"}</strong> no GeoGestor.</p>
              <p>Clique no botão abaixo para aceitar o convite:</p>
              <a href="${inviteUrl}" style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">Aceitar Convite</a>
              <p style="color: #666; font-size: 14px;">Este convite expira em 7 dias.</p>
              <p style="color: #666; font-size: 12px;">Se você não esperava este convite, pode ignorar este email.</p>
            </div>
          `,
        });
        console.log("Email sent to:", email);
      } catch (emailError) {
        console.error("Email send error:", emailError);
      }
    } else {
      console.warn("RESEND_API_KEY not configured, skipping email");
    }

    return new Response(
      JSON.stringify({ success: true, message: "Convite enviado com sucesso", invite: { id: invite.id, email: invite.email, expires_at: invite.expires_at } }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Erro interno do servidor" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
