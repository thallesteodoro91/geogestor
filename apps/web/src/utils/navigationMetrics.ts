const STORAGE_KEY = 'geogestor:navigation-metrics';

interface PendingNavigation {
  pathname: string;
  startedAt: number;
  urlChangedAt?: number;
}

interface NavigationMetric {
  pathname: string;
  urlMs: number | null;
  headingMs: number;
  usableMs: number;
  chunks: string[];
  longTasks: number[];
  recordedAt: string;
}

let pending: PendingNavigation | null = null;
let longTasks: Array<{ startTime: number; duration: number }> = [];
let observer: PerformanceObserver | null = null;

function storeMetric(metric: NavigationMetric) {
  try {
    const current = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]') as NavigationMetric[];
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...current.slice(-49), metric]));
  } catch {
    // A medição nunca pode interferir na navegação.
  }
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
  if (!pathname || pathname === window.location.pathname) return;
  pending = { pathname, startedAt: performance.now() };
}

export function markNavigationUrlChanged(pathname: string) {
  if (pending?.pathname === pathname) pending.urlChangedAt = performance.now();
}

export function markNavigationUsable(pathname: string) {
  if (pending?.pathname !== pathname) return;
  const finishedAt = performance.now();
  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  const chunks = resources
    .filter((entry) => entry.startTime >= pending!.startedAt && /\/assets\/.*\.js(?:\?|$)/.test(entry.name))
    .map((entry) => entry.name.split('/').pop() || entry.name);
  const headingVisible = Boolean(document.querySelector('main h1'));

  storeMetric({
    pathname,
    urlMs: pending.urlChangedAt ? pending.urlChangedAt - pending.startedAt : null,
    headingMs: headingVisible ? finishedAt - pending.startedAt : Number.NaN,
    usableMs: finishedAt - pending.startedAt,
    chunks,
    longTasks: longTasks
      .filter((entry) => entry.startTime >= pending!.startedAt)
      .map((entry) => entry.duration),
    recordedAt: new Date().toISOString()
  });
  pending = null;
}

export function recordGlobalFallback() {
  try {
    const count = Number(sessionStorage.getItem(`${STORAGE_KEY}:global-fallbacks`) || '0');
    sessionStorage.setItem(`${STORAGE_KEY}:global-fallbacks`, String(count + 1));
  } catch {
    // A aplicação continua normalmente sem armazenamento de sessão.
  }
}
