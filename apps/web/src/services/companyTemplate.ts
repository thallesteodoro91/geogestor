import { z } from 'zod';
import { getOperationalSettings, persistOperationalSetting } from './operationalSettings';

export const COMPANY_TEMPLATE_KEY = 'geogestor_empresa_template' as const;

export const CompanyTemplateSchema = z.object({
  version: z.literal(1).default(1),
  appLogo: z.string().max(3_000_000).default(''),
  logo: z.string().max(3_000_000).default(''),
  razao: z.string().max(200).default(''),
  cnpj: z.string().max(18).default(''),
  telefone: z.string().max(30).default(''),
  email: z.string().email().or(z.literal('')).default(''),
  endereco: z.string().max(500).default(''),
  cor: z.string().regex(/^#[0-9a-f]{6}$/i).default('#059669'),
  termos: z.string().max(10_000).default('')
});

export type CompanyTemplate = z.infer<typeof CompanyTemplateSchema>;

export const DEFAULT_COMPANY_TEMPLATE: CompanyTemplate = {
  version: 1,
  appLogo: '',
  logo: '',
  razao: '',
  cnpj: '',
  telefone: '',
  email: '',
  endereco: '',
  cor: '#059669',
  termos: 'Validade da proposta: 15 dias úteis.\nPagamento: 50% na aprovação e 50% na entrega técnica.'
};

export function normalizeCompanyTemplate(value: unknown): CompanyTemplate {
  const parsed = CompanyTemplateSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  if (value && typeof value === 'object') {
    const legacy = CompanyTemplateSchema.safeParse({ version: 1, ...value });
    if (legacy.success) return legacy.data;
  }
  return { ...DEFAULT_COMPANY_TEMPLATE };
}

export function getCachedCompanyTemplate(): CompanyTemplate {
  try {
    return normalizeCompanyTemplate(JSON.parse(localStorage.getItem(COMPANY_TEMPLATE_KEY) || '{}'));
  } catch {
    return { ...DEFAULT_COMPANY_TEMPLATE };
  }
}

export async function loadCompanyTemplate() {
  const settings = await getOperationalSettings();
  const template = normalizeCompanyTemplate(settings[COMPANY_TEMPLATE_KEY]);
  try {
    localStorage.setItem(COMPANY_TEMPLATE_KEY, JSON.stringify(template));
  } catch {
    // SQLite remains authoritative even if the synchronous cache is unavailable.
  }
  return template;
}

export function saveCompanyTemplate(template: CompanyTemplate) {
  const normalized = normalizeCompanyTemplate(template);
  return persistOperationalSetting(COMPANY_TEMPLATE_KEY, normalized);
}
