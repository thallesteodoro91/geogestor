import { z } from 'zod';

export const SERVICE_CATALOG_KEY = 'geogestor_tipos_servico' as const;
export const EXPENSE_CATALOG_KEY = 'geogestor_tipos_despesa' as const;

export function normalizeCatalogLabel(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-BR');
}

export const ServiceCatalogItemSchema = z.object({
  id: z.string().trim().min(1).max(120),
  nome: z.string().trim().min(1).max(200),
  categoria: z.string().trim().min(1).max(120),
  valorSugerido: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  ativo: z.boolean().default(true)
}).strict();

export const ExpenseCatalogItemSchema = z.object({
  id: z.string().trim().min(1).max(120),
  categoria: z.string().trim().min(1).max(120),
  descricao: z.string().trim().min(1).max(500),
  subcategorias: z.array(z.string().trim().min(1).max(120)).max(100).default([]),
  ativo: z.boolean().default(true)
}).strict().superRefine((item, context) => {
  const seen = new Map<string, number>();
  item.subcategorias.forEach((subcategory, index) => {
    const normalized = normalizeCatalogLabel(subcategory);
    const previous = seen.get(normalized);
    if (previous !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['subcategorias', index],
        message: `Subcategoria duplicada em relação ao item ${previous + 1}.`
      });
    } else {
      seen.set(normalized, index);
    }
  });
});

function uniqueCatalog<T>(items: T[], label: (item: T) => string, context: z.RefinementCtx) {
  const seen = new Map<string, number>();
  items.forEach((item, index) => {
    const normalized = normalizeCatalogLabel(label(item));
    const previous = seen.get(normalized);
    if (previous !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [index],
        message: `Cadastro duplicado em relação ao item ${previous + 1}.`
      });
    } else {
      seen.set(normalized, index);
    }
  });
}

export const ServiceCatalogSchema = z.array(ServiceCatalogItemSchema).max(500)
  .superRefine((items, context) => uniqueCatalog(items, (item) => item.nome, context));

export const ExpenseCatalogSchema = z.array(ExpenseCatalogItemSchema).max(500)
  .superRefine((items, context) => uniqueCatalog(items, (item) => item.categoria, context));

function legacyId(prefix: 'service' | 'expense', value: string, index: number) {
  const slug = normalizeCatalogLabel(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90) || 'item';
  return `legacy-${prefix}-${index}-${slug}`;
}

export function coerceServiceCatalog(value: unknown): ServiceCatalogItem[] | null {
  const parsed = ServiceCatalogSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) return null;
  const migrated = value.map((rawName, index) => ({
    id: legacyId('service', rawName, index),
    nome: rawName.trim(),
    categoria: 'Serviços',
    valorSugerido: 0,
    ativo: true
  }));
  const legacyParsed = ServiceCatalogSchema.safeParse(migrated);
  return legacyParsed.success ? legacyParsed.data : null;
}

export function coerceExpenseCatalog(value: unknown): ExpenseCatalogItem[] | null {
  const parsed = ExpenseCatalogSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) return null;
  const migrated = value.map((rawCategory, index) => ({
    id: legacyId('expense', rawCategory, index),
    categoria: rawCategory.trim(),
    descricao: `Despesas classificadas como ${rawCategory.trim()}.`,
    subcategorias: [],
    ativo: true
  }));
  const legacyParsed = ExpenseCatalogSchema.safeParse(migrated);
  return legacyParsed.success ? legacyParsed.data : null;
}

export type ServiceCatalogItem = z.infer<typeof ServiceCatalogItemSchema>;
export type ExpenseCatalogItem = z.infer<typeof ExpenseCatalogItemSchema>;

export const DEFAULT_SERVICE_CATALOG: ServiceCatalogItem[] = [
  { id: 'default-service-planimetrico', nome: 'Levantamento topográfico planimétrico', categoria: 'Topografia', valorSugerido: 250_000, ativo: true },
  { id: 'default-service-planialtimetrico', nome: 'Levantamento planialtimétrico', categoria: 'Topografia', valorSugerido: 250_000, ativo: true },
  { id: 'default-service-georreferenciamento-rural', nome: 'Georreferenciamento de imóvel rural', categoria: 'Georreferenciamento', valorSugerido: 450_000, ativo: true },
  { id: 'default-service-retificacao-area', nome: 'Retificação de área', categoria: 'Regularização', valorSugerido: 300_000, ativo: true }
];

export const DEFAULT_EXPENSE_CATALOG: ExpenseCatalogItem[] = [
  { id: 'default-expense-combustivel', categoria: 'Combustível', descricao: 'Abastecimento e combustível para atividades operacionais.', subcategorias: ['Gasolina', 'Etanol', 'Diesel', 'Arla'], ativo: true },
  { id: 'default-expense-pedagio', categoria: 'Pedágio', descricao: 'Tarifas de pedágio em deslocamentos profissionais.', subcategorias: ['Pedágio rodoviário', 'Estacionamento'], ativo: true },
  { id: 'default-expense-hospedagem', categoria: 'Hospedagem', descricao: 'Hospedagem necessária para trabalhos externos.', subcategorias: ['Hotel', 'Pousada', 'Locação temporária'], ativo: true },
  { id: 'default-expense-alimentacao', categoria: 'Alimentação', descricao: 'Refeições da equipe durante atividades profissionais.', subcategorias: ['Refeição', 'Lanche', 'Diária de alimentação'], ativo: true },
  { id: 'default-expense-viagem', categoria: 'Viagem e transporte', descricao: 'Passagens, locações e outros deslocamentos.', subcategorias: ['Passagem', 'Locação de veículo', 'Aplicativo de transporte'], ativo: true },
  { id: 'default-expense-cartorio', categoria: 'Cartório e taxas', descricao: 'Certidões, averbações e emolumentos.', subcategorias: ['Certidão', 'Emolumento', 'Reconhecimento de firma'], ativo: true },
  { id: 'default-expense-documentos', categoria: 'Documentos', descricao: 'Emissão, cópia e autenticação de documentos.', subcategorias: ['Cópia', 'Impressão', 'Autenticação'], ativo: true },
  { id: 'default-expense-equipamentos', categoria: 'Equipamentos', descricao: 'Aquisição, locação e manutenção de equipamentos.', subcategorias: ['Aquisição', 'Locação', 'Manutenção', 'Calibração'], ativo: true },
  { id: 'default-expense-software', categoria: 'Software e licenças', descricao: 'Assinaturas, licenças e serviços digitais.', subcategorias: ['Assinatura', 'Licença', 'Armazenamento'], ativo: true },
  { id: 'default-expense-tributos', categoria: 'Tributos', descricao: 'Impostos e contribuições vinculados à operação.', subcategorias: ['Imposto', 'Contribuição', 'Taxa municipal'], ativo: true },
  { id: 'default-expense-outros', categoria: 'Outros', descricao: 'Despesas operacionais não classificadas nas demais categorias.', subcategorias: [], ativo: true }
];

export const AuxiliaryCatalogSettingsSchema = z.object({
  [SERVICE_CATALOG_KEY]: ServiceCatalogSchema.optional(),
  [EXPENSE_CATALOG_KEY]: ExpenseCatalogSchema.optional()
}).strict();
