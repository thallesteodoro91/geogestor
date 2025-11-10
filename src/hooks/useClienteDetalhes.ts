import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useClienteDetalhes(clienteId: string) {
  return useQuery({
    queryKey: ['cliente-detalhes', clienteId],
    queryFn: async () => {
      const { data: cliente, error } = await supabase
        .from('dim_cliente')
        .select('*')
        .eq('id_cliente', clienteId)
        .single();

      if (error) throw error;
      return cliente;
    },
    enabled: !!clienteId,
  });
}

export function useClientePropriedades(clienteId: string) {
  return useQuery({
    queryKey: ['cliente-propriedades', clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dim_propriedade')
        .select('*')
        .eq('id_cliente', clienteId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!clienteId,
  });
}

export function useClienteServicos(clienteId: string) {
  return useQuery({
    queryKey: ['cliente-servicos', clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fato_servico')
        .select(`
          *,
          dim_propriedade (nome_da_propriedade),
          dim_empresa (nome)
        `)
        .eq('id_cliente', clienteId)
        .order('data_do_servico_inicio', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!clienteId,
  });
}

export function useClienteOrcamentos(clienteId: string) {
  return useQuery({
    queryKey: ['cliente-orcamentos', clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fato_orcamento')
        .select(`
          *,
          fato_servico (nome_do_servico)
        `)
        .eq('id_cliente', clienteId)
        .order('data_orcamento', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!clienteId,
  });
}

export function useClienteKPIs(clienteId: string) {
  return useQuery({
    queryKey: ['cliente-kpis', clienteId],
    queryFn: async () => {
      // Buscar propriedades
      const { data: propriedades } = await supabase
        .from('dim_propriedade')
        .select('id_propriedade')
        .eq('id_cliente', clienteId);

      // Buscar serviços
      const { data: servicos } = await supabase
        .from('fato_servico')
        .select('id_servico, situacao_do_servico, receita_servico')
        .eq('id_cliente', clienteId);

      // Buscar orçamentos
      const { data: orcamentos } = await supabase
        .from('fato_orcamento')
        .select('id_orcamento, receita_realizada, receita_esperada')
        .eq('id_cliente', clienteId);

      const totalPropriedades = propriedades?.length || 0;
      const servicosRealizados = servicos?.filter(s => s.situacao_do_servico === 'Concluído').length || 0;
      const totalServicos = servicos?.length || 0;
      const orcamentosEmitidos = orcamentos?.length || 0;
      const receitaTotal = servicos?.reduce((sum, s) => sum + (Number(s.receita_servico) || 0), 0) || 0;
      const receitaOrcamentos = orcamentos?.reduce((sum, o) => sum + (Number(o.receita_realizada || o.receita_esperada) || 0), 0) || 0;

      return {
        totalPropriedades,
        servicosRealizados,
        totalServicos,
        orcamentosEmitidos,
        receitaTotal: receitaTotal + receitaOrcamentos,
      };
    },
    enabled: !!clienteId,
  });
}
