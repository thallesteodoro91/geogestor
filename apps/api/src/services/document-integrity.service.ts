import { and, eq, isNull } from 'drizzle-orm';
import { schema } from '@geogestor/database';

/** Definição canônica usada por contadores, seletores e vínculos. */
export function activeDocumentWhere() {
  return and(eq(schema.documentos.status, 'ativo'), isNull(schema.documentos.deletedAt));
}

export function activeClientDocumentWhere(clienteId: string) {
  return and(eq(schema.documentos.clienteId, clienteId), activeDocumentWhere());
}
