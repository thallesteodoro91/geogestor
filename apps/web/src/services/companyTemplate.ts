import { z } from 'zod';
import { getOperationalSettings, persistOperationalSetting } from './operationalSettings';

export const COMPANY_TEMPLATE_KEY = 'geogestor_empresa_template' as const;

function onlyDigits(value: string) {
  return value.replace(/\D/g, '');
}

function hasValidCheckDigits(value: string, baseLength: number) {
  const digits = onlyDigits(value);
  if (digits.length !== baseLength + 2 || /^(\d)\1+$/.test(digits)) return false;

  if (baseLength === 9) {
    const calculate = (length: number) => {
      const sum = digits.slice(0, length).split('').reduce((total, digit, index) => total + Number(digit) * (length + 1 - index), 0);
      const remainder = (sum * 10) % 11;
      return remainder === 10 ? 0 : remainder;
    };
    return calculate(9) === Number(digits[9]) && calculate(10) === Number(digits[10]);
  }

  const calculate = (length: number) => {
    const weights = length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = digits.slice(0, length).split('').reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return calculate(12) === Number(digits[12]) && calculate(13) === Number(digits[13]);
}

export function isValidCpfOrCnpj(value: string) {
  if (!value.trim()) return true;
  const digits = onlyDigits(value);
  return digits.length === 11 ? hasValidCheckDigits(digits, 9) : digits.length === 14 && hasValidCheckDigits(digits, 12);
}

export const CompanyTemplateSchema = z.object({
  version: z.literal(1).default(1),
  appLogo: z.string().max(3_000_000).default(''),
  logo: z.string().max(3_000_000).default(''),
  razao: z.string().max(200, 'Use no máximo 200 caracteres.').default(''),
  cnpj: z.string().max(18, 'Use no máximo 18 caracteres.').default(''),
  telefone: z.string().max(30, 'Use no máximo 30 caracteres.').default(''),
  email: z.string().max(254, 'Use no máximo 254 caracteres.').email('Informe um e-mail válido.').or(z.literal('')).default(''),
  endereco: z.string().max(500, 'Use no máximo 500 caracteres.').default(''),
  conselhoProfissional: z.string().max(30, 'Use no máximo 30 caracteres.').default(''),
  registroProfissional: z.string().max(60, 'Use no máximo 60 caracteres.').default(''),
  cor: z.string().regex(/^#[0-9a-f]{6}$/i, 'Selecione uma cor válida.').default('#059669'),
  termos: z.string().max(10_000, 'Use no máximo 10.000 caracteres.').default('')
});

export const CompanyTemplateSaveSchema = CompanyTemplateSchema.extend({
  cnpj: CompanyTemplateSchema.shape.cnpj.refine(isValidCpfOrCnpj, 'Informe um CPF ou CNPJ válido.'),
  telefone: CompanyTemplateSchema.shape.telefone.refine((value) => {
    if (!value.trim()) return true;
    const digits = onlyDigits(value);
    return digits.length >= 10 && digits.length <= 13;
  }, 'Informe um telefone com DDD e 10 a 13 dígitos.')
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
  conselhoProfissional: '',
  registroProfissional: '',
  cor: '#059669',
  termos: 'Esta proposta contempla exclusivamente os serviços e entregáveis descritos. Alterações de escopo serão objeto de revisão formal.'
};

const CompanyTemplateReadSchema = z.object({
  version: CompanyTemplateSchema.shape.version.catch(DEFAULT_COMPANY_TEMPLATE.version),
  appLogo: CompanyTemplateSchema.shape.appLogo.catch(DEFAULT_COMPANY_TEMPLATE.appLogo),
  logo: CompanyTemplateSchema.shape.logo.catch(DEFAULT_COMPANY_TEMPLATE.logo),
  razao: CompanyTemplateSchema.shape.razao.catch(DEFAULT_COMPANY_TEMPLATE.razao),
  cnpj: CompanyTemplateSchema.shape.cnpj.catch(DEFAULT_COMPANY_TEMPLATE.cnpj),
  telefone: CompanyTemplateSchema.shape.telefone.catch(DEFAULT_COMPANY_TEMPLATE.telefone),
  email: CompanyTemplateSchema.shape.email.catch(DEFAULT_COMPANY_TEMPLATE.email),
  endereco: CompanyTemplateSchema.shape.endereco.catch(DEFAULT_COMPANY_TEMPLATE.endereco),
  conselhoProfissional: CompanyTemplateSchema.shape.conselhoProfissional.catch(DEFAULT_COMPANY_TEMPLATE.conselhoProfissional),
  registroProfissional: CompanyTemplateSchema.shape.registroProfissional.catch(DEFAULT_COMPANY_TEMPLATE.registroProfissional),
  cor: CompanyTemplateSchema.shape.cor.catch(DEFAULT_COMPANY_TEMPLATE.cor),
  termos: CompanyTemplateSchema.shape.termos.catch(DEFAULT_COMPANY_TEMPLATE.termos)
});

export function normalizeCompanyTemplate(value: unknown): CompanyTemplate {
  if (value && typeof value === 'object') {
    return CompanyTemplateReadSchema.parse({ version: 1, ...value });
  }
  return { ...DEFAULT_COMPANY_TEMPLATE };
}

/**
 * Escritas usam validação estrita. Diferente da normalização tolerante de
 * leitura, um valor inválido nunca pode ser convertido no modelo padrão.
 */
export function parseCompanyTemplateForSave(value: unknown): CompanyTemplate {
  return CompanyTemplateSaveSchema.parse(value);
}

export function getCachedCompanyTemplate(): CompanyTemplate {
  try {
    return normalizeCompanyTemplate(JSON.parse(localStorage.getItem(COMPANY_TEMPLATE_KEY) || '{}'));
  } catch {
    return { ...DEFAULT_COMPANY_TEMPLATE };
  }
}

export function cacheCompanyTemplate(template: CompanyTemplate) {
  const validated = parseCompanyTemplateForSave(template);
  try {
    localStorage.setItem(COMPANY_TEMPLATE_KEY, JSON.stringify(validated));
    return true;
  } catch {
    return false;
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
  const validated = parseCompanyTemplateForSave(template);
  return persistOperationalSetting(COMPANY_TEMPLATE_KEY, validated);
}
