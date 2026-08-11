import { ArrowsClockwise, CheckCircle, Info, WarningCircle, XCircle } from '@phosphor-icons/react';
import type { FullMigrationPreview, FullMigrationResult, ReconciliationItem } from './fullMigration';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });

function money(cents: number) {
  return currency.format(cents / 100);
}

function ReconciliationTable({ items }: { items: ReconciliationItem[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
          <tr>
            <th scope="col" className="px-3 py-2.5">Indicador</th>
            <th scope="col" className="px-3 py-2.5 text-right">Total da planilha</th>
            <th scope="col" className="px-3 py-2.5 text-right">Total importado</th>
            <th scope="col" className="px-3 py-2.5 text-right">Diferença</th>
            <th scope="col" className="px-3 py-2.5">Situação</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {items.map(item => (
            <tr key={item.key}>
              <th scope="row" className="px-3 py-2.5 font-semibold text-zinc-900 dark:text-zinc-100">
                {item.label}
                {item.historical && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800 dark:bg-amber-950 dark:text-amber-200">snapshot</span>}
              </th>
              <td className="px-3 py-2.5 text-right tabular-nums">{money(item.spreadsheet)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{money(item.imported)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{money(item.difference)}</td>
              <td className="px-3 py-2.5">
                <span className={`rounded-md px-2 py-1 text-xs font-semibold ${item.difference === 0 ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300'}`}>
                  {item.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type FullMigrationReviewProps = {
  preview: FullMigrationPreview;
  onMappingChange?: (source: string, field: string | null) => void;
  isRefreshing?: boolean;
};

export function FullMigrationReview({ preview, onMappingChange, isRefreshing = false }: FullMigrationReviewProps) {
  const metrics = [
    ['Linhas lidas', preview.counts.rowsRead],
    ['Clientes novos', preview.counts.clientsCreated],
    ['Clientes atualizados', preview.counts.clientsUpdated],
    ['Propriedades', preview.counts.properties],
    ['Projetos', preview.counts.projects],
    ['Orçamentos', preview.counts.budgets],
    ['Faturamentos', preview.counts.billings],
    ['Despesas', preview.counts.expenses],
    ['Pendências parciais', preview.counts.partial],
    ['Erros impeditivos', preview.counts.blocking]
  ] as const;
  const blockingIssues = preview.issues.filter(issue => issue.severity === 'blocking');
  const generalIssues = preview.issues.filter(issue => issue.row === null && ['warning', 'ambiguous'].includes(issue.severity));
  const rowIssues = preview.issues.filter(issue => issue.row !== null && !['info', 'blocking'].includes(issue.severity));
  const ignoredDocumentColumn = preview.columns.ignored.some(source => /\b(cpf|cnpj|documento)\b/i.test(source));

  return (
    <div className="space-y-6">
      <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${preview.status === 'ready' ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-100' : 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-100'}`} role={preview.status === 'ready' ? 'status' : 'alert'}>
        {preview.status === 'ready' ? <CheckCircle size={22} weight="fill" aria-hidden="true" /> : <XCircle size={22} weight="fill" aria-hidden="true" />}
        <div>
          <p className="font-bold">{preview.status === 'ready' ? 'Planilha pronta para confirmação' : preview.status === 'already_imported' ? 'Este arquivo já foi importado' : 'A planilha precisa de correções'}</p>
          <p className="mt-0.5 text-sm">{preview.status === 'ready' ? 'Confira os totais e avisos abaixo. Nada será gravado até a confirmação.' : 'Veja as linhas indicadas abaixo. A gravação permanece bloqueada enquanto houver erro impeditivo.'}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {metrics.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/50">
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{label}</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-zinc-950 dark:text-zinc-100">{value}</p>
          </div>
        ))}
      </div>

      {blockingIssues.length > 0 && (
        <section id="migration-blocking-issues" tabIndex={-1} aria-labelledby="migration-blocking-issues-title" className="scroll-mt-6 focus-visible:ring-2 focus-visible:ring-red-500/40">
          <h3 id="migration-blocking-issues-title" className="text-sm font-bold text-red-900 dark:text-red-200">Erros impeditivos</h3>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">A importação não está processando. Ela foi bloqueada por erros que precisam ser corrigidos.</p>
          <div className="mt-3 max-h-72 overflow-auto rounded-lg border border-red-200 dark:border-red-900/70">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="sticky top-0 border-b border-red-200 bg-red-50 text-xs font-semibold uppercase text-red-900 dark:border-red-900/70 dark:bg-red-950 dark:text-red-200"><tr><th className="px-3 py-2">Linha</th><th className="px-3 py-2">Campo</th><th className="px-3 py-2">Como corrigir</th></tr></thead>
              <tbody className="divide-y divide-red-100 dark:divide-red-900/60">
                {blockingIssues.map((issue, index) => <tr id={index === 0 ? 'migration-first-blocking-issue' : undefined} tabIndex={index === 0 ? -1 : undefined} key={`${issue.row}-${issue.field}-${index}`} className="focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500"><td className="px-3 py-2 tabular-nums">{issue.row ?? 'Geral'}</td><td className="px-3 py-2">{issue.field || 'Mapeamento'}</td><td className="px-3 py-2 break-words">{issue.message}</td></tr>)}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section aria-labelledby="recognized-columns-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="recognized-columns-title" className="text-sm font-bold text-zinc-950 dark:text-zinc-100">Reconhecimento das colunas</h3>
          <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
            {preview.columns.recognized.length} de {preview.columns.sourceTotal} colunas interpretadas
          </span>
        </div>
        <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
          O GeoGestor sugere o destino pelo significado do cabeçalho. Confirme ou altere qualquer associação antes de importar.
        </p>
        <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
              <tr>
                <th scope="col" className="px-3 py-2.5">Coluna da planilha</th>
                <th scope="col" className="px-3 py-2.5">Campo no GeoGestor</th>
                <th scope="col" className="px-3 py-2.5">Reconhecimento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {preview.columns.sources.map((source, sourceIndex) => {
                const recognition = preview.columns.recognized.find(column => column.source === source);
                const duplicate = preview.columns.duplicateAliases.includes(source);
                const ignored = preview.columns.ignored.includes(source);
                const fieldId = `full-map-${sourceIndex}`;
                const confidenceLabel = recognition?.method === 'manual'
                  ? 'Confirmado por você'
                  : recognition?.method === 'exact'
                    ? 'Correspondência exata'
                    : recognition
                      ? `Sugestão · ${Math.round(recognition.confidence * 100)}%`
                      : duplicate
                        ? 'Destino repetido'
                        : ignored
                          ? 'Não será importada'
                        : 'Não reconhecida';
                return (
                  <tr key={source}>
                    <th scope="row" className="px-3 py-2.5 font-semibold text-zinc-900 dark:text-zinc-100">{source}</th>
                    <td className="px-3 py-2.5">
                      <label htmlFor={fieldId} className="sr-only">Destino da coluna {source}</label>
                      <select
                        id={fieldId}
                        name={fieldId}
                        value={preview.columns.selectedMapping[source] ?? recognition?.field ?? ''}
                        onChange={event => onMappingChange?.(source, event.target.value || null)}
                        disabled={!onMappingChange || isRefreshing}
                        className="h-9 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-900 focus-visible:border-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-500/35 disabled:cursor-wait disabled:opacity-70 dark:[color-scheme:dark] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      >
                        <option value="">Não importar esta coluna</option>
                        {preview.columns.availableFields.map(field => (
                          <option key={field.key} value={field.key}>{field.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${recognition?.method === 'manual' || recognition?.method === 'exact' ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'}`}>
                          {confidenceLabel}
                        </span>
                        {recognition?.method === 'semantic' && onMappingChange && (
                          <button
                            type="button"
                            onClick={() => onMappingChange(source, recognition.field)}
                            disabled={isRefreshing}
                            className="rounded-md border border-amber-300 bg-white px-2 py-1 text-xs font-bold text-amber-900 transition-colors hover:bg-amber-50 focus-visible:ring-2 focus-visible:ring-amber-500/40 disabled:cursor-wait disabled:opacity-70 dark:border-amber-800 dark:bg-zinc-900 dark:text-amber-200 dark:hover:bg-amber-950/30"
                          >
                            Confirmar sugestão
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {isRefreshing && (
          <p role="status" className="mt-2 flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <ArrowsClockwise size={15} className="motion-safe:animate-spin motion-reduce:animate-none" aria-hidden="true" />
            Recalculando a prévia…
          </p>
        )}
        {preview.columns.unrecognized.length > 0 && (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            As colunas ainda não associadas serão preservadas no histórico da importação: {preview.columns.unrecognized.join(', ')}.
          </p>
        )}
        {ignoredDocumentColumn && (
          <p className="mt-3 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-100">
            CPF/CNPJ não será importado. Os clientes serão identificados principalmente pelo nome e ficarão marcados para revisão cadastral.
          </p>
        )}
      </section>

      {generalIssues.length > 0 && (
        <section aria-labelledby="general-migration-issues-title">
          <h3 id="general-migration-issues-title" className="text-sm font-bold text-zinc-950 dark:text-zinc-100">Ajustes gerais da planilha</h3>
          <ul className="mt-3 space-y-2">
            {generalIssues.map((issue, index) => (
              <li key={`${issue.field}-${index}`} className={`rounded-md border px-3 py-2 text-sm ${issue.severity === 'blocking' ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-200' : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200'}`}>
                {issue.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      {rowIssues.length > 0 && (
        <section aria-labelledby="migration-issues-title">
          <h3 id="migration-issues-title" className="text-sm font-bold text-zinc-950 dark:text-zinc-100">Pendências por linha</h3>
          <div className="mt-3 max-h-72 overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="sticky top-0 border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                <tr><th scope="col" className="px-3 py-2">Linha</th><th scope="col" className="px-3 py-2">Nível</th><th scope="col" className="px-3 py-2">Campo</th><th scope="col" className="px-3 py-2">Orientação</th></tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {rowIssues.map((issue, index) => (
                  <tr key={`${issue.row}-${issue.field}-${index}`}>
                    <td className="px-3 py-2 tabular-nums">{issue.row}</td>
                    <td className="px-3 py-2"><span className={`rounded px-2 py-0.5 text-xs font-semibold ${issue.severity === 'blocking' ? 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200' : 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200'}`}>{issue.severity === 'blocking' ? 'Impeditivo' : issue.severity === 'ambiguous' ? 'Ambíguo' : 'Revisão'}</span></td>
                    <td className="px-3 py-2">{issue.field || 'Geral'}</td>
                    <td className="px-3 py-2 break-words">{issue.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section aria-labelledby="pre-reconciliation-title">
        <h3 id="pre-reconciliation-title" className="text-sm font-bold text-zinc-950 dark:text-zinc-100">Conciliação financeira prevista</h3>
        <p className="mb-3 mt-1 text-xs text-zinc-500 dark:text-zinc-400">Os valores em snapshot ficam separados dos lançamentos para evitar duplicidade.</p>
        <ReconciliationTable items={preview.reconciliation} />
      </section>

      <section aria-labelledby="migration-limitations-title" className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sky-950 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-100">
        <h3 id="migration-limitations-title" className="flex items-center gap-2 text-sm font-bold"><Info size={18} aria-hidden="true" />Limites identificados na planilha</h3>
        <ul className="mt-2 space-y-1.5 text-sm leading-5">
          {preview.limitations.map(item => <li key={item}>• {item}</li>)}
        </ul>
      </section>
    </div>
  );
}

export function FullMigrationResultView({ result }: { result: FullMigrationResult }) {
  const hasDifference = result.reconciliation.some(item => item.difference !== 0);
  return (
    <div className="space-y-6 text-left">
      <div className={`flex items-start gap-3 rounded-lg border p-4 ${hasDifference ? 'border-amber-200 bg-amber-50 dark:border-amber-900/70 dark:bg-amber-950/30' : 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/70 dark:bg-emerald-950/30'}`}>
        {hasDifference ? <WarningCircle size={24} weight="fill" className="text-amber-700" aria-hidden="true" /> : <CheckCircle size={24} weight="fill" className="text-emerald-700" aria-hidden="true" />}
        <div><p className="font-bold text-zinc-950 dark:text-zinc-100">{hasDifference ? 'Migração concluída com divergências' : 'Migração concluída e conciliada'}</p><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{result.counts.imported} registros gravados, {result.counts.updated} atualizados, {result.counts.ignored} reutilizados e {result.counts.pendingReview} pendências de revisão.</p></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[['Clientes', result.counts.clients], ['Propriedades', result.counts.properties], ['Projetos', result.counts.projects], ['Orçamentos', result.counts.budgets], ['Faturamentos', result.counts.billings], ['Recebimentos', result.counts.receipts], ['Despesas', result.counts.expenses], ['Rejeitados', result.counts.rejected]].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"><p className="text-xs font-semibold text-zinc-500">{label}</p><p className="mt-1 text-xl font-bold tabular-nums">{value}</p></div>
        ))}
      </div>
      <ReconciliationTable items={result.reconciliation} />
      <div className="grid gap-1 text-xs text-zinc-500 dark:text-zinc-400 sm:grid-cols-2"><p>Identificador da importação: <span className="font-mono">{result.importId}</span></p><p>Concluída em {dateTime.format(new Date(result.completedAt))} · duração {(result.durationMs / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} s</p></div>
    </div>
  );
}
