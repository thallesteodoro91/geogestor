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
  '/propriedades': () => import('../pages/Propriedades'),
  '/qualidade-dados': () => import('../pages/QualidadeDados'),
  '/pos-atualizacao': () => import('../pages/PosAtualizacao'),
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

const COMMON_ROUTES = [
  '/clientes',
  '/projetos',
  '/financeiro',
  '/calendario',
  '/crm',
  '/orcamentos',
  '/relatorios'
] as const;

type IdleCapableWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

export function scheduleCommonRoutePreload() {
  const browserWindow = window as IdleCapableWindow;
  const timers: number[] = [];

  const preloadCommonRoutes = () => {
    COMMON_ROUTES.forEach((route, index) => {
      timers.push(window.setTimeout(() => void preloadRoute(route), index * 150));
    });
  };

  const idleHandle = browserWindow.requestIdleCallback
    ? browserWindow.requestIdleCallback(preloadCommonRoutes, { timeout: 2_500 })
    : window.setTimeout(preloadCommonRoutes, 1_000);

  return () => {
    timers.forEach((timer) => window.clearTimeout(timer));
    if (browserWindow.cancelIdleCallback) {
      browserWindow.cancelIdleCallback(idleHandle);
    } else {
      window.clearTimeout(idleHandle);
    }
  };
}
