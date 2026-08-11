import { useState } from 'react';
import { CheckCircle, LinkBreak, WarningCircle } from '@phosphor-icons/react';
import { RemoteCombobox } from '../../components/RemoteCombobox';
import type { ProjectImportClientOption, ProjectImportPreview, ProjectImportPreviewRow } from './projectImport';

const methodLabel = {
  document: 'CPF/CNPJ',
  exact_name: 'Nome exato',
  manual: 'Confirmação manual',
  internal_id: 'Identificador interno'
} as const;

type Props = {
  preview: ProjectImportPreview;
  refreshingRow: number | null;
  onAssociate: (index: number, clientId: string | null, keepPending: boolean) => void;
  onReset: (index: number) => void;
};

function AssociationRow({ row, refreshing, onAssociate, onReset }: {
  row: ProjectImportPreviewRow;
  refreshing: boolean;
  onAssociate: Props['onAssociate'];
  onReset: Props['onReset'];
}) {
  const [editing, setEditing] = useState(row.status === 'pending' || row.association?.method === 'manual');
  const association = row.association;
  const inputId = `project-client-association-${row.index}`;

  return (
    <tr id={row.status === 'pending' ? `project-association-pending-${row.index}` : undefined} tabIndex={row.status === 'pending' ? -1 : undefined} className="align-top focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500">
      <td className="px-3 py-3 tabular-nums">{row.row}</td>
      <td className="px-3 py-3"><p className="font-semibold text-zinc-950 dark:text-zinc-100">{row.projectName}</p><p className="mt-1 break-words text-xs text-zinc-500">Referência: {row.reference || 'não informada'}</p></td>
      <td className="px-3 py-3">
        {editing ? (
          <div className="min-w-72 space-y-2">
            <label htmlFor={inputId} className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Pesquisar cliente ativo</label>
            <RemoteCombobox<ProjectImportClientOption>
              id={inputId}
              name={`associacao-cliente-${row.index}`}
              endpoint="/api/projetos/lote/clientes"
              value={association?.clientId || ''}
              selectedLabel={association?.clientName || ''}
              placeholder="Digite nome, CPF/CNPJ ou município…"
              emptyLabel="Manter esta linha pendente"
              disabled={refreshing}
              aria-invalid={row.status === 'pending'}
              aria-describedby={`${inputId}-help`}
              getOptionLabel={option => option.nome}
              getOptionDescription={option => [option.documentoMascarado, option.municipio].filter(Boolean).join(' · ')}
              onChange={clientId => onAssociate(row.index, clientId || null, !clientId)}
            />
            <p id={`${inputId}-help`} className="text-xs text-zinc-500">O documento aparece mascarado. A linha é revalidada sem recalcular as demais.</p>
            <div className="flex flex-wrap gap-2">
              {row.status === 'resolved' && <button type="button" onClick={() => setEditing(false)} className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-emerald-500/40 dark:border-zinc-700 dark:bg-zinc-900">Fechar seleção</button>}
              <button type="button" onClick={() => { onReset(row.index); setEditing(false); }} disabled={refreshing} className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-emerald-500/40 disabled:cursor-wait dark:border-zinc-700 dark:bg-zinc-900">Tentar identificação automática</button>
            </div>
          </div>
        ) : association ? (
          <div>
            <p className="font-semibold text-zinc-950 dark:text-zinc-100">{association.clientName}</p>
            <p className="mt-1 text-xs text-zinc-500">{[association.documentMasked, association.municipality].filter(Boolean).join(' · ') || 'Sem dados auxiliares'}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => setEditing(true)} className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-emerald-500/40 dark:border-zinc-700 dark:bg-zinc-900">Alterar associação</button>
              <button type="button" onClick={() => { setEditing(true); onAssociate(row.index, null, true); }} className="rounded-md border border-amber-300 bg-white px-2 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-50 focus-visible:ring-2 focus-visible:ring-amber-500/40 dark:border-amber-800 dark:bg-zinc-900 dark:text-amber-200"><LinkBreak size={14} aria-hidden="true" className="mr-1 inline" />Remover vínculo</button>
            </div>
          </div>
        ) : null}
      </td>
      <td className="px-3 py-3">
        <span className={`mb-2 inline-flex rounded-md px-2 py-1 text-xs font-bold ${(row.action ?? (row.status === 'resolved' ? 'create' : 'reject')) === 'create' ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200' : 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200'}`}>
          {(row.action ?? (row.status === 'resolved' ? 'create' : 'reject')) === 'create' ? 'Será criado' : 'Será rejeitado'}
        </span>
        <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold ${row.status === 'resolved' ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'}`}>
          {row.status === 'resolved' ? <CheckCircle size={14} weight="fill" aria-hidden="true" /> : <WarningCircle size={14} weight="fill" aria-hidden="true" />}
          {row.status === 'resolved' && association ? methodLabel[association.method] : 'Pendente'}
        </span>
        <p className="mt-2 max-w-sm break-words text-xs leading-5 text-zinc-600 dark:text-zinc-300">{row.message}</p>
      </td>
    </tr>
  );
}

export function ProjectClientAssociationReview({ preview, refreshingRow, onAssociate, onReset }: Props) {
  const metrics = [
    ['Linhas', preview.counts.total],
    ['Automáticas', preview.counts.automatic],
    ['Manuais', preview.counts.manual],
    ['Pendentes', preview.counts.pending],
    ['Ambíguas', preview.counts.ambiguous],
    ['Não localizadas', preview.counts.missing]
  ] as const;
  return (
    <section aria-labelledby="project-association-title" className="space-y-4">
      <div>
        <h3 id="project-association-title" className="text-sm font-bold text-zinc-950 dark:text-zinc-100">Conferência dos clientes dos projetos</h3>
        <p className="mt-1 text-xs leading-5 text-zinc-500">As associações automáticas usam CPF/CNPJ válido ou nome exato. Linhas ambíguas e não localizadas exigem sua confirmação.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {metrics.map(([label, value]) => <div key={label} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/40"><p className="text-xs font-semibold text-zinc-500">{label}</p><p className="mt-1 text-lg font-bold tabular-nums">{value}</p></div>)}
      </div>
      {preview.counts.pending > 0 && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100">A confirmação está bloqueada até que todas as linhas tenham um cliente definido.</p>}
      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"><tr><th className="px-3 py-2.5">Linha</th><th className="px-3 py-2.5">Projeto e referência</th><th className="px-3 py-2.5">Cliente associado</th><th className="px-3 py-2.5">Critério e situação</th></tr></thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {preview.rows.map(row => <AssociationRow key={row.index} row={row} refreshing={refreshingRow === row.index} onAssociate={onAssociate} onReset={onReset} />)}
          </tbody>
        </table>
      </div>
    </section>
  );
}
