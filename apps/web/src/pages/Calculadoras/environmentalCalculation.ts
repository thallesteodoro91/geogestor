export type ReservaLegalRegion = 'amazonia_floresta' | 'amazonia_cerrado' | 'amazonia_campos' | 'demais_regioes';

export interface EnvironmentalCalculationInput {
  region: ReservaLegalRegion;
  totalArea: string;
  appArea: string;
  nativeOutsideApp: string;
  fiscalModules: string;
  nativeOn2008: string;
  propertyExistedOn2008: boolean;
  carRequested: boolean;
  appProtected: boolean;
  noNewConversion: boolean;
  historicalCompliance: boolean;
}

export const environmentalRegionOptions: Array<{ value: ReservaLegalRegion; label: string; percentage: number }> = [
  { value: 'demais_regioes', label: 'Demais regiões do Brasil', percentage: 20 },
  { value: 'amazonia_floresta', label: 'Amazônia Legal — área de floresta', percentage: 80 },
  { value: 'amazonia_cerrado', label: 'Amazônia Legal — área de cerrado', percentage: 35 },
  { value: 'amazonia_campos', label: 'Amazônia Legal — área de campos gerais', percentage: 20 }
];

export const parseEnvironmentalArea = (value: string) => {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(trimmed)) return Number.NaN;
  return Number(trimmed.replace(',', '.'));
};

export const calculateEnvironmentalReserve = (input: EnvironmentalCalculationInput) => {
  const total = parseEnvironmentalArea(input.totalArea);
  const app = parseEnvironmentalArea(input.appArea) ?? 0;
  const nativeOutside = parseEnvironmentalArea(input.nativeOutsideApp) ?? 0;
  const modules = parseEnvironmentalArea(input.fiscalModules);
  const remnant2008 = parseEnvironmentalArea(input.nativeOn2008);
  const errors: Record<string, string> = {};

  if (total === null) return { ready: false as const, errors };
  if (!Number.isFinite(total) || total <= 0) errors.totalArea = 'Informe uma área total maior que zero.';
  if (!Number.isFinite(app) || app < 0) errors.appArea = 'Informe uma área de APP válida.';
  if (!Number.isFinite(nativeOutside) || nativeOutside < 0) errors.nativeOutsideApp = 'Informe uma área de vegetação válida.';
  if (modules !== null && (!Number.isFinite(modules) || modules <= 0)) errors.fiscalModules = 'Informe uma quantidade de módulos fiscais maior que zero.';
  if (remnant2008 !== null && (!Number.isFinite(remnant2008) || remnant2008 < 0)) errors.nativeOn2008 = 'Informe uma área remanescente válida.';

  if (total > 0) {
    if (app > total) errors.appArea = 'A APP não pode superar a área total do imóvel.';
    if (nativeOutside > total) errors.nativeOutsideApp = 'A vegetação fora de APP não pode superar a área total.';
    if (app + nativeOutside > total) errors.nativeOutsideApp = 'A soma da APP e da vegetação fora de APP supera a área total.';
    if (remnant2008 !== null && remnant2008 > total) errors.nativeOn2008 = 'O remanescente de 2008 não pode superar a área total.';
  }

  const article15Eligible = app > 0 && input.carRequested && input.appProtected && input.noNewConversion;
  const article67Candidate = modules !== null && modules <= 4 && input.propertyExistedOn2008;
  if (article67Candidate && (remnant2008 === null || remnant2008 <= 0)) {
    errors.nativeOn2008 = 'Informe o remanescente de vegetação nativa existente em 22/07/2008.';
  }

  if (Object.keys(errors).length > 0) return { ready: true as const, valid: false as const, errors };

  const percentage = environmentalRegionOptions.find((option) => option.value === input.region)?.percentage ?? 20;
  const generalRequirement = total * (percentage / 100);
  const article67Applied = article67Candidate && remnant2008 !== null && remnant2008 < generalRequirement;
  const requiredArea = article67Applied && remnant2008 !== null ? remnant2008 : generalRequirement;
  const eligibleAppArea = article15Eligible ? app : 0;
  const countableVegetation = nativeOutside + eligibleAppArea;

  return {
    ready: true as const,
    valid: true as const,
    errors,
    percentage,
    requiredArea,
    generalRequirement,
    countableVegetation,
    eligibleAppArea,
    deficit: Math.max(0, requiredArea - countableVegetation),
    potentialExcess: Math.max(0, countableVegetation - requiredArea),
    article15Eligible,
    article67Candidate,
    article67Applied,
    historicalCompliance: input.historicalCompliance
  };
};
