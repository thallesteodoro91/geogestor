import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { apiClient, acceptReviewedRecordVersion } from '../services/apiClient';

type Conflict = { recordPath: string; current?: Record<string, unknown> | null; error: string };
export function RecordConflictDialog() {
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [current, setCurrent] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [consulted, setConsulted] = useState(false);
  useEffect(() => {
    const receive = (event: Event) => { setConflict((event as CustomEvent<Conflict>).detail); setCurrent(null); setConsulted(false); setError(''); };
    window.addEventListener('geogestor:record-conflict', receive);
    return () => window.removeEventListener('geogestor:record-conflict', receive);
  }, []);
  const consult = async () => {
    if (!conflict) return;
    setBusy(true); setError('');
    try { setCurrent(await apiClient.get<Record<string, unknown>>(`/api/edicao/atual?path=${encodeURIComponent(conflict.recordPath)}`)); setConsulted(true); }
    catch { setCurrent(null); setConsulted(true); setError('Este registro não está disponível. Ele pode ter sido excluído. Seu rascunho continua aberto; copie o conteúdo antes de fechar.'); }
    finally { setBusy(false); }
  };
  return <Modal isOpen={Boolean(conflict)} onClose={() => setConflict(null)} title="Alterações em outra janela">
    <div className="space-y-4"><p>{conflict?.error}</p><p>Seu rascunho permanece no formulário. Consulte os dados atuais e revise os campos antes de tentar salvar novamente.</p>
      <button type="button" disabled={busy} className="geo-button-base geo-button-secondary geo-focus-ring min-h-11 px-4" onClick={() => void consult()}>{busy ? 'Consultando…' : 'Consultar versão atual'}</button>
      {error && <p role="alert">{error}</p>}
      {consulted && current && <div aria-live="polite" className="max-h-64 overflow-auto rounded-lg border p-3"><dl>{Object.entries(current).filter(([key]) => !['id', 'createdAt', 'updatedAt', 'deletedAt'].includes(key) && !key.endsWith('Id')).filter(([, value]) => value !== null && typeof value !== 'object').map(([key, value]) => <div key={key} className="mb-2"><dt className="font-semibold">{key.replace(/([A-Z])/g, ' $1')}</dt><dd className="whitespace-pre-wrap break-words">{String(value)}</dd></div>)}</dl></div>}
      {consulted && current && typeof current.updatedAt === 'string' && <button type="button" className="geo-button-base geo-button-secondary geo-focus-ring min-h-11 px-4" onClick={() => {
        if (conflict && typeof current.updatedAt === 'string') acceptReviewedRecordVersion(conflict.recordPath, current.updatedAt);
        setConflict(null);
      }}>Voltar ao rascunho para revisar</button>}
    </div>
  </Modal>;
}
