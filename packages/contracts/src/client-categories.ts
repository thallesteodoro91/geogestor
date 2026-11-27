export const PUBLIC_ENTITY_CATEGORY = 'Entidade Pública';
export const CLIENT_PRIMARY_CATEGORIES = [
  PUBLIC_ENTITY_CATEGORY,
  'Produtor Rural',
  'Empresa',
  'Indústria',
  'Comércio'
] as const;
export const CLIENT_PROFILE_TAGS = ['Parceiro'] as const;

const PERSON_TYPE_LABELS = new Set(['pessoa fisica', 'pessoa juridica']);

const normalizedLabel = (value: string) => value.trim()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR');

export function isPublicEntityCategory(value: string): boolean {
  return ['governo', 'orgao publico', 'entidade publica'].includes(normalizedLabel(value));
}

export function normalizeClientCategoryTag(value: string): string {
  const trimmed = value.trim();
  if (isPublicEntityCategory(trimmed)) return PUBLIC_ENTITY_CATEGORY;
  return [...CLIENT_PRIMARY_CATEGORIES, ...CLIENT_PROFILE_TAGS]
    .find((label) => normalizedLabel(label) === normalizedLabel(trimmed)) ?? trimmed;
}

export function splitClientCategoryTags(value?: string | null): string[] {
  return [...new Set((value || '')
    .split(',')
    .map(normalizeClientCategoryTag)
    .filter(Boolean))];
}

export function normalizeClientCategoryText(value?: string | null): string | null {
  return splitClientCategoryTags(value).join(', ') || null;
}

export function resolveClientClassification(category?: string | null, profiles?: string | null) {
  const categoryTags = splitClientCategoryTags(category);
  const candidates = categoryTags.filter((tag) =>
    !PERSON_TYPE_LABELS.has(normalizedLabel(tag)) && tag !== 'Parceiro');
  const primary = candidates.length === 1 ? candidates[0] : null;
  const profileTags = [...new Set([
    ...categoryTags.filter((tag) => tag === 'Parceiro'),
    ...splitClientCategoryTags(profiles).filter((tag) =>
      tag !== primary && !PERSON_TYPE_LABELS.has(normalizedLabel(tag))
      && (tag === 'Parceiro' || !categoryTags.includes(tag)))
  ])];

  return {
    primary,
    profiles: profileTags,
    needsReview: candidates.length > 1,
    legacyCategory: candidates.length > 1 ? category?.trim() || null : null
  };
}

export function clientCategoryIconKind(category?: string | null) {
  const primary = resolveClientClassification(category).primary;
  switch (primary) {
    case 'Entidade Pública': return 'public' as const;
    case 'Produtor Rural': return 'rural' as const;
    case 'Empresa': return 'business' as const;
    case 'Indústria': return 'industry' as const;
    case 'Comércio': return 'commerce' as const;
    default: return 'neutral' as const;
  }
}
