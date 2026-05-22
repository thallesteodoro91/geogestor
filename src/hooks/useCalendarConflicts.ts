import { useMemo } from "react";
import { useCalendarEventos, EventoUnificado } from "./useCalendarEventos";

export type Conflito = {
  id: string;
  a: EventoUnificado;
  b: EventoUnificado;
  overlapStart: Date;
  overlapEnd: Date;
};

function overlaps(a: EventoUnificado, b: EventoUnificado): boolean {
  return a.start < b.end && b.start < a.end;
}

export function useCalendarConflicts() {
  const { data: eventos = [], isLoading } = useCalendarEventos();

  const conflitos = useMemo<Conflito[]>(() => {
    const sorted = [...eventos].sort((x, y) => x.start.getTime() - y.start.getTime());
    const result: Conflito[] = [];
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i];
        const b = sorted[j];
        if (b.start >= a.end) break;
        if (a.id === b.id) continue;
        if (overlaps(a, b)) {
          result.push({
            id: `${a.id}__${b.id}`,
            a, b,
            overlapStart: new Date(Math.max(a.start.getTime(), b.start.getTime())),
            overlapEnd: new Date(Math.min(a.end.getTime(), b.end.getTime())),
          });
        }
      }
    }
    return result;
  }, [eventos]);

  return { conflitos, isLoading, eventos };
}
