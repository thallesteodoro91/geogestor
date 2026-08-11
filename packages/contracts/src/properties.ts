import { z } from 'zod';

const optionalText = (maximum: number) => z.string().trim().max(maximum).nullable().optional();

export const PropertyFieldsSchema = z.object({
  clienteId: z.string().uuid('Selecione um cliente válido.'),
  nome: z.string().trim().min(1, 'Informe o nome do imóvel.').max(200, 'Use até 200 caracteres no nome.'),
  areaHa: z.number().finite().nonnegative('A área não pode ser negativa.').nullable().optional(),
  matricula: optionalText(120),
  car: optionalText(120),
  ccir: optionalText(120),
  itr: optionalText(120),
  cidade: optionalText(160),
  municipio: z.string().trim().min(1, 'Informe o município.').max(160, 'Use até 160 caracteres no município.'),
  uf: z.string().trim().length(2, 'Use a sigla da UF com duas letras.').toUpperCase().nullable().optional(),
  situacaoImovel: optionalText(160),
  latitude: z.number().finite().min(-90, 'Informe uma latitude entre -90 e 90.').max(90, 'Informe uma latitude entre -90 e 90.').nullable().optional(),
  longitude: z.number().finite().min(-180, 'Informe uma longitude entre -180 e 180.').max(180, 'Informe uma longitude entre -180 e 180.').nullable().optional(),
  observacoes: optionalText(4000)
});

function validateProperty(payload: z.infer<typeof PropertyFieldsSchema>, context: z.RefinementCtx) {
  if (![payload.matricula, payload.car, payload.ccir, payload.itr].some((value) => Boolean(value?.trim()))) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['matricula'],
      message: 'Informe ao menos uma identificação: matrícula, CAR, CCIR ou ITR.'
    });
  }
  const hasLatitude = payload.latitude !== null && payload.latitude !== undefined;
  const hasLongitude = payload.longitude !== null && payload.longitude !== undefined;
  if (hasLatitude !== hasLongitude) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: [hasLatitude ? 'longitude' : 'latitude'],
      message: 'Informe latitude e longitude em conjunto.'
    });
  }
}

export const PropertyPayloadSchema = PropertyFieldsSchema.superRefine(validateProperty);
export const PropertyPatchSchema = PropertyFieldsSchema.partial();
export type PropertyPayload = z.infer<typeof PropertyPayloadSchema>;

export function normalizePropertyIdentifier(value?: string | null) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLocaleUpperCase('pt-BR');
}

export function normalizePropertyName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-BR');
}
