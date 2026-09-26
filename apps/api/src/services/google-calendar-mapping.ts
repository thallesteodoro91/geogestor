const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_KEY_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const GOOGLE_CALENDAR_TIME_ZONE = 'America/Sao_Paulo';

function addCivilMinutes(dateKey: string, timeKey: string, minutes: number) {
  const dateMatch = DATE_KEY_PATTERN.exec(dateKey);
  const timeMatch = TIME_KEY_PATTERN.exec(timeKey);
  if (!dateMatch || !timeMatch) throw new Error('Data ou hora local inválida para sincronização.');
  const value = new Date(Date.UTC(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]) + minutes
  ));
  const nextDate = `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
  const nextTime = `${String(value.getUTCHours()).padStart(2, '0')}:${String(value.getUTCMinutes()).padStart(2, '0')}`;
  return { date: nextDate, time: nextTime };
}

export function nextCivilDay(dateKey: string) {
  return addCivilMinutes(dateKey, '00:00', 24 * 60).date;
}

export function buildGoogleCalendarEvent(input: {
  titulo: string;
  descricao?: string | null;
  tipo?: string | null;
  data: string;
  hora?: string | null;
}) {
  const base = {
    summary: `[GeoGestor] ${input.titulo}`,
    description: input.descricao || `Tipo: ${input.tipo || 'Outro'}`
  };
  if (!input.hora) {
    return {
      ...base,
      start: { date: input.data },
      end: { date: nextCivilDay(input.data) }
    };
  }
  const end = addCivilMinutes(input.data, input.hora, 60);
  return {
    ...base,
    start: { dateTime: `${input.data}T${input.hora}:00`, timeZone: GOOGLE_CALENDAR_TIME_ZONE },
    end: { dateTime: `${end.date}T${end.time}:00`, timeZone: GOOGLE_CALENDAR_TIME_ZONE }
  };
}

export function googleEventStartToLocal(start?: { date?: string | null; dateTime?: string | null }) {
  if (start?.date && DATE_KEY_PATTERN.test(start.date)) return { data: start.date, hora: null as string | null };
  if (!start?.dateTime) return null;
  const instant = new Date(start.dateTime);
  if (Number.isNaN(instant.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: GOOGLE_CALENDAR_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(instant);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    data: `${value.year}-${value.month}-${value.day}`,
    hora: `${value.hour}:${value.minute}`
  };
}
