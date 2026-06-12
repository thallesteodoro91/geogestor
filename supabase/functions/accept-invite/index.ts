import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

const rateLimiter = new RateLimiter(10, 60_000);

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "https://geogestor.lovable.app").split(",").map((s) => s.trim()).filter(Boolean);
const LOVABLE_PREVIEW_RE = /^https:\/\/[a-z0-9-]+\.lovable\.(app|dev)$/i;
const ALLOW_HDRS = "authorization, x-client-info, apikey, content-type";
function corsFor(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allow = (ALLOWED_ORIGINS.includes(origin) || LOVABLE_PREVIEW_RE.test(origin)) ? origin : (ALLOWED_ORIGINS[0] ?? "");
  return {
    "Access-Control-Allow-Origin": allow,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": ALLOW_HDRS,
  };
}

interface AcceptRequest {
  token: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting
  const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimiter.isRateLimited(clientIP)) {
    console.warn(JSON.stringify({ timestamp: new Date().toISOString(), event: "rate_limited", ip: clientIP, function: "accept-invite" }));
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

    console.log("User authenticated:", user.id, user.email);

    const { token }: AcceptRequest = await req.json();
    if (!token) {
      return new Response(JSON.stringify({ error: "Token é obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log("Accept invite request for token:", token);

    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("tenant_invites").select("*").eq("token", token).is("accepted_at", null).single();

    if (inviteError || !invite) {
      console.error("Invite not found:", inviteError);
      return new Response(JSON.stringify({ error: "Convite não encontrado ou já foi usado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log("Found invite:", invite.id, invite.email);

    if (new Date(invite.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Este convite expirou" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (user.email?.toLowerCase() !== invite.email.toLowerCase()) {
      return new Response(JSON.stringify({ error: `Este convite foi enviado para ${invite.email}. Faça login com esse email.` }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: existingMember } = await supabaseAdmin
      .from("tenant_members").select("id").eq("tenant_id", invite.tenant_id).eq("user_id", user.id).maybeSingle();

    if (existingMember) {
      await supabaseAdmin.from("tenant_invites").update({ accepted_at: new Date().toISOString() }).eq("id", invite.id);
      return new Response(JSON.stringify({ error: "Você já é membro desta empresa" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: otherMember } = await supabaseAdmin
      .from("tenant_members").select("id, tenant:tenants(name)").eq("user_id", user.id).maybeSingle();

    if (otherMember) {
      return new Response(JSON.stringify({ error: "Você já é membro de outra empresa. Não é possível participar de múltiplas empresas." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: limitCheck, error: limitError } = await supabaseAdmin.rpc("check_user_limit", { p_tenant_id: invite.tenant_id });
    const limit = limitCheck?.[0];
    if (!limit?.can_invite) {
      return new Response(JSON.stringify({ error: "A empresa atingiu o limite de usuários. Contate o administrador." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { error: memberError } = await supabaseAdmin
      .from("tenant_members").insert({ tenant_id: invite.tenant_id, user_id: user.id, role: invite.role });

    if (memberError) {
      console.error("Member creation error:", memberError);
      return new Response(JSON.stringify({ error: "Erro ao adicionar usuário à empresa" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log("User added as member:", user.id, invite.role);

    const { error: updateError } = await supabaseAdmin
      .from("tenant_invites").update({ accepted_at: new Date().toISOString() }).eq("id", invite.id);
    if (updateError) console.error("Invite update error:", updateError);

    const { data: tenant } = await supabaseAdmin.from("tenants").select("name").eq("id", invite.tenant_id).single();

    return new Response(
      JSON.stringify({ success: true, message: `Bem-vindo à ${tenant?.name || "empresa"}!`, tenant_id: invite.tenant_id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Erro interno do servidor" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
