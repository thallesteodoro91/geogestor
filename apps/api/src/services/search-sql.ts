import { sql, type SQL, type AnyColumn } from 'drizzle-orm';

export function normalizedSearchText(column: AnyColumn | SQL): SQL {
  const stages: SQL[] = [sql`s0(value) AS MATERIALIZED (SELECT coalesce(${column}, ''))`];
  let value = sql`value`;
  let depth = 0; let stage = 0;
  for (const [letters, plain] of [['áàâãäÁÀÂÃÄ', 'a'], ['éèêëÉÈÊË', 'e'], ['íìîïÍÌÎÏ', 'i'], ['óòôõöÓÒÔÕÖ', 'o'], ['úùûüÚÙÛÜ', 'u'], ['çÇ', 'c'], ['ñÑ', 'n']]) {
    for (const letter of letters) {
      value = sql`replace(${value}, ${letter}, ${plain})`;
      if (++depth % 12 === 0) {
        stages.push(sql`${sql.raw(`s${stage + 1}(value)`)} AS MATERIALIZED (SELECT ${value} FROM ${sql.raw(`s${stage}`)})`);
        stage += 1; value = sql`value`;
      }
    }
  }
  return sql`(WITH ${sql.join(stages, sql`, `)} SELECT lower(${value}) FROM ${sql.raw(`s${stage}`)})`;
}

export function searchContains(query: string, columns: AnyColumn[]) {
  // NUL separators prevent a substring from spanning two independent fields.
  const text = sql.join(columns.map(column => sql`coalesce(${column}, '')`), sql` || char(0) || `);
  return sql`instr(${normalizedSearchText(text)}, ${query}) > 0`;
}
