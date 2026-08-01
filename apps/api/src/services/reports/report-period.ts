import type { ReportPeriod } from '@geogestor/contracts';

export type PeriodInput = {
  inicio?: string;
  fim?: string;
};

export type ParsedPeriod = {
  startDate: string | null;
  endDate: string | null;
  previousStartDate: string | null;
  previousEndDate: string | null;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const DAY_MS = 86_400_000;

export class ReportPeriodValidationError extends Error {}

function parseDate(value: string, field: string) {
  if (!DATE_PATTERN.test(value)) {
    throw new ReportPeriodValidationError(`${field} deve usar o formato AAAA-MM-DD.`);
  }
  const parsed = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new ReportPeriodValidationError(`${field} contém uma data inválida.`);
  }
  return parsed;
}

export function shiftDate(value: string, days: number) {
  const parsed = new Date(`${value}T12:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function parseReportPeriod(input: PeriodInput): ParsedPeriod {
  const startDate = input.inicio?.trim() || null;
  const endDate = input.fim?.trim() || null;
  const start = startDate ? parseDate(startDate, 'Data inicial') : null;
  const end = endDate ? parseDate(endDate, 'Data final') : null;

  if (start && end && start.getTime() > end.getTime()) {
    throw new ReportPeriodValidationError('A data inicial não pode ser posterior à data final.');
  }
  if (!startDate || !endDate) {
    return { startDate, endDate, previousStartDate: null, previousEndDate: null };
  }

  const inclusiveDays = Math.round((end!.getTime() - start!.getTime()) / DAY_MS) + 1;
  return {
    startDate,
    endDate,
    previousStartDate: shiftDate(startDate, -inclusiveDays),
    previousEndDate: shiftDate(startDate, -1)
  };
}

export function dateKey(value?: string | null) {
  if (!value) return '';
  return value.match(/\d{4}-\d{2}-\d{2}/)?.[0] || '';
}

export function isInPeriod(
  value: string | null | undefined,
  period: Pick<ParsedPeriod, 'startDate' | 'endDate'>
) {
  const key = dateKey(value);
  if (!key) return false;
  if (period.startDate && key < period.startDate) return false;
  if (period.endDate && key > period.endDate) return false;
  return true;
}

function label(period: ParsedPeriod) {
  if (period.startDate && period.endDate) return `${period.startDate} a ${period.endDate}`;
  if (period.startDate) return `A partir de ${period.startDate}`;
  if (period.endDate) return `Até ${period.endDate}`;
  return 'Todo o histórico';
}

export function toReportPeriod(period: ParsedPeriod): ReportPeriod {
  return {
    ...period,
    label: label(period),
    comparisonLabel: period.previousStartDate && period.previousEndDate
      ? `${period.previousStartDate} a ${period.previousEndDate}`
      : null,
    rules: {
      contractedRevenue: 'Competência do orçamento: data de competência, emissão, orçamento ou criação.',
      receivedRevenue: 'Regime de caixa: data do recebimento ou do pagamento legado.',
      pendingRevenue: 'Competência da parcela; na ausência, vencimento. Orçamentos diretos usam sua competência.',
      paidExpenses: 'Regime de caixa: data de pagamento; na ausência, competência ou lançamento.',
      projects: 'Coorte por data de início; na ausência, data de criação.',
      activeArea: 'Soma apenas áreas conhecidas de projetos ativos pertencentes ao período.'
    }
  };
}
