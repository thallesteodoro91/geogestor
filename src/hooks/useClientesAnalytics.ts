import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ClienteReceita {
  cliente: string;
  receita: number;
  acumulado: number;
}

interface LTVData {
  mes: string;
  ltv: number;
}

interface ServicoRentabilidade {
  projeto: string;
  rentabilidade: number;
  receita: number;
  custo: number;
}

interface ClientesKPIs {
  totalClientes: number;
  ltvMedio: number;
  top3Percentual: number;
  cidadesAtivas: number;
}

export function useClientesAnalytics() {
  // Fetch all clients with their budgets and services for analytics
  const { data, isLoading, error } = useQuery({
    queryKey: ["clientes-analytics"],
    queryFn: async () => {
      // Fetch clients
      const { data: clientes, error: clientesError } = await supabase
        .from("dim_cliente")
        .select("id_cliente, nome");

      if (clientesError) throw clientesError;

      // Fetch budgets with receita_realizada
      const { data: orcamentos, error: orcamentosError } = await supabase
        .from("fato_orcamento")
        .select("id_cliente, receita_realizada, receita_esperada, data_orcamento");

      if (orcamentosError) throw orcamentosError;

      // Fetch services with receita and custo
      const { data: servicos, error: servicosError } = await supabase
        .from("fato_servico")
        .select("id_servico, id_cliente, nome_do_servico, receita_servico, custo_servico, situacao_do_servico");

      if (servicosError) throw servicosError;

      // Fetch properties for cities
      const { data: propriedades, error: propriedadesError } = await supabase
        .from("dim_propriedade")
        .select("cidade, municipio");

      if (propriedadesError) throw propriedadesError;

      return { clientes, orcamentos, servicos, propriedades };
    },
  });

  // Calculate derived analytics
  const analytics = useQuery({
    queryKey: ["clientes-analytics-derived", data],
    enabled: !!data,
    queryFn: () => {
      if (!data) return null;

      const { clientes, orcamentos, servicos, propriedades } = data;

      // Calculate revenue per client
      const clienteReceitaMap = new Map<string, { nome: string; receita: number }>();
      
      clientes?.forEach((c) => {
        clienteReceitaMap.set(c.id_cliente, { nome: c.nome, receita: 0 });
      });

      orcamentos?.forEach((o) => {
        if (o.id_cliente && clienteReceitaMap.has(o.id_cliente)) {
          const current = clienteReceitaMap.get(o.id_cliente)!;
          current.receita += Number(o.receita_realizada || o.receita_esperada || 0);
        }
      });

      // Sort by revenue descending for Pareto
      const sortedClientes = Array.from(clienteReceitaMap.entries())
        .map(([id, data]) => ({ id, ...data }))
        .filter((c) => c.receita > 0)
        .sort((a, b) => b.receita - a.receita);

      const totalReceita = sortedClientes.reduce((sum, c) => sum + c.receita, 0);

      // Pareto data (top 5 + others)
      let acumulado = 0;
      const paretoData: ClienteReceita[] = [];
      
      const topClientes = sortedClientes.slice(0, 4);
      const outrosReceita = sortedClientes.slice(4).reduce((sum, c) => sum + c.receita, 0);

      topClientes.forEach((c) => {
        acumulado += (c.receita / totalReceita) * 100;
        paretoData.push({
          cliente: c.nome.length > 15 ? c.nome.substring(0, 15) + "..." : c.nome,
          receita: c.receita,
          acumulado: Math.round(acumulado),
        });
      });

      if (outrosReceita > 0) {
        paretoData.push({
          cliente: "Outros",
          receita: outrosReceita,
          acumulado: 100,
        });
      }

      // LTV by month (last 6 months)
      const now = new Date();
      const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      const ltvData: LTVData[] = [];

      for (let i = 5; i >= 0; i--) {
        const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStart = targetDate.toISOString().split("T")[0];
        const nextMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 1);
        const monthEnd = nextMonth.toISOString().split("T")[0];

        const monthOrcamentos = orcamentos?.filter((o) => {
          const date = o.data_orcamento;
          return date >= monthStart && date < monthEnd;
        }) || [];

        const uniqueClients = new Set(monthOrcamentos.map((o) => o.id_cliente).filter(Boolean));
        const monthReceita = monthOrcamentos.reduce((sum, o) => sum + Number(o.receita_realizada || o.receita_esperada || 0), 0);
        const ltv = uniqueClients.size > 0 ? monthReceita / uniqueClients.size : 0;

        ltvData.push({
          mes: monthNames[targetDate.getMonth()],
          ltv: Math.round(ltv),
        });
      }

      // Service profitability
      const rentabilidadeData: ServicoRentabilidade[] = (servicos || [])
        .filter((s) => s.receita_servico && s.receita_servico > 0)
        .map((s) => {
          const receita = Number(s.receita_servico || 0);
          const custo = Number(s.custo_servico || 0);
          const rentabilidade = receita > 0 ? ((receita - custo) / receita) * 100 : 0;
          return {
            projeto: s.nome_do_servico.length > 20 ? s.nome_do_servico.substring(0, 20) + "..." : s.nome_do_servico,
            rentabilidade: Math.round(rentabilidade),
            receita,
            custo,
          };
        })
        .sort((a, b) => b.rentabilidade - a.rentabilidade)
        .slice(0, 6);

      // KPIs
      const totalClientes = clientes?.length || 0;
      
      const clientesComReceita = sortedClientes.filter((c) => c.receita > 0);
      const ltvMedio = clientesComReceita.length > 0 
        ? totalReceita / clientesComReceita.length 
        : 0;

      const top3Receita = sortedClientes.slice(0, 3).reduce((sum, c) => sum + c.receita, 0);
      const top3Percentual = totalReceita > 0 ? (top3Receita / totalReceita) * 100 : 0;

      const cidadesSet = new Set<string>();
      propriedades?.forEach((p) => {
        const cidade = p.cidade || p.municipio;
        if (cidade) cidadesSet.add(cidade.toLowerCase().trim());
      });
      const cidadesAtivas = cidadesSet.size;

      const kpis: ClientesKPIs = {
        totalClientes,
        ltvMedio,
        top3Percentual: Math.round(top3Percentual),
        cidadesAtivas,
      };

      return {
        paretoData: paretoData.length > 0 ? paretoData : null,
        ltvData: ltvData.filter((l) => l.ltv > 0).length > 0 ? ltvData : null,
        rentabilidadeData: rentabilidadeData.length > 0 ? rentabilidadeData : null,
        kpis,
      };
    },
  });

  return {
    isLoading: isLoading || analytics.isLoading,
    error: error || analytics.error,
    paretoData: analytics.data?.paretoData || [],
    ltvData: analytics.data?.ltvData || [],
    rentabilidadeData: analytics.data?.rentabilidadeData || [],
    kpis: analytics.data?.kpis || {
      totalClientes: 0,
      ltvMedio: 0,
      top3Percentual: 0,
      cidadesAtivas: 0,
    },
  };
}
