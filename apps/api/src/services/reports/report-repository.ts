import { schema } from '@geogestor/database';
import { and, count, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import { db } from '../../db';
import type { ParsedPeriod } from './report-period';

type ReportRows = {
  budgets: typeof schema.orcamentos.$inferSelect[];
  installments: typeof schema.parcelas.$inferSelect[];
  receipts: typeof schema.recebimentos.$inferSelect[];
  expenses: typeof schema.despesas.$inferSelect[];
  projects: typeof schema.projetos.$inferSelect[];
  sourceRecordCount: number;
};

function periodPredicate(expression: SQL, period: ParsedPeriod): SQL | undefined {
  const start = period.previousStartDate || period.startDate;
  const end = period.endDate;
  if (start && end) return sql`${expression} BETWEEN ${start} AND ${end}`;
  if (start) return sql`${expression} >= ${start}`;
  if (end) return sql`${expression} <= ${end}`;
  return undefined;
}

function uniqueById<T extends { id: string }>(rows: T[]) {
  return [...new Map(rows.map((row) => [row.id, row])).values()];
}

async function sourceCount() {
  const [budgets, installments, receipts, expenses, projects] = await Promise.all([
    db.select({ value: count() }).from(schema.orcamentos).where(isNull(schema.orcamentos.deletedAt)),
    db.select({ value: count() }).from(schema.parcelas).where(and(isNull(schema.parcelas.deletedAt), isNull(schema.parcelas.canceladaEm))),
    db.select({ value: count() }).from(schema.recebimentos).where(and(isNull(schema.recebimentos.deletedAt), isNull(schema.recebimentos.estornadoEm))),
    db.select({ value: count() }).from(schema.despesas).where(and(
      isNull(schema.despesas.deletedAt),
      isNull(schema.despesas.canceladaEm),
      isNull(schema.despesas.estornadaEm)
    )),
    db.select({ value: count() }).from(schema.projetos).where(isNull(schema.projetos.deletedAt))
  ]);
  return budgets[0].value + installments[0].value + receipts[0].value + expenses[0].value + projects[0].value;
}

/**
 * Aplica o recorte no SQLite e só completa as relações necessárias por ID.
 * Assim, relatórios por período não materializam tabelas inteiras na API.
 */
export async function loadReportRows(period: ParsedPeriod): Promise<ReportRows> {
  const receiptDate = periodPredicate(sql`${schema.recebimentos.dataRecebimento}`, period);
  const expenseDate = or(
    periodPredicate(sql`${schema.despesas.dataPagamento}`, period),
    periodPredicate(sql`coalesce(${schema.despesas.dataCompetencia}, ${schema.despesas.data})`, period)
  );
  const projectDate = periodPredicate(sql`coalesce(${schema.projetos.dataInicio}, ${schema.projetos.createdAt})`, period);
  const budgetDate = periodPredicate(
    sql`coalesce(${schema.orcamentos.dataCompetencia}, ${schema.orcamentos.dataEmissao}, ${schema.orcamentos.dataOrcamento}, ${schema.orcamentos.createdAt})`,
    period
  );
  const budgetPaymentDate = periodPredicate(sql`${schema.orcamentos.dataPagamento}`, period);
  const installmentDate = or(
    periodPredicate(sql`coalesce(${schema.parcelas.dataCompetencia}, ${schema.parcelas.dataVencimento})`, period),
    periodPredicate(sql`${schema.parcelas.dataPagamento}`, period)
  );

  const [periodReceipts, expenses, projects, total] = await Promise.all([
    db.select().from(schema.recebimentos).where(and(
      isNull(schema.recebimentos.deletedAt),
      isNull(schema.recebimentos.estornadoEm),
      receiptDate
    )),
    db.select().from(schema.despesas).where(and(
      isNull(schema.despesas.deletedAt),
      isNull(schema.despesas.canceladaEm),
      isNull(schema.despesas.estornadaEm),
      expenseDate
    )),
    db.select().from(schema.projetos).where(and(isNull(schema.projetos.deletedAt), projectDate)),
    sourceCount()
  ]);

  const receiptInstallmentIds = periodReceipts.map((row) => row.parcelaId);
  const receiptInstallments = receiptInstallmentIds.length
    ? await db.select().from(schema.parcelas).where(and(
      isNull(schema.parcelas.deletedAt),
      isNull(schema.parcelas.canceladaEm),
      inArray(schema.parcelas.id, receiptInstallmentIds)
    ))
    : [];
  const receiptBudgetIds = receiptInstallments.map((row) => row.orcamentoId);
  const cohortBudgets = await db.select().from(schema.orcamentos).where(and(
    isNull(schema.orcamentos.deletedAt),
    or(
      budgetDate,
      budgetPaymentDate,
      receiptBudgetIds.length ? inArray(schema.orcamentos.id, receiptBudgetIds) : undefined
    )
  ));
  const cohortBudgetIds = cohortBudgets.map((row) => row.id);
  const periodInstallments = await db.select().from(schema.parcelas).where(and(
    isNull(schema.parcelas.deletedAt),
    isNull(schema.parcelas.canceladaEm),
    or(
      installmentDate,
      cohortBudgetIds.length ? inArray(schema.parcelas.orcamentoId, cohortBudgetIds) : undefined
    )
  ));
  const installments = uniqueById([...receiptInstallments, ...periodInstallments]);
  const loadedBudgetIds = new Set(cohortBudgetIds);
  const missingBudgetIds = [...new Set(
    installments
      .map((row) => row.orcamentoId)
      .filter((id) => !loadedBudgetIds.has(id))
  )];
  const parentBudgets = missingBudgetIds.length
    ? await db.select().from(schema.orcamentos).where(and(
      isNull(schema.orcamentos.deletedAt),
      inArray(schema.orcamentos.id, missingBudgetIds)
    ))
    : [];
  const budgets = uniqueById([...cohortBudgets, ...parentBudgets]);
  const installmentIds = installments.map((row) => row.id);
  const linkedReceipts = installmentIds.length
    ? await db.select().from(schema.recebimentos).where(and(
      isNull(schema.recebimentos.deletedAt),
      isNull(schema.recebimentos.estornadoEm),
      inArray(schema.recebimentos.parcelaId, installmentIds)
    ))
    : [];

  return {
    budgets,
    installments,
    receipts: uniqueById([...periodReceipts, ...linkedReceipts]),
    expenses,
    projects,
    sourceRecordCount: total
  };
}
