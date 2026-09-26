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

const routePreloadPromises = new Map<string, Promise<unknown>>();

export function preloadRoute(path?: string) {
  if (!path) return undefined;
  const existing = routePreloadPromises.get(path);
  if (existing) return existing;
  const preload = routePreloaders[path];
  if (!preload) return undefined;

  const promise = preload().catch(() => {
    routePreloadPromises.delete(path);
    return undefined;
  });
  routePreloadPromises.set(path, promise);
  return promise;
}

const COMMON_ROUTES = [
  '/clientes',
  '/projetos',
  '/financeiro',
  '/calendario',
  '/relatorios',
  '/topografia',
  '/configuracoes',
  '/crm',
  '/orcamentos'
] as const;

type IdleCapableWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

export function scheduleCommonRoutePreload() {
  const browserWindow = window as IdleCapableWindow;
  const timers: number[] = [];
  const idleHandles: number[] = [];
  let cancelled = false;

  const scheduleRoute = (index: number) => {
    if (cancelled || index >= COMMON_ROUTES.length) return;

    const run = () => {
      if (cancelled) return;
      void Promise.resolve(preloadRoute(COMMON_ROUTES[index]))
        .catch(() => undefined)
        .finally(() => scheduleRoute(index + 1));
    };

    if (browserWindow.requestIdleCallback) {
      idleHandles.push(browserWindow.requestIdleCallback(run, { timeout: 1_200 + index * 350 }));
      return;
    }

    timers.push(window.setTimeout(run, index === 0 ? 600 : 200));
  };

  scheduleRoute(0);

  return () => {
    cancelled = true;
    timers.forEach((timer) => window.clearTimeout(timer));
    if (browserWindow.cancelIdleCallback) {
      idleHandles.forEach((handle) => browserWindow.cancelIdleCallback?.(handle));
    }
  };
}
