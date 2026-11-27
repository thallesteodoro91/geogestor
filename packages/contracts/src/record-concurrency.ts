// Root edit routes. Catalog collections have their own per-key compare-and-set.
export const RECORD_RESOURCES = [
  '/api/clientes', '/api/projetos', '/api/contatos', '/api/oportunidades',
  '/api/tarefas/modelos', '/api/orcamentos/templates',
  '/api/financeiro/despesas', '/api/financeiro/orcamentos', '/api/financeiro/parcelas', '/api/financeiro/viagens',
  '/api/planejamento/ciclos', '/api/planejamento/pilares', '/api/planejamento/objetivos', '/api/planejamento/resultados-chave',
  '/api/planejamento/iniciativas', '/api/planejamento/checkins', '/api/planejamento/riscos', '/api/planejamento/decisoes',
  '/api/tarefas', '/api/compromissos', '/api/licencas', '/api/orcamentos'
] as const;

export function recordResource(pathname: string) {
  return RECORD_RESOURCES.filter((resource) => pathname === resource || pathname.startsWith(resource + '/')).sort((a, b) => b.length - a.length)[0];
}

export function mutationRecordPath(pathname: string) {
  const resource = recordResource(pathname);
  if (!resource) return null;
  const id = pathname.slice(resource.length + 1).split('/')[0];
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? `${resource}/${id}` : null;
}
