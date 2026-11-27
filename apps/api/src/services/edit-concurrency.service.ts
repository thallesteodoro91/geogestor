import crypto from 'node:crypto';
import { getTableColumns, isNull, and, eq, type SQL } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

export function editToken(row: Record<string, unknown>) {
  const entries = Object.keys(row).sort().map((key) => [key, row[key]]);
  return crypto.createHash('sha256').update(JSON.stringify(entries)).digest('hex');
}

// Compare the complete database snapshot in the UPDATE itself. A timestamp alone
// can collide when two writes happen within the same clock tick.
export function unchangedRow(table: SQLiteTable, row: Record<string, unknown>): SQL | undefined {
  const columns = getTableColumns(table);
  return and(...Object.entries(row).flatMap(([key, value]) => {
    const column = columns[key];
    if (!column) return [];
    return [value === null ? isNull(column) : eq(column, value)];
  }));
}

export function nextEditTime(previous: string) {
  const previousTime = Date.parse(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(previous) ? previous.replace(' ', 'T') + 'Z' : previous);
  return new Date(Math.max(Date.now(), Number.isFinite(previousTime) ? previousTime + 1 : 0)).toISOString();
}

export const editConflict = {
  code: 'EDIT_CONFLICT',
  error: 'Outra janela alterou ou excluiu este registro. Seu rascunho foi preservado. Consulte a versão atual antes de reaplicar suas alterações.'
};
