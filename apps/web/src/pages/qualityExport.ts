export function buildQualityExportUrl(moduleFilter: string, severityFilter: string) {
  const params = new URLSearchParams();
  if (moduleFilter) params.set('module', moduleFilter);
  if (severityFilter) params.set('severity', severityFilter);
  const query = params.toString();
  return `/api/sistema/qualidade-dados.csv${query ? `?${query}` : ''}`;
}

