import type { TDocumentDefinitions } from 'pdfmake/interfaces';

export function withPdfAccessibilityMetadata(definition: TDocumentDefinitions): TDocumentDefinitions {
  const firstText = (content: unknown): string | undefined => {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) return content.map(firstText).find(Boolean);
    if (content && typeof content === 'object' && 'text' in content) return firstText(content.text);
    return undefined;
  };
  return {
    ...definition, language: definition.language || 'pt-BR', displayTitle: true,
    info: { ...definition.info, title: definition.info?.title || firstText(definition.content) || 'Documento GeoGestor' }
  };
}
