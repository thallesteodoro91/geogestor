import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AcceptRequest {
  token: string;
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

    console.log("User authenticated:", user.id, user.email);

    // Parse request body
    const { token }: AcceptRequest = await req.json();
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Accept invite request for token:", token);

    // Use service role for operations
    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find invite by token
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("tenant_invites")
      .select("*")
      .eq("token", token)
      .is("accepted_at", null)
      .single();

    if (inviteError || !invite) {
      console.error("Invite not found:", inviteError);
      return new Response(
        JSON.stringify({ error: "Convite não encontrado ou já foi usado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Found invite:", invite.id, invite.email);

    // Check if invite is expired
    if (new Date(invite.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Este convite expirou" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user email matches invite email
    if (user.email?.toLowerCase() !== invite.email.toLowerCase()) {
      return new Response(
        JSON.stringify({ 
          error: `Este convite foi enviado para ${invite.email}. Faça login com esse email.` 
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is already a member of this tenant
    const { data: existingMember } = await supabaseAdmin
      .from("tenant_members")
      .select("id")
      .eq("tenant_id", invite.tenant_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingMember) {
      // Update invite as accepted
      await supabaseAdmin
        .from("tenant_invites")
        .update({ accepted_at: new Date().toISOString() })
        .eq("id", invite.id);

      return new Response(
        JSON.stringify({ error: "Você já é membro desta empresa" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is member of another tenant
    const { data: otherMember } = await supabaseAdmin
      .from("tenant_members")
      .select("id, tenant:tenants(name)")
      .eq("user_id", user.id)
      .maybeSingle();

    if (otherMember) {
      return new Response(
        JSON.stringify({ 
          error: "Você já é membro de outra empresa. Não é possível participar de múltiplas empresas." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user limit is still valid
    const { data: limitCheck, error: limitError } = await supabaseAdmin
      .rpc("check_user_limit", { p_tenant_id: invite.tenant_id });

    const limit = limitCheck?.[0];
    if (!limit?.can_invite) {
      return new Response(
        JSON.stringify({ 
          error: "A empresa atingiu o limite de usuários. Contate o administrador." 
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Add user as tenant member
    const { error: memberError } = await supabaseAdmin
      .from("tenant_members")
      .insert({
        tenant_id: invite.tenant_id,
        user_id: user.id,
        role: invite.role,
      });

    if (memberError) {
      console.error("Member creation error:", memberError);
      return new Response(
        JSON.stringify({ error: "Erro ao adicionar usuário à empresa" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("User added as member:", user.id, invite.role);

    // Mark invite as accepted
    const { error: updateError } = await supabaseAdmin
      .from("tenant_invites")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invite.id);

    if (updateError) {
      console.error("Invite update error:", updateError);
    }

    // Get tenant name for response
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("name")
      .eq("id", invite.tenant_id)
      .single();

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Bem-vindo à ${tenant?.name || "empresa"}!`,
        tenant_id: invite.tenant_id
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
