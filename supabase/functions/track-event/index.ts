import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

import { corsFor } from "../_shared/cors.ts";

class RateLimiter {
  private requests = new Map<string, { count: number; resetAt: number }>();
  constructor(private maxRequests: number, private windowMs: number) {}
  isRateLimited(key: string): boolean {
    const now = Date.now();
    for (const [k, v] of this.requests) if (v.resetAt <= now) this.requests.delete(k);
    const e = this.requests.get(key);
    if (!e || e.resetAt <= now) {
      this.requests.set(key, { count: 1, resetAt: now + this.windowMs });
      return false;
    }
    e.count++;
    return e.count > this.maxRequests;
  }
}
const limiter = new RateLimiter(60, 60_000);

interface TrackBody {
  event_name: string;
  source?: string;
  competencia?: string;
  metadata?: Record<string, unknown>;
}

function validate(body: unknown): TrackBody {
  if (!body || typeof body !== "object") throw new Error("Invalid body");
  const b = body as Record<string, unknown>;
  if (typeof b.event_name !== "string" || b.event_name.length === 0 || b.event_name.length > 100) {
    throw new Error("event_name required (1-100 chars)");
  }
  if (b.source !== undefined && (typeof b.source !== "string" || b.source.length > 100)) {
    throw new Error("source must be string ≤100");
  }
  if (b.competencia !== undefined && (typeof b.competencia !== "string" || !/^\d{4}-\d{2}$/.test(b.competencia))) {
    throw new Error("competencia must match YYYY-MM");
  }
  if (b.metadata !== undefined && (typeof b.metadata !== "object" || b.metadata === null)) {
    throw new Error("metadata must be object");
  }
  return b as TrackBody;
}

serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (limiter.isRateLimited(user.id)) {
      return new Response(JSON.stringify({ error: "Rate limited" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = validate(await req.json());

    // Resolve tenant_id (best-effort, RLS-aware)
    let tenantId: string | null = null;
    const { data: member } = await supabase
      .from("tenant_members")
      .select("tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (member?.tenant_id) tenantId = member.tenant_id;

    const { error: insertErr } = await supabase.from("analytics_events").insert({
      tenant_id: tenantId,
      user_id: user.id,
      event_name: payload.event_name,
      source: payload.source ?? null,
      competencia: payload.competencia ?? null,
      metadata: payload.metadata ?? {},
    });

    if (insertErr) {
      console.error("[track-event] insert error", insertErr);
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
