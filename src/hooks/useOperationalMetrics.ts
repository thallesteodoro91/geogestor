import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays } from "date-fns";

interface Servico {
  id_servico: string;
  nome_do_servico: string;
  categoria: string | null;
  situacao_do_servico: string | null;
  data_do_servico_inicio: string | null;
  data_do_servico_fim: string | null;
  receita_servico: number | null;
  custo_servico: number | null;
}

interface TempoPorCategoria {
  servico: string;
  tempo: number;
}

interface StatusDistribuicao {
  name: string;
  value: number;
  color: string;
}

interface TicketPorCategoria {
  servico: string;
  valor: number;
}

interface CustoReceitaPorCategoria {
  servico: string;
  custo: number;
  receita: number;
  lucro: number;
}

interface OperationalMetrics {
  kpis: {
    tempoMedioDias: number;
    produtividade: number;
    ticketMedio: number;
    variacao: {
      tempoMedio: number | null;
      produtividade: number | null;
      ticketMedio: number | null;
    };
  };
  charts: {
    tempoPorCategoria: TempoPorCategoria[];
    statusDistribuicao: StatusDistribuicao[];
    ticketPorCategoria: TicketPorCategoria[];
    custoReceitaPorCategoria: CustoReceitaPorCategoria[];
  };
  totals: {
    total: number;
    concluidos: number;
    emAndamento: number;
    pendentes: number;
  };
}

const STATUS_COLORS: Record<string, string> = {
  "Concluído": "hsl(142, 76%, 36%)",
  "Em Andamento": "hsl(38, 92%, 50%)",
  "Pendente": "hsl(217, 91%, 60%)",
  "Cancelado": "hsl(0, 84%, 60%)",
  "Aguardando": "hsl(262, 83%, 58%)",
};

function calcularTempoMedio(servicosConcluidos: Servico[]): number {
  const servicosComDatas = servicosConcluidos.filter(
    s => s.data_do_servico_inicio && s.data_do_servico_fim
  );
  
  if (servicosComDatas.length === 0) return 0;
  
  const totalDias = servicosComDatas.reduce((sum, s) => {
    const inicio = new Date(s.data_do_servico_inicio!);
    const fim = new Date(s.data_do_servico_fim!);
    const dias = differenceInDays(fim, inicio);
    return sum + Math.max(0, dias);
  }, 0);
  
  return Math.round(totalDias / servicosComDatas.length);
}

function agruparTempoPorCategoria(servicosConcluidos: Servico[]): TempoPorCategoria[] {
  const porCategoria: Record<string, { total: number; count: number }> = {};
  
  servicosConcluidos.forEach(s => {
    if (!s.data_do_servico_inicio || !s.data_do_servico_fim) return;
    
    const categoria = s.categoria || s.nome_do_servico || "Outros";
    const dias = differenceInDays(
      new Date(s.data_do_servico_fim),
      new Date(s.data_do_servico_inicio)
    );
    
    if (!porCategoria[categoria]) {
      porCategoria[categoria] = { total: 0, count: 0 };
    }
    porCategoria[categoria].total += Math.max(0, dias);
    porCategoria[categoria].count += 1;
  });
  
  return Object.entries(porCategoria)
    .map(([servico, { total, count }]) => ({
      servico,
      tempo: Math.round(total / count),
    }))
    .sort((a, b) => b.tempo - a.tempo)
    .slice(0, 6);
}

function contarPorStatus(servicos: Servico[]): StatusDistribuicao[] {
  const porStatus: Record<string, number> = {};
  
  servicos.forEach(s => {
    const status = s.situacao_do_servico || "Pendente";
    porStatus[status] = (porStatus[status] || 0) + 1;
  });
  
  return Object.entries(porStatus)
    .map(([name, value]) => ({
      name,
      value,
      color: STATUS_COLORS[name] || "hsl(220, 14%, 46%)",
    }))
    .sort((a, b) => b.value - a.value);
}

function agruparTicketPorCategoria(servicos: Servico[]): TicketPorCategoria[] {
  const porCategoria: Record<string, { total: number; count: number }> = {};
  
  servicos.forEach(s => {
    const categoria = s.categoria || s.nome_do_servico || "Outros";
    const receita = s.receita_servico || 0;
    
    if (!porCategoria[categoria]) {
      porCategoria[categoria] = { total: 0, count: 0 };
    }
    porCategoria[categoria].total += receita;
    porCategoria[categoria].count += 1;
  });
  
  return Object.entries(porCategoria)
    .map(([servico, { total, count }]) => ({
      servico,
      valor: count > 0 ? Math.round(total / count) : 0,
    }))
    .filter(item => item.valor > 0)
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 6);
}

