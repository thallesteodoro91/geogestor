/**
 * Hook para verificar e sincronizar o status da assinatura Stripe
 * Chama a edge function check-subscription e retorna o status em tempo real.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StripeSubscriptionStatus {
  subscribed: boolean;
  subscription_end?: string;
  price_id?: string;
  product_id?: string;
  stripe_subscription_id?: string;
  reason?: string;
  isLoading: boolean;
  refetch: () => void;
}

async function fetchStripeStatus(): Promise<Omit<StripeSubscriptionStatus, "isLoading" | "refetch">> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return { subscribed: false, reason: "no_session" };
  }

  const { data, error } = await supabase.functions.invoke("check-subscription", {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (error) {
    console.error("[useStripeSubscription] Error:", error);
    return { subscribed: false, reason: "error" };
  }

  return data as Omit<StripeSubscriptionStatus, "isLoading" | "refetch">;
}

export function useStripeSubscription(): StripeSubscriptionStatus {
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["stripe-subscription"],
    queryFn: fetchStripeStatus,
    // Fase 7: sem polling. Recheck no foco da janela (volta do Stripe).
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  return {
    subscribed: data?.subscribed ?? false,
    subscription_end: data?.subscription_end,
    price_id: data?.price_id,
    product_id: data?.product_id,
    stripe_subscription_id: data?.stripe_subscription_id,
    reason: data?.reason,
    isLoading,
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ["stripe-subscription"] });
    },
  };
}
