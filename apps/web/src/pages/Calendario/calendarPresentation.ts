// Catalogs mirror the existing appointment and task API enums, never the month's records.
export const appointmentTypes = [
  { value: 'Visita de Campo', label: 'Visita de campo' },
  { value: 'Reunião', label: 'Reunião' },
  { value: 'Ligação', label: 'Ligação' },
  { value: 'Administrativo', label: 'Administrativo' },
  { value: 'Serviço', label: 'Serviço' },
  { value: 'Entrega', label: 'Entrega' },
  { value: 'Outro', label: 'Outro' }
] as const;

export const calendarTypes: readonly string[] = ['Projeto', 'Tarefa', ...appointmentTypes.map(item => item.value)];
export const calendarStatuses: readonly string[] = ['Agendado', 'Início', 'Entrega', 'A Fazer', 'Em Progresso', 'Concluído'];

export function normalizeCalendarFilter(value: string, catalog: readonly string[]) {
  return value === 'Todos' || catalog.includes(value) ? value : 'Todos';
}

export function appointmentTextErrors(title: string, description: string) {
  return {
    ...(!title.trim() ? { titulo: 'Informe um título para identificar o compromisso.' }
      : title.trim().length > 180 ? { titulo: 'Use até 180 caracteres no título.' } : {}),
    ...(description.trim().length > 4000 ? { descricao: 'Use até 4.000 caracteres na descrição.' } : {})
  };
}

export function appointmentRequestError(error: unknown) {
  if (error instanceof TypeError || (error instanceof Error && /failed to fetch|network|fetch failed/i.test(error.message))) {
    return 'Não foi possível comunicar com o serviço local. Seus campos foram mantidos. Verifique se o GeoGestor está disponível e tente novamente.';
  }
  const detail = error instanceof Error ? error.message : 'O serviço local não confirmou o agendamento.';
  return `${detail} Seus campos foram mantidos. Confira os dados e tente novamente.`;
}
