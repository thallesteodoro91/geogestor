const STORAGE_KEY = 'geogestor:navigation-metrics';
const NAVIGATION_TIMEOUT_MS = 15_000;

interface PendingNavigation {
  pathname: string;
  startedAt: number;
  urlChangedAt?: number;
  renderStartedAt?: number;
  contentMountedAt?: number;
}

export interface NavigationMetric {
  pathname: string;
  status: 'usable' | 'failed';
  urlMs: number | null;
  renderStartMs: number | null;
  contentMountedMs: number | null;
  usableMs: number | null;
  chunks: string[];
  longTasks: number[];
  failureReason?: string;
  recordedAt: string;
}

type NavigationStateListener = () => void;

let pending: PendingNavigation | null = null;
let pendingPathname: string | null = null;
let pendingTimeout: ReturnType<typeof setTimeout> | null = null;
let longTasks: Array<{ startTime: number; duration: number }> = [];
let observer: PerformanceObserver | null = null;
const navigationStateListeners = new Set<NavigationStateListener>();

function now() {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

function notifyNavigationState() {
  navigationStateListeners.forEach((listener) => listener());
}

function setPendingPathname(pathname: string | null) {
  if (pendingPathname === pathname) return;
  pendingPathname = pathname;
  notifyNavigationState();
}

function clearPendingTimeout() {
  if (pendingTimeout === null) return;
  clearTimeout(pendingTimeout);
  pendingTimeout = null;
}

function storeMetric(metric: NavigationMetric) {
  try {
    const current = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]') as NavigationMetric[];
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...current.slice(-49), metric]));
  } catch {
    // A medição nunca pode interferir na navegação.
  }
}

function collectNavigationResources(startedAt: number) {
  if (typeof performance === 'undefined') return [];
  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  return resources
    .filter((entry) => entry.startTime >= startedAt && /\/assets\/.*\.js(?:\?|$)/.test(entry.name))
    .map((entry) => entry.name.split('/').pop() || entry.name);
}

function collectNavigationLongTasks(startedAt: number) {
  return longTasks
    .filter((entry) => entry.startTime >= startedAt)
    .map((entry) => entry.duration);
}

function finishPendingNavigation() {
  clearPendingTimeout();
  pending = null;
  setPendingPathname(null);
}

export function subscribeNavigationState(listener: NavigationStateListener) {
  navigationStateListeners.add(listener);
  return () => navigationStateListeners.delete(listener);
}

export function getPendingNavigationPath() {
  return pendingPathname;
}

export function initializeNavigationMetrics() {
  if (observer || typeof PerformanceObserver === 'undefined') return;
  try {
    observer = new PerformanceObserver((list) => {
      longTasks.push(...list.getEntries().map((entry) => ({
        startTime: entry.startTime,
        duration: entry.duration
      })));
      longTasks = longTasks.slice(-100);
    });
    observer.observe({ type: 'longtask', buffered: true });
  } catch {
    observer = null;
  }
}

export function markNavigationIntent(pathname?: string) {
  if (!pathname) return false;
  if (typeof window !== 'undefined' && pathname === window.location.pathname) return false;

  clearPendingTimeout();
  pending = { pathname, startedAt: now() };
  setPendingPathname(pathname);
  pendingTimeout = setTimeout(() => markNavigationFailed(pathname, 'timeout'), NAVIGATION_TIMEOUT_MS);
  return true;
}

export function markNavigationUrlChanged(pathname: string) {
  if (pending?.pathname !== pathname || pending.urlChangedAt !== undefined) return false;
  pending.urlChangedAt = now();
  return true;
}

export function markNavigationRenderStarted(pathname: string) {
  if (pending?.pathname !== pathname || pending.renderStartedAt !== undefined) return false;
  pending.renderStartedAt = now();
  return true;
}

export function markNavigationContentMounted(pathname: string) {
  if (pending?.pathname !== pathname || pending.contentMountedAt !== undefined) return false;
  pending.contentMountedAt = now();
  return true;
}

export function markNavigationUsable(pathname: string) {
  if (pending?.pathname !== pathname || pending.contentMountedAt === undefined) return false;

  const finishedAt = now();
  storeMetric({
    pathname,
    status: 'usable',
    urlMs: pending.urlChangedAt === undefined ? null : pending.urlChangedAt - pending.startedAt,
    renderStartMs: pending.renderStartedAt === undefined ? null : pending.renderStartedAt - pending.startedAt,
    contentMountedMs: pending.contentMountedAt - pending.startedAt,
    usableMs: finishedAt - pending.startedAt,
    chunks: collectNavigationResources(pending.startedAt),
    longTasks: collectNavigationLongTasks(pending.startedAt),
    recordedAt: new Date().toISOString()
  });
  finishPendingNavigation();
  return true;
}

export function markNavigationFailed(pathname: string, failureReason: string) {
  if (pending?.pathname !== pathname) return false;

  storeMetric({
    pathname,
    status: 'failed',
    urlMs: pending.urlChangedAt === undefined ? null : pending.urlChangedAt - pending.startedAt,
    renderStartMs: pending.renderStartedAt === undefined ? null : pending.renderStartedAt - pending.startedAt,
    contentMountedMs: pending.contentMountedAt === undefined ? null : pending.contentMountedAt - pending.startedAt,
    usableMs: null,
    chunks: collectNavigationResources(pending.startedAt),
    longTasks: collectNavigationLongTasks(pending.startedAt),
    failureReason,
    recordedAt: new Date().toISOString()
  });
  finishPendingNavigation();
  return true;
}

export function recordGlobalFallback() {
  try {
    const count = Number(sessionStorage.getItem(`${STORAGE_KEY}:global-fallbacks`) || '0');
    sessionStorage.setItem(`${STORAGE_KEY}:global-fallbacks`, String(count + 1));
  } catch {
    // A aplicação continua normalmente sem armazenamento de sessão.
  }
}
