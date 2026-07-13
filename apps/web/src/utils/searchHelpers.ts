/**
 * Utilitários para buscas de texto insensíveis a acentuação ortográfica (PT-BR) e caixa (maiúsculas/minúsculas).
 */

export function normalizeSearch(str: string | number | boolean | null | undefined): string {
  if (str === null || str === undefined) return '';
  return str
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function matchesSearch(text: string | number | boolean | null | undefined, query: string | null | undefined): boolean {
  if (!query || query.trim() === '') return true;
  const normText = normalizeSearch(text);
  const normQuery = normalizeSearch(query);
  return normText.includes(normQuery);
}
