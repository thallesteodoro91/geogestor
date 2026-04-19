import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertCircle, TrendingDown, TrendingUp, Clock, Calendar,
  UserX, DollarSign, Award, Target, LucideIcon,
} from "lucide-react";

export type InsightSeverity = "urgent" | "attention" | "opportunity";

export interface Insight {
  id: string;
  severity: InsightSeverity;
  title: string;
  explanation: string;
  impact: string;
  impactValue: number;
  ctaLabel: string;
  ctaHref: string;
  icon: LucideIcon;
}

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });

export function useActionableInsights() {
  return useQuery({
    queryKey: ["actionable-insights"],
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<Insight[]> => {
      const today = new Date();
      const todayISO = today.toISOString().slice(0, 10);
      const sevenDaysAgo = new Date(today.getTime() - 7 * 86400000).toISOString().slice(0, 10);
      const ninetyDaysAgo = new Date(today.getTime() - 90 * 86400000).toISOString().slice(0, 10);

      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
      const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().slice(0, 10);
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().slice(0, 10);

      const [
        overdue, lossServices, pendingBudgets, lateServices,
        inactiveClients, topClient, topService,
        thisMonthOrc, lastMonthOrc, thisMonthExp, lastMonthExp,
      ] = await Promise.all([
        // 1. Pagamentos vencidos
        supabase
          .from("fato_orcamento")
          .select("id_orcamento, receita_esperada, data_do_faturamento")
          .eq("situacao_do_pagamento", "Pendente")
          .lt("data_do_faturamento", todayISO),
        // 2. Serviços com prejuízo
        supabase
          .from("fato_servico")
          .select("id_servico, nome_do_servico, receita_servico, custo_servico")
          .gt("custo_servico", 0),
        // 3. Orçamentos pendentes >7 dias
        supabase
          .from("fato_orcamento")
          .select("id_orcamento, receita_esperada")
          .in("situacao", ["Pendente", "Em Análise", "Em Negociação"])
          .eq("orcamento_convertido", false)
          .lt("data_orcamento", sevenDaysAgo),
        // 4. Serviços atrasados
        supabase
          .from("fato_servico")
          .select("id_servico", { count: "exact", head: true })
          .neq("situacao_do_servico", "Concluído")
          .neq("situacao_do_servico", "Cancelado")
          .lt("data_do_servico_fim", todayISO),
        // 5. Clientes sem projeto há 90+ dias
        supabase
          .from("dim_cliente")
          .select("id_cliente, fato_servico!fk_servico_cliente(id_servico, created_at)")
          .lt("created_at", ninetyDaysAgo),
        // 6. Top cliente do mês
        supabase
          .from("fato_orcamento")
          .select("id_cliente, receita_esperada, dim_cliente!fk_orcamento_cliente(nome)")
          .gte("data_orcamento", monthStart)
          .not("receita_esperada", "is", null),
        // 7. Serviço mais lucrativo do mês
        supabase
          .from("fato_servico")
          .select("nome_do_servico, receita_servico, custo_servico")
          .gte("data_do_servico_inicio", monthStart),
        // 8/9/10/11. Comparações mês atual vs anterior
        supabase.from("fato_orcamento").select("receita_esperada, lucro_esperado").gte("data_orcamento", monthStart),
        supabase.from("fato_orcamento").select("receita_esperada, lucro_esperado").gte("data_orcamento", lastMonthStart).lte("data_orcamento", lastMonthEnd),
        supabase.from("fato_despesas").select("valor_da_despesa").gte("data_da_despesa", monthStart),
        supabase.from("fato_despesas").select("valor_da_despesa").gte("data_da_despesa", lastMonthStart).lte("data_da_despesa", lastMonthEnd),
      ]);

      const insights: Insight[] = [];

      // 1. Pagamentos vencidos
      const overdueRows = overdue.data || [];
      if (overdueRows.length > 0) {
        const total = overdueRows.reduce((s, r) => s + (Number(r.receita_esperada) || 0), 0);
        insights.push({
          id: "overdue-payments",
          severity: "urgent",
          title: `${overdueRows.length} ${overdueRows.length === 1 ? "pagamento atrasado" : "pagamentos atrasados"}`,
          explanation: "Esses valores já passaram da data de vencimento e ainda não foram pagos.",
          impact: `${fmtBRL(total)} a receber`,
          impactValue: total,
          ctaLabel: "Cobrar agora",
          ctaHref: "/servicos-orcamentos",
          icon: AlertCircle,
        });
      }

      // 2. Serviço com prejuízo (pior caso)
      const losses = (lossServices.data || [])
        .map(s => ({ ...s, prejuizo: (Number(s.custo_servico) || 0) - (Number(s.receita_servico) || 0) }))
        .filter(s => s.prejuizo > 0)
        .sort((a, b) => b.prejuizo - a.prejuizo);
      if (losses.length > 0) {
        const worst = losses[0];
        insights.push({
          id: "loss-service",
          severity: "urgent",
          title: `Serviço "${worst.nome_do_servico}" está dando prejuízo`,
          explanation: losses.length > 1 ? `Existem ${losses.length} serviços com custo maior que a receita.` : "O custo desse serviço superou a receita gerada.",
          impact: `Prejuízo de ${fmtBRL(worst.prejuizo)}`,
          impactValue: worst.prejuizo,
          ctaLabel: "Revisar custos",
          ctaHref: "/projetos",
          icon: TrendingDown,
        });
      }

      // 3/4. Lucro caiu / Receita cresceu
      const sumRev = (rows: any[] | null) => (rows || []).reduce((s, r) => s + (Number(r.receita_esperada) || 0), 0);
      const sumProfit = (rows: any[] | null) => (rows || []).reduce((s, r) => s + (Number(r.lucro_esperado) || 0), 0);
      const profitNow = sumProfit(thisMonthOrc.data);
      const profitLast = sumProfit(lastMonthOrc.data);
      const revNow = sumRev(thisMonthOrc.data);
      const revLast = sumRev(lastMonthOrc.data);

      if (profitLast > 0 && profitNow < profitLast) {
        const drop = ((profitLast - profitNow) / profitLast) * 100;
        if (drop > 20) {
          insights.push({
            id: "profit-drop",
            severity: "urgent",
            title: `Seu lucro caiu ${drop.toFixed(0)}% este mês`,
            explanation: "Comparado ao mês anterior, o lucro esperado diminuiu significativamente.",
            impact: `${fmtBRL(profitLast - profitNow)} a menos`,
            impactValue: profitLast - profitNow,
            ctaLabel: "Ver dashboard financeiro",
            ctaHref: "/dashboard-financeiro",
            icon: TrendingDown,
          });
        }
      }

      // 5. Orçamentos pendentes >7 dias
      const pending = pendingBudgets.data || [];
      if (pending.length > 0) {
        const total = pending.reduce((s, r) => s + (Number(r.receita_esperada) || 0), 0);
        insights.push({
          id: "stale-budgets",
          severity: "attention",
          title: `${pending.length} ${pending.length === 1 ? "orçamento" : "orçamentos"} sem resposta há mais de 1 semana`,
          explanation: "Clientes podem ter esquecido. Um contato pode acelerar o fechamento.",
          impact: `${fmtBRL(total)} em negociação`,
          impactValue: total,
          ctaLabel: "Ver orçamentos",
          ctaHref: "/servicos-orcamentos",
          icon: Clock,
        });
      }

      // 6. Serviços atrasados
      if ((lateServices.count || 0) > 0) {
        insights.push({
          id: "late-services",
          severity: "attention",
          title: `${lateServices.count} ${lateServices.count === 1 ? "projeto passou" : "projetos passaram"} do prazo`,
          explanation: "A data de término já passou, mas o projeto não foi marcado como concluído.",
          impact: "Atualize o status",
          impactValue: (lateServices.count || 0) * 1000,
          ctaLabel: "Ver projetos",
          ctaHref: "/projetos",
          icon: Calendar,
        });
      }

      // 7. Clientes sem projeto há 90+ dias
      const inactive = (inactiveClients.data || []).filter((c: any) => {
        const servicos = c.fato_servico || [];
        if (servicos.length === 0) return true;
        const lastDate = Math.max(...servicos.map((s: any) => new Date(s.created_at).getTime()));
        return lastDate < new Date(ninetyDaysAgo).getTime();
      });
      if (inactive.length >= 3) {
        insights.push({
          id: "inactive-clients",
          severity: "attention",
          title: `${inactive.length} clientes sem nenhum projeto ativo`,
          explanation: "Esses clientes não têm projetos há mais de 90 dias. Reativá-los pode gerar receita.",
          impact: "Oportunidade de reativação",
          impactValue: inactive.length * 500,
          ctaLabel: "Ver clientes",
          ctaHref: "/clientes",
          icon: UserX,
        });
      }

      // 8. Custos subiram
      const expNow = (thisMonthExp.data || []).reduce((s, r) => s + (Number(r.valor_da_despesa) || 0), 0);
      const expLast = (lastMonthExp.data || []).reduce((s, r) => s + (Number(r.valor_da_despesa) || 0), 0);
      if (expLast > 0 && expNow > expLast) {
        const rise = ((expNow - expLast) / expLast) * 100;
        if (rise > 15) {
          insights.push({
            id: "expense-rise",
            severity: "attention",
            title: `Suas despesas subiram ${rise.toFixed(0)}% este mês`,
            explanation: "O total gasto este mês está acima do mês anterior.",
            impact: `${fmtBRL(expNow - expLast)} a mais`,
            impactValue: expNow - expLast,
            ctaLabel: "Ver despesas",
            ctaHref: "/despesas",
            icon: DollarSign,
          });
        }
      }

      // 9. Top cliente do mês (oportunidade)
      const clienteAgg = new Map<string, { nome: string; receita: number }>();
      (topClient.data || []).forEach((r: any) => {
        const nome = r.dim_cliente?.nome || "Cliente";
        const cur = clienteAgg.get(r.id_cliente) || { nome, receita: 0 };
        cur.receita += Number(r.receita_esperada) || 0;
        clienteAgg.set(r.id_cliente, cur);
      });
      const topClienteArr = [...clienteAgg.values()].sort((a, b) => b.receita - a.receita);
      if (topClienteArr.length > 0 && topClienteArr[0].receita > 0) {
        const top = topClienteArr[0];
        insights.push({
          id: "top-client",
          severity: "opportunity",
          title: `${top.nome} é seu cliente mais rentável do mês`,
          explanation: "Considere oferecer novos serviços ou um contrato recorrente.",
          impact: `${fmtBRL(top.receita)} gerados`,
          impactValue: top.receita,
          ctaLabel: "Ver cliente",
          ctaHref: "/clientes",
          icon: Award,
        });
      }

      // 10. Serviço mais lucrativo
      const servAgg = new Map<string, number>();
      (topService.data || []).forEach((s: any) => {
        const lucro = (Number(s.receita_servico) || 0) - (Number(s.custo_servico) || 0);
        servAgg.set(s.nome_do_servico, (servAgg.get(s.nome_do_servico) || 0) + lucro);
      });
      const topServ = [...servAgg.entries()].sort((a, b) => b[1] - a[1])[0];
      if (topServ && topServ[1] > 0) {
        insights.push({
          id: "top-service",
          severity: "opportunity",
          title: `"${topServ[0]}" é seu serviço mais lucrativo este mês`,
          explanation: "Foque sua estratégia comercial nesse tipo de serviço.",
          impact: `${fmtBRL(topServ[1])} de lucro`,
          impactValue: topServ[1],
          ctaLabel: "Ver projetos",
          ctaHref: "/projetos",
          icon: Target,
        });
      }

      // 11. Crescimento de receita
      if (revLast > 0 && revNow > revLast) {
        const growth = ((revNow - revLast) / revLast) * 100;
        if (growth > 10) {
          insights.push({
            id: "revenue-growth",
            severity: "opportunity",
            title: `Sua receita cresceu ${growth.toFixed(0)}% este mês`,
            explanation: "Ótimo momento para investir em marketing ou expandir a equipe.",
            impact: `${fmtBRL(revNow - revLast)} a mais`,
            impactValue: revNow - revLast,
            ctaLabel: "Ver dashboard",
            ctaHref: "/dashboard-financeiro",
            icon: TrendingUp,
          });
        }
      }

      // Ordenar: urgent > attention > opportunity, dentro de cada por impactValue desc
      const order: Record<InsightSeverity, number> = { urgent: 0, attention: 1, opportunity: 2 };
      insights.sort((a, b) => {
        if (order[a.severity] !== order[b.severity]) return order[a.severity] - order[b.severity];
        return b.impactValue - a.impactValue;
      });

      // Limitar oportunidades a 2
      const urgents = insights.filter(i => i.severity === "urgent");
      const attentions = insights.filter(i => i.severity === "attention");
      const opportunities = insights.filter(i => i.severity === "opportunity").slice(0, 2);

      return [...urgents, ...attentions, ...opportunities].slice(0, 7);
    },
  });
}
