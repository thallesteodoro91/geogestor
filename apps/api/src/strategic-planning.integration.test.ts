import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import type { StrategicPlanningSnapshot } from '@geogestor/contracts';

const testRoot = path.resolve(process.cwd(), 'scratch', `strategic-planning-${process.pid}`);
const dbPath = path.join(testRoot, 'strategic-planning.test.db');
const dbFiles = [dbPath, `${dbPath}-shm`, `${dbPath}-wal`];

process.env.GEOGESTOR_DB_PATH = dbPath;
process.env.GEOGESTOR_API_TOKEN = 'test-token';

test('planejamento estratégico persiste metas explícitas e não inventa valor para fonte vazia', async () => {
  await fs.mkdir(testRoot, { recursive: true });
  await Promise.all(dbFiles.map((file) => fs.rm(file, { force: true })));

  const [{ server }, { db, dbReady }, { runRuntimeMigrations }, { schema }] = await Promise.all([
    import('./server'),
    import('./db'),
    import('./services/runtime-migrations.service'),
    import('@geogestor/database')
  ]);

  const request = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: Record<string, unknown>) => server.inject({
    method,
    url,
    headers: { 'x-api-token': 'test-token' },
    payload
  });

  try {
    await dbReady;
    const migration = await runRuntimeMigrations();
    assert.equal(migration.schemaVersion, 7);

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
      objetivoId: objective.id,
      iniciativaId: null,
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

    const blockedPillarDelete = await request('DELETE', `/api/planejamento/pilares/${pillar.id}`);
    assert.equal(blockedPillarDelete.statusCode, 400);
    assert.match(blockedPillarDelete.json<{ error: string }>().error, /1 objetivo ativo/i);
    assert.match(blockedPillarDelete.json<{ error: string }>().error, /Aumentar a previsibilidade do caixa/i);

    const auditRows = await db.select().from(schema.auditLogs);
    assert.ok(auditRows.some((row) => row.entity === 'Ciclo Estratégico' && row.action === 'INSERT'));
    assert.ok(auditRows.some((row) => row.entity === 'Resultado-chave' && row.action === 'INSERT'));
    assert.ok(auditRows.some((row) => row.entity === 'Decisão Estratégica' && row.action === 'UPDATE'));
  } finally {
    await server.close();
    const client = (db as unknown as { $client: { close: () => void } }).$client;
    client.close();
    await Promise.allSettled(dbFiles.map((file) => fs.rm(file, { force: true })));
  }
});
