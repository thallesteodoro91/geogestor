const routePreloaders: Record<string, () => Promise<unknown>> = {
  '/': () => import('../pages/Dashboard'),
  '/clientes': () => import('../pages/Clientes/ListagemClientes'),
  '/contatos': () => import('../pages/CRM/CRM'),
  '/projetos': () => import('../pages/Projetos/ListagemProjetos'),
  '/crm': () => import('../pages/CRM/CRM'),
  '/calendario': () => import('../pages/Calendario/Calendario'),
  '/topografia': () => import('../pages/Topografia/CalculadoraTopografica'),
  '/orcamentos': () => import('../pages/Orcamentos/Orcamentos'),
  '/financeiro': () => import('../pages/Financeiro/Financeiro'),
  '/relatorios': () => import('../pages/Relatorios/Relatorios'),
  '/planejamento': () => import('../pages/Planejamento'),
  '/tarefas': () => import('../pages/Tarefas/Tarefas'),
  '/importacao': () => import('../pages/Importacao/ImportacaoDados'),
  '/cadastros': () => import('../pages/Cadastros'),
  '/configuracoes': () => import('../pages/Configuracoes'),
  '/audit-logs': () => import('../pages/Relatorios/AuditLogs'),
  '/ajuda': () => import('../pages/Ajuda/Ajuda')
};

const preloadedRoutes = new Set<string>();

export function preloadRoute(path?: string) {
  if (!path || preloadedRoutes.has(path)) return;
  const preload = routePreloaders[path];
  if (!preload) return;

  preloadedRoutes.add(path);
  void preload().catch(() => {
    preloadedRoutes.delete(path);
  });
}
