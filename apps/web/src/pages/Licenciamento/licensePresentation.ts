import { isRealEnvironmentalDateKey, type LicenseListItem } from '@geogestor/contracts/src/environmental';

export type LicenseTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

const licenseTones: Record<string, LicenseTone> = {
  'Em análise': 'info', 'Válida': 'success', 'Em renovação': 'warning',
  'Suspensa': 'danger', 'Vencida': 'danger', 'Encerrada': 'neutral'
};
const conditionTones: Record<string, LicenseTone> = {
  'Pendente': 'warning', 'Em andamento': 'info', 'Cumprida': 'success',
  'Vencida': 'danger', 'Dispensada': 'neutral'
};

export function licenseStatusClass(status: string) {
  return `license-tone-${licenseTones[status] || 'warning'}`;
}
export function conditionStatusClass(status: string) {
  return `license-tone-${conditionTones[status] || 'warning'}`;
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });
export function formatLicenseDate(value?: string | null) {
  if (!value) return 'Não informada';
  const key = value.slice(0, 10);
  return isRealEnvironmentalDateKey(key)
    ? dateFormatter.format(new Date(`${key}T12:00:00Z`)) : 'Data inválida — revise o cadastro';
}

export function licenseDaysUntilDate(value: string, now = new Date()): number | null {
  if (!isRealEnvironmentalDateKey(value)) return null;
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(now);
  return Math.round((Date.parse(`${value}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
}

export function getLicenseDeadline(value: string, now = new Date()) {
  const days = licenseDaysUntilDate(value, now);
  if (days === null) return { tone: 'warning' as const, label: 'Revise a data cadastrada' };
  if (days < 0) return { tone: 'danger' as const, label: `Data ultrapassada há ${Math.abs(days)} ${Math.abs(days) === 1 ? 'dia' : 'dias'}` };
  if (days === 0) return { tone: 'danger' as const, label: 'Vencimento cadastrado para hoje' };
  return { tone: (days <= 30 ? 'danger' : days <= 120 ? 'warning' : 'neutral') as LicenseTone, label: `Vencimento em ${days} ${days === 1 ? 'dia' : 'dias'}` };
}

type LicenseState = Pick<LicenseListItem, 'status' | 'statusRegistrado' | 'statusRegistradoReconhecido' | 'dataVencimento'>;
export function getLicenseExpirationPresentation(license: LicenseState, now = new Date()): { tone: LicenseTone; message: string } {
  const { status, statusRegistrado, dataVencimento } = license;
  const dateMessage = `Data de vencimento cadastrada: ${formatLicenseDate(dataVencimento)}.`;
  if (status === 'Encerrada') return { tone: 'neutral', message: 'Esta licença está encerrada.' };
  if (status === 'Suspensa') return { tone: 'danger', message: `Esta licença está suspensa. Verifique as restrições antes de prosseguir. ${dateMessage}` };
  if (!license.statusRegistradoReconhecido) return { tone: 'warning', message: `A situação registrada não foi reconhecida. Revise o cadastro. ${dateMessage}` };
  if (status === 'Em análise') return { tone: 'info', message: `Esta licença está em análise. ${dateMessage}` };
  const days = licenseDaysUntilDate(dataVencimento, now);
  if (days === null) return { tone: 'warning', message: 'A data de vencimento é inválida. Edite a licença para revisar o cadastro.' };
  const renewing = statusRegistrado === 'Em renovação' || status === 'Em renovação';
  const renewalNote = renewing ? ' Renovação em andamento.' : '';
  if (status === 'Vencida' || days < 0) {
    return { tone: 'danger', message: days < 0
      ? `Licença vencida há ${Math.abs(days)} ${Math.abs(days) === 1 ? 'dia' : 'dias'}.${renewalNote}`
      : `Esta licença está registrada como vencida. Revise a situação e o vencimento.${renewalNote}` };
  }
  if (days === 0) return { tone: 'danger', message: `A licença vence hoje.${renewalNote}` };
  if (renewing) return { tone: days <= 30 ? 'danger' : 'warning', message: `Renovação em andamento. Vencimento cadastrado em ${days} ${days === 1 ? 'dia' : 'dias'}.` };
  if (days <= 120) return { tone: days <= 30 ? 'danger' : 'warning', message: `A licença vence em ${days} ${days === 1 ? 'dia' : 'dias'}. Planeje a renovação.` };
  return { tone: 'success', message: `Licença válida por mais ${days} dias.` };
}

export function parseLicensePage(value: string | null) {
  const page = Number(value || 1);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

const listKeys = ['lic_q', 'lic_status', 'lic_tipo', 'lic_vencimento', 'lic_page'];
export function getSafeLicenseReturnTo(candidate?: string | null) {
  const fallback = '/ambiental?tab=licenciamento';
  if (!candidate || candidate.length > 4096 || !candidate.startsWith('/ambiental') || /[\\\r\n]/.test(candidate)) return fallback;
  try {
    const url = new URL(candidate, 'https://geogestor.invalid');
    if (url.origin !== 'https://geogestor.invalid' || url.pathname !== '/ambiental') return fallback;
    const params = new URLSearchParams({ tab: 'licenciamento' });
    for (const key of listKeys) {
      const value = url.searchParams.get(key);
      if (value && key !== 'lic_page') params.set(key, value);
      if (key === 'lic_page' && value && parseLicensePage(value) > 1) params.set(key, String(parseLicensePage(value)));
    }
    return `/ambiental?${params}`;
  } catch { return fallback; }
}

export function licenseDetailPath(id: string, returnTo: string) {
  return `/ambiental/licencas/${encodeURIComponent(id)}?${new URLSearchParams({ retorno: getSafeLicenseReturnTo(returnTo) })}`;
}
