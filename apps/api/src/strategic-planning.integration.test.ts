import { injectWithRecordVersion } from './test-support/record-request';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { and, eq, isNull } from 'drizzle-orm';
import type { StrategicPlanningSnapshot } from '@geogestor/contracts';

const testRoot = path.resolve(process.cwd(), 'scratch', `strategic-planning-${process.pid}`);
const dbPath = path.join(testRoot, 'strategic-planning.test.db');
const dbFiles = [dbPath, `${dbPath}-shm`, `${dbPath}-wal`];

process.env.GEOGESTOR_DB_PATH = dbPath;
process.env.GEOGESTOR_API_TOKEN = 'test-token';

test('planejamento estratégico persiste metas explícitas e não inventa valor para fonte vazia', async () => {
  await fs.mkdir(testRoot, { recursive: true });
  await Promise.all(dbFiles.map((file) => fs.rm(file, { force: true })));

  const [{ server }, { db, dbReady }, { runRuntimeMigrations }, { schema }, { AuditLogService }] = await Promise.all([
    import('./server'),
    import('./db'),
    import('./services/runtime-migrations.service'),
    import('@geogestor/database'),
    import('./services/audit.service')
  ]);

  const request = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: Record<string, unknown>) => injectWithRecordVersion(server, {
    method,
    url,
    headers: { 'x-api-token': 'test-token' },
    payload
  });

  try {
    await dbReady;
    const migration = await runRuntimeMigrations();
    assert.equal(migration.schemaVersion, 19);
    const foreignKeys = await db.$client.execute('PRAGMA foreign_keys;');
    assert.equal(Number(foreignKeys.rows[0]?.foreign_keys), 1);

    const impossibleDate = await request('POST', '/api/planejamento/ciclos', {
      nome: 'Ciclo com data impossível',
      dataInicio: '2026-02-30',
      dataFim: '2026-03-31',
      visao: 'Este registro não pode ser persistido.',
      status: 'rascunho'
    });
    assert.equal(impossibleDate.statusCode, 400);

    const extraField = await request('POST', '/api/planejamento/ciclos', {
      nome: 'Ciclo com campo adulterado',
      dataInicio: '2026-01-01',
      dataFim: '2026-12-31',
      visao: 'Este registro não pode ser persistido.',
      status: 'rascunho',
      administrador: true
    });
    assert.equal(extraField.statusCode, 400);

    const malformedCycleId = await request('GET', '/api/planejamento/ciclos/nao-e-uuid');
    assert.equal(malformedCycleId.statusCode, 400);

    const cycleResponse = await request('POST', '/api/planejamento/ciclos', {
      nome: 'Plano 2026',
      dataInicio: '2026-01-01',
      dataFim: '2026-12-31',
      visao: 'Consolidar uma operação sustentável e previsível.',
      status: 'ativo',
      proximaRevisao: '2026-08-15'
    });
    assert.equal(cycleResponse.statusCode, 201);
    const cycle = cycleResponse.json<{ id: string }>();

    const emptyCyclePatch = await request('PATCH', `/api/planejamento/ciclos/${cycle.id}`, {});
    assert.equal(emptyCyclePatch.statusCode, 400);

    const emptySnapshotResponse = await request('GET', `/api/planejamento/ciclos/${cycle.id}`);
    assert.equal(emptySnapshotResponse.statusCode, 200);
    const emptySnapshot = emptySnapshotResponse.json<StrategicPlanningSnapshot>();
    assert.equal(emptySnapshot.resumo.progressoGeral, null);
    assert.equal(emptySnapshot.resultadosChave.length, 0);

    const pillarResponse = await request('POST', '/api/planejamento/pilares', {
      cicloId: cycle.id,
      nome: 'Sustentabilidade financeira',
      descricao: 'Liquidez, margem e previsibilidade.',
      ordem: 1
    });
    assert.equal(pillarResponse.statusCode, 201);
    const pillar = pillarResponse.json<{ id: string }>();

    const objectiveResponse = await request('POST', '/api/planejamento/objetivos', {
      cicloId: cycle.id,
      pilarId: pillar.id,
      titulo: 'Aumentar a previsibilidade do caixa',
      descricao: 'Manter uma leitura gerencial baseada em recebimentos confirmados.',
      responsavel: 'Thalles',
      dataLimite: '2026-12-20',
      status: 'em_andamento',
      prioridade: 'alta'
    });
    assert.equal(objectiveResponse.statusCode, 201);
    const objective = objectiveResponse.json<{ id: string }>();

    const manualResultResponse = await request('POST', '/api/planejamento/resultados-chave', {
      objetivoId: objective.id,
      titulo: 'Índice interno de previsibilidade',
      linhaBase: 0,
      meta: 100,
      valorAtual: 50,
      unidade: '%',
      direcao: 'aumentar',
      fonteTipo: 'manual',
      fonteCodigo: null,
      fonteRegra: 'Valor informado pelo responsável.',
      frequencia: 'mensal',
      confianca: 'alta'
    });
    assert.equal(manualResultResponse.statusCode, 201);
    const manualResult = manualResultResponse.json<{ id: string }>();

    const automaticResultResponse = await request('POST', '/api/planejamento/resultados-chave', {
      objetivoId: objective.id,
      titulo: 'Conversão comercial',
      linhaBase: 0,
      meta: 50,
      valorAtual: null,
      unidade: '%',
      direcao: 'aumentar',
      fonteTipo: 'crm',
      fonteCodigo: 'crm_taxa_conversao',
      frequencia: 'mensal',
      confianca: 'media'
    });
    assert.equal(automaticResultResponse.statusCode, 201);
    const automaticResult = automaticResultResponse.json<{ id: string }>();

    const financeResultResponse = await request('POST', '/api/planejamento/resultados-chave', {
      objetivoId: objective.id,
      titulo: 'Resultado de caixa',
      linhaBase: 0,
      meta: 100000,
      valorAtual: null,
      unidade: 'BRL',
      direcao: 'aumentar',
      fonteTipo: 'financeiro',
      fonteCodigo: 'financeiro_resultado_caixa',
      frequencia: 'mensal',
      confianca: 'alta'
    });
    assert.equal(financeResultResponse.statusCode, 201);
    const financeResult = financeResultResponse.json<{ id: string }>();

    const projectsResultResponse = await request('POST', '/api/planejamento/resultados-chave', {
      objetivoId: objective.id,
      titulo: 'Conclusão de projetos',
      linhaBase: 0,
      meta: 100,
      valorAtual: null,
      unidade: '%',
      direcao: 'aumentar',
      fonteTipo: 'projetos',
      fonteCodigo: 'projetos_taxa_conclusao',
      frequencia: 'mensal',
      confianca: 'media'
    });
    assert.equal(projectsResultResponse.statusCode, 201);

    const tasksResultResponse = await request('POST', '/api/planejamento/resultados-chave', {
      objetivoId: objective.id,
      titulo: 'Conclusão de tarefas',
      linhaBase: 0,
      meta: 100,
      valorAtual: null,
      unidade: '%',
      direcao: 'aumentar',
      fonteTipo: 'tarefas',
      fonteCodigo: 'tarefas_taxa_conclusao',
      frequencia: 'mensal',
      confianca: 'media'
    });
    assert.equal(tasksResultResponse.statusCode, 201);

    const reduceResultResponse = await request('POST', '/api/planejamento/resultados-chave', {
      objetivoId: objective.id,
      titulo: 'Reduzir prazo médio', linhaBase: 100, meta: 50, valorAtual: 75,
      unidade: 'dias', direcao: 'reduzir', fonteTipo: 'manual', frequencia: 'mensal', confianca: 'alta'
    });
    assert.equal(reduceResultResponse.statusCode, 201);

    const maintainResultResponse = await request('POST', '/api/planejamento/resultados-chave', {
      objetivoId: objective.id,
      titulo: 'Manter qualidade', linhaBase: 100, meta: 100, valorAtual: 100,
      unidade: '%', direcao: 'manter', fonteTipo: 'manual', frequencia: 'mensal', confianca: 'alta'
    });
    assert.equal(maintainResultResponse.statusCode, 201);

    const initiativeResponse = await request('POST', '/api/planejamento/iniciativas', {
      objetivoId: objective.id,
      titulo: 'Implantar rotina mensal de revisão',
      responsavel: 'Thalles',
      dataLimite: '2026-09-30',
      progresso: 25,
      status: 'em_andamento',
      orcamentoCentavos: null,
      projetoId: null,
      tarefaId: null
    });
    assert.equal(initiativeResponse.statusCode, 201);
    const initiative = initiativeResponse.json<{ id: string }>();

    const checkinResponse = await request('POST', '/api/planejamento/checkins', {
      cicloId: cycle.id,
      objetivoId: objective.id,
      data: '2026-07-30',
      status: 'atencao',
      narrativa: 'A rotina foi iniciada, mas ainda precisa de responsáveis substitutos.',
      confianca: 'media',
      decisoesPendentes: 'Definir responsável substituto.',
      proximaRevisao: '2026-08-15'
    });
    assert.equal(checkinResponse.statusCode, 201);
    const checkin = checkinResponse.json<{ id: string }>();

    const riskResponse = await request('POST', '/api/planejamento/riscos', {
      cicloId: cycle.id,
      objetivoId: null,
      iniciativaId: initiative.id,
      descricao: 'Dependência excessiva de atualização manual.',
      impacto: 'alto',
      probabilidade: 'medio',
      mitigacao: 'Automatizar fontes críticas.',
      responsavel: 'Thalles',
      status: 'mitigando'
    });
    assert.equal(riskResponse.statusCode, 201);
    const risk = riskResponse.json<{ id: string }>();

    const snapshotResponse = await request('GET', `/api/planejamento/ciclos/${cycle.id}`);
    assert.equal(snapshotResponse.statusCode, 200);
    const snapshot = snapshotResponse.json<StrategicPlanningSnapshot>();
    assert.equal(snapshot.objetivos.length, 1);
    assert.equal(snapshot.iniciativas.length, 1);
    assert.equal(snapshot.checkins.length, 1);
    assert.equal(snapshot.riscos.length, 1);
    assert.equal(snapshot.resumo.decisoesPendentes, 1);
    assert.equal(snapshot.resumo.objetivosEmRisco, 1);
    assert.equal(snapshot.riscos[0]?.objetivoId, null, 'O vínculo indireto não deve reescrever registros existentes.');
    assert.equal(snapshot.riscos[0]?.iniciativaId, initiative.id);
    assert.equal(snapshot.resumo.dadosDesatualizados, 0);
    assert.equal(snapshot.decisoes.length, 1);
    assert.equal(snapshot.decisoes[0]?.descricao, 'Definir responsável substituto.');
    assert.equal(snapshot.decisoes[0]?.status, 'pendente');
    assert.equal(snapshot.tendencias.disponivel, false);

    const manual = snapshot.resultadosChave.find((item) => item.fonteTipo === 'manual');
    const automatic = snapshot.resultadosChave.find((item) => item.fonteTipo === 'crm');
    assert.equal(manual?.progresso, 50);
    assert.equal(automatic?.valorAtual, null);
    assert.equal(automatic?.progresso, null);
    assert.match(automatic?.fonteRegra || '', /oportunidades ganhas/i);
    const finance = snapshot.resultadosChave.find((item) => item.fonteTipo === 'financeiro');
    const reduce = snapshot.resultadosChave.find((item) => item.direcao === 'reduzir');
    const maintain = snapshot.resultadosChave.find((item) => item.direcao === 'manter');
    assert.equal(finance?.valorAtual, null);
    assert.equal(finance?.estadoDado, 'indisponivel');
    assert.equal(reduce?.progresso, 50);
    assert.equal(maintain?.progresso, 100);
    assert.match(reduce?.formulaProgresso || '', /linha de base/i);

    const fixtureUpdatedAt = '2026-07-15T12:00:00.000Z';
    const clientId = crypto.randomUUID();
    const budgetId = crypto.randomUUID();
    const parcelId = crypto.randomUUID();
    const activeProjectId = crypto.randomUUID();
    const completedProjectId = crypto.randomUUID();
    await db.transaction(async (tx) => {
      await tx.insert(schema.clientes).values({ id: clientId, nome: 'Cliente das fontes', createdAt: fixtureUpdatedAt, updatedAt: fixtureUpdatedAt });
      await tx.insert(schema.orcamentos).values({
        id: budgetId, clienteId: clientId, valorTotal: 10000, status: 'aprovado', createdAt: fixtureUpdatedAt, updatedAt: fixtureUpdatedAt
      });
      await tx.insert(schema.parcelas).values({
        id: parcelId, orcamentoId: budgetId, valor: 10000, dataVencimento: '2026-07-10', statusPagamento: 'Pago',
        createdAt: fixtureUpdatedAt, updatedAt: fixtureUpdatedAt
      });
      await tx.insert(schema.recebimentos).values({
        id: crypto.randomUUID(), parcelaId: parcelId, valorPrincipal: 10000, valorRecebido: 10000,
        dataRecebimento: '2026-07-10', createdAt: fixtureUpdatedAt, updatedAt: fixtureUpdatedAt
      });
      await tx.insert(schema.despesas).values({
        id: crypto.randomUUID(), descricao: 'Despesa paga', valor: 4000, data: '2026-07-11', dataPagamento: '2026-07-11',
        categoria: 'Operacional', status: 'Pago', createdAt: fixtureUpdatedAt, updatedAt: fixtureUpdatedAt
      });
      await tx.insert(schema.despesas).values({
        id: crypto.randomUUID(), descricao: 'Despesa pendente ignorada', valor: 900000, data: '2026-07-11',
        categoria: 'Operacional', status: 'Pendente', createdAt: fixtureUpdatedAt, updatedAt: fixtureUpdatedAt
      });
      await tx.insert(schema.oportunidades).values([
        { id: crypto.randomUUID(), clienteId: clientId, titulo: 'Oportunidade ganha', estagio: 'Ganho', encerradoEm: '2026-06-10', createdAt: fixtureUpdatedAt, updatedAt: fixtureUpdatedAt },
        { id: crypto.randomUUID(), clienteId: clientId, titulo: 'Oportunidade perdida', estagio: 'Perdido', encerradoEm: '2026-06-11', createdAt: fixtureUpdatedAt, updatedAt: fixtureUpdatedAt },
        { id: crypto.randomUUID(), clienteId: clientId, titulo: 'Oportunidade aberta ignorada', estagio: 'Negociação', createdAt: fixtureUpdatedAt, updatedAt: fixtureUpdatedAt }
      ]);
      await tx.insert(schema.projetos).values([
        { id: completedProjectId, clienteId: clientId, nome: 'Projeto concluído', status: 'Concluído', dataInicio: '2026-01-10', dataEntrega: '2026-04-10', createdAt: fixtureUpdatedAt, updatedAt: fixtureUpdatedAt },
        { id: activeProjectId, clienteId: clientId, nome: 'Projeto ativo', status: 'Em Andamento', dataInicio: '2026-03-10', dataEntrega: '2026-10-10', createdAt: fixtureUpdatedAt, updatedAt: fixtureUpdatedAt }
      ]);
      await tx.insert(schema.tarefas).values([
        { id: crypto.randomUUID(), projetoId: completedProjectId, titulo: 'Tarefa concluída', status: 'Concluído', prioridade: 'Média', dataLimite: '2026-05-10', createdAt: fixtureUpdatedAt, updatedAt: fixtureUpdatedAt },
        { id: crypto.randomUUID(), projetoId: activeProjectId, titulo: 'Tarefa aberta', status: 'A Fazer', prioridade: 'Média', dataLimite: '2026-08-10', createdAt: fixtureUpdatedAt, updatedAt: fixtureUpdatedAt }
      ]);
    });

    const sourcedSnapshot = (await request('GET', `/api/planejamento/ciclos/${cycle.id}`)).json<StrategicPlanningSnapshot>();
    assert.equal(sourcedSnapshot.resultadosChave.find((item) => item.fonteTipo === 'financeiro')?.valorAtual, 60);
    assert.equal(sourcedSnapshot.resultadosChave.find((item) => item.fonteTipo === 'crm')?.valorAtual, 50);
    assert.equal(sourcedSnapshot.resultadosChave.find((item) => item.fonteTipo === 'projetos')?.valorAtual, 50);
    assert.equal(sourcedSnapshot.resultadosChave.find((item) => item.fonteTipo === 'tarefas')?.valorAtual, 50);
    assert.equal(sourcedSnapshot.resumo.dadosDesatualizados, 4);

    const tamperedSource = await request('PATCH', `/api/planejamento/resultados-chave/${automaticResult.id}`, {
      fonteRegra: 'Sempre retornar 100%',
      fontePeriodo: 'qualquer período',
      fonteRota: '/rota-adulterada',
      unidade: 'R$'
    });
    assert.equal(tamperedSource.statusCode, 200);
    const canonicalSource = tamperedSource.json<{ fonteRegra: string; fontePeriodo: string; fonteRota: string; unidade: string }>();
    assert.match(canonicalSource.fonteRegra, /oportunidades ganhas/i);
    assert.equal(canonicalSource.fontePeriodo, 'Período do ciclo estratégico');
    assert.equal(canonicalSource.fonteRota, '/crm');
    assert.equal(canonicalSource.unidade, '%');

    const financeSourceSwitch = await request('PATCH', `/api/planejamento/resultados-chave/${financeResult.id}`, {
      fonteTipo: 'manual', valorAtual: 25, unidade: 'R$', fonteCodigo: 'financeiro_resultado_caixa'
    });
    assert.equal(financeSourceSwitch.statusCode, 200);
    assert.equal(financeSourceSwitch.json<{ fonteCodigo: string | null }>().fonteCodigo, null);

    const [historicalSnapshotBeforeEdit] = await db.select().from(schema.snapshotsEstrategicos)
      .where(and(eq(schema.snapshotsEstrategicos.checkinId, checkin.id), isNull(schema.snapshotsEstrategicos.deletedAt)));
    assert.ok(historicalSnapshotBeforeEdit);

    const decisionId = snapshot.decisoes[0]?.id;
    assert.ok(decisionId);
    const invalidClosure = await request('PATCH', `/api/planejamento/decisoes/${decisionId}`, { status: 'concluida' });
    assert.equal(invalidClosure.statusCode, 400);
    assert.match(invalidClosure.json<{ error: string }>().error, /como a decisão foi concluída/i);

    const closeDecision = await request('PATCH', `/api/planejamento/decisoes/${decisionId}`, {
      status: 'concluida',
      observacaoEncerramento: 'Responsável substituto definido e comunicado.'
    });
    assert.equal(closeDecision.statusCode, 200);

    const updateObjective = await request('PATCH', `/api/planejamento/objetivos/${objective.id}`, { ordem: 3, prioridade: 'critica' });
    assert.equal(updateObjective.statusCode, 200);
    const updateResult = await request('PATCH', `/api/planejamento/resultados-chave/${manualResult.id}`, { valorAtual: 75 });
    assert.equal(updateResult.statusCode, 200);
    assert.equal((await request('PATCH', `/api/planejamento/ciclos/${cycle.id}`, { visao: 'Consolidar uma operação sustentável, previsível e auditável.' })).statusCode, 200);
    assert.equal((await request('PATCH', `/api/planejamento/pilares/${pillar.id}`, { ordem: 2 })).statusCode, 200);
    assert.equal((await request('PATCH', `/api/planejamento/iniciativas/${initiative.id}`, { progresso: 40, proximoMarco: 'Publicar o calendário mensal.' })).statusCode, 200);
    assert.equal((await request('PATCH', `/api/planejamento/checkins/${checkin.id}`, { narrativa: 'A rotina avançou e os responsáveis substitutos foram definidos.' })).statusCode, 200);
    assert.equal((await request('PATCH', `/api/planejamento/riscos/${risk.id}`, { status: 'resolvido' })).statusCode, 200);

    const [historicalSnapshotAfterEdit] = await db.select().from(schema.snapshotsEstrategicos)
      .where(and(eq(schema.snapshotsEstrategicos.checkinId, checkin.id), isNull(schema.snapshotsEstrategicos.deletedAt)));
    assert.equal(historicalSnapshotAfterEdit?.objetivosJson, historicalSnapshotBeforeEdit.objetivosJson);
    assert.equal(historicalSnapshotAfterEdit?.progressoGeral, historicalSnapshotBeforeEdit.progressoGeral);

    const secondCheckin = await request('POST', '/api/planejamento/checkins', {
      cicloId: cycle.id,
      objetivoId: objective.id,
      data: '2026-08-15',
      status: 'no_rumo',
      narrativa: 'A previsibilidade evoluiu e a decisão anterior foi concluída.',
      confianca: 'alta',
      proximaRevisao: '2026-09-15'
    });
    assert.equal(secondCheckin.statusCode, 201);

    // A review retains its historical forecast; only editing the cycle changes its live schedule.
    const afterNewReview = (await request('GET', `/api/planejamento/ciclos/${cycle.id}`)).json<StrategicPlanningSnapshot>();
    assert.equal(afterNewReview.ciclo.proximaRevisao, '2026-08-15');
    assert.equal((await request('PATCH', `/api/planejamento/ciclos/${cycle.id}`, { proximaRevisao: '2026-10-15' })).statusCode, 200);
    assert.equal((await request('PATCH', `/api/planejamento/checkins/${checkin.id}`, { proximaRevisao: '2026-08-01', narrativa: 'Revisão histórica ajustada, sem reagendar o ciclo.' })).statusCode, 200);
    const afterOldReview = (await request('GET', `/api/planejamento/ciclos/${cycle.id}`)).json<StrategicPlanningSnapshot>();
    assert.equal(afterOldReview.ciclo.proximaRevisao, '2026-10-15');
    assert.equal(afterOldReview.checkins.find(item => item.id === checkin.id)?.proximaRevisao, '2026-08-01');
    assert.equal(afterOldReview.checkins.find(item => item.id === checkin.id)?.decisoesPendentes, 'Definir responsável substituto.');
    assert.equal((await request('PATCH', `/api/planejamento/ciclos/${cycle.id}`, { proximaRevisao: null })).statusCode, 200);
    const afterClearSchedule = (await request('GET', `/api/planejamento/ciclos/${cycle.id}`)).json<StrategicPlanningSnapshot>();
    assert.equal(afterClearSchedule.ciclo.proximaRevisao, null);
    assert.equal(afterClearSchedule.checkins.find(item => item.id === checkin.id)?.proximaRevisao, '2026-08-01');
    assert.equal((await request('PATCH', `/api/planejamento/checkins/${checkin.id}`, { data: '2026-08-02' })).statusCode, 200);
    const correctedDate = (await request('GET', `/api/planejamento/ciclos/${cycle.id}`)).json<StrategicPlanningSnapshot>();
    assert.equal(correctedDate.ciclo.proximaRevisao, null);
    assert.equal(correctedDate.checkins.find(item => item.id === checkin.id)?.proximaRevisao, '2026-08-01');
    // Restore the historical date used by the trend assertions below.
    assert.equal((await request('PATCH', `/api/planejamento/checkins/${checkin.id}`, { data: '2026-07-30' })).statusCode, 200);

    const evolvedSnapshot = (await request('GET', `/api/planejamento/ciclos/${cycle.id}`)).json<StrategicPlanningSnapshot>();
    assert.equal(evolvedSnapshot.resumo.decisoesPendentes, 0);
    assert.equal(evolvedSnapshot.decisoes[0]?.observacaoEncerramento, 'Responsável substituto definido e comunicado.');
    assert.equal(evolvedSnapshot.tendencias.disponivel, true);
    assert.equal(evolvedSnapshot.tendencias.revisaoAnterior?.slice(0, 10), '2026-07-30');
    assert.equal(evolvedSnapshot.tendencias.revisaoAtual?.slice(0, 10), '2026-08-15');
    assert.ok(evolvedSnapshot.linhaDoTempo.some((item) => item.tipo === 'decisao'));

    const reopenDecision = await request('PATCH', `/api/planejamento/decisoes/${decisionId}`, {
      status: 'em_andamento',
      observacaoEncerramento: null
    });
    assert.equal(reopenDecision.statusCode, 200);
    const reopenedSnapshot = (await request('GET', `/api/planejamento/ciclos/${cycle.id}`)).json<StrategicPlanningSnapshot>();
    assert.equal(reopenedSnapshot.resumo.decisoesPendentes, 1);
    assert.equal(reopenedSnapshot.decisoes[0]?.concluidaEm, null);

    const secondCycleResponse = await request('POST', '/api/planejamento/ciclos', {
      nome: 'Plano 2027', dataInicio: '2027-01-01', dataFim: '2027-12-31',
      visao: 'Validar vínculos e exclusão em cascata lógica.', status: 'rascunho'
    });
    assert.equal(secondCycleResponse.statusCode, 201);
    const secondCycle = secondCycleResponse.json<{ id: string }>();
    const secondPillarResponse = await request('POST', '/api/planejamento/pilares', {
      cicloId: secondCycle.id, nome: 'Pilar descartável', ordem: 1
    });
    assert.equal(secondPillarResponse.statusCode, 201);
    const secondPillar = secondPillarResponse.json<{ id: string }>();
    const secondObjectiveResponse = await request('POST', '/api/planejamento/objetivos', {
      cicloId: secondCycle.id, pilarId: secondPillar.id, titulo: 'Objetivo descartável', responsavel: 'Thalles',
      dataLimite: '2027-11-30', status: 'nao_iniciado', prioridade: 'media'
    });
    assert.equal(secondObjectiveResponse.statusCode, 201);
    const secondObjective = secondObjectiveResponse.json<{ id: string }>();

    const crossCycleRisk = await request('PATCH', `/api/planejamento/riscos/${risk.id}`, { objetivoId: secondObjective.id });
    assert.equal(crossCycleRisk.statusCode, 400);
    assert.match(crossCycleRisk.json<{ error: string }>().error, /não pertence ao ciclo/i);

    const linkRiskToInitiative = await request('PATCH', `/api/planejamento/riscos/${risk.id}`, {
      objetivoId: objective.id, iniciativaId: initiative.id
    });
    assert.equal(linkRiskToInitiative.statusCode, 200);
    assert.equal((await request('DELETE', `/api/planejamento/iniciativas/${initiative.id}`)).statusCode, 204);
    const [riskAfterInitiativeDelete] = await db.select().from(schema.riscosEstrategicos).where(eq(schema.riscosEstrategicos.id, risk.id));
    assert.equal(riskAfterInitiativeDelete?.iniciativaId, null);

    assert.equal((await request('DELETE', `/api/planejamento/checkins/${checkin.id}`)).statusCode, 204);
    const [snapshotAfterCheckinDelete] = await db.select().from(schema.snapshotsEstrategicos).where(eq(schema.snapshotsEstrategicos.checkinId, checkin.id));
    assert.ok(snapshotAfterCheckinDelete?.deletedAt);
    const [decisionAfterCheckinDelete] = await db.select().from(schema.decisoesEstrategicas).where(eq(schema.decisoesEstrategicas.id, decisionId));
    assert.equal(decisionAfterCheckinDelete?.checkinId, null);

    assert.equal((await request('DELETE', `/api/planejamento/ciclos/${secondCycle.id}`)).statusCode, 204);
    const [deletedSecondCycle] = await db.select().from(schema.ciclosEstrategicos).where(eq(schema.ciclosEstrategicos.id, secondCycle.id));
    const [deletedSecondPillar] = await db.select().from(schema.pilaresEstrategicos).where(eq(schema.pilaresEstrategicos.id, secondPillar.id));
    const [deletedSecondObjective] = await db.select().from(schema.objetivosEstrategicos).where(eq(schema.objetivosEstrategicos.id, secondObjective.id));
    assert.ok(deletedSecondCycle?.deletedAt);
    assert.ok(deletedSecondPillar?.deletedAt);
    assert.ok(deletedSecondObjective?.deletedAt);

    const volumeCycleResponse = await request('POST', '/api/planejamento/ciclos', {
      nome: 'Plano de volume', dataInicio: '2029-01-01', dataFim: '2029-12-31',
      visao: 'Validar cardinalidade alta sem perder ordenação.', status: 'rascunho'
    });
    const volumeCycle = volumeCycleResponse.json<{ id: string }>();
    const volumePillarResponse = await request('POST', '/api/planejamento/pilares', {
      cicloId: volumeCycle.id, nome: 'Pilar de volume', ordem: 1
    });
    const volumePillar = volumePillarResponse.json<{ id: string }>();
    const volumeObjectives = Array.from({ length: 80 }, (_, index) => ({
      id: crypto.randomUUID(), cicloId: volumeCycle.id, pilarId: volumePillar.id, titulo: `Objetivo ${index + 1}`,
      responsavel: `Responsável ${index % 8}`, dataLimite: '2029-12-01', status: 'em_andamento', prioridade: 'media', ordem: index
    }));
    const volumeResults = volumeObjectives.flatMap((item, objectiveIndex) => Array.from({ length: 4 }, (_, resultIndex) => ({
      id: crypto.randomUUID(), objetivoId: item.id, titulo: `Resultado ${objectiveIndex + 1}.${resultIndex + 1}`,
      linhaBase: 0, meta: 100, valorAtual: 50, unidade: '%', direcao: 'aumentar', fonteTipo: 'manual',
      frequencia: 'mensal', confianca: 'media', ultimaAtualizacao: fixtureUpdatedAt
    })));
    await db.transaction(async (tx) => {
      await tx.insert(schema.objetivosEstrategicos).values(volumeObjectives);
      await tx.insert(schema.resultadosChave).values(volumeResults);
    });
    const volumeStartedAt = performance.now();
    const volumeSnapshotResponse = await request('GET', `/api/planejamento/ciclos/${volumeCycle.id}`);
    const volumeElapsedMs = performance.now() - volumeStartedAt;
    assert.equal(volumeSnapshotResponse.statusCode, 200);
    const volumeSnapshot = volumeSnapshotResponse.json<StrategicPlanningSnapshot>();
    assert.equal(volumeSnapshot.objetivos.length, 80);
    assert.equal(volumeSnapshot.resultadosChave.length, 320);
    assert.ok(volumeElapsedMs < 3_000, `snapshot de volume levou ${volumeElapsedMs.toFixed(1)} ms`);
    assert.equal((await request('DELETE', `/api/planejamento/ciclos/${volumeCycle.id}`)).statusCode, 204);

    const rollbackCycleName = `Ciclo que deve reverter ${crypto.randomUUID()}`;
    AuditLogService.setFailureInjectorForTests((_action, entity) => {
      if (entity === 'Ciclo Estratégico') throw new Error('segredo interno da auditoria');
    });
    const failedAuditedCreate = await request('POST', '/api/planejamento/ciclos', {
      nome: rollbackCycleName, dataInicio: '2028-01-01', dataFim: '2028-12-31',
      visao: 'Não deve sobreviver ao rollback.', status: 'rascunho'
    });
    AuditLogService.setFailureInjectorForTests(null);
    assert.equal(failedAuditedCreate.statusCode, 500);
    assert.equal(failedAuditedCreate.json<{ error: string }>().error, 'Não foi possível concluir a operação estratégica. Tente novamente.');
    assert.doesNotMatch(failedAuditedCreate.body, /segredo interno/i);
    const rolledBackRows = await db.select().from(schema.ciclosEstrategicos).where(eq(schema.ciclosEstrategicos.nome, rollbackCycleName));
    assert.equal(rolledBackRows.length, 0);

    const blockedPillarDelete = await request('DELETE', `/api/planejamento/pilares/${pillar.id}`);
    assert.equal(blockedPillarDelete.statusCode, 400);
    assert.match(blockedPillarDelete.json<{ error: string }>().error, /1 objetivo ativo/i);
    assert.match(blockedPillarDelete.json<{ error: string }>().error, /Aumentar a previsibilidade do caixa/i);

    const auditRows = await db.select().from(schema.auditLogs);
    assert.ok(auditRows.some((row) => row.entity === 'Ciclo Estratégico' && row.action === 'INSERT'));
    assert.ok(auditRows.some((row) => row.entity === 'Resultado-chave' && row.action === 'INSERT'));
    assert.ok(auditRows.some((row) => row.entity === 'Decisão Estratégica' && row.action === 'UPDATE'));
  } finally {
    AuditLogService.setFailureInjectorForTests(null);
    await server.close();
    const client = (db as unknown as { $client: { close: () => void | Promise<void> } }).$client;
    await client.close();
    await fs.rm(testRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
