import { CheckCircle, WarningCircle, XCircle } from '@phosphor-icons/react';
import type { SimpleImportResult } from './simpleImport';

const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });

export function SimpleImportResultView({ result }: { result: SimpleImportResult }) {
  const presentation = result.status === 'completed'
    ? { title: 'Importação concluída', description: 'Todos os registros válidos foram gravados.', icon: CheckCircle, tone: 'emerald' }
    : result.status === 'partial'
      ? { title: 'Importação concluída parcialmente', description: 'Parte das linhas foi gravada e parte precisa de correção.', icon: WarningCircle, tone: 'amber' }
      : { title: 'Nenhum registro foi importado', description: 'Corrija os problemas indicados e gere uma nova prévia.', icon: XCircle, tone: 'red' };
  const Icon = presentation.icon;
  const toneClass = presentation.tone === 'emerald'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-100'
    : presentation.tone === 'amber'
      ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100'
      : 'border-red-200 bg-red-50 text-red-950 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-100';
  const metrics = [
    ['Linhas lidas', result.rowsRead], ['Criados', result.imported], ['Atualizados', result.updated],
    ['Reutilizados', result.reused], ['Ignorados', result.ignored], ['Rejeitados', result.failed],
    ['Revisão pendente', result.pendingReview]
  ] as const;
  const failures = result.results.filter((item) => item.status === 'failed');
  const associations = result.results.filter((item) => item.status === 'success' && item.association);
  const associationMethod = { document: 'CPF/CNPJ', exact_name: 'Nome exato', manual: 'Confirmação manual', internal_id: 'Identificador interno' } as const;

  return (
    <div className="space-y-5 text-left">
      <div className={`flex items-start gap-3 rounded-xl border p-4 ${toneClass}`} role={result.status === 'failed' ? 'alert' : 'status'}>
        <Icon size={26} weight="fill" aria-hidden="true" className="shrink-0" />
        <div><h2 className="text-lg font-bold">{presentation.title}</h2><p className="mt-1 text-sm">{presentation.description}</p></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map(([label, value]) => <div key={label} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"><p className="text-xs font-semibold text-zinc-500">{label}</p><p className="mt-1 text-xl font-bold tabular-nums">{value}</p></div>)}
      </div>
      {failures.length > 0 && (
        <section aria-labelledby="simple-import-failures-title">
          <h3 id="simple-import-failures-title" className="text-sm font-bold">Falhas por linha</h3>
          <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[560px] text-left text-sm"><thead className="sticky top-0 bg-zinc-50 text-xs uppercase dark:bg-zinc-950"><tr><th className="px-3 py-2">Linha</th><th className="px-3 py-2">Como corrigir</th></tr></thead><tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">{failures.map((item) => <tr key={item.index}><td className="px-3 py-2 tabular-nums">{item.row}</td><td className="px-3 py-2">{item.errors?.join(' ') || 'Revise os dados desta linha.'}</td></tr>)}</tbody></table>
          </div>
        </section>
      )}
      {associations.length > 0 && (
        <section aria-labelledby="simple-import-associations-title">
          <h3 id="simple-import-associations-title" className="text-sm font-bold">Associações dos projetos importados</h3>
          <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[640px] text-left text-sm"><thead className="sticky top-0 bg-zinc-50 text-xs uppercase dark:bg-zinc-950"><tr><th className="px-3 py-2">Linha</th><th className="px-3 py-2">Cliente</th><th className="px-3 py-2">Critério</th></tr></thead><tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">{associations.map(item => <tr key={item.index}><td className="px-3 py-2 tabular-nums">{item.row}</td><td className="px-3 py-2 font-medium">{item.association?.clientName}</td><td className="px-3 py-2">{item.association ? associationMethod[item.association.method] : '—'}</td></tr>)}</tbody></table>
          </div>
        </section>
      )}
      <div className="grid gap-1 text-xs text-zinc-500 sm:grid-cols-2">
        <p>Identificador: <span className="font-mono">{result.importId}</span></p>
        <p>Concluída em {dateTime.format(new Date(result.completedAt))} · duração {(result.durationMs / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} s</p>
      </div>
    </div>
  );
}
