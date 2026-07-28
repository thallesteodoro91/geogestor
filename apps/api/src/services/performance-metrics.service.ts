export type DurationClassification = 'fast' | 'normal' | 'slow';

type RouteMetric = {
  route: string;
  method: string;
  count: number;
  totalDurationMs: number;
  maxDurationMs: number;
  totalResponseBytes: number;
  maxResponseBytes: number;
  statusCodes: Map<number, number>;
  classifications: Record<DurationClassification, number>;
  samples: number[];
  nextSampleIndex: number;
  slowSinceLastLog: number;
  lastSlowLogAt: number;
};

export type HttpPerformanceObservation = {
  route: string;
  method: string;
  statusCode: number;
  durationMs: number;
  responseBytes?: number;
};

const DEFAULT_SLOW_REQUEST_MS = 200;
const DEFAULT_MAX_ROUTES = 200;
const DEFAULT_SAMPLE_SIZE = 128;
const DEFAULT_SLOW_LOG_INTERVAL_MS = 60_000;

function finitePositive(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function percentile(values: number[], target: number) {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.min(ordered.length - 1, Math.max(0, Math.ceil(target * ordered.length) - 1))];
}

export function normalizeRegisteredRoute(route: string | undefined) {
  if (!route) return '/unmatched';
  const withoutQuery = route.split('?')[0] || '/unmatched';
  return withoutQuery
    .replace(/:[A-Za-z0-9_]+/g, ':id')
    .replace(/\*$/g, ':wildcard')
    .slice(0, 160);
}

export class PerformanceMetricsService {
  private static routes = new Map<string, RouteMetric>();
  private static startedAt = new Date().toISOString();

  static get slowRequestMs() {
    return finitePositive(process.env.GEOGESTOR_SLOW_REQUEST_MS, DEFAULT_SLOW_REQUEST_MS);
  }

  static classify(durationMs: number): DurationClassification {
    if (durationMs > this.slowRequestMs) return 'slow';
    if (durationMs <= 50) return 'fast';
    return 'normal';
  }

  static record(observation: HttpPerformanceObservation) {
    const route = normalizeRegisteredRoute(observation.route);
    const method = observation.method.toUpperCase().slice(0, 12);
    const key = `${method} ${route}`;
    const durationMs = Math.max(0, observation.durationMs);
    const responseBytes = Math.max(0, observation.responseBytes || 0);
    const classification = this.classify(durationMs);
    let metric = this.routes.get(key);

    if (!metric) {
      if (this.routes.size >= finitePositive(process.env.GEOGESTOR_METRICS_MAX_ROUTES, DEFAULT_MAX_ROUTES)) {
        metric = this.routes.get('OTHER /other');
        if (!metric) {
          metric = this.createMetric('/other', 'OTHER');
          this.routes.set('OTHER /other', metric);
        }
      } else {
        metric = this.createMetric(route, method);
        this.routes.set(key, metric);
      }
    }

    metric.count += 1;
    metric.totalDurationMs += durationMs;
    metric.maxDurationMs = Math.max(metric.maxDurationMs, durationMs);
    metric.totalResponseBytes += responseBytes;
    metric.maxResponseBytes = Math.max(metric.maxResponseBytes, responseBytes);
    metric.statusCodes.set(observation.statusCode, (metric.statusCodes.get(observation.statusCode) || 0) + 1);
    metric.classifications[classification] += 1;

    const sampleSize = finitePositive(process.env.GEOGESTOR_METRICS_SAMPLE_SIZE, DEFAULT_SAMPLE_SIZE);
    if (metric.samples.length < sampleSize) metric.samples.push(durationMs);
    else {
      metric.samples[metric.nextSampleIndex] = durationMs;
      metric.nextSampleIndex = (metric.nextSampleIndex + 1) % sampleSize;
    }

    if (classification !== 'slow') return null;
    metric.slowSinceLastLog += 1;
    const now = Date.now();
    const interval = finitePositive(process.env.GEOGESTOR_SLOW_LOG_INTERVAL_MS, DEFAULT_SLOW_LOG_INTERVAL_MS);
    if (metric.lastSlowLogAt !== 0 && now - metric.lastSlowLogAt < interval) return null;

    const occurrences = metric.slowSinceLastLog;
    metric.slowSinceLastLog = 0;
    metric.lastSlowLogAt = now;
    return {
      route: metric.route,
      method: metric.method,
      statusCode: observation.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      classification,
      responseBytes,
      occurrences,
      thresholdMs: this.slowRequestMs
    };
  }

  static snapshot() {
    return {
      startedAt: this.startedAt,
      collectedAt: new Date().toISOString(),
      slowRequestThresholdMs: this.slowRequestMs,
      routes: [...this.routes.values()]
        .map((metric) => ({
          route: metric.route,
          method: metric.method,
          count: metric.count,
          statusCodes: Object.fromEntries([...metric.statusCodes.entries()].sort(([left], [right]) => left - right)),
          durationsMs: {
            average: Math.round((metric.totalDurationMs / metric.count) * 100) / 100,
            median: Math.round(percentile(metric.samples, 0.5) * 100) / 100,
            p95: Math.round(percentile(metric.samples, 0.95) * 100) / 100,
            max: Math.round(metric.maxDurationMs * 100) / 100
          },
          classifications: { ...metric.classifications },
          responseBytes: {
            average: Math.round(metric.totalResponseBytes / metric.count),
            max: metric.maxResponseBytes
          }
        }))
        .sort((left, right) => right.durationsMs.p95 - left.durationsMs.p95)
    };
  }

  static resetForTests() {
    if (process.env.NODE_ENV !== 'test' && !process.env.GEOGESTOR_DB_PATH?.includes('scratch')) {
      throw new Error('Métricas só podem ser reiniciadas em ambiente de teste.');
    }
    this.routes.clear();
    this.startedAt = new Date().toISOString();
  }

  private static createMetric(route: string, method: string): RouteMetric {
    return {
      route,
      method,
      count: 0,
      totalDurationMs: 0,
      maxDurationMs: 0,
      totalResponseBytes: 0,
      maxResponseBytes: 0,
      statusCodes: new Map(),
      classifications: { fast: 0, normal: 0, slow: 0 },
      samples: [],
      nextSampleIndex: 0,
      slowSinceLastLog: 0,
      lastSlowLogAt: 0
    };
  }
}
