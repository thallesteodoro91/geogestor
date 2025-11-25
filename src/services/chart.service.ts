/**
 * @fileoverview Serviço de processamento de dados para gráficos
 */

import { supabase } from '@/integrations/supabase/client';
import type { ReceitaDespesa, CustoCategoria } from '@/domain/types/financial.types';

/**
 * Busca dados de receita e despesa mensais
 */
export async function fetchReceitaDespesaMensal(
  ano: number
): Promise<ReceitaDespesa[]> {
  // Buscar receitas mensais
  const { data: receitas } = await supabase
    .from('fato_orcamento')
    .select('data_orcamento, receita_realizada')
    .gte('data_orcamento', `${ano}-01-01`)
    .lte('data_orcamento', `${ano}-12-31`);

  // Buscar despesas mensais
  const { data: despesas } = await supabase
    .from('fato_despesas')
    .select('data_da_despesa, valor_da_despesa')
    .gte('data_da_despesa', `${ano}-01-01`)
    .lte('data_da_despesa', `${ano}-12-31`);

  // Processar dados por mês
  const meses = [
    'Jan',
    'Fev',
    'Mar',
    'Abr',
    'Mai',
    'Jun',
    'Jul',
    'Ago',
    'Set',
    'Out',
    'Nov',
    'Dez',
  ];

  const dadosMensais: ReceitaDespesa[] = meses.map((mes, index) => {
    const mesNum = index + 1;

    const receitaMes =
      receitas
        ?.filter((r) => {
          const date = new Date(r.data_orcamento);
          return date.getMonth() + 1 === mesNum;
        })
        .reduce((sum, r) => sum + (Number(r.receita_realizada) || 0), 0) || 0;

    const despesaMes =
      despesas
        ?.filter((d) => {
          const date = new Date(d.data_da_despesa);
          return date.getMonth() + 1 === mesNum;
        })
        .reduce((sum, d) => sum + Number(d.valor_da_despesa), 0) || 0;

    return {
      mes,
      receita: receitaMes,
      despesa: despesaMes,
      lucro: receitaMes - despesaMes,
    };
  });

  return dadosMensais;
}

/**
 * Busca custos agrupados por categoria
 */
export async function fetchCustosPorCategoria(): Promise<CustoCategoria[]> {
  const { data, error } = await supabase.from('fato_despesas').select(`
      valor_da_despesa,
      dim_tipodespesa!inner(categoria)
    `);

  if (error) throw error;

  // Agrupar por categoria
  const grouped = data.reduce((acc: any[], curr) => {
    const categoria = curr.dim_tipodespesa.categoria;
    const existing = acc.find((item) => item.categoria === categoria);
    if (existing) {
      existing.valor += curr.valor_da_despesa;
    } else {
      acc.push({
        categoria,
        valor: curr.valor_da_despesa,
      });
    }
    return acc;
  }, []);

  // Calcular total para percentual
  const total = grouped.reduce((sum, item) => sum + item.valor, 0);

  // Adicionar percentual
  return grouped
    .map((item) => ({
      ...item,
      percentual: total > 0 ? (item.valor / total) * 100 : 0,
    }))
    .sort((a, b) => b.valor - a.valor);
}

/**
 * Busca dados para análise de lucro por cliente
 */
export async function fetchLucroPorCliente(limit: number = 10) {
  const { data, error } = await supabase
    .from('fato_orcamento')
    .select(
      `
      id_cliente,
      lucro_esperado,
      dim_cliente!inner(nome)
    `
    )
    .order('lucro_esperado', { ascending: false })
    .limit(limit);

  if (error) throw error;

  // Agrupar por cliente
  const grouped = data.reduce((acc: any[], curr) => {
    const cliente = curr.dim_cliente.nome;
    const existing = acc.find((item) => item.cliente === cliente);
    if (existing) {
      existing.lucro += curr.lucro_esperado || 0;
    } else {
      acc.push({
        cliente: cliente.length > 20 ? cliente.substring(0, 17) + '...' : cliente,
        lucro: curr.lucro_esperado || 0,
      });
    }
    return acc;
  }, []);

  return grouped.slice(0, 8);
}
