import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDashboardMetrics, calculateDerivedKPIs } from "./useDashboardMetrics";
import { startOfMonth, endOfMonth, subMonths, format, getWeek, startOfWeek, endOfWeek, eachWeekOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

interface RelatorioParams {
  mes: number; // 0-11
  ano: number;
  customInicio?: string; // yyyy-MM-dd
  customFim?: string;    // yyyy-MM-dd
}

export interface DadoSemanal {
  semana: string;
  entradas: number;
  saidas: number;
}

export interface ReceitaCategoria {
  categoria: string;
  valor: number;
}

export interface ClienteNovo {
  nome: string;
  data_cadastro: string;
  telefone: string | null;
  email: string | null;
}

export interface ServicoCusto {
  nome: string;
  receita: number;
  custo: number;
  margem: number;
}

export interface OrcamentoPendente {
  codigo: string | null;
  cliente: string;
  valor: number;
  data_faturamento: string | null;
}

export function useRelatorioData({ mes, ano, customInicio, customFim }: RelatorioParams) {
  const dataInicio = customInicio || format(startOfMonth(new Date(ano, mes)), "yyyy-MM-dd");
  const dataFim = customFim || format(endOfMonth(new Date(ano, mes)), "yyyy-MM-dd");

  const mesAnteriorDate = subMonths(new Date(ano, mes, 1), 1);
  const dataInicioAnterior = format(startOfMonth(mesAnteriorDate), "yyyy-MM-dd");
  const dataFimAnterior = format(endOfMonth(mesAnteriorDate), "yyyy-MM-dd");

  const metricsAtual = useDashboardMetrics({ dataInicio, dataFim });
  const metricsAnterior = useDashboardMetrics({ dataInicio: dataInicioAnterior, dataFim: dataFimAnterior });

  // Novos clientes do período
  const clientesQuery = useQuery({
    queryKey: ["relatorio-clientes", dataInicio, dataFim],
    queryFn: async (): Promise<ClienteNovo[]> => {
      const { data, error } = await supabase
        .from("dim_cliente")
        .select("nome, data_cadastro, telefone, email")
        .gte("data_cadastro", dataInicio)
        .lte("data_cadastro", dataFim)
        .order("data_cadastro", { ascending: false });
      if (error) throw error;
      return (data || []) as ClienteNovo[];
    },
  });

  // Serviços com maior custo
  const servicosQuery = useQuery({
    queryKey: ["relatorio-servicos-custo", dataInicio, dataFim],
    queryFn: async (): Promise<ServicoCusto[]> => {
      const { data, error } = await supabase
        .from("fato_servico")
        .select("nome_do_servico, receita_servico, custo_servico")
        .or(`data_do_servico_inicio.gte.${dataInicio},data_do_servico_inicio.is.null`)
        .lte("data_do_servico_inicio", dataFim)
        .order("custo_servico", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data || []).map((s) => ({
        nome: s.nome_do_servico,
        receita: s.receita_servico || 0,
        custo: s.custo_servico || 0,
        margem: s.receita_servico && s.receita_servico > 0
          ? ((s.receita_servico - (s.custo_servico || 0)) / s.receita_servico) * 100
          : 0,
      }));
    },
  });

  // Orçamentos pendentes
  const orcamentosQuery = useQuery({
    queryKey: ["relatorio-orcamentos-pendentes", dataInicio, dataFim],
    queryFn: async (): Promise<OrcamentoPendente[]> => {
      const { data, error } = await supabase
        .from("fato_orcamento")
        .select("codigo_orcamento, receita_esperada, data_do_faturamento, id_cliente, dim_cliente(nome)")
        .eq("situacao_do_pagamento", "Pendente")
        .gte("data_orcamento", dataInicio)
        .lte("data_orcamento", dataFim)
        .order("receita_esperada", { ascending: false });
      if (error) throw error;
      return (data || []).map((o: any) => ({
        codigo: o.codigo_orcamento,
        cliente: o.dim_cliente?.nome || "—",
        valor: o.receita_esperada || 0,
        data_faturamento: o.data_do_faturamento,
      }));
    },
  });

  // Dados semanais (entradas/saídas)
  const semanaisQuery = useQuery({
    queryKey: ["relatorio-semanal", dataInicio, dataFim],
    queryFn: async (): Promise<DadoSemanal[]> => {
      const inicio = startOfMonth(new Date(ano, mes));
      const fim = endOfMonth(new Date(ano, mes));
      const weeks = eachWeekOfInterval({ start: inicio, end: fim }, { weekStartsOn: 1 });

      const { data: orcamentos } = await supabase
        .from("fato_orcamento")
        .select("data_orcamento, receita_esperada")
        .gte("data_orcamento", dataInicio)
        .lte("data_orcamento", dataFim);

      const { data: despesas } = await supabase
        .from("fato_despesas")
        .select("data_da_despesa, valor_da_despesa")
        .gte("data_da_despesa", dataInicio)
        .lte("data_da_despesa", dataFim);

      return weeks.map((weekStart, i) => {
        const wStart = i === 0 ? inicio : weekStart;
        const wEnd = i === weeks.length - 1 ? fim : endOfWeek(weekStart, { weekStartsOn: 1 });
        const wStartStr = format(wStart, "yyyy-MM-dd");
        const wEndStr = format(wEnd, "yyyy-MM-dd");

        const entradas = (orcamentos || [])
          .filter((o) => o.data_orcamento >= wStartStr && o.data_orcamento <= wEndStr)
          .reduce((sum, o) => sum + (o.receita_esperada || 0), 0);

        const saidas = (despesas || [])
          .filter((d) => d.data_da_despesa >= wStartStr && d.data_da_despesa <= wEndStr)
          .reduce((sum, d) => sum + (d.valor_da_despesa || 0), 0);

        return { semana: `Sem ${i + 1}`, entradas, saidas };
      });
    },
  });

  // Receita por categoria de serviço
  const categoriasQuery = useQuery({
    queryKey: ["relatorio-categorias", dataInicio, dataFim],
    queryFn: async (): Promise<ReceitaCategoria[]> => {
      const { data, error } = await supabase
        .from("fato_servico")
        .select("categoria, receita_servico")
        .gte("data_do_servico_inicio", dataInicio)
        .lte("data_do_servico_inicio", dataFim);
      if (error) throw error;
      const map: Record<string, number> = {};
      (data || []).forEach((s) => {
        const cat = s.categoria || "Outros";
        map[cat] = (map[cat] || 0) + (s.receita_servico || 0);
      });
      return Object.entries(map)
        .map(([categoria, valor]) => ({ categoria, valor }))
        .sort((a, b) => b.valor - a.valor);
    },
  });

  // Empresa info
  const empresaQuery = useQuery({
    queryKey: ["relatorio-empresa"],
    queryFn: async () => {
      const { data } = await supabase.from("dim_empresa").select("nome").limit(1).single();
      return data;
    },
  });

  // Taxa de conversão do mês
  const conversaoQuery = useQuery({
    queryKey: ["relatorio-conversao", dataInicio, dataFim],
    queryFn: async () => {
      const { data } = await supabase
        .from("fato_orcamento")
        .select("orcamento_convertido")
        .gte("data_orcamento", dataInicio)
        .lte("data_orcamento", dataFim);
      const total = data?.length || 0;
      const convertidos = data?.filter((o) => o.orcamento_convertido).length || 0;
      return { total, convertidos, taxa: total > 0 ? (convertidos / total) * 100 : 0 };
    },
  });

  const derivedKPIs = metricsAtual.data ? calculateDerivedKPIs(metricsAtual.data) : null;
  const derivedKPIsAnterior = metricsAnterior.data ? calculateDerivedKPIs(metricsAnterior.data) : null;

  const variacaoReceita = metricsAtual.data && metricsAnterior.data && metricsAnterior.data.receita_total > 0
    ? ((metricsAtual.data.receita_total - metricsAnterior.data.receita_total) / metricsAnterior.data.receita_total) * 100
    : null;

  const isLoading = metricsAtual.isLoading || clientesQuery.isLoading || servicosQuery.isLoading || orcamentosQuery.isLoading || semanaisQuery.isLoading || categoriasQuery.isLoading;

  return {
    metrics: metricsAtual.data,
    metricsAnterior: metricsAnterior.data,
    derivedKPIs,
    derivedKPIsAnterior,
    variacaoReceita,
    clientes: clientesQuery.data || [],
    servicosCusto: servicosQuery.data || [],
    orcamentosPendentes: orcamentosQuery.data || [],
    dadosSemanais: semanaisQuery.data || [],
    receitaCategorias: categoriasQuery.data || [],
    conversao: conversaoQuery.data,
    empresa: empresaQuery.data,
    isLoading,
  };
}
