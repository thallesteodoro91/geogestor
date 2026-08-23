import { useMemo, useState } from 'react';
import { CheckCircle, WarningCircle } from '@phosphor-icons/react';
import { Modal } from '../../components/Modal';
import { analyzeVertexImport, type DecimalSeparator, type ImportDelimiter } from '../../core/topographyImport';
import { validateGeographicPositions, validateProjectedPositions, type CoordinateMode, type GeographicPosition, type ProjectedPosition, type SpatialReference } from '../../core/topographySpatial';

interface VertexImportPreviewProps {
  open: boolean;
  text: string;
  fileName: string;
  mode: CoordinateMode;
  reference: SpatialReference;
  onClose: () => void;
  onApply: (vertices: Array<GeographicPosition | ProjectedPosition>, strategy: 'append' | 'replace') => void;
}

const fieldClass = 'min-h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white';

export function VertexImportPreview({ open, text, fileName, mode, reference, onClose, onApply }: VertexImportPreviewProps) {
  const [delimiter, setDelimiter] = useState<ImportDelimiter>('auto');
  const [decimalSeparator, setDecimalSeparator] = useState<DecimalSeparator>('auto');
  const [hasHeader, setHasHeader] = useState(true);
  const [firstColumn, setFirstColumn] = useState<number | undefined>();
  const [secondColumn, setSecondColumn] = useState<number | undefined>();

  const preview = useMemo(() => {
    try {
      return { data: analyzeVertexImport(text, mode, { delimiter, decimalSeparator, hasHeader, firstCoordinateColumn: firstColumn, secondCoordinateColumn: secondColumn }), error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Não foi possível analisar o arquivo.' };
    }
  }, [decimalSeparator, delimiter, firstColumn, hasHeader, mode, secondColumn, text]);

  const data = preview.data;
  const spatialIssues = data
    ? mode === 'geografica'
      ? validateGeographicPositions(data.validVertices as GeographicPosition[], reference)
      : validateProjectedPositions(data.validVertices as ProjectedPosition[], reference)
    : [];
  return (
    <Modal isOpen={open} onClose={onClose} title="Prévia da importação de vértices" maxWidth="max-w-5xl">
      <div className="space-y-4">
        <div className="grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm sm:grid-cols-4 dark:border-zinc-800 dark:bg-zinc-950/60">
          <div><p className="text-[10px] font-bold uppercase text-zinc-500">Arquivo</p><p className="mt-1 truncate font-semibold">{fileName || 'Texto colado'}</p></div>
          <div><p className="text-[10px] font-bold uppercase text-zinc-500">Tipo</p><p className="mt-1 font-semibold">{mode === 'geografica' ? 'Latitude/longitude' : 'X/Y projetado'}</p></div>
          <div><p className="text-[10px] font-bold uppercase text-zinc-500">SRC</p><p className="mt-1 font-semibold" translate="no">{reference.code}</p></div>
          <div><p className="text-[10px] font-bold uppercase text-zinc-500">Resultado</p><p className="mt-1 font-semibold">{data ? `${data.validVertices.length}/${data.totalLines} válidas` : 'Bloqueado'}</p></div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <label className="text-xs font-semibold">Delimitador<select value={delimiter} onChange={(event) => { setDelimiter(event.target.value as ImportDelimiter); setFirstColumn(undefined); setSecondColumn(undefined); }} className={`${fieldClass} mt-1.5`}><option value="auto">Detectar</option><option value=";">Ponto e vírgula</option><option value=",">Vírgula</option><option value="\t">Tabulação</option></select></label>
          <label className="text-xs font-semibold">Separador decimal<select value={decimalSeparator} onChange={(event) => setDecimalSeparator(event.target.value as DecimalSeparator)} className={`${fieldClass} mt-1.5`}><option value="auto">Detectar</option><option value=",">Vírgula</option><option value=".">Ponto</option></select></label>
          <label className="flex min-h-10 items-center gap-2 rounded-lg border border-zinc-200 px-3 text-xs font-semibold sm:mt-[22px] dark:border-zinc-700"><input type="checkbox" checked={hasHeader} onChange={(event) => { setHasHeader(event.target.checked); setFirstColumn(undefined); setSecondColumn(undefined); }} />Primeira linha é cabeçalho</label>
          <label className="text-xs font-semibold">{mode === 'geografica' ? 'Coluna latitude' : 'Coluna X / Este'}<select value={firstColumn ?? data?.firstCoordinateColumn ?? 0} onChange={(event) => setFirstColumn(Number(event.target.value))} className={`${fieldClass} mt-1.5`}>{data?.headers.map((header, index) => <option key={`${header}-${index}`} value={index}>{header}</option>)}</select></label>
          <label className="text-xs font-semibold">{mode === 'geografica' ? 'Coluna longitude' : 'Coluna Y / Norte'}<select value={secondColumn ?? data?.secondCoordinateColumn ?? 1} onChange={(event) => setSecondColumn(Number(event.target.value))} className={`${fieldClass} mt-1.5`}>{data?.headers.map((header, index) => <option key={`${header}-${index}`} value={index}>{header}</option>)}</select></label>
        </div>

        {preview.error && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">{preview.error}</p>}
        {spatialIssues.length > 0 && <ul role="alert" className="space-y-1 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">{spatialIssues.map((issue) => <li key={`${issue.code}-${issue.message}`}><strong>{issue.message}</strong> {issue.fix}</li>)}</ul>}
        {data && (
          <>
            <div className="max-h-64 overflow-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full min-w-[620px] text-left text-xs">
                <thead className="sticky top-0 bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"><tr><th className="p-2">Linha</th><th className="p-2">Situação</th>{data.headers.map((header, index) => <th key={`${header}-${index}`} className="p-2">{header}</th>)}</tr></thead>
                <tbody>{data.rows.slice(0, 100).map((row) => <tr key={row.line} className="border-t border-zinc-100 dark:border-zinc-800"><td className="p-2 tabular-nums">{row.line}</td><td className="p-2">{row.error ? <span className="inline-flex items-center gap-1 text-red-600"><WarningCircle aria-hidden="true" />{row.error}</span> : <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle aria-hidden="true" />Válida</span>}</td>{data.headers.map((_, index) => <td key={index} className="p-2 tabular-nums">{row.raw[index] ?? ''}</td>)}</tr>)}</tbody>
              </table>
            </div>
            {data.rows.length > 100 && <p className="text-xs text-zinc-500">Exibindo as primeiras 100 linhas de {data.rows.length.toLocaleString('pt-BR')}.</p>}
            <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <button type="button" onClick={onClose} className="min-h-10 rounded-lg border border-zinc-200 px-4 text-sm font-semibold hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-500/40 dark:border-zinc-700 dark:hover:bg-zinc-800">Cancelar</button>
              <button type="button" disabled={!data.validVertices.length} onClick={() => onApply(data.validVertices, 'append')} className="min-h-10 rounded-lg border border-cyan-300 bg-cyan-50 px-4 text-sm font-semibold text-cyan-800 hover:bg-cyan-100 focus-visible:ring-2 focus-visible:ring-cyan-500/40 disabled:opacity-40 dark:border-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-200">Acrescentar válidas</button>
              <button type="button" disabled={!data.validVertices.length} onClick={() => onApply(data.validVertices, 'replace')} className="min-h-10 rounded-lg bg-cyan-700 px-4 text-sm font-semibold text-white hover:bg-cyan-800 focus-visible:ring-2 focus-visible:ring-cyan-500/40 disabled:opacity-40">Substituir pelos válidos</button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
