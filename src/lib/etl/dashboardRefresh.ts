/**
 * Invalidate every query key powering KPIs / Dashboard 360 after a successful
 * import so the user sees updated numbers immediately.
 */

import type { QueryClient } from "@tanstack/react-query";

const KPI_QUERY_KEYS: string[] = [
  "kpis",
  "kpis-v2",
  "dashboard-metrics",
  "financial-dashboard",
  "chart-data",
  "sales-funnel",
  "clientes-analytics",
  "operational-metrics",
  "actionable-insights",
  "resource-counts",
  "available-years",
  "kpi-variation",
];

export function invalidateDashboardAndKpis(queryClient: QueryClient): void {
  for (const key of KPI_QUERY_KEYS) {
    queryClient.invalidateQueries({ queryKey: [key] });
  }
}
