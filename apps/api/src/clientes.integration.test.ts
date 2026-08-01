import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { eq, sql } from 'drizzle-orm';

const testRoot = path.resolve(process.cwd(), 'scratch', `clientes-${process.pid}`);
const dbPath = path.join(testRoot, 'clientes.integration.test.db');
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

process.env.GEOGESTOR_DB_PATH = dbPath;
process.env.GEOGESTOR_API_TOKEN = 'test-token';

test('cria PF estruturada e edita cadastro legado sem perder categoria ou origem antigas', async () => {
  await fs.mkdir(testRoot, { recursive: true });
  await removeTestDatabase();

  const [{ server }, { db, dbReady }, { runRuntimeMigrations }, { schema }] = await Promise.all([
    import('./server'),
    import('./db'),
    import('./services/runtime-migrations.service'),
    import('@geogestor/database')
  ]);
  const request = (options: { method: 'GET' | 'POST' | 'PATCH'; url: string; payload?: Record<string, unknown> }) => server.inject({
    ...options,
    headers: options.payload ? authHeaders : { 'x-api-token': 'test-token' }
  });

  try {
    await dbReady;
    await runRuntimeMigrations();

    const create = await request({
      method: 'POST',
      url: '/api/clientes',
      payload: {
        nome: 'Maria de Souza',
        tipoPessoa: 'PF',
        cpf: '529.982.247-25',
        documento: '529.982.247-25',
        celular: '(48) 99999-9999',
        celularWhatsapp: true,
        cep: '88000-000',
        endereco: 'Rua das Araucárias',
        numero: '120',
        bairro: 'Centro',
        municipio: 'Florianópolis',
        uf: 'SC',
        origemPrincipal: 'Indicação',
        indicadoPor: 'João',
        categoria: 'Pessoa Física, Produtor Rural',
        perfis: 'Produtor Rural',
        servicos: 'Georreferenciamento'
      }
    });
    assert.equal(create.statusCode, 201, create.body);
    const created = create.json<{ id: string; tipoPessoa: string; situacao: string; celularWhatsapp: boolean; municipio: string }>();
    assert.equal(created.tipoPessoa, 'PF');
    assert.equal(created.situacao, 'Ativo');
    assert.equal(created.celularWhatsapp, true);
    assert.equal(created.municipio, 'Florianópolis');

    const linkedPropertyId = crypto.randomUUID();
    await db.insert(schema.propriedades).values([
      { id: linkedPropertyId, clienteId: created.id, nome: 'Sítio Araucária' },
      { id: crypto.randomUUID(), clienteId: created.id, nome: 'Fazenda Horizonte' },
      { id: crypto.randomUUID(), clienteId: created.id, nome: 'Imóvel removido', deletedAt: new Date().toISOString() }
    ]);
    await db.insert(schema.projetos).values([
      { id: crypto.randomUUID(), clienteId: created.id, nome: 'Projeto vinculado', propriedadeId: linkedPropertyId },
      { id: crypto.randomUUID(), clienteId: created.id, nome: 'Projeto legado sem imóvel estruturado' },
      { id: crypto.randomUUID(), clienteId: created.id, nome: 'Projeto legado removido', deletedAt: new Date().toISOString() }
    ]);

    const list = await request({ method: 'GET', url: '/api/clientes?limit=100' });
    assert.equal(list.statusCode, 200, list.body);
    const listedClient = list.json<Array<{ id: string; propriedadesCount: number }>>()
      .find((client) => client.id === created.id);
    assert.equal(listedClient?.propriedadesCount, 3);

    const createBusiness = await request({
      method: 'POST',
      url: '/api/clientes',
      payload: {
        nome: 'SkyGeo Serviços Geográficos Ltda.',
        tipoPessoa: 'PJ',
        cnpj: '11.222.333/0001-81',
        documento: '11.222.333/0001-81',
        telefone: '(48) 3333-4444',
        inscricaoEstadual: '123.456.789',
        origemPrincipal: 'Outro',
        origemDetalhe: 'Feira regional',
        categoria: 'Pessoa Jurídica, Parceiro',
        perfis: 'Parceiro'
      }
    });
    assert.equal(createBusiness.statusCode, 201, createBusiness.body);
    const createdBusiness = createBusiness.json<{ tipoPessoa: string; cnpj: string; inscricaoEstadual: string; situacao: string }>();
    assert.equal(createdBusiness.tipoPessoa, 'PJ');
    assert.equal(createdBusiness.cnpj, '11.222.333/0001-81');
    assert.equal(createdBusiness.inscricaoEstadual, '123.456.789');
    assert.equal(createdBusiness.situacao, 'Ativo');

    const legacyId = crypto.randomUUID();
    await db.insert(schema.clientes).values({
      id: legacyId,
      nome: 'Empresa Legada',
      documento: '45.723.174/0001-10',
      categoria: 'Empresa, Parceiro',
      origem: 'Evento, Telefone',
      celular: '(48) 99999-8888'
    });
    await db.update(schema.clientes).set({ tipoPessoa: null, origemPrincipal: null, origemDetalhe: null }).where(eq(schema.clientes.id, legacyId));
    await db.run(sql.raw("UPDATE schema_migrations SET status = 'failed' WHERE version = 7"));
    await runRuntimeMigrations();

    const migrated = await request({ method: 'GET', url: `/api/clientes/${legacyId}` });
    assert.equal(migrated.statusCode, 200, migrated.body);
    const legacyBeforeEdit = migrated.json<{ tipoPessoa: string; categoria: string; origem: string; origemPrincipal: string; origemDetalhe: string }>();
    assert.equal(legacyBeforeEdit.tipoPessoa, 'PJ');
    assert.equal(legacyBeforeEdit.categoria, 'Empresa, Parceiro');
    assert.equal(legacyBeforeEdit.origem, 'Evento, Telefone');
    assert.equal(legacyBeforeEdit.origemPrincipal, 'Outro');
    assert.equal(legacyBeforeEdit.origemDetalhe, 'Evento, Telefone');

    const update = await request({
      method: 'PATCH',
      url: `/api/clientes/${legacyId}`,
      payload: {
        tipoPessoa: 'PJ',
        nome: 'Empresa Legada Atualizada',
        cnpj: '45.723.174/0001-10',
        documento: '45.723.174/0001-10',
        celular: '(48) 99999-8888',
        origem: 'Evento, Telefone',
        origemPrincipal: 'Google',
        categoria: 'Pessoa Jurídica, Parceiro',
        perfis: 'Parceiro',
        semNumero: true
      }
    });
    assert.equal(update.statusCode, 200, update.body);
    const updated = update.json<{ origem: string; origemPrincipal: string; perfis: string; numero: string | null; semNumero: boolean }>();
    assert.equal(updated.origem, 'Evento, Telefone');
    assert.equal(updated.origemPrincipal, 'Google');
    assert.equal(updated.perfis, 'Parceiro');
    assert.equal(updated.numero, null);
    assert.equal(updated.semNumero, true);
  } finally {
    await server.close();
    await removeTestDatabase();
  }
});
