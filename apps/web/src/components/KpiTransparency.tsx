import { Info } from '@phosphor-icons/react';

export type KpiCompositionItem = { id: string; label: string; value: string };

export function KpiTransparency({
  definition, period, filters = 'Nenhum filtro adicional', total, recordCount, updatedAt, records = [], warnings = []
}: {
  definition: string; period: string; filters?: string; total: string; recordCount: number;
  updatedAt: string; records?: KpiCompositionItem[]; warnings?: string[];
}) {
  return (
    <details className="relative text-left">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:text-indigo-300 dark:hover:bg-indigo-950/30">
        <Info aria-hidden="true" size={16} /> Ver composição
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-[min(88vw,420px)] rounded-2xl border border-zinc-200 bg-white p-4 text-sm shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-2">
          <dt className="font-semibold">Definição</dt><dd>{definition}</dd>
          <dt className="font-semibold">Período</dt><dd>{period}</dd>
          <dt className="font-semibold">Filtros</dt><dd>{filters}</dd>
          <dt className="font-semibold">Total</dt><dd className="tabular-nums">{total}</dd>
          <dt className="font-semibold">Registros</dt><dd className="tabular-nums">{recordCount.toLocaleString('pt-BR')}</dd>
          <dt className="font-semibold">Atualizado</dt><dd>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(updatedAt))}</dd>
        </dl>
        {warnings.length > 0 && <ul className="mt-3 space-y-1 rounded-xl bg-amber-50 p-3 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">{warnings.map((warning) => <li key={warning}>• {warning}</li>)}</ul>}
        {records.length > 0 && <div className="mt-3 max-h-44 overflow-y-auto border-t border-zinc-200 pt-2 dark:border-zinc-700">{records.map((record) => <div key={record.id} className="flex justify-between gap-3 py-1"><span className="truncate">{record.label}</span><span className="shrink-0 tabular-nums font-medium">{record.value}</span></div>)}</div>}
      </div>
    </details>
  );
}
