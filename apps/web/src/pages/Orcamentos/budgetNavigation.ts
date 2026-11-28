const LIST_POSITION_KEY = 'geogestor:orcamentos:list-position:v1';
const APP_ORIGIN = 'https://geogestor.local';
const TRANSIENT_LIST_PARAMS = ['budgetId', 'highlightId'];
const FINANCE_RETURN_KEYS = new Set([
  'tab', 'periodo', 'inicio', 'fim', 'cliente', 'categoria', 'tipoCusto', 'centroCusto', 'projeto',
  'receberBusca', 'receberInicio', 'receberFim', 'receberSituacao', 'receberPagina',
  'pagarBusca', 'pagarCategoria', 'pagarSubcategoria', 'pagarSituacao', 'pagarTipo',
  'pagarCentro', 'pagarReembolso', 'pagarInicio', 'pagarFim', 'pagarPagina'
]);

export interface BudgetListPosition {
  returnTo: string;
  windowY: number;
  tableTop: number;
  tableLeft: number;
}

export interface BudgetEditorPathOptions {
  budgetId?: string;
  clientId?: string | null;
  opportunityId?: string | null;
  returnTo?: string | null;
}

export function isSafeEntityId(value: string | null | undefined): value is string {
  return Boolean(value && /^[a-zA-Z0-9_-]{1,128}$/.test(value));
}

export function getBudgetListPath(params: URLSearchParams | string = '') {
  const source = typeof params === 'string' ? new URLSearchParams(params) : new URLSearchParams(params);
  TRANSIENT_LIST_PARAMS.forEach((key) => source.delete(key));
  const query = source.toString();
  return `/orcamentos${query ? `?${query}` : ''}`;
}

export function getSafeBudgetReturnTo(value: string | null | undefined) {
  if (!value) return '/orcamentos';
  try {
    // Only explicit local destinations; never normalize an arbitrary path into one.
    if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\') || Array.from(value).some(character => character.charCodeAt(0) < 32)) return '/orcamentos';
    const rawPath = value.split(/[?#]/)[0];
    if (rawPath !== '/orcamentos' && rawPath !== '/financeiro') return '/orcamentos';
    const url = new URL(value, APP_ORIGIN);
    if (url.origin !== APP_ORIGIN) return '/orcamentos';
    if (url.pathname === '/financeiro') {
      const query = new URLSearchParams();
      url.searchParams.forEach((entry, key) => { if (FINANCE_RETURN_KEYS.has(key)) query.set(key, entry); });
      return `/financeiro${query.size ? `?${query}` : ''}`;
    }
    return getBudgetListPath(url.searchParams);
  } catch {
    return '/orcamentos';
  }
}

export function buildBudgetEditorPath({ budgetId, clientId, opportunityId, returnTo }: BudgetEditorPathOptions = {}) {
  const path = budgetId && isSafeEntityId(budgetId)
    ? `/orcamentos/${encodeURIComponent(budgetId)}/editar`
    : '/orcamentos/novo';
  const params = new URLSearchParams();
  if (!budgetId && isSafeEntityId(clientId)) params.set('clienteId', clientId);
  if (!budgetId && isSafeEntityId(opportunityId)) params.set('oportunidadeId', opportunityId);
  params.set('retorno', getSafeBudgetReturnTo(returnTo));
  return `${path}?${params}`;
}

export function withBudgetHighlight(returnTo: string, budgetId: string) {
  const safeReturnTo = getSafeBudgetReturnTo(returnTo);
  if (safeReturnTo.split('?')[0] === '/financeiro') return safeReturnTo;
  if (!isSafeEntityId(budgetId)) return safeReturnTo;
  const url = new URL(safeReturnTo, APP_ORIGIN);
  url.searchParams.set('highlightId', budgetId);
  return `${url.pathname}?${url.searchParams}`;
}

export function saveBudgetListPosition(position: BudgetListPosition) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(LIST_POSITION_KEY, JSON.stringify({
    ...position,
    returnTo: getSafeBudgetReturnTo(position.returnTo),
    windowY: Math.max(0, position.windowY),
    tableTop: Math.max(0, position.tableTop),
    tableLeft: Math.max(0, position.tableLeft)
  }));
}

export function loadBudgetListPosition(returnTo: string): BudgetListPosition | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(LIST_POSITION_KEY) || 'null') as Partial<BudgetListPosition> | null;
    if (!stored || stored.returnTo !== getSafeBudgetReturnTo(returnTo)) return null;
    window.sessionStorage.removeItem(LIST_POSITION_KEY);
    return {
      returnTo: stored.returnTo,
      windowY: Number.isFinite(stored.windowY) ? Math.max(0, Number(stored.windowY)) : 0,
      tableTop: Number.isFinite(stored.tableTop) ? Math.max(0, Number(stored.tableTop)) : 0,
      tableLeft: Number.isFinite(stored.tableLeft) ? Math.max(0, Number(stored.tableLeft)) : 0
    };
  } catch {
    return null;
  }
}
