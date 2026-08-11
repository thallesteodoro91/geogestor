import { PropertyPayloadSchema } from '@geogestor/contracts/src/properties';

export type PropertyFormState = {
  clienteId: string;
  nome: string;
  matricula: string;
  car: string;
  ccir: string;
  itr: string;
  areaHa: string;
  cidade: string;
  municipio: string;
  uf: string;
  situacaoImovel: string;
  latitude: string;
  longitude: string;
  observacoes: string;
};

function numberOrNull(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value.trim().replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function normalizeOptional(value: string, uppercase = false) {
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized ? uppercase ? normalized.toLocaleUpperCase('pt-BR') : normalized : null;
}

export function propertyFormToPayload(form: PropertyFormState) {
  return PropertyPayloadSchema.safeParse({
    clienteId: form.clienteId,
    nome: form.nome.trim().replace(/\s+/g, ' '),
    matricula: normalizeOptional(form.matricula, true),
    car: normalizeOptional(form.car, true),
    ccir: normalizeOptional(form.ccir, true),
    itr: normalizeOptional(form.itr, true),
    areaHa: numberOrNull(form.areaHa),
    cidade: normalizeOptional(form.cidade),
    municipio: form.municipio.trim().replace(/\s+/g, ' '),
    uf: normalizeOptional(form.uf, true),
    situacaoImovel: normalizeOptional(form.situacaoImovel),
    latitude: numberOrNull(form.latitude),
    longitude: numberOrNull(form.longitude),
    observacoes: normalizeOptional(form.observacoes)
  });
}
