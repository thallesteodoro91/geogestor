import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { eq } from 'drizzle-orm';

const testRoot = path.resolve(process.cwd(), 'scratch', `deadline-alerts-${process.pid}`);
const dbPath = path.join(testRoot, `deadline-alerts.${process.pid}.test.db`);
const dbFiles = [dbPath, `${dbPath}-shm`, `${dbPath}-wal`];

async function removeDatabase() {
  for (const file of dbFiles) {
    try {
      await fs.rm(file, { force: true, maxRetries: 20, retryDelay: 100 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EBUSY') throw error;
    }
  }
}

process.env.GEOGESTOR_DB_PATH = dbPath;

test('centraliza prazos, estados e recorrências sem duplicar ocorrências', async () => {
  await fs.mkdir(testRoot, { recursive: true });
  await removeDatabase();
  const [{ db, dbReady, closeDb }, { runRuntimeMigrations }, { schema }, alerts, contracts] = await Promise.all([
    import('./db'),
    import('./services/runtime-migrations.service'),
    import('@geogestor/database'),
    import('./services/deadline-alerts.service'),
    import('@geogestor/contracts')
  ]);

  try {
    await dbReady;
    await runRuntimeMigrations();
    const clientId = crypto.randomUUID();
    const projectId = crypto.randomUUID();
    const archivedProjectId = crypto.randomUUID();
    const budgetId = crypto.randomUUID();
    const licenseId = crypto.randomUUID();
    await db.insert(schema.clientes).values({ id: clientId, nome: 'Cliente dos alertas' });
    await db.insert(schema.projetos).values([
      { id: projectId, clienteId: clientId, nome: 'Serviço RTK', status: 'Em Andamento', dataEntrega: '2026-08-05' },
      { id: archivedProjectId, clienteId: clientId, nome: 'Projeto arquivado', status: 'Arquivado', dataEntrega: '2026-08-02' }
    ]);
    await db.insert(schema.tarefas).values([
      { id: crypto.randomUUID(), clienteId: clientId, projetoId: projectId, titulo: 'Tarefa concluída', status: 'Concluído', dataLimite: '2026-08-02' },
      { id: crypto.randomUUID(), clienteId: clientId, projetoId: projectId, titulo: 'Tarefa pendente', status: 'A Fazer', dataLimite: '2026-08-03' }
    ]);
    await db.insert(schema.orcamentos).values({
      id: budgetId,
      clienteId: clientId,
      projetoId: projectId,
      valorTotal: 20_000,
      status: 'Enviado',
      descricao: 'Proposta RTK',
      validadeAte: '2026-08-04'
    });
    await db.insert(schema.parcelas).values([
      { id: crypto.randomUUID(), orcamentoId: budgetId, valor: 10_000, valorPago: 10_000, numero: 1, statusPagamento: 'Pago', dataVencimento: '2026-07-31', dataPagamento: '2026-07-31' },
      { id: crypto.randomUUID(), orcamentoId: budgetId, valor: 10_000, valorPago: 4_000, numero: 2, statusPagamento: 'Pendente', dataVencimento: '2026-07-31' }
    ]);
    await db.insert(schema.despesas).values({
      id: crypto.randomUUID(), clienteId: clientId, projetoId: projectId, descricao: 'Taxa de cartório',
      valor: 2_500, data: '2026-07-30', categoria: 'Cartório', status: 'Pendente'
    });
    await db.insert(schema.licencas).values({
      id: licenseId, projetoId: projectId, clienteId: clientId, numero: 'LAO-42', orgao: 'IMA',
      status: 'Válida', dataVencimento: '2026-08-06'
    });
    await db.insert(schema.condicionantesAmbientais).values({
      id: crypto.randomUUID(), licencaId: licenseId, titulo: 'Enviar relatório',
      status: 'Pendente', dataLimite: '2026-08-02'
    });
    await db.insert(schema.compromissos).values({
      id: crypto.randomUUID(), clienteId: clientId, projetoId: projectId, titulo: 'Visita de campo', data: '2026-08-02'
    });
    await db.insert(schema.oportunidades).values({
      id: crypto.randomUUID(), clienteId: clientId, titulo: 'Proposta comercial', estagio: 'Proposta',
      proximaAcao: 'Telefonar para o cliente', proximaAcaoEm: '2026-08-02'
    });

    const defaults = await alerts.getAlertSettings();
    assert.equal(defaults.enabled, true);
    assert.equal(defaults.categories.every((item) => item.daysBefore === 7), true);

    const initial = await alerts.listDeadlineAlerts('2026-08-01');
    assert.ok(initial.items.some((item) => item.category === 'project' && item.title === 'Serviço RTK'));
    assert.equal(initial.items.some((item) => item.title === 'Projeto arquivado'), false);
    assert.equal(initial.items.some((item) => item.title === 'Tarefa concluída'), false);
    assert.ok(initial.items.some((item) => item.category === 'task' && item.title === 'Tarefa pendente'));
    assert.equal(initial.items.filter((item) => item.category === 'receivable').length, 1, 'somente o saldo parcial deve alertar');
    assert.match(initial.items.find((item) => item.category === 'receivable')?.description || '', /R\$\s*60,00/);
    assert.ok(initial.items.some((item) => item.category === 'payable' && item.severity === 'critical'));
    assert.ok(initial.items.some((item) => item.category === 'license'));
    assert.ok(initial.items.some((item) => item.category === 'condition'));

    const repeated = await alerts.listDeadlineAlerts('2026-08-01');
    assert.deepEqual(repeated.items.map((item) => item.id), initial.items.map((item) => item.id), 'a mesma recorrência não pode duplicar');
    const nextDay = await alerts.listDeadlineAlerts('2026-08-02');
    assert.notEqual(nextDay.items.find((item) => item.category === 'project')?.id, initial.items.find((item) => item.category === 'project')?.id, 'a recorrência diária deve criar uma nova ocorrência');
    assert.equal(nextDay.items.find((item) => item.category === 'appointment')?.timingLabel, 'Vence hoje');

    const projectOnlyOneDay = structuredClone(defaults);
    projectOnlyOneDay.categories = projectOnlyOneDay.categories.map((item) => item.category === 'project' ? { ...item, daysBefore: 1 } : item);
    await alerts.saveAlertSettings(projectOnlyOneDay);
    assert.equal((await alerts.listDeadlineAlerts('2026-08-01')).items.some((item) => item.category === 'project'), false, 'a nova antecedência deve valer imediatamente');

    const customized = structuredClone(projectOnlyOneDay);
    customized.categories = customized.categories.map((item) => {
      if (item.category === 'project') return { ...item, daysBefore: 7, recurrence: 'interval' as const, intervalDays: 3 };
      if (item.category === 'license' || item.category === 'condition') return { ...item, enabled: false };
      return item;
    });
    await alerts.saveAlertSettings(customized);
    const configured = await alerts.listDeadlineAlerts('2026-08-01');
    assert.ok(configured.items.some((item) => item.category === 'project'));
    assert.equal(configured.items.some((item) => item.category === 'license' || item.category === 'condition'), false);
    const persisted = await alerts.getAlertSettings();
    assert.equal(persisted.categories.find((item) => item.category === 'project')?.intervalDays, 3);

    const projectAlert = configured.items.find((item) => item.category === 'project');
    assert.ok(projectAlert);
    await alerts.DeadlineAlertStateService.dismiss([projectAlert.id]);
    assert.equal((await alerts.listDeadlineAlerts('2026-08-01')).items.some((item) => item.id === projectAlert.id), false);
    await alerts.DeadlineAlertStateService.restore([projectAlert.id]);
    assert.equal((await alerts.listDeadlineAlerts('2026-08-01')).items.some((item) => item.id === projectAlert.id), true);

    await db.update(schema.projetos).set({ status: 'Cancelado' }).where(eq(schema.projetos.id, projectId));
    assert.equal((await alerts.listDeadlineAlerts('2026-08-01')).items.some((item) => item.category === 'project'), false);

    assert.equal(alerts.civilDaysBetween('2026-08-01', '2026-08-02'), 1);
    assert.equal(alerts.civilDaysBetween('2026-10-17', '2026-10-18'), 1, 'datas civis não dependem de UTC ou horário de verão');
    assert.equal(alerts.saoPauloDateKey(new Date('2026-08-02T02:30:00.000Z')), '2026-08-01');
    assert.deepEqual(contracts.AlertSettingsSchema.parse(await alerts.getAlertSettings()), await alerts.getAlertSettings());
  } finally {
    await closeDb();
    await removeDatabase();
  }
});
