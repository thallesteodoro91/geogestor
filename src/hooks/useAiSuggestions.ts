import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AiSuggestion } from "@/lib/aiBatchApply";

export interface AiSuggestionRow extends AiSuggestion {
  title: string;
  description: string;
  rationale: string | null;
  action_payload: Record<string, unknown>;
  created_at: string;
}

export function useAiSuggestions(status: AiSuggestion["status"] = "pending") {
  return useQuery({
    queryKey: ["ai-suggestions", status],
    queryFn: async (): Promise<AiSuggestionRow[]> => {
      const { data, error } = await supabase
        .from("ai_suggestions")
        .select(
          "id, category, priority, depends_on, status, action_type, action_payload, title, description, rationale, created_at",
        )
        .eq("status", status)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as AiSuggestionRow[];
    },
    staleTime: 1000 * 30,
  });
}
