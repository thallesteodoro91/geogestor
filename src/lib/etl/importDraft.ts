/**
 * Persistência local do rascunho do UniversalImporter.
 *
 * Mantém em sessionStorage o estado da etapa de validação para que o usuário
 * possa fechar acidentalmente, recarregar a página ou navegar e retomar de
 * onde parou — sem perder mapeamento, overrides e linhas analisadas.
 *
 * Escopo: APENAS o fluxo de importação. Nenhum outro módulo deve usar este
 * helper. Chave isolada por tenant para evitar vazamento entre empresas.
 */

import type { HybridMatch } from "@/lib/etl/hybridMatcher";

const KEY_PREFIX = "geogestor:importDraft:v1:";
const MAX_PERSISTED_ROWS = 5000;

export interface ImportDraft {
  fileName: string;
  headers: string[];
  rows: unknown[][];
  matches: HybridMatch[];
  overrides: Record<string, string | null>;
  savedAt: string;
  truncated: boolean;
  totalRows: number;
}

function storage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function keyFor(tenantId: string | null | undefined): string | null {
  if (!tenantId) return null;
  return `${KEY_PREFIX}${tenantId}`;
}

export interface SaveDraftInput {
  tenantId: string | null | undefined;
  fileName: string;
  headers: string[];
  rows: unknown[][];
  matches: HybridMatch[];
  overrides: Record<string, string | null>;
}

export function saveDraft(input: SaveDraftInput): void {
  const s = storage();
  const key = keyFor(input.tenantId);
  if (!s || !key) return;
  const totalRows = input.rows.length;
  const truncated = totalRows > MAX_PERSISTED_ROWS;
  const draft: ImportDraft = {
    fileName: input.fileName,
    headers: input.headers,
    rows: truncated ? input.rows.slice(0, MAX_PERSISTED_ROWS) : input.rows,
    matches: input.matches,
    overrides: input.overrides,
    savedAt: new Date().toISOString(),
    truncated,
    totalRows,
  };
  try {
    s.setItem(key, JSON.stringify(draft));
  } catch {
    // Quota exceeded — limpe e desista silenciosamente; o fluxo segue em memória.
    try { s.removeItem(key); } catch { /* noop */ }
  }
}

export function loadDraft(tenantId: string | null | undefined): ImportDraft | null {
  const s = storage();
  const key = keyFor(tenantId);
  if (!s || !key) return null;
  try {
    const raw = s.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ImportDraft;
    if (!parsed?.headers || !Array.isArray(parsed.rows)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearDraft(tenantId: string | null | undefined): void {
  const s = storage();
  const key = keyFor(tenantId);
  if (!s || !key) return;
  try { s.removeItem(key); } catch { /* noop */ }
}

export function hasDraft(tenantId: string | null | undefined): boolean {
  return loadDraft(tenantId) != null;
}

export const __testing = { KEY_PREFIX, MAX_PERSISTED_ROWS };
