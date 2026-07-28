import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { eq } from 'drizzle-orm';

const testRoot = path.resolve(process.cwd(), 'scratch', `oportunidades-${process.pid}`);
const dbPath = path.join(testRoot, 'oportunidades.integration.test.db');
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

test('funil mantém estágios, histórico, métricas, orçamento e projeto consistentes', async () => {
  await fs.mkdir(testRoot, { recursive: true });
  await removeTestDatabase();

  const [{ server }, { db, dbReady }, { runRuntimeMigrations }, { schema }] = await Promise.all([
    import('./server'),
    import('./db'),
    import('./services/runtime-migrations.service'),
    import('@geogestor/database')
  ]);
  const request = async (options: {
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    url: string;
    payload?: Record<string, unknown> | Array<Record<string, unknown>>;
  }) => server.inject({
    ...options,
    headers: options.payload ? authHeaders : { 'x-api-token': 'test-token' }
  });

  try {
    await dbReady;
    await runRuntimeMigrations();
    const clientId = crypto.randomUUID();
    await db.insert(schema.clientes).values({ id: clientId, nome: 'Cliente do Funil' });

    const create = await request({
      method: 'POST',
      url: '/api/oportunidades',
      payload: {
        clienteId: clientId,
        titulo: 'Georreferenciamento Fazenda Modelo',
        valorEstimado: 200_000,
        servicoTipo: 'Georreferenciamento rural',
        proximaAcao: 'Agendar reunião de escopo',
        proximaAcaoEm: '2099-01-15',
        probabilidadePontosBase: 2_000
      }
    });
    assert.equal(create.statusCode, 201, create.body);
    const opportunity = create.json<{ id: string; estagio: string; history?: unknown[] }>();
    assert.equal(opportunity.estagio, 'Prospectado');

    const detail = await request({ method: 'GET', url: `/api/oportunidades/${opportunity.id}` });
    assert.equal(detail.statusCode, 200, detail.body);
    assert.equal(detail.json<{ history: unknown[] }>().history.length, 1);

    const analyticsBefore = await request({ method: 'GET', url: '/api/oportunidades/analytics' });
    const firstMetrics = analyticsBefore.json<{ openPipelineCents: number; weightedPipelineCents: number; activeCount: number }>();
    assert.equal(firstMetrics.openPipelineCents, 200_000);
    assert.equal(firstMetrics.weightedPipelineCents, 40_000);
    assert.equal(firstMetrics.activeCount, 1);

    const contact = await request({ method: 'PATCH', url: `/api/oportunidades/${opportunity.id}/transition`, payload: { estagio: 'Contato' } });
    assert.equal(contact.statusCode, 200, contact.body);
    assert.equal(contact.json<{ estagio: string }>().estagio, 'Contato');

    const invalidReorder = await request({ method: 'PATCH', url: '/api/oportunidades/reorder', payload: [{ id: opportunity.id, estagio: 'Proposta', ordem: 0 }] });
    assert.equal(invalidReorder.statusCode, 400, invalidReorder.body);

    const lossWithoutReason = await request({ method: 'PATCH', url: `/api/oportunidades/${opportunity.id}/transition`, payload: { estagio: 'Perdido' } });
    assert.equal(lossWithoutReason.statusCode, 400, lossWithoutReason.body);

    const budgetId = crypto.randomUUID();
    await db.insert(schema.orcamentos).values({
      id: budgetId,
      grupoId: budgetId,
      clienteId: clientId,
      valorTotal: 250_000,
      status: 'enviado',
      descricao: 'Orçamento do funil'
    });
    const link = await request({ method: 'POST', url: `/api/oportunidades/${opportunity.id}/link-budget`, payload: { orcamentoId: budgetId } });
    assert.equal(link.statusCode, 200, link.body);
    const linked = link.json<{ estagio: string; valorEstimado: number; orcamentoId: string }>();
    assert.equal(linked.estagio, 'Proposta');
    assert.equal(linked.valorEstimado, 250_000);
    assert.equal(linked.orcamentoId, budgetId);

    const gainBeforeApproval = await request({ method: 'PATCH', url: `/api/oportunidades/${opportunity.id}/transition`, payload: { estagio: 'Ganho' } });
    assert.equal(gainBeforeApproval.statusCode, 400, gainBeforeApproval.body);

    const projectId = crypto.randomUUID();
    await db.insert(schema.projetos).values({ id: projectId, clienteId: clientId, nome: 'Projeto aprovado' });
    await db.update(schema.orcamentos).set({ status: 'aprovado', projetoId: projectId }).where(eq(schema.orcamentos.id, budgetId));
    const gain = await request({ method: 'PATCH', url: `/api/oportunidades/${opportunity.id}/transition`, payload: { estagio: 'Ganho' } });
    assert.equal(gain.statusCode, 200, gain.body);
    assert.equal(gain.json<{ estagio: string; projetoId: string }>().projetoId, projectId);

    const conversion = await request({ method: 'POST', url: `/api/oportunidades/${opportunity.id}/convert-project`, payload: {} });
    assert.equal(conversion.statusCode, 200, conversion.body);
    assert.equal(conversion.json<{ projectId: string; idempotent: boolean }>().idempotent, true);

    const analyticsAfter = await request({ method: 'GET', url: '/api/oportunidades/analytics' });
    const finalMetrics = analyticsAfter.json<{ openPipelineCents: number; wonValueCents: number; conversionBasisPoints: number }>();
    assert.equal(finalMetrics.openPipelineCents, 0);
    assert.equal(finalMetrics.wonValueCents, 250_000);
    assert.equal(finalMetrics.conversionBasisPoints, 10_000);

    const leadCreate = await request({
      method: 'POST',
      url: '/api/contatos',
      payload: { nome: 'Lead do Funil', email: 'lead.funil@example.com', telefone: '(48) 99999-1234', origem: 'Site' }
    });
    assert.equal(leadCreate.statusCode, 200, leadCreate.body);
    const lead = leadCreate.json<{ id: string }>();

    const leadOpportunityCreate = await request({
      method: 'POST',
      url: '/api/oportunidades',
      payload: { leadId: lead.id, titulo: 'Aerolevantamento do lead', valorEstimado: 80_000 }
    });
    assert.equal(leadOpportunityCreate.statusCode, 201, leadOpportunityCreate.body);
    const leadOpportunity = leadOpportunityCreate.json<{ id: string; clienteId: string | null; leadId: string; vinculoTipo: string }>();
    assert.equal(leadOpportunity.clienteId, null);
    assert.equal(leadOpportunity.leadId, lead.id);
    assert.equal(leadOpportunity.vinculoTipo, 'lead');

    const blockedLeadDeletion = await request({ method: 'DELETE', url: `/api/contatos/${lead.id}` });
    assert.equal(blockedLeadDeletion.statusCode, 409, blockedLeadDeletion.body);
    assert.match(blockedLeadDeletion.json<{ error: string }>().error, /oportunidades comerciais ativas/i);

    const convertLead = await request({ method: 'POST', url: `/api/contatos/${lead.id}/converter`, payload: {} });
    assert.equal(convertLead.statusCode, 200, convertLead.body);
    const conversionResult = convertLead.json<{ clientId: string; opportunityId: string; clientCreated: boolean; idempotent: boolean; matchCriterion: string }>();
    assert.equal(conversionResult.opportunityId, leadOpportunity.id);
    assert.equal(conversionResult.clientCreated, true);
    assert.equal(conversionResult.idempotent, false);
    assert.equal(conversionResult.matchCriterion, 'novo_cliente');

    const convertedLeadRow = await db.select().from(schema.contatos).where(eq(schema.contatos.id, lead.id)).get();
    assert.equal(convertedLeadRow?.status, 'convertido');
    assert.equal(convertedLeadRow?.clienteConvertidoId, conversionResult.clientId);
    assert.ok(convertedLeadRow?.convertidoEm);

    const convertedOpportunity = await request({ method: 'GET', url: `/api/oportunidades/${leadOpportunity.id}` });
    const convertedData = convertedOpportunity.json<{ clienteId: string; leadId: string; vinculoTipo: string }>();
    assert.equal(convertedData.clienteId, conversionResult.clientId);
    assert.equal(convertedData.leadId, lead.id);
    assert.equal(convertedData.vinculoTipo, 'cliente');

    const convertLeadAgain = await request({ method: 'POST', url: `/api/contatos/${lead.id}/converter`, payload: {} });
    assert.equal(convertLeadAgain.statusCode, 200, convertLeadAgain.body);
    const repeatedConversion = convertLeadAgain.json<{ clientId: string; opportunityId: string; clientCreated: boolean; idempotent: boolean; matchCriterion: string }>();
    assert.equal(repeatedConversion.clientId, conversionResult.clientId);
    assert.equal(repeatedConversion.opportunityId, leadOpportunity.id);
    assert.equal(repeatedConversion.clientCreated, false);
    assert.equal(repeatedConversion.idempotent, true);
    assert.equal(repeatedConversion.matchCriterion, 'vinculo_persistido');

    const emailMatchedLeadResponse = await request({
      method: 'POST',
      url: '/api/contatos',
      payload: { nome: 'Lead com e-mail repetido', email: '  LEAD.FUNIL@EXAMPLE.COM  ', telefone: '(48) 98888-0000' }
    });
    const emailMatchedLead = emailMatchedLeadResponse.json<{ id: string }>();
    const emailConversionResponse = await request({ method: 'POST', url: `/api/contatos/${emailMatchedLead.id}/converter`, payload: {} });
    assert.equal(emailConversionResponse.statusCode, 200, emailConversionResponse.body);
    const emailConversion = emailConversionResponse.json<{ clientId: string; opportunityId: string; clientCreated: boolean; matchCriterion: string }>();
    assert.equal(emailConversion.clientId, conversionResult.clientId);
    assert.equal(emailConversion.clientCreated, false);
    assert.equal(emailConversion.matchCriterion, 'email_normalizado');

    const phoneMatchedLeadResponse = await request({
      method: 'POST',
      url: '/api/contatos',
      payload: { nome: 'Lead com telefone repetido', telefone: '+55 (48) 99999-1234' }
    });
    const phoneMatchedLead = phoneMatchedLeadResponse.json<{ id: string }>();
    const phoneConversionResponse = await request({ method: 'POST', url: `/api/contatos/${phoneMatchedLead.id}/converter`, payload: {} });
    assert.equal(phoneConversionResponse.statusCode, 200, phoneConversionResponse.body);
    const phoneConversion = phoneConversionResponse.json<{ clientId: string; opportunityId: string; clientCreated: boolean; matchCriterion: string }>();
    assert.equal(phoneConversion.clientId, conversionResult.clientId);
    assert.equal(phoneConversion.clientCreated, false);
    assert.equal(phoneConversion.matchCriterion, 'telefone_normalizado');

    const clientsAfterDeduplication = await db.select({ id: schema.clientes.id }).from(schema.clientes);
    assert.equal(clientsAfterDeduplication.length, 2);

    const leadAnalytics = await request({ method: 'GET', url: '/api/contatos/analytics' });
    assert.deepEqual(leadAnalytics.json(), {
      total: 3,
      activeCount: 0,
      convertedCount: 3,
      conversionBasisPoints: 10_000
    });

    const paginatedLeads = await request({ method: 'GET', url: '/api/contatos?page=1&pageSize=2&status=convertido&q=Lead' });
    const paginatedData = paginatedLeads.json<{ items: Array<{ id: string }>; pagination: { page: number; pageSize: number; total: number; totalPages: number } }>();
    assert.equal(paginatedData.items.length, 2);
    assert.deepEqual(paginatedData.pagination, { page: 1, pageSize: 2, total: 3, totalPages: 2 });

    const legacyLeadList = await request({ method: 'GET', url: '/api/contatos' });
    assert.equal(Array.isArray(legacyLeadList.json()), true);

    const conversionAudits = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.entity, 'LeadConversion'));
    assert.equal(conversionAudits.length, 4);
    const lastAuditData = JSON.parse(conversionAudits.at(-1)?.newData || '{}') as Record<string, unknown>;
    assert.equal(lastAuditData.leadId, phoneMatchedLead.id);
    assert.equal(lastAuditData.clientId, conversionResult.clientId);
    assert.equal(lastAuditData.matchCriterion, 'telefone_normalizado');
    assert.equal('email' in lastAuditData, false);
    assert.equal('telefone' in lastAuditData, false);

    const optionsAfterConversion = await request({ method: 'GET', url: '/api/oportunidades/options' });
    assert.equal(optionsAfterConversion.json<{ leads: Array<{ id: string }> }>().leads.some((item) => item.id === lead.id), false);

    const removeLeadOpportunity = await request({ method: 'DELETE', url: `/api/oportunidades/${leadOpportunity.id}` });
    assert.equal(removeLeadOpportunity.statusCode, 204, removeLeadOpportunity.body);

    const conversionAfterOpportunityDeletion = await request({ method: 'POST', url: `/api/contatos/${lead.id}/converter`, payload: {} });
    assert.equal(conversionAfterOpportunityDeletion.statusCode, 200, conversionAfterOpportunityDeletion.body);
    const idempotentAfterDeletion = conversionAfterOpportunityDeletion.json<{ opportunityId: string; opportunityCreated: boolean; idempotent: boolean }>();
    assert.equal(idempotentAfterDeletion.opportunityId, leadOpportunity.id);
    assert.equal(idempotentAfterDeletion.opportunityCreated, false);
    assert.equal(idempotentAfterDeletion.idempotent, true);
    const leadOpportunityHistory = await db.select().from(schema.oportunidades).where(eq(schema.oportunidades.leadId, lead.id));
    assert.equal(leadOpportunityHistory.length, 1);
    assert.ok(leadOpportunityHistory[0].deletedAt);

    const removeEmailOpportunity = await request({ method: 'DELETE', url: `/api/oportunidades/${emailConversion.opportunityId}` });
    assert.equal(removeEmailOpportunity.statusCode, 204, removeEmailOpportunity.body);
    const removePhoneOpportunity = await request({ method: 'DELETE', url: `/api/oportunidades/${phoneConversion.opportunityId}` });
    assert.equal(removePhoneOpportunity.statusCode, 204, removePhoneOpportunity.body);

    const removeLeadAfterOpportunity = await request({ method: 'DELETE', url: `/api/contatos/${lead.id}` });
    assert.equal(removeLeadAfterOpportunity.statusCode, 200, removeLeadAfterOpportunity.body);

    const remove = await request({ method: 'DELETE', url: `/api/oportunidades/${opportunity.id}` });
    assert.equal(remove.statusCode, 204, remove.body);
    const list = await request({ method: 'GET', url: '/api/oportunidades' });
    assert.equal(list.json<unknown[]>().length, 0);
  } finally {
    await server.close();
    await removeTestDatabase();
  }
});
