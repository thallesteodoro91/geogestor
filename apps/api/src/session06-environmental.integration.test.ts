import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { and, eq, isNull } from 'drizzle-orm';

const prefix = 'QA-AUDIT-S06-20260911-';
const testRoot = path.resolve(process.cwd(), 'scratch', `session06-environmental-${process.pid}`);
const dbPath = path.join(testRoot, `session06.${process.pid}.db`);
const dbFiles = [dbPath, `${dbPath}-shm`, `${dbPath}-wal`];
const authHeaders = { 'content-type': 'application/json', 'x-api-token': 'test-token' };

async function removeTestDatabase() {
  for (const file of dbFiles) {
    try {
      await fs.rm(file, { force: true, maxRetries: 5, retryDelay: 100 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EBUSY') throw error;
    }
  }
}

const localDateKey = (offset = 0) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
};

process.env.GEOGESTOR_DB_PATH = dbPath;
process.env.GEOGESTOR_API_TOKEN = 'test-token';
process.env.GEOGESTOR_DISABLE_SCHEDULER = '1';

test('Sessão 06 protege contratos, prazos, vínculos, cascatas e alertas ambientais', async () => {
  await fs.mkdir(testRoot, { recursive: true });
  await removeTestDatabase();
  await fs.mkdir(testRoot, { recursive: true });

  const [{ server }, { db, dbReady }, { runRuntimeMigrations }, { schema }, alerts] = await Promise.all([
    import('./server'),
    import('./db'),
    import('./services/runtime-migrations.service'),
    import('@geogestor/database'),
    import('./services/deadline-alerts.service')
  ]);

  const request = (options: {
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    url: string;
    payload?: Record<string, unknown>;
  }) => server.inject({
    ...options,
    headers: options.payload ? authHeaders : { 'x-api-token': 'test-token' }
  });

  const ids = {
    client: crypto.randomUUID(), otherClient: crypto.randomUUID(), inactiveClient: crypto.randomUUID(),
    property: crypto.randomUUID(), otherProperty: crypto.randomUUID(),
    demand: crypto.randomUUID(), assessment: crypto.randomUUID(), otherProject: crypto.randomUUID()
  };

  try {
    await dbReady;
    await runRuntimeMigrations();
    const now = new Date().toISOString();
    await db.insert(schema.clientes).values([
      { id: ids.client, nome: `${prefix}Cliente Principal`, situacao: 'Ativo' },
      { id: ids.otherClient, nome: `${prefix}Cliente Secundário`, situacao: 'Ativo' },
      { id: ids.inactiveClient, nome: `${prefix}Cliente Inativo`, situacao: 'Inativo' }
    ]);
    await db.insert(schema.propriedades).values([
      { id: ids.property, clienteId: ids.client, nome: `${prefix}Imóvel Principal`, areaHa: 100 },
      { id: ids.otherProperty, clienteId: ids.otherClient, nome: `${prefix}Imóvel Cruzado`, areaHa: 50 }
    ]);
    await db.insert(schema.projetos).values([
      { id: ids.demand, clienteId: ids.client, propriedadeId: ids.property, nome: `${prefix}Demanda Açores`, tipo: 'Ambiental', status: 'Em Andamento', dataInicio: localDateKey(-20), dataEntrega: localDateKey(30), updatedAt: now },
      { id: ids.assessment, clienteId: ids.client, propriedadeId: ids.property, nome: `${prefix}Perícia Judicial`, tipo: 'Perícia', status: 'Suspenso', dataEntrega: localDateKey(60), updatedAt: now },
      { id: ids.otherProject, clienteId: ids.otherClient, propriedadeId: ids.otherProperty, nome: `${prefix}Projeto Incompatível`, tipo: 'Rural', status: 'Em Andamento', updatedAt: now }
    ]);
    await db.insert(schema.ambiental).values({
      id: crypto.randomUUID(), projetoId: ids.demand, clienteId: ids.client, propriedadeId: ids.property,
      orgaoAmbiental: 'Órgão QA', tipoDemanda: 'Licenciamento ambiental', protocolo: `${prefix}PROTOCOLO`, statusFase: 'Documentação'
    });
    await db.insert(schema.pericias).values({
      id: crypto.randomUUID(), projetoId: ids.assessment, clienteId: ids.client, propriedadeId: ids.property,
      tipoPericia: 'Judicial', numeroProcesso: `${prefix}PROCESSO`, status: 'Em andamento'
    });
    await db.insert(schema.tarefas).values([
      { id: crypto.randomUUID(), projetoId: ids.demand, clienteId: ids.client, titulo: `${prefix}Sem prazo`, status: 'A Fazer', prioridade: 'Média' },
      { id: crypto.randomUUID(), projetoId: ids.demand, clienteId: ids.client, titulo: `${prefix}Atrasada`, status: 'A Fazer', prioridade: 'Alta', dataLimite: localDateKey(-1) },
      { id: crypto.randomUUID(), projetoId: ids.demand, clienteId: ids.client, titulo: `${prefix}Concluída`, status: 'Concluído', prioridade: 'Baixa', dataLimite: localDateKey(-10) }
    ]);

    const demandList = await request({ method: 'GET', url: `/api/ambiental?q=${encodeURIComponent(prefix)}` });
    assert.equal(demandList.statusCode, 200, demandList.body);
    const demand = demandList.json<{ items: Array<{ id: string; proximaAcao: string | null }>; total: number }>();
    assert.equal(demand.total, 2);
    assert.equal(demand.items.find((item) => item.id === ids.demand)?.proximaAcao, `${prefix}Atrasada`, 'tarefas sem prazo não podem ocultar a próxima ação com prazo');

    for (const url of [
      '/api/ambiental?page=0',
      '/api/ambiental?page=1.5',
      '/api/ambiental?limit=101',
      '/api/ambiental?inicio=2026-02-30',
      '/api/ambiental?inicio=2026-10-02&fim=2026-10-01'
    ]) {
      const invalid = await request({ method: 'GET', url });
      assert.equal(invalid.statusCode, 400, `${url}: ${invalid.body}`);
    }

    const badPhase = await request({ method: 'PATCH', url: `/api/ambiental/${ids.demand}/fase`, payload: { statusFase: 'Fase inventada', extra: true } });
    assert.equal(badPhase.statusCode, 400, badPhase.body);
    const assessmentPhase = await request({ method: 'PATCH', url: `/api/ambiental/${ids.assessment}/fase`, payload: { statusFase: 'Protocolo' } });
    assert.equal(assessmentPhase.statusCode, 404, assessmentPhase.body);
    const validPhase = await request({ method: 'PATCH', url: `/api/ambiental/${ids.demand}/fase`, payload: { statusFase: 'Protocolo', status: 'Aguardando Órgão' } });
    assert.equal(validPhase.statusCode, 200, validPhase.body);

    for (const payload of [
      { titulo: 'Data impossível', descricao: 'Teste', data: '2026-02-30', categoria: 'Protocolo' },
      { titulo: 'Categoria vazia', descricao: 'Teste', data: localDateKey(), categoria: '   ' },
      { titulo: 'Campo extra', descricao: 'Teste', data: localDateKey(), categoria: 'Protocolo', extra: true }
    ]) {
      const invalid = await request({ method: 'POST', url: `/api/ambiental/${ids.demand}/andamentos`, payload });
      assert.equal(invalid.statusCode, 400, invalid.body);
    }

    const baseLicense = {
      projetoId: ids.demand, clienteId: ids.client, numero: `${prefix}LO-001`, protocolo: `${prefix}P-001`,
      orgao: 'Órgão QA', tipoLicenca: 'LO', dataEmissao: localDateKey(-365), dataVencimento: localDateKey(30),
      status: 'Válida', observacoes: 'Licença sintética.'
    };
    for (const payload of [
      { ...baseLicense, numero: `${prefix}EXTRA`, extra: true },
      { ...baseLicense, numero: `${prefix}DATA`, dataEmissao: '2026-02-30' },
      { ...baseLicense, numero: `${prefix}CRUZADA`, clienteId: ids.otherClient }
    ]) {
      const invalid = await request({ method: 'POST', url: '/api/licencas', payload });
      assert.ok([400, 409].includes(invalid.statusCode), invalid.body);
    }

    const createdResponse = await request({ method: 'POST', url: '/api/licencas', payload: baseLicense });
    assert.equal(createdResponse.statusCode, 201, createdResponse.body);
    const created = createdResponse.json<{ id: string }>();

    const reassignment = await request({ method: 'PATCH', url: `/api/licencas/${created.id}`, payload: { projetoId: ids.otherProject, clienteId: ids.otherClient } });
    assert.equal(reassignment.statusCode, 409, reassignment.body);
    const partial = await request({ method: 'PATCH', url: `/api/licencas/${created.id}`, payload: { observacoes: 'PATCH preserva campos omitidos.' } });
    assert.equal(partial.statusCode, 200, partial.body);

    for (const payload of [
      { titulo: 'Data impossível', dataLimite: '2026-02-30', status: 'Pendente' },
      { titulo: 'Cumprida sem data', status: 'Cumprida' },
      { titulo: 'Campo extra', status: 'Pendente', extra: true }
    ]) {
      const invalid = await request({ method: 'POST', url: `/api/licencas/${created.id}/condicionantes`, payload });
      assert.equal(invalid.statusCode, 400, invalid.body);
    }

    const conditionResponse = await request({
      method: 'POST', url: `/api/licencas/${created.id}/condicionantes`,
      payload: { titulo: `${prefix}Condicionante`, dataLimite: localDateKey(-1), status: 'Pendente' }
    });
    assert.equal(conditionResponse.statusCode, 201, conditionResponse.body);
    const condition = conditionResponse.json<{ id: string; status: string }>();
    assert.equal(condition.status, 'Vencida');

    const missingConditions = await request({ method: 'GET', url: `/api/licencas/${crypto.randomUUID()}/condicionantes` });
    assert.equal(missingConditions.statusCode, 404, missingConditions.body);

    const beforeDeleteAlerts = await alerts.listDeadlineAlerts(localDateKey());
    assert.ok(beforeDeleteAlerts.items.some((item) => item.sourceId === condition.id && item.category === 'condition'));
    const deleted = await request({ method: 'DELETE', url: `/api/licencas/${created.id}` });
    assert.equal(deleted.statusCode, 204, deleted.body);
    const activeChildren = await db.select().from(schema.condicionantesAmbientais).where(and(
      eq(schema.condicionantesAmbientais.licencaId, created.id), isNull(schema.condicionantesAmbientais.deletedAt)
    ));
    assert.equal(activeChildren.length, 0, 'a exclusão lógica da licença deve retirar suas condicionantes ativas');
    const afterDeleteAlerts = await alerts.listDeadlineAlerts(localDateKey());
    assert.equal(afterDeleteAlerts.items.some((item) => item.sourceId === condition.id), false);

    await db.insert(schema.calculosSalvos).values({
      id: crypto.randomUUID(), tipo: 'ambiental', nome: `${prefix}Legado inválido`, dataCalculo: localDateKey(),
      entradasJson: '{json-invalido', resultadoJson: '{json-invalido'
    });
    const legacyHistory = await request({ method: 'GET', url: '/api/dados-operacionais/calculos?tipo=ambiental' });
    assert.equal(legacyHistory.statusCode, 200, legacyHistory.body);
    assert.equal(legacyHistory.json<Array<{ dadosInvalidos?: boolean }>>()[0].dadosInvalidos, true);

    for (const payload of [
      { tipo: 'ambiental', nome: `${prefix}Data inválida`, dataCalculo: '2026-02-30', entradas: {}, resultado: {}, extra: true },
      { tipo: 'ambiental', nome: `${prefix}Projeto incompatível`, projetoId: ids.otherProject, clienteId: ids.otherClient, dataCalculo: localDateKey(), entradas: {}, resultado: {} }
    ]) {
      const invalid = await request({ method: 'POST', url: '/api/dados-operacionais/calculos', payload });
      assert.ok([400, 409].includes(invalid.statusCode), invalid.body);
    }
  } finally {
    await server.close();
    await removeTestDatabase();
  }
});
