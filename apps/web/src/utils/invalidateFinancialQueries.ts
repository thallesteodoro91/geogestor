import type { QueryClient } from '@tanstack/react-query';

const FINANCIAL_QUERY_PREFIXES = new Set([
  'orcamentos',
  'orcamentos-financeiro',
  'parcelas',
  'parcelas-financeiro',
  'recebimentos',
  'despesas',
  'despesas-financeiro',
  'resumo-mensal-financeiro',
  // Compatibilidade temporária com versões anteriores.
  'dre-financeiro',
  'fluxo-caixa',
  'resumo-gerencial',
  'relatorio-geral',
  'stats-geral',
  'financeiro-resumo',
  'financeiro-cliente',
  'viagens',
  'notas-fiscais',
  'clientes',
  'cliente-dashboard',
  'projetos',
  'projeto-contexto-financeiro'
]);

export function invalidateFinancialQueries(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    predicate: (query) => FINANCIAL_QUERY_PREFIXES.has(String(query.queryKey[0] || '')),
    refetchType: 'active'
  });
}
