import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../services/apiClient';

type Version = { titulo?: string; descricao?: string; data?: string; hora?: string | null; deleted: boolean };
type Conflict = { id: string; reviewToken: string; local: Version; remote: Version; reason: string };

function VersionDetails({ title, value }: { title: string; value: Version }) {
  return <div className="min-w-0 rounded-lg border p-3"><h4 className="font-semibold">{title}</h4>
    <p>{value.deleted ? 'Compromisso excluído' : 'Compromisso ativo'}</p>
    <p className="break-words">{value.titulo || 'Sem título'}</p><p>{value.data} {value.hora || 'Dia inteiro'}</p>
    <p className="whitespace-pre-wrap break-words">{value.descricao}</p></div>;
}

export function GoogleCalendarConflicts() {
  const query = useQuery({ queryKey: ['google-calendar-conflicts'], queryFn: () => apiClient.get<Conflict[]>('/api/google/conflitos') });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const resolve = async (item: Conflict, choice: 'local' | 'remote') => {
    setBusy(true); setError('');
    try { await apiClient.post(`/api/google/conflitos/${item.id}/resolver`, { choice, reviewToken: item.reviewToken }); await query.refetch(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível resolver. Consulte novamente.'); await query.refetch(); }
    finally { setBusy(false); }
  };
  return <section className="space-y-4" aria-labelledby="calendar-conflicts-title">
    <h3 id="calendar-conflicts-title" className="font-semibold">Conflitos da sincronização</h3>
    <button type="button" className="geo-button-base geo-button-secondary geo-focus-ring min-h-11 px-4" onClick={() => void query.refetch()} disabled={busy}>Consultar versões atuais</button>
    {(error || query.isError) && <p role="alert">{error || 'Não foi possível consultar os conflitos. Tente novamente.'}</p>}
    <div aria-live="polite">{query.isLoading ? 'Consultando conflitos…' : !query.data?.length ? 'Nenhum conflito registrado.' : null}</div>
    {query.data?.map((item) => <article key={item.id} className="space-y-3 rounded-xl border p-4">
      <p>{item.reason}</p><div className="grid gap-3 md:grid-cols-2"><VersionDetails title="Aplicativo" value={item.local} /><VersionDetails title="Google Agenda" value={item.remote} /></div>
      <p>Compare as versões antes de decidir. Ao preservar a versão do aplicativo, ela será enviada na próxima sincronização.</p>
      <div className="flex flex-wrap gap-3"><button type="button" disabled={busy} className="geo-button-base geo-button-secondary geo-focus-ring min-h-11 px-4" onClick={() => void resolve(item, 'remote')}>Preservar versão do Google</button>
        <button type="button" disabled={busy} className="geo-button-base geo-button-secondary geo-focus-ring min-h-11 px-4" onClick={() => void resolve(item, 'local')}>Preservar versão do aplicativo</button></div>
    </article>)}
  </section>;
}
