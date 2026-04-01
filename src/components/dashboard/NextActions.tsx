import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { FileText, Briefcase, DollarSign, ArrowRight } from "lucide-react";

interface ActionItem {
  id: string;
  icon: typeof FileText;
  label: string;
  detail: string;
  href: string;
  color: string;
}

export function NextActions() {
  const navigate = useNavigate();

  const { data: actions = [] } = useQuery({
    queryKey: ["next-actions"],
    queryFn: async () => {
      const [orcPendentes, servSemProgresso, pagReceber] = await Promise.all([
        // Orçamentos pendentes de aprovação
        supabase
          .from("fato_orcamento")
          .select("id_orcamento, receita_esperada", { count: "exact" })
          .in("situacao", ["Pendente", "Em Análise", "Em Negociação"])
          .eq("orcamento_convertido", false),
        // Serviços sem progresso (Em Andamento com 0%)
        supabase
          .from("fato_servico")
          .select("id_servico", { count: "exact", head: true })
          .eq("situacao_do_servico", "Em Andamento")
          .lte("progresso", 0),
        // Pagamentos a receber
        supabase
          .from("fato_orcamento")
          .select("id_orcamento, receita_esperada")
          .eq("situacao_do_pagamento", "Pendente")
          .eq("orcamento_convertido", true),
      ]);

      const items: ActionItem[] = [];

      const orcCount = orcPendentes.count || orcPendentes.data?.length || 0;
      if (orcCount > 0) {
        const valorTotal = (orcPendentes.data || []).reduce((acc, o) => acc + (o.receita_esperada || 0), 0);
        items.push({
          id: "aprovar-orc",
          icon: FileText,
          label: `Aprovar ${orcCount} orçamento(s)`,
          detail: `R$ ${valorTotal.toLocaleString("pt-BR")} em pipeline`,
          href: "/servicos-orcamentos",
          color: "text-primary",
        });
      }

      const servCount = servSemProgresso.count || 0;
      if (servCount > 0) {
        items.push({
          id: "atualizar-serv",
          icon: Briefcase,
          label: `Atualizar ${servCount} serviço(s)`,
          detail: "Em andamento sem progresso registrado",
          href: "/servicos",
          color: "text-amber-500",
        });
      }

      const pagCount = pagReceber.data?.length || 0;
      if (pagCount > 0) {
        const valorReceber = (pagReceber.data || []).reduce((acc, o) => acc + (o.receita_esperada || 0), 0);
        items.push({
          id: "cobrar-pag",
          icon: DollarSign,
          label: `Cobrar ${pagCount} pagamento(s)`,
          detail: `R$ ${valorReceber.toLocaleString("pt-BR")} a receber`,
          href: "/servicos-orcamentos",
          color: "text-emerald-500",
        });
      }

      return items;
    },
    staleTime: 120_000,
  });

  if (actions.length === 0) return null;

  return (
    <Card className="p-5 border-0 bg-gradient-to-r from-muted/30 to-transparent">
      <h3 className="text-sm font-heading font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        📋 Próximas Ações
      </h3>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={() => navigate(action.href)}
            className="flex items-center gap-3 rounded-lg p-3 bg-card border hover:border-primary/30 hover:shadow-sm transition-all text-left group"
          >
            <action.icon className={`h-5 w-5 shrink-0 ${action.color}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{action.label}</p>
              <p className="text-xs text-muted-foreground truncate">{action.detail}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
          </button>
        ))}
      </div>
    </Card>
  );
}
