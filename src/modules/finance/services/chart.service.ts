/**
 * @fileoverview Serviço de dados para gráficos financeiros tenant-aware
 */

import { supabase } from '@/integrations/supabase/client';
import { getCurrentTenantId } from '@/services/supabase.service';
import type { ReceitaDespesa, CustoCategoria } from '@/domain/types/financial.types';

/**
 * Busca dados de receita e despesa mensais (tenant-aware)
 */
export async function fetchReceitaDespesaMensal(
  ano: number
): Promise<ReceitaDespesa[]> {
  const tenantId = await getCurrentTenantId();
  
  // Buscar receitas mensais
  let receitasQuery = supabase.from('fato_orcamento').select('data_orcamento, receita_realizada')
    .gte('data_orcamento', `${ano}-01-01`)
    .lte('data_orcamento', `${ano}-12-31`);
  if (tenantId) receitasQuery = receitasQuery.eq('tenant_id', tenantId);
  const { data: receitas } = await receitasQuery;

  // Buscar despesas mensais
  let despesasQuery = supabase.from('fato_despesas').select('data_da_despesa, valor_da_despesa')
    .gte('data_da_despesa', `${ano}-01-01`)
    .lte('data_da_despesa', `${ano}-12-31`);
  if (tenantId) despesasQuery = despesasQuery.eq('tenant_id', tenantId);
  const { data: despesas } = await despesasQuery;

  // Processar dados por mês
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  const dadosMensais: ReceitaDespesa[] = meses.map((mes, index) => {
    const mesNum = index + 1;

    const receitaMes = receitas
      ?.filter((r) => new Date(r.data_orcamento).getMonth() + 1 === mesNum)
      .reduce((sum, r) => sum + (Number(r.receita_realizada) || 0), 0) || 0;

    const despesaMes = despesas
      ?.filter((d) => new Date(d.data_da_despesa).getMonth() + 1 === mesNum)
      .reduce((sum, d) => sum + Number(d.valor_da_despesa), 0) || 0;

    return { mes, receita: receitaMes, despesa: despesaMes, lucro: receitaMes - despesaMes };
  });

  return dadosMensais;
}

/**
 * Busca custos agrupados por categoria (tenant-aware)
 */
export async function fetchCustosPorCategoria(): Promise<CustoCategoria[]> {
  const tenantId = await getCurrentTenantId();
  let query = supabase.from('fato_despesas').select(`valor_da_despesa, dim_tipodespesa!inner(categoria)`);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  const { data, error } = await query;

  if (error) throw error;
  if (!data) return [];

  // Agrupar por categoria
  const grouped = data.reduce((acc: { categoria: string; valor: number }[], curr: any) => {
    const categoria = curr.dim_tipodespesa?.categoria || 'Sem categoria';
    const existing = acc.find((item) => item.categoria === categoria);
    if (existing) {
      existing.valor += curr.valor_da_despesa;
    } else {
      acc.push({ categoria, valor: curr.valor_da_despesa });
    }
    return acc;
  }, []);

  const total = grouped.reduce((sum, item) => sum + item.valor, 0);
  return grouped
    .map((item) => ({ ...item, percentual: total > 0 ? (item.valor / total) * 100 : 0 }))
    .sort((a, b) => b.valor - a.valor);
}

/**
 * Busca dados para análise de lucro por cliente (tenant-aware)
 */
export async function fetchLucroPorCliente(limit: number = 10) {
  const tenantId = await getCurrentTenantId();
  let query = supabase.from('fato_orcamento').select(`id_cliente, lucro_esperado, dim_cliente!inner(nome)`)
    .order('lucro_esperado', { ascending: false }).limit(limit);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  const { data, error } = await query;

  if (error) throw error;
  if (!data) return [];

  const grouped = data.reduce((acc: { cliente: string; lucro: number }[], curr: any) => {
    const nomeCliente = curr.dim_cliente?.nome || 'Sem nome';
    const existing = acc.find((item) => item.cliente === nomeCliente);
    if (existing) {
      existing.lucro += curr.lucro_esperado || 0;
    } else {
      acc.push({
        cliente: nomeCliente.length > 20 ? nomeCliente.substring(0, 17) + '...' : nomeCliente,
        lucro: curr.lucro_esperado || 0,
      });
    }
    return acc;
  }, []);

  return grouped.slice(0, 8);
}
