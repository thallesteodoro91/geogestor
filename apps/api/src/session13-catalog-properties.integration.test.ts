import { injectWithRecordVersion } from './test-support/record-request';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(process.cwd(), 'scratch', `session13-catalog-properties-${process.pid}`);
const databasePath = path.join(root, 'session13.db');
const headers = { 'content-type': 'application/json', 'x-api-token': 'test-token' };

process.env.GEOGESTOR_DB_PATH = databasePath;
process.env.GEOGESTOR_API_TOKEN = 'test-token';
process.env.GEOGESTOR_DISABLE_SCHEDULER = '1';

test('Sessão 13 protege catálogos e o ciclo de vida das propriedades', async () => {
  await fs.rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
  await fs.mkdir(root, { recursive: true });
  const [{ server }, { db, dbReady, closeDb }, { runRuntimeMigrations }, { schema }] = await Promise.all([
    import('./server'), import('./db'), import('./services/runtime-migrations.service'), import('@geogestor/database')
  ]);
  const request = (
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: string,
    payload?: Record<string, unknown>,
  ) => injectWithRecordVersion(server, {
    method,
    url,
    ...(payload === undefined ? {} : { payload }),
    headers: payload === undefined ? { 'x-api-token': 'test-token' } : headers,
  });

  try {
    await dbReady;
    const migration = await runRuntimeMigrations();
    const clientA = crypto.randomUUID();
    const clientB = crypto.randomUUID();
    const inactiveClient = crypto.randomUUID();
    await db.insert(schema.clientes).values([
      { id: clientA, nome: 'QA-AUDIT-S13-Cliente A' },
      { id: clientB, nome: 'QA-AUDIT-S13-Cliente B' },
      { id: inactiveClient, nome: 'QA-AUDIT-S13-Cliente inativo', deletedAt: new Date().toISOString() }
    ]);

    const atomicCatalogUpdate = await request('PUT', '/api/dados-operacionais/configuracoes-operacionais', {
      values: {
        geogestor_tipos_servico: [
          { id: 'valid', nome: 'Serviço válido', categoria: 'Serviços', valorSugerido: 0, ativo: true }
        ],
        geogestor_tipos_despesa: [
          { id: 'invalid', categoria: 'Campo', descricao: 'Inválida', subcategorias: ['Taxa', ' taxa '], ativo: true }
        ]
      }
    });
    assert.equal(atomicCatalogUpdate.statusCode, 400, atomicCatalogUpdate.body);
    assert.equal((await db.select().from(schema.configuracoesOperacionais)).length, 0);

    const missingState = await request('POST', '/api/dados-operacionais/propriedades', {
      clienteId: clientA,
      nome: 'QA-AUDIT-S13-Sem UF',
      matricula: 'S13-UF-0',
      municipio: 'Florianópolis'
    });
    assert.equal(missingState.statusCode, 400, missingState.body);

    const create = await request('POST', '/api/dados-operacionais/propriedades', {
      clienteId: clientA,
      nome: 'QA-AUDIT-S13-Fazenda Açores',
      matricula: 'S13.123/ABC',
      areaHa: 0,
      municipio: 'Florianópolis',
      uf: 'sc',
      latitude: -90,
      longitude: -180
    });
    assert.equal(create.statusCode, 201, create.body);
    const propertyId = create.json<{ id: string; uf: string }>().id;
    assert.equal(create.json<{ uf: string }>().uf, 'SC');

    const partialUpdate = await request('PATCH', `/api/dados-operacionais/propriedades/${propertyId}`, {
      observacoes: 'Atualização parcial preserva os demais campos.'
    });
    assert.equal(partialUpdate.statusCode, 200, partialUpdate.body);
    assert.equal(partialUpdate.json<{ matricula: string }>().matricula, 'S13.123/ABC');
    assert.equal((await request('PATCH', `/api/dados-operacionais/propriedades/${propertyId}`, {})).statusCode, 400);
    assert.equal((await request('PATCH', `/api/dados-operacionais/propriedades/${propertyId}`, {
      matricula: null, car: null, ccir: null, itr: null
    })).statusCode, 400);
    assert.equal((await request('PATCH', `/api/dados-operacionais/propriedades/${propertyId}`, { longitude: null })).statusCode, 400);

    const invalidCoordinates = await request('POST', '/api/dados-operacionais/propriedades', {
      clienteId: clientA,
      nome: 'QA-AUDIT-S13-Coordenadas inválidas',
      car: 'S13-CAR-COORD',
      municipio: 'Florianópolis',
      uf: 'SC',
      latitude: 91,
      longitude: 0
    });
    assert.equal(invalidCoordinates.statusCode, 400, invalidCoordinates.body);
    const incompleteCoordinates = await request('POST', '/api/dados-operacionais/propriedades', {
      clienteId: clientA,
      nome: 'QA-AUDIT-S13-Coordenadas incompletas',
      car: 'S13-CAR-COORD-2',
      municipio: 'Florianópolis',
      uf: 'SC',
      latitude: -27.5
    });
    assert.equal(incompleteCoordinates.statusCode, 400, incompleteCoordinates.body);
    const inactiveClientCreate = await request('POST', '/api/dados-operacionais/propriedades', {
      clienteId: inactiveClient,
      nome: 'QA-AUDIT-S13-Cliente inativo',
      car: 'S13-CAR-INATIVO',
      municipio: 'Florianópolis',
      uf: 'SC'
    });
    assert.equal(inactiveClientCreate.statusCode, 400, inactiveClientCreate.body);

    const detail = await request('GET', `/api/dados-operacionais/propriedades/${propertyId}`);
    assert.equal(detail.statusCode, 200, detail.body);
    assert.equal(detail.json<{ id: string }>().id, propertyId);

    const accentSearch = await request('GET', '/api/dados-operacionais/propriedades?q=acores');
    assert.equal(accentSearch.statusCode, 200, accentSearch.body);
    assert.equal(accentSearch.json<{ total: number }>().total, 1);

    const duplicateIdentifier = await request('POST', '/api/dados-operacionais/propriedades', {
      clienteId: clientB,
      nome: 'QA-AUDIT-S13-Outro imóvel',
      matricula: ' s13 123 abc ',
      municipio: 'Palhoça',
      uf: 'SC'
    });
    assert.equal(duplicateIdentifier.statusCode, 409, duplicateIdentifier.body);

    for (const [field, identifier] of [
      ['car', 'S13-CAR-001'],
      ['ccir', 'S13-CCIR-001'],
      ['itr', 'S13-ITR-001']
    ] as const) {
      const source = await request('POST', '/api/dados-operacionais/propriedades', {
        clienteId: clientA,
        nome: `QA-AUDIT-S13-${field.toUpperCase()} origem`,
        [field]: identifier,
        municipio: 'Florianópolis',
        uf: 'SC'
      });
      assert.equal(source.statusCode, 201, source.body);
      const duplicate = await request('POST', '/api/dados-operacionais/propriedades', {
        clienteId: clientB,
        nome: `QA-AUDIT-S13-${field.toUpperCase()} duplicado`,
        [field]: ` ${identifier.toLowerCase().replaceAll('-', ' ')} `,
        municipio: 'São José',
        uf: 'SC'
      });
      assert.equal(duplicate.statusCode, 409, `${field}: ${duplicate.body}`);
    }

    const concurrentPayload = (registration: string) => ({
      clienteId: clientA,
      nome: 'QA-AUDIT-S13-Concorrente',
      matricula: registration,
      municipio: 'Florianópolis',
      uf: 'SC'
    });
    const concurrent = await Promise.all([
      request('POST', '/api/dados-operacionais/propriedades', concurrentPayload('S13-CONC-1')),
      request('POST', '/api/dados-operacionais/propriedades', concurrentPayload('S13-CONC-2'))
    ]);
    assert.deepEqual(concurrent.map((response) => response.statusCode).sort(), [201, 409]);
    assert.equal((await request('GET', '/api/dados-operacionais/propriedades?q=concorrente')).json<{ total: number }>().total, 1);

    const paginatedIds: string[] = [];
    const paginatedRows = Array.from({ length: 27 }, (_, index) => {
      const id = crypto.randomUUID();
      paginatedIds.push(id);
      const suffix = String(index + 1).padStart(2, '0');
      return {
        id,
        clienteId: clientB,
        nome: `QA-AUDIT-S13-Paginação ${suffix}`,
        nomeNormalizado: `qa-audit-s13-paginacao ${suffix}`,
        matricula: `S13-PAGE-${suffix}`,
        matriculaNormalizada: `S13PAGE${suffix}`,
        municipio: 'São José',
        uf: 'SC'
      };
    });
    await db.insert(schema.propriedades).values(paginatedRows);
    const pageOne = await request('GET', `/api/dados-operacionais/propriedades?clienteId=${clientB}&q=paginacao&page=1&limit=25`);
    const pageTwo = await request('GET', `/api/dados-operacionais/propriedades?clienteId=${clientB}&q=paginacao&page=2&limit=25`);
    assert.equal(pageOne.statusCode, 200, pageOne.body);
    assert.equal(pageOne.json<{ total: number; items: unknown[] }>().total, 27);
    assert.equal(pageOne.json<{ items: unknown[] }>().items.length, 25);
    assert.equal(pageTwo.json<{ items: unknown[] }>().items.length, 2);
    const orderedNames = [...pageOne.json<{ items: Array<{ nome: string }> }>().items, ...pageTwo.json<{ items: Array<{ nome: string }> }>().items]
      .map((item) => item.nome);
    assert.deepEqual(orderedNames, [...orderedNames].sort((left, right) => left.localeCompare(right)));

    const optionLimitOne = await request('GET', `/api/dados-operacionais/propriedades/options?clienteId=${clientB}&q=paginacao&limit=1`);
    assert.equal(optionLimitOne.statusCode, 200, optionLimitOne.body);
    assert.equal(optionLimitOne.json<unknown[]>().length, 1);
    const selectedOutsideSearch = await request('GET', `/api/dados-operacionais/propriedades/options?clienteId=${clientB}&q=nao-encontra&selectedId=${paginatedIds[26]}&limit=1`);
    assert.deepEqual(selectedOutsideSearch.json<Array<{ id: string }>>().map((item) => item.id), [paginatedIds[26]]);
    assert.equal((await request('GET', '/api/dados-operacionais/propriedades/options?limit=51')).statusCode, 400);

    const softDeletedOptionId = crypto.randomUUID();
    await db.insert(schema.propriedades).values({
      id: softDeletedOptionId,
      clienteId: clientB,
      nome: 'QA-AUDIT-S13-Opção excluída',
      nomeNormalizado: 'qa-audit-s13-opcao excluida',
      matricula: 'S13-OPTION-DELETED',
      matriculaNormalizada: 'S13OPTIONDELETED',
      municipio: 'São José',
      uf: 'SC',
      deletedAt: new Date().toISOString()
    });
    const deletedSelection = await request('GET', `/api/dados-operacionais/propriedades/options?selectedId=${softDeletedOptionId}`);
    assert.equal(deletedSelection.json<Array<{ id: string }>>().some((item) => item.id === softDeletedOptionId), false);

    const projectId = crypto.randomUUID();
    await db.insert(schema.projetos).values({
      id: projectId,
      clienteId: clientA,
      propriedadeId: propertyId,
      nome: 'QA-AUDIT-S13-Vínculo removido',
      deletedAt: new Date().toISOString()
    });
    const deleteWithOnlySoftDeletedLink = await request('DELETE', `/api/dados-operacionais/propriedades/${propertyId}`);
    assert.equal(deleteWithOnlySoftDeletedLink.statusCode, 204, deleteWithOnlySoftDeletedLink.body);
    assert.equal((await request('GET', `/api/dados-operacionais/propriedades/${propertyId}`)).statusCode, 404);
    assert.equal((await request('DELETE', `/api/dados-operacionais/propriedades/${propertyId}`)).statusCode, 404);

    const createLinkedProperty = async (suffix: string) => {
      const response = await request('POST', '/api/dados-operacionais/propriedades', {
        clienteId: clientA,
        nome: `QA-AUDIT-S13-Vínculo ${suffix}`,
        matricula: `S13-LINK-${suffix}`,
        municipio: 'Florianópolis',
        uf: 'SC'
      });
      assert.equal(response.statusCode, 201, response.body);
      return response.json<{ id: string }>().id;
    };

    const projectProperty = await createLinkedProperty('PROJETO');
    await db.insert(schema.projetos).values({ id: crypto.randomUUID(), clienteId: clientA, propriedadeId: projectProperty, nome: 'QA-AUDIT-S13-Projeto ativo' });
    const projectDelete = await request('DELETE', `/api/dados-operacionais/propriedades/${projectProperty}`);
    assert.equal(projectDelete.statusCode, 409, projectDelete.body);
    assert.match(projectDelete.body, /projeto/i);
    assert.equal((await request('PATCH', `/api/dados-operacionais/propriedades/${projectProperty}`, { clienteId: clientB })).statusCode, 409);
    assert.equal((await request('PATCH', `/api/dados-operacionais/propriedades/${projectProperty}`, { observacoes: 'Edição permitida sem transferência.' })).statusCode, 200);

    const budgetProperty = await createLinkedProperty('ORCAMENTO');
    await db.insert(schema.orcamentos).values({ id: crypto.randomUUID(), clienteId: clientA, propriedadeId: budgetProperty, valorTotal: 1000 });
    const budgetDelete = await request('DELETE', `/api/dados-operacionais/propriedades/${budgetProperty}`);
    assert.equal(budgetDelete.statusCode, 409, budgetDelete.body);
    assert.match(budgetDelete.body, /orçamento/i);
    assert.equal((await request('PATCH', `/api/dados-operacionais/propriedades/${budgetProperty}`, { clienteId: clientB })).statusCode, 409);

    const environmentalProperty = await createLinkedProperty('AMBIENTAL');
    const environmentalProject = crypto.randomUUID();
    await db.insert(schema.projetos).values({ id: environmentalProject, clienteId: clientA, nome: 'QA-AUDIT-S13-Projeto ambiental' });
    await db.insert(schema.ambiental).values({ id: crypto.randomUUID(), projetoId: environmentalProject, clienteId: clientA, propriedadeId: environmentalProperty });
    const environmentalDelete = await request('DELETE', `/api/dados-operacionais/propriedades/${environmentalProperty}`);
    assert.equal(environmentalDelete.statusCode, 409, environmentalDelete.body);
    assert.match(environmentalDelete.body, /ambiental/i);
    assert.equal((await request('PATCH', `/api/dados-operacionais/propriedades/${environmentalProperty}`, { clienteId: clientB })).statusCode, 409);

    const assessmentProperty = await createLinkedProperty('PERICIA');
    const assessmentProject = crypto.randomUUID();
    await db.insert(schema.projetos).values({ id: assessmentProject, clienteId: clientA, nome: 'QA-AUDIT-S13-Projeto perícia' });
    await db.insert(schema.pericias).values({ id: crypto.randomUUID(), projetoId: assessmentProject, clienteId: clientA, propriedadeId: assessmentProperty });
    const assessmentDelete = await request('DELETE', `/api/dados-operacionais/propriedades/${assessmentProperty}`);
    assert.equal(assessmentDelete.statusCode, 409, assessmentDelete.body);
    assert.match(assessmentDelete.body, /perícia/i);
    assert.equal((await request('PATCH', `/api/dados-operacionais/propriedades/${assessmentProperty}`, { clienteId: clientB })).statusCode, 409);

    const longQuery = await request('GET', `/api/dados-operacionais/propriedades?q=${'x'.repeat(201)}`);
    assert.equal(longQuery.statusCode, 400, longQuery.body);

    const invalidMigration = await request('PUT', '/api/dados-operacionais/configuracoes-operacionais/migrar', {
      values: { chave_desconhecida: ['não deve persistir'] }
    });
    assert.equal(invalidMigration.statusCode, 400, invalidMigration.body);

    const legacyMigration = await request('PUT', '/api/dados-operacionais/configuracoes-operacionais/migrar', {
      values: { geogestor_tipos_servico: ['Topografia', 'Ambiental'] }
    });
    assert.equal(legacyMigration.statusCode, 200, legacyMigration.body);
    assert.deepEqual(legacyMigration.json<{ migrated: string[] }>().migrated, ['geogestor_tipos_servico']);
    const repeatedMigration = await request('PUT', '/api/dados-operacionais/configuracoes-operacionais/migrar', {
      values: { geogestor_tipos_servico: ['Valor obsoleto'] }
    });
    assert.deepEqual(repeatedMigration.json<{ migrated: string[] }>().migrated, []);

    const settings = await request('GET', '/api/dados-operacionais/configuracoes-operacionais');
    const services = settings.json<Record<string, Array<{ nome: string; valorSugerido: number }>>>().geogestor_tipos_servico;
    assert.deepEqual(services.map((item) => item.nome), ['Topografia', 'Ambiental']);
    assert.ok(services.every((item) => item.valorSugerido === 0));

    const auditRows = await db.select().from(schema.auditLogs);
    assert.ok(auditRows.some((row) => row.entity === 'Propriedade' && row.action === 'INSERT' && row.newData?.includes(propertyId)));
    assert.ok(auditRows.some((row) => row.entity === 'Propriedade' && row.action === 'DELETE (SOFT)' && row.oldData?.includes(propertyId)));
    assert.equal(migration.schemaVersion, 19);
  } finally {
    await server.close();
    await closeDb();
    await fs.rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
  }
});
