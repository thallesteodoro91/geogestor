import path from 'node:path';

function requiredEnvironmentPath(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} ausente. Execute a spec por pnpm run test:e2e.`);
  return path.resolve(value);
}

export function e2eEvidenceRoot() {
  return requiredEnvironmentPath('GEOGESTOR_E2E_EVIDENCE_DIR');
}

export function e2eDataDirectory() {
  return path.join(requiredEnvironmentPath('GEOGESTOR_E2E_ROOT'), 'files');
}

export function e2eReferenceDate() {
  const value = process.env.GEOGESTOR_E2E_REFERENCE_DATE;
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('GEOGESTOR_E2E_REFERENCE_DATE ausente ou inválida.');
  }
  return value;
}

export function relativeDate(offsetDays = 0) {
  const date = new Date(`${e2eReferenceDate()}T12:00:00-03:00`);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
}

export function relativeInstant(offsetDays = 0) {
  return new Date(`${relativeDate(offsetDays)}T12:00:00-03:00`).toISOString();
}
