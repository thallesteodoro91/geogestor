import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowClockwise, FileCsv, FilePdf, ShieldCheck, WarningCircle } from '@phosphor-icons/react';
import { Layout } from '../components/Layout';
import { PageHeader } from '../components/PageHeader';
import { apiClient, apiFetch } from '../services/apiClient';
import { loadPdfMake } from '../utils/loadPdfMake';
import type { Content } from 'pdfmake/interfaces';

type Severity = 'critical' | 'warning' | 'info';
type QualityIssue = {
  code: string; module: string; severity: Severity; title: string; description: string;
  recommendation: string; count: number; records: Array<{ id: string; clienteId: string | null; label: string }>;
};
type QualityReport = {
  checkedAt: string; status: 'ok' | 'degraded';
  summary: { issues: number; critical: number; warnings: number };
  issues: QualityIssue[];
};

const severityLabel = { critical: 'Crítico', warning: 'Atenção', info: 'Informativo' };
const severityClass = {
  critical: 'bg-red-50 text-red-800 ring-red-200 dark:bg-red-950/30 dark:text-red-200 dark:ring-red-900',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-200 dark:ring-amber-900',
  info: 'bg-blue-50 text-blue-800 ring-blue-200 dark:bg-blue-950/30 dark:text-blue-200 dark:ring-blue-900'
};

export function QualidadeDados() {
  const [moduleFilter, setModuleFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const reportQuery = useQuery({
    queryKey: ['data-quality', moduleFilter, severityFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (moduleFilter) params.set('module', moduleFilter);
      if (severityFilter) params.set('severity', severityFilter);
      return apiClient.get<QualityReport>(`/api/sistema/qualidade-dados?${params}`);
    }
  });
  const modules = useMemo(() => Array.from(new Set((reportQuery.data?.issues || []).map((issue) => issue.module))).sort(), [reportQuery.data]);

  const exportCsv = async () => {
    const response = await apiFetch('/api/sistema/qualidade-dados.csv');
    if (!response.ok) throw new Error('Não foi possível exportar o diagnóstico.');
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = 'qualidade-dados.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = async () => {
    if (!reportQuery.data) return;
    const pdfMake = await loadPdfMake();
    pdfMake.createPdf({
      pageSize: 'A4', pageMargins: [36, 42, 36, 42],
      content: [
        { text: 'GeoGestor — Qualidade dos dados', fontSize: 18, bold: true, margin: [0, 0, 0, 8] },
        { text: `Verificação: ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(reportQuery.data.checkedAt))}`, fontSize: 9, color: '#52525b', margin: [0, 0, 0, 16] },
        ...reportQuery.data.issues.flatMap((issue): Content[] => ([
          { text: `${issue.module} • ${severityLabel[issue.severity]} • ${issue.count}`, bold: true, fontSize: 11, margin: [0, 7, 0, 2] },
          { text: issue.title, fontSize: 10 },
          { text: issue.recommendation, fontSize: 9, color: '#52525b', margin: [0, 1, 0, 4] }
        ]))
      ],
      defaultStyle: { font: 'Roboto' }
    }).download('qualidade-dados-geogestor.pdf');
  };

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader title="Qualidade dos dados" description="Diagnóstico somente leitura de vínculos, finanças, arquivos e informações legadas." />
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <label className="text-sm font-medium">Módulo<select value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)} className="mt-1 block min-h-11 rounded-xl border border-zinc-300 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-950"><option value="">Todos</option>{modules.map((module) => <option key={module}>{module}</option>)}</select></label>
          <label className="text-sm font-medium">Gravidade<select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)} className="mt-1 block min-h-11 rounded-xl border border-zinc-300 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-950"><option value="">Todas</option><option value="critical">Crítica</option><option value="warning">Atenção</option><option value="info">Informativa</option></select></label>
          <button type="button" onClick={() => reportQuery.refetch()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-zinc-300 px-3 text-sm font-semibold hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:border-zinc-700 dark:hover:bg-zinc-800"><ArrowClockwise aria-hidden="true" /> Verificar novamente</button>
          <button type="button" onClick={() => void exportCsv()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-zinc-300 px-3 text-sm font-semibold hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:border-zinc-700 dark:hover:bg-zinc-800"><FileCsv aria-hidden="true" /> Exportar CSV</button>
          <button type="button" onClick={() => void exportPdf()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-zinc-300 px-3 text-sm font-semibold hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:border-zinc-700 dark:hover:bg-zinc-800"><FilePdf aria-hidden="true" /> Exportar PDF</button>
        </div>

        {reportQuery.isLoading ? <p aria-live="polite" className="text-sm text-zinc-500">Verificando os dados…</p>
          : reportQuery.isError ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">Não foi possível executar o diagnóstico. Tente novamente.</p>
            : !reportQuery.data?.issues.length ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center dark:border-emerald-900 dark:bg-emerald-950/30">
                <ShieldCheck aria-hidden="true" size={38} className="mx-auto text-emerald-700" />
                <h2 className="mt-3 text-lg font-semibold text-emerald-950 dark:text-emerald-100">Nenhuma inconsistência encontrada</h2>
                <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-300">Os vínculos verificados estão íntegros.</p>
              </div>
            ) : (
              <div className="space-y-3" aria-live="polite">
                {reportQuery.data.issues.map((issue) => (
                  <article key={issue.code} className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{issue.module}</p><h2 className="mt-1 flex items-center gap-2 font-semibold text-zinc-950 dark:text-white"><WarningCircle aria-hidden="true" /> {issue.title}</h2></div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${severityClass[issue.severity]}`}>{severityLabel[issue.severity]} • {issue.count.toLocaleString('pt-BR')}</span>
                    </div>
                    <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">{issue.description}</p>
                    <p className="mt-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">Próximo passo: {issue.recommendation}</p>
                    {issue.records.length > 0 && <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold text-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:text-indigo-300">Ver registros afetados</summary><ul className="mt-2 max-h-52 space-y-1 overflow-y-auto text-sm text-zinc-600 dark:text-zinc-300">{issue.records.map((record) => <li key={record.id} className="break-words rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-950">{record.label} <span className="font-mono text-xs text-zinc-400">{record.id}</span></li>)}</ul></details>}
                  </article>
                ))}
              </div>
            )}
      </div>
    </Layout>
  );
}
