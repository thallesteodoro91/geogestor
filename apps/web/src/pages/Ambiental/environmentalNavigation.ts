export function environmentalReturn(value: string | null) {
  return value && /^\/ambiental(?:\?|$)/.test(value) ? value : '/ambiental';
}

export function demandReturn(value: string | null) {
  return value && /^\/ambiental\/[0-9a-f-]+(?:\?|$)/i.test(value) ? value : null;
}

export function environmentalProjectLink(id: string, returnTo: string, action?: 'editar' | 'nova-tarefa' | 'anexar') {
  const query = new URLSearchParams({ retorno: returnTo });
  if (action) {
    query.set('acao', action);
    if (action !== 'editar') query.set('aba', action === 'anexar' ? 'documentos' : 'checklist');
  }
  return `/projetos/${encodeURIComponent(id)}?${query}`;
}
