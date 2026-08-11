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
});

export const ExpenseCatalogItemSchema = z.object({
  id: z.string().trim().min(1).max(120),
  categoria: z.string().trim().min(1).max(120),
  descricao: z.string().trim().min(1).max(500),
  ativo: z.boolean().default(true)
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

export type ServiceCatalogItem = z.infer<typeof ServiceCatalogItemSchema>;
export type ExpenseCatalogItem = z.infer<typeof ExpenseCatalogItemSchema>;

export const DEFAULT_SERVICE_CATALOG: ServiceCatalogItem[] = [
  { id: 'default-service-planimetrico', nome: 'Levantamento topográfico planimétrico', categoria: 'Topografia', valorSugerido: 250_000, ativo: true },
  { id: 'default-service-planialtimetrico', nome: 'Levantamento planialtimétrico', categoria: 'Topografia', valorSugerido: 250_000, ativo: true },
  { id: 'default-service-georreferenciamento-rural', nome: 'Georreferenciamento de imóvel rural', categoria: 'Georreferenciamento', valorSugerido: 450_000, ativo: true },
  { id: 'default-service-retificacao-area', nome: 'Retificação de área', categoria: 'Regularização', valorSugerido: 300_000, ativo: true }
];

export const DEFAULT_EXPENSE_CATALOG: ExpenseCatalogItem[] = [
  { id: 'default-expense-combustivel', categoria: 'Combustível', descricao: 'Abastecimento e combustível para atividades operacionais.', ativo: true },
  { id: 'default-expense-pedagio', categoria: 'Pedágio', descricao: 'Tarifas de pedágio em deslocamentos profissionais.', ativo: true },
  { id: 'default-expense-hospedagem', categoria: 'Hospedagem', descricao: 'Hospedagem necessária para trabalhos externos.', ativo: true },
  { id: 'default-expense-alimentacao', categoria: 'Alimentação', descricao: 'Refeições da equipe durante atividades profissionais.', ativo: true },
  { id: 'default-expense-viagem', categoria: 'Viagem e transporte', descricao: 'Passagens, locações e outros deslocamentos.', ativo: true },
  { id: 'default-expense-cartorio', categoria: 'Cartório e taxas', descricao: 'Certidões, averbações e emolumentos.', ativo: true },
  { id: 'default-expense-documentos', categoria: 'Documentos', descricao: 'Emissão, cópia e autenticação de documentos.', ativo: true },
  { id: 'default-expense-equipamentos', categoria: 'Equipamentos', descricao: 'Aquisição, locação e manutenção de equipamentos.', ativo: true },
  { id: 'default-expense-software', categoria: 'Software e licenças', descricao: 'Assinaturas, licenças e serviços digitais.', ativo: true },
  { id: 'default-expense-tributos', categoria: 'Tributos', descricao: 'Impostos e contribuições vinculados à operação.', ativo: true },
  { id: 'default-expense-outros', categoria: 'Outros', descricao: 'Despesas operacionais não classificadas nas demais categorias.', ativo: true }
];

export const AuxiliaryCatalogSettingsSchema = z.object({
  [SERVICE_CATALOG_KEY]: ServiceCatalogSchema.optional(),
  [EXPENSE_CATALOG_KEY]: ExpenseCatalogSchema.optional()
});
