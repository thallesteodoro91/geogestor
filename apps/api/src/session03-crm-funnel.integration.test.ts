import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { and, eq, isNull } from 'drizzle-orm';

const testRoot = path.resolve(process.cwd(), 'scratch', `session03-crm-${process.pid}`);
const dbPath = path.join(testRoot, 'session03-crm.integration.test.db');
const dbFiles = [dbPath, `${dbPath}-shm`, `${dbPath}-wal`];
const headers = { 'content-type': 'application/json', 'x-api-token': 'test-token' };

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

test('Sessão 03 mantém contratos, auditoria, métricas e integridade do CRM', async () => {
  await fs.mkdir(testRoot, { recursive: true });
  await removeTestDatabase();

  const [{ server }, { db, dbReady }, { runRuntimeMigrations }, { schema }] = await Promise.all([
    import('./server'),
    import('./db'),
    import('./services/runtime-migrations.service'),
    import('@geogestor/database'),
  ]);
  const request = async (options: { method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; url: string; payload?: unknown }): Promise<any> => server.inject({
    ...options,
    payload: options.payload as any,
    headers: options.payload === undefined ? { 'x-api-token': 'test-token' } : headers,
  });

  try {
    await dbReady;
    await runRuntimeMigrations();

    for (const payload of [
      { nome: '   ' },
      { nome: 'Lead inválido', email: 'email-invalido' },
      { nome: 'Lead inválido', telefone: '123' },
      { nome: 'Lead inválido', campoInesperado: true },
    ]) {
      const response = await request({ method: 'POST', url: '/api/contatos', payload });
      assert.equal(response.statusCode, 400, `${JSON.stringify(payload)} => ${response.statusCode} ${response.body}`);
    }

    const createLead = await request({
      method: 'POST',
      url: '/api/contatos',
      payload: {
        nome: '  QA-AUDIT-S03-Lead Árvore  ',
        email: '  S03.LEAD@EXAMPLE.INVALID ',
        telefone: '+55 (48) 99999-1234',
        empresa: '  Empresa Açores  ',
        cidade: '  Florianópolis  ',
        origem: '  Evento técnico  ',
        observacoes: '  Interesse em georreferenciamento.  ',
        dataCadastro: '2026-09-08',
      },
    });
    assert.equal(createLead.statusCode, 201, createLead.body);
    const lead = createLead.json() as { id: string; nome: string; email: string; telefone: string; empresa: string; createdAt: string };
    assert.equal(lead.nome, 'QA-AUDIT-S03-Lead Árvore');
    assert.equal(lead.email, 's03.lead@example.invalid');
    assert.equal(lead.telefone, '48999991234');
    assert.equal(lead.empresa, 'Empresa Açores');
    assert.equal(lead.createdAt.slice(0, 10), '2026-09-08');

    for (const payload of [
      { nome: 'Duplicado por e-mail', email: 'S03.LEAD@example.invalid' },
      { nome: 'Duplicado por telefone', telefone: '(48) 99999-1234' },
    ]) {
      const duplicate = await request({ method: 'POST', url: '/api/contatos', payload });
      assert.equal(duplicate.statusCode, 409, duplicate.body);
    }

    const invalidDate = await request({ method: 'PUT', url: `/api/contatos/${lead.id}`, payload: { dataCadastro: '2026-02-31' } });
    assert.equal(invalidDate.statusCode, 400, invalidDate.body);
    const invalidStatus = await request({ method: 'PUT', url: `/api/contatos/${lead.id}`, payload: { status: 'apagado' } });
    assert.equal(invalidStatus.statusCode, 400, invalidStatus.body);
    const missingUpdate = await request({ method: 'PUT', url: `/api/contatos/${crypto.randomUUID()}`, payload: { nome: 'Fantasma' } });
    assert.equal(missingUpdate.statusCode, 404, missingUpdate.body);

    const updateLead = await request({
      method: 'PUT',
      url: `/api/contatos/${lead.id}`,
      payload: { nome: '  QA-AUDIT-S03-Lead Atualizado  ', observacoes: '<img src=x onerror=alert(1)>' },
    });
    assert.equal(updateLead.statusCode, 200, updateLead.body);
    assert.equal((updateLead.json() as { nome: string }).nome, 'QA-AUDIT-S03-Lead Atualizado');

    const clientId = crypto.randomUUID();
    const otherClientId = crypto.randomUUID();
    await db.insert(schema.clientes).values([
      { id: clientId, nome: 'QA-AUDIT-S03-Cliente', email: 'cliente.s03@example.invalid', situacao: 'Ativo' },
      { id: otherClientId, nome: 'QA-AUDIT-S03-Outro Cliente', situacao: 'Ativo' },
    ]);
    const budgetId = crypto.randomUUID();
    const incompatibleBudgetId = crypto.randomUUID();
    await db.insert(schema.orcamentos).values([
      { id: budgetId, grupoId: budgetId, clienteId: clientId, valorTotal: 700_000, status: 'enviado', codigoOrcamento: 'QA-S03-001' },
      { id: incompatibleBudgetId, grupoId: incompatibleBudgetId, clienteId: otherClientId, valorTotal: 900_000, status: 'enviado', codigoOrcamento: 'QA-S03-OUTRO' },
    ]);

    const impossibleOpportunityDate = await request({
      method: 'POST',
      url: '/api/oportunidades',
      payload: { clienteId: clientId, titulo: 'Data impossível', previsaoFechamento: '2026-02-31' },
    });
    assert.equal(impossibleOpportunityDate.statusCode, 400, impossibleOpportunityDate.body);
    const incompleteNextAction = await request({
      method: 'POST',
      url: '/api/oportunidades',
      payload: { clienteId: clientId, titulo: 'Ação incompleta', proximaAcao: 'Telefonar' },
    });
    assert.equal(incompleteNextAction.statusCode, 400, incompleteNextAction.body);
    const extraOpportunityField = await request({
      method: 'POST',
      url: '/api/oportunidades',
      payload: { clienteId: clientId, titulo: 'Campo extra', admin: true },
    });
    assert.equal(extraOpportunityField.statusCode, 400, extraOpportunityField.body);

    const createOpportunity = await request({
      method: 'POST',
      url: '/api/oportunidades',
      payload: {
        clienteId: clientId,
        titulo: '  QA-AUDIT-S03-Oportunidade Principal  ',
        valorEstimado: 1_000_000,
        responsavel: '  Thalles QA  ',
        origem: '  Indicação  ',
        servicoTipo: '  Georreferenciamento rural  ',
        proximaAcao: '  Enviar proposta  ',
        proximaAcaoEm: '2026-09-09',
        previsaoFechamento: '2026-10-01',
        probabilidadePontosBase: 2_500,
        observacoes: '<script>alert(1)</script>',
      },
    });
    assert.equal(createOpportunity.statusCode, 201, createOpportunity.body);
    const opportunity = createOpportunity.json() as { id: string; titulo: string; responsavel: string; servicoTipo: string };
    assert.equal(opportunity.titulo, 'QA-AUDIT-S03-Oportunidade Principal');
    assert.equal(opportunity.responsavel, 'Thalles QA');
    assert.equal(opportunity.servicoTipo, 'Georreferenciamento rural');

    const wrongBudget = await request({ method: 'POST', url: `/api/oportunidades/${opportunity.id}/link-budget`, payload: { orcamentoId: incompatibleBudgetId } });
    assert.equal(wrongBudget.statusCode, 400, wrongBudget.body);
    const linkBudget = await request({ method: 'POST', url: `/api/oportunidades/${opportunity.id}/link-budget`, payload: { orcamentoId: budgetId } });
    assert.equal(linkBudget.statusCode, 200, linkBudget.body);

    const contact = await request({ method: 'PATCH', url: `/api/oportunidades/${opportunity.id}/transition`, payload: { estagio: 'Contato' } });
    assert.equal(contact.statusCode, 200, contact.body);
    const proposal = await request({ method: 'PATCH', url: `/api/oportunidades/${opportunity.id}/transition`, payload: { estagio: 'Proposta' } });
    assert.equal(proposal.statusCode, 200, proposal.body);
    const lost = await request({ method: 'PATCH', url: `/api/oportunidades/${opportunity.id}/transition`, payload: { estagio: 'Perdido', motivo: '  Prazo incompatível  ' } });
    assert.equal(lost.statusCode, 200, lost.body);
    const reopened = await request({ method: 'PATCH', url: `/api/oportunidades/${opportunity.id}/transition`, payload: { estagio: 'Proposta', motivo: '  Negociação retomada  ' } });
    assert.equal(reopened.statusCode, 200, reopened.body);

    const leadOpportunity = await request({
      method: 'POST',
      url: '/api/oportunidades',
      payload: { leadId: lead.id, titulo: 'QA-AUDIT-S03-Oportunidade de Lead', valorEstimado: 200_000, probabilidadePontosBase: 5_000 },
    });
    assert.equal(leadOpportunity.statusCode, 201, leadOpportunity.body);
    const leadOpportunityId = (leadOpportunity.json() as { id: string }).id;
    const leadCannotWin = await request({ method: 'PATCH', url: `/api/oportunidades/${leadOpportunityId}/transition`, payload: { estagio: 'Ganho' } });
    assert.equal(leadCannotWin.statusCode, 400, leadCannotWin.body);

    const duplicateReorder = await request({
      method: 'PATCH',
      url: '/api/oportunidades/reorder',
      payload: [
        { id: leadOpportunityId, estagio: 'Prospectado', ordem: 0 },
        { id: leadOpportunityId, estagio: 'Prospectado', ordem: 1 },
      ],
    });
    assert.equal(duplicateReorder.statusCode, 400, duplicateReorder.body);

    const conversion = await request({ method: 'POST', url: `/api/contatos/${lead.id}/converter`, payload: {} });
    assert.equal(conversion.statusCode, 200, conversion.body);
    const conversionAgain = await request({ method: 'POST', url: `/api/contatos/${lead.id}/converter`, payload: {} });
    assert.equal(conversionAgain.statusCode, 200, conversionAgain.body);
    assert.equal((conversionAgain.json() as { idempotent: boolean }).idempotent, true);

    const analytics = await request({ method: 'GET', url: '/api/oportunidades/analytics' });
    assert.equal(analytics.statusCode, 200, analytics.body);
    const metrics = analytics.json() as { activeCount: number; openPipelineCents: number; weightedPipelineCents: number; counts: Record<string, number> };
    assert.equal(metrics.activeCount, 2);
    assert.equal(metrics.openPipelineCents, 900_000);
    assert.equal(metrics.weightedPipelineCents, 555_000);
    assert.equal(metrics.counts.Proposta, 1);
    assert.equal(metrics.counts.Prospectado, 1);

    const opportunityAudit = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.entity, 'Oportunidade'));
    assert.ok(opportunityAudit.some((entry) => entry.action === 'INSERT'));
    assert.ok(opportunityAudit.filter((entry) => entry.action === 'UPDATE').length >= 4);
    assert.equal(opportunityAudit.some((entry) => (entry.newData || '').includes('<script>')), false);
    const leadAudit = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.entity, 'Contato'));
    assert.ok(leadAudit.some((entry) => entry.action === 'INSERT'));
    assert.ok(leadAudit.some((entry) => entry.action === 'UPDATE'));

    const deleteOpportunity = await request({ method: 'DELETE', url: `/api/oportunidades/${opportunity.id}` });
    assert.equal(deleteOpportunity.statusCode, 204, deleteOpportunity.body);
    const deleteOpportunityAgain = await request({ method: 'DELETE', url: `/api/oportunidades/${opportunity.id}` });
    assert.equal(deleteOpportunityAgain.statusCode, 404, deleteOpportunityAgain.body);
    const deletedRow = await db.select().from(schema.oportunidades).where(eq(schema.oportunidades.id, opportunity.id)).get();
    assert.ok(deletedRow?.deletedAt);

    const deleteLeadOpportunity = await request({ method: 'DELETE', url: `/api/oportunidades/${leadOpportunityId}` });
    assert.equal(deleteLeadOpportunity.statusCode, 204, deleteLeadOpportunity.body);
    const deleteLead = await request({ method: 'DELETE', url: `/api/contatos/${lead.id}` });
    assert.equal(deleteLead.statusCode, 200, deleteLead.body);
    const deleteLeadAgain = await request({ method: 'DELETE', url: `/api/contatos/${lead.id}` });
    assert.equal(deleteLeadAgain.statusCode, 404, deleteLeadAgain.body);
    const activeLead = await db.select().from(schema.contatos).where(and(eq(schema.contatos.id, lead.id), isNull(schema.contatos.deletedAt))).get();
    assert.equal(activeLead, undefined);
    const finalLeadAudit = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.entity, 'Contato'));
    assert.ok(finalLeadAudit.some((entry) => entry.action === 'DELETE (SOFT)'));
  } finally {
    await server.close();
    await removeTestDatabase();
  }
});
