import { isEnvironmentalWorkCompleted } from '@geogestor/contracts';

export class CompletedWorkError extends Error {
  constructor() { super('Reabra o trabalho antes de alterar a fase ou registrar um andamento.'); }
}

export function assertEnvironmentalWorkWritable(project: { tipo: string | null; status: string | null }) {
  if (['Ambiental', 'Perícia'].includes(project.tipo || '') && isEnvironmentalWorkCompleted(project.status)) throw new CompletedWorkError();
}