function agruparCustoReceitaPorCategoria(servicos: Servico[]): CustoReceitaPorCategoria[] {
  const porCategoria: Record<string, { custo: number; receita: number }> = {};
  
  servicos.forEach(s => {
    const categoria = s.categoria || s.nome_do_servico || "Outros";
    const custo = s.custo_servico || 0;
    const receita = s.receita_servico || 0;
    
    if (!porCategoria[categoria]) {
      porCategoria[categoria] = { custo: 0, receita: 0 };
    }
    porCategoria[categoria].custo += custo;
    porCategoria[categoria].receita += receita;
  });
  
  return Object.entries(porCategoria)
    .map(([servico, { custo, receita }]) => ({
      servico,
      custo,
      receita,
      lucro: receita - custo,
    }))
    .filter(item => item.receita > 0 || item.custo > 0)
    .sort((a, b) => b.receita - a.receita)
    .slice(0, 6);
}

export function useOperationalMetrics(startDate: string, endDate: string) {
  return useQuery<OperationalMetrics>({
    queryKey: ['operational-metrics', startDate, endDate],
    queryFn: async () => {
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error("Usuário não autenticado");
      }

      // Fetch services in the period
      const { data: servicos, error } = await supabase
        .from('fato_servico')
        .select('id_servico, nome_do_servico, categoria, situacao_do_servico, data_do_servico_inicio, data_do_servico_fim, receita_servico, custo_servico')
        .or(`data_do_servico_inicio.gte.${startDate},data_do_servico_inicio.is.null`)
        .or(`data_do_servico_inicio.lte.${endDate},data_do_servico_inicio.is.null`);

      if (error) {
        console.error('Error fetching services:', error);
        throw error;
      }

      // Filter services that are within the period
      const servicosNoPeriodo = (servicos || []).filter(s => {
        if (!s.data_do_servico_inicio) return true; // Include services without start date
        const inicio = new Date(s.data_do_servico_inicio);
        return inicio >= new Date(startDate) && inicio <= new Date(endDate);
      });

      // Calculate metrics
      const concluidos = servicosNoPeriodo.filter(s => s.situacao_do_servico === 'Concluído');
      const emAndamento = servicosNoPeriodo.filter(s => s.situacao_do_servico === 'Em Andamento');
      const pendentes = servicosNoPeriodo.filter(s => 
        !s.situacao_do_servico || 
        s.situacao_do_servico === 'Pendente' || 
        s.situacao_do_servico === 'Aguardando'
      );
      
      const tempoMedioDias = calcularTempoMedio(concluidos);
      const produtividade = servicosNoPeriodo.length > 0 
        ? Math.round((concluidos.length / servicosNoPeriodo.length) * 100) 
        : 0;
      
      const totalReceita = servicosNoPeriodo.reduce((sum, s) => sum + (s.receita_servico || 0), 0);
      const ticketMedio = servicosNoPeriodo.length > 0 
        ? Math.round(totalReceita / servicosNoPeriodo.length) 
        : 0;

      // Group data for charts
      const tempoPorCategoria = agruparTempoPorCategoria(concluidos);
      const statusDistribuicao = contarPorStatus(servicosNoPeriodo);
      const ticketPorCategoria = agruparTicketPorCategoria(servicosNoPeriodo);
      const custoReceitaPorCategoria = agruparCustoReceitaPorCategoria(servicosNoPeriodo);

      return {
        kpis: { 
          tempoMedioDias, 
          produtividade, 
          ticketMedio,
          variacao: {
            tempoMedio: null,
            produtividade: null,
            ticketMedio: null,
          }
        },
        charts: { 
          tempoPorCategoria, 
          statusDistribuicao, 
          ticketPorCategoria,
          custoReceitaPorCategoria,
        },
        totals: { 
          total: servicosNoPeriodo.length, 
          concluidos: concluidos.length,
          emAndamento: emAndamento.length,
          pendentes: pendentes.length,
        }
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
