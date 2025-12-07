import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InviteRequest {
  email: string;
  role: "admin" | "user";
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header");
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client with user's token
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("User auth error:", userError);
      return new Response(
        JSON.stringify({ error: "Usuário não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("User authenticated:", user.id);

    // Parse request body
    const { email, role }: InviteRequest = await req.json();
    if (!email || !role) {
      return new Response(
        JSON.stringify({ error: "Email e role são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Invite request:", { email, role });

    // Get user's tenant
    const { data: memberData, error: memberError } = await supabase
      .from("tenant_members")
      .select("tenant_id, role")
      .eq("user_id", user.id)
      .single();

    if (memberError || !memberData) {
      console.error("Tenant member error:", memberError);
      return new Response(
        JSON.stringify({ error: "Usuário não pertence a nenhum tenant" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin
    if (memberData.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Apenas administradores podem convidar usuários" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tenantId = memberData.tenant_id;
    console.log("Tenant ID:", tenantId);

    // Check user limit via database function
    const { data: limitCheck, error: limitError } = await supabase
      .rpc("check_user_limit", { p_tenant_id: tenantId });

    if (limitError) {
      console.error("Limit check error:", limitError);
      return new Response(
        JSON.stringify({ error: "Erro ao verificar limite de usuários" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const limit = limitCheck?.[0];
    if (!limit?.can_invite) {
      return new Response(
        JSON.stringify({ 
          error: `Limite de usuários atingido (${limit?.current_users}/${limit?.max_users}). Faça upgrade do plano.` 
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Limit check passed:", limit);

    // Check if email already has pending invite
    const { data: existingInvite } = await supabase
      .from("tenant_invites")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("email", email.toLowerCase())
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (existingInvite) {
      return new Response(
        JSON.stringify({ error: "Já existe um convite pendente para este email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is already a member
    const { data: existingMember } = await supabase
      .from("tenant_members")
      .select("id, user_id")
      .eq("tenant_id", tenantId)
      .single();

    // Get all members to check if email exists
    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Generate unique token
    const token = crypto.randomUUID();
    
    // Set expiration to 7 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Create invite record
    const { data: invite, error: inviteError } = await supabase
      .from("tenant_invites")
      .insert({
        tenant_id: tenantId,
        email: email.toLowerCase(),
        role: role,
        token: token,
        expires_at: expiresAt.toISOString(),
        created_by: user.id,
      })
      .select()
      .single();

    if (inviteError) {
      console.error("Invite creation error:", inviteError);
      return new Response(
        JSON.stringify({ error: "Erro ao criar convite" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Invite created:", invite.id);

    // Get tenant name for email
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name")
      .eq("id", tenantId)
      .single();

    // Send invitation email via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey) {
      try {
        const resend = new Resend(resendApiKey);
        const appUrl = Deno.env.get("APP_URL") || "https://skygeo360.lovable.app";
        const inviteUrl = `${appUrl}/aceitar-convite?token=${token}`;

        await resend.emails.send({
          from: "SkyGeo 360 <noreply@resend.dev>",
          to: [email],
          subject: `Convite para ${tenant?.name || "SkyGeo 360"}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #1a365d;">Você foi convidado!</h1>
              <p>Você recebeu um convite para participar de <strong>${tenant?.name || "uma empresa"}</strong> no SkyGeo 360.</p>
              <p>Clique no botão abaixo para aceitar o convite:</p>
              <a href="${inviteUrl}" 
                 style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; 
                        text-decoration: none; border-radius: 6px; margin: 16px 0;">
                Aceitar Convite
              </a>
              <p style="color: #666; font-size: 14px;">Este convite expira em 7 dias.</p>
              <p style="color: #666; font-size: 12px;">Se você não esperava este convite, pode ignorar este email.</p>
            </div>
          `,
        });
        console.log("Email sent to:", email);
      } catch (emailError) {
        console.error("Email send error:", emailError);
        // Don't fail the request if email fails
      }
    } else {
      console.warn("RESEND_API_KEY not configured, skipping email");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Convite enviado com sucesso",
        invite: { id: invite.id, email: invite.email, expires_at: invite.expires_at }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
