import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { EnvironmentalDocumentIssue } from '@geogestor/contracts/src/environmental-documents';
import { formatLaudoDate, type LaudoOptions } from '../utils/laudoPdfGenerator';
import { apiClient } from '../services/apiClient';
import { downloadEnvironmentalPdf, environmentalPdfUrl } from '../utils/environmentalDocumentFile';
import { Modal } from './Modal';
const buttonClass = 'geo-focus-ring inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800';
type Saved = EnvironmentalDocumentIssue & { pdfBase64: string; snapshot: { options: LaudoOptions; company?: LaudoOptions['empresa'] } };
export function EnvironmentalDocumentHistory({ projetoId, onRevision }: { projetoId: string; onRevision: (revision: { id: string; options: LaudoOptions }) => void }) {
  const query = useQuery<EnvironmentalDocumentIssue[]>({ queryKey: ['environmental-documents', projetoId], queryFn: () => apiClient.get('/api/ambiental/' + projetoId + '/documentos') });
  const [saved, setSaved] = useState<Saved | null>(null);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  const load = async (id: string, revise = false, download = false) => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const result = await apiClient.get<Saved>('/api/ambiental/' + projetoId + '/documentos/' + id);
      if (revise) onRevision({ id: result.id, options: result.snapshot.options });
      else if (download) downloadEnvironmentalPdf(result.pdfBase64, result.fileName);
      else { setUrl(environmentalPdfUrl(result.pdfBase64)); setSaved(result); }
    } catch { setError('Não foi possível consultar o documento preservado. Tente novamente.'); }
    finally { setBusy(false); }
  };
  return <section className="mt-6 min-w-0 rounded-2xl border border-zinc-200 bg-white p-5 text-zinc-900 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100" aria-labelledby="environmental-documents-heading">
    <h2 id="environmental-documents-heading" className="text-lg font-semibold text-zinc-950 dark:text-white">Emissões registradas</h2>
    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Cada versão preserva seu PDF e os dados utilizados. Pré-visualizações não aparecem nesta lista.</p>
    {query.isLoading && <p role="status" className="mt-4 text-sm">Consultando emissões…</p>}
    {query.isError && <div role="alert" className="mt-4"><p>Não foi possível consultar as emissões.</p><button type="button" onClick={() => void query.refetch()} className={buttonClass}>Tentar novamente</button></div>}
    {!query.isLoading && !query.isError && !query.data?.length && <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">Nenhuma emissão registrada nesta demanda.</p>}
    {error && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
    <ul className="mt-4 divide-y divide-zinc-200 dark:divide-zinc-800">{query.data?.map(issue => <li key={issue.id} style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 88px' }} className="flex min-w-0 flex-wrap items-start justify-between gap-3 py-3">
      <div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold text-zinc-900 dark:text-zinc-100">{issue.codigo} · Revisão {issue.revisao}</p><p className="mt-1 break-words text-sm text-zinc-600 dark:text-zinc-400">{new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(issue.emittedAt))} · {issue.responsavel}</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => void load(issue.id)} className={buttonClass} aria-label={'Consultar ' + issue.codigo + ' revisão ' + issue.revisao}>Consultar</button><button type="button" disabled={busy} onClick={() => void load(issue.id, false, true)} className={buttonClass} aria-label={'Baixar PDF ' + issue.codigo + ' revisão ' + issue.revisao}>Baixar PDF</button><button type="button" disabled={busy} onClick={() => void load(issue.id, true)} className={buttonClass} aria-label={'Nova revisão de ' + issue.codigo + ' revisão ' + issue.revisao}>Nova revisão</button></div>
    </li>)}</ul>
    <Modal isOpen={Boolean(saved)} onClose={() => { setSaved(null); setUrl(''); }} title="Documento preservado" maxWidth="max-w-4xl">
      {saved && <div className="space-y-4 text-zinc-900 dark:text-zinc-100"><p className="break-words text-sm font-semibold">{saved.codigo} · Revisão {saved.revisao} · Emissão registrada</p><iframe title="PDF da emissão preservada" src={url} tabIndex={0} className="geo-focus-ring h-[50vh] w-full rounded border border-zinc-300" />{!window.electronAPI && <a href={url} target="_blank" rel="noreferrer" className={buttonClass}>Abrir documento em nova aba</a>}<details><summary className="geo-focus-ring flex min-h-11 cursor-pointer items-center rounded font-semibold">Dados utilizados nesta emissão</summary><dl className="mt-3 space-y-3">{[['Trabalho', saved.snapshot.options.projetoNome], ['Cliente', saved.snapshot.options.clienteNome], ['Serviço', saved.snapshot.options.tipoDemanda], ['Propriedade', saved.snapshot.options.propriedadeNome], ['Protocolo ou processo', saved.snapshot.options.protocolo], ['Órgão ambiental', saved.snapshot.options.orgaoAmbiental], ['Situação do trabalho', saved.snapshot.options.situacaoTrabalho], ['Fase registrada', saved.snapshot.options.faseAmbiental], ['Data de referência', formatLaudoDate(saved.snapshot.options.dataVistoria)], ['Responsável', saved.snapshot.options.tecnicoResponsavel], ['Finalidade', saved.snapshot.options.finalidade], ['Documentos considerados', saved.snapshot.options.documentosConsiderados], ['Síntese', saved.snapshot.options.sintese], ['Registros', saved.snapshot.options.observacoes], ['Próximos passos', saved.snapshot.options.proximosPassos], ['Empresa emissora', saved.snapshot.company?.razao], ['E-mail da empresa', saved.snapshot.company?.email], ['Telefone da empresa', saved.snapshot.company?.telefone], ['Endereço da empresa', saved.snapshot.company?.endereco]].filter(([, value]) => value).map(([label, value]) => <div key={label}><dt className="text-sm font-semibold">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm">{value}</dd></div>)}</dl></details><button type="button" className={buttonClass} onClick={() => downloadEnvironmentalPdf(saved.pdfBase64, saved.fileName)}>Baixar PDF preservado</button></div>}
    </Modal>
  </section>;
}
