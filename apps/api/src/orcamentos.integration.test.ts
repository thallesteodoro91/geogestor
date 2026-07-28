import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { eq } from 'drizzle-orm';

const testRoot = path.resolve(process.cwd(), 'scratch', `orcamentos-${process.pid}`);
const dbPath = path.join(testRoot, `orcamentos.integration.${process.pid}.test.db`);
const dbFiles = [dbPath, `${dbPath}-shm`, `${dbPath}-wal`];
const authHeaders = { 'content-type': 'application/json', 'x-api-token': 'test-token' };

process.env.GEOGESTOR_DB_PATH = dbPath;
process.env.GEOGESTOR_API_TOKEN = 'test-token';

const payload = (clientId: string) => ({
  clientId,
  projectId: null,
  propertyId: null,
  description: 'Georreferenciamento de imóvel rural',
  internalNotes: 'Custo interno reservado',
  clientNotes: 'Inclui peças técnicas e protocolo.',
  terms: 'A execução depende do acesso ao imóvel.',
  issueDate: null,
  validUntil: '2099-12-31',
  technicalLead: 'Thalles Wesley Teodoro',
  source: 'manual',
  serviceType: 'Georreferenciamento de imóvel rural',
  propertyType: 'rural',
  propertyName: 'Fazenda Teste',
  municipality: 'Florianópolis',
  state: 'SC',
  methodology: 'GNSS RTK e apoio estático',
  deliverables: 'Planta, memorial descritivo e arquivos digitais',
  executionDays: 20,
  characterization: {
    estimatedArea: '12.5',
    physicalGroundControl: 'Marco de concreto M-01',
    gnssElectronicBase: 'Receptor GNSS configurado como estação base eletrônica'
  },
  globalDiscount: { type: 'fixo', value: '0' },
  globalAddition: { type: 'fixo', value: '0' },
  items: [{
    description: 'Serviço técnico completo',
    unit: 'serviço',
    quantity: '1',
    unitCostCents: 20_000,
    unitPriceCents: 100_000,
    discount: { type: 'fixo', value: '0' },
    addition: { type: 'fixo', value: '0' },
    taxable: true,
    component: 'servico',
    optional: false,
    required: true,
    order: 0
  }],
  costs: [{
    category: 'Deslocamento',
    description: 'Combustível e pedágios',
    amountCents: 8_000,
    classification: 'custo_proprio',
    taxable: false,
    order: 0
  }],
  taxes: [{
    name: 'ISS',
    acronym: 'ISS',
    ratePercent: '5',
    calculationBase: 'tributavel',
    includedInPrice: false,
    cumulative: false,
    manualAdjustmentCents: 0
  }],
  payment: {
    type: 'parcelas',
    description: '40% na aprovação e 60% na entrega',
    installments: [
      { percentage: '40', daysAfterApproval: 0, label: 'Entrada' },
      { percentage: '60', daysAfterApproval: 30, label: 'Entrega' }
    ],
    paymentMethod: 'PIX',
    financialAccount: 'Conta operacional',
    interestBasisPoints: 100,
    fineBasisPoints: 200,
    earlyDiscountBasisPoints: 50
  }
});

test('fluxo ponta a ponta de orçamento mantém estados, efeitos financeiros, revisão e rollback atômico', async () => {
  await fs.mkdir(testRoot, { recursive: true });
  await Promise.all(dbFiles.map((file) => fs.rm(file, { force: true })));

  const [{ server }, { db, dbReady }, { runRuntimeMigrations }, { schema }] = await Promise.all([
    import('./server'),
    import('./db'),
    import('./services/runtime-migrations.service'),
    import('@geogestor/database')
  ]);

  const request = async (options: {
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    url: string;
    payload?: Record<string, unknown>;
  }) => server.inject({
    ...options,
    headers: options.payload ? authHeaders : { 'x-api-token': 'test-token' }
  });

  try {
    await dbReady;
    await runRuntimeMigrations();

    const clientId = crypto.randomUUID();
    await db.insert(schema.clientes).values({
      id: clientId,
      nome: 'Cliente Integração',
      documento: '12345678900',
      email: 'cliente@teste.local',
      telefone: '48999999999'
    });

    const templateResponse = await request({
      method: 'POST',
      url: '/api/orcamentos/templates',
      payload: {
        name: 'Modelo topográfico de integração',
        serviceType: 'Levantamento topográfico',
        description: 'Modelo reutilizável',
        content: { description: 'Conteúdo preservado', items: [] }
      }
    });
    assert.equal(templateResponse.statusCode, 201, templateResponse.body);
    const template = templateResponse.json<{ id: string }>();

    const updateTemplateResponse = await request({
      method: 'PATCH',
      url: `/api/orcamentos/templates/${template.id}`,
      payload: { name: 'Modelo topográfico revisado' }
    });
    assert.equal(updateTemplateResponse.statusCode, 200, updateTemplateResponse.body);

    const taxProfileResponse = await request({
      method: 'POST',
      url: '/api/orcamentos/tax-profiles',
      payload: {
        name: 'Perfil fiscal de integração',
        description: 'Tributos de teste',
        taxes: [{
          name: 'ISS', acronym: 'ISS', ratePercent: '5', calculationBase: 'tributavel',
          includedInPrice: false, cumulative: false
        }]
      }
    });
    assert.equal(taxProfileResponse.statusCode, 201, taxProfileResponse.body);

    const pricingParameterResponse = await request({
      method: 'POST',
      url: '/api/orcamentos/pricing-parameters',
      payload: {
        key: 'deslocamento-integracao', name: 'Deslocamento de integração', category: 'Deslocamento',
        unit: 'km', valueCents: 350, notes: 'Valor inicial'
      }
    });
    assert.equal(pricingParameterResponse.statusCode, 201, pricingParameterResponse.body);
    const pricingParameterId = pricingParameterResponse.json<{ id: string }>().id;

    const pricingParameterUpdateResponse = await request({
      method: 'POST',
      url: '/api/orcamentos/pricing-parameters',
      payload: {
        key: 'deslocamento-integracao', name: 'Deslocamento de integração', category: 'Deslocamento',
        unit: 'km', valueCents: 425, notes: 'Valor revisado'
      }
    });
    assert.equal(pricingParameterUpdateResponse.statusCode, 201, pricingParameterUpdateResponse.body);
    assert.equal(pricingParameterUpdateResponse.json<{ id: string }>().id, pricingParameterId);

    const optionsResponse = await request({ method: 'GET', url: '/api/orcamentos/options' });
    assert.equal(optionsResponse.statusCode, 200, optionsResponse.body);
    const budgetOptions = optionsResponse.json<{
      templates: Array<{ nome: string; content: { description?: string } }>;
      taxProfiles: Array<{ nome: string; taxes: Array<{ sigla: string; ratePercent: string }> }>;
      pricingParameters: Array<{ chave: string; valorCentavos: number }>;
    }>();
    assert.ok(budgetOptions.templates.some((entry) => entry.nome === 'Modelo topográfico revisado' && entry.content.description === 'Conteúdo preservado'));
    assert.ok(budgetOptions.taxProfiles.some((entry) => entry.nome === 'Perfil fiscal de integração' && entry.taxes[0]?.sigla === 'ISS' && entry.taxes[0]?.ratePercent === '5'));
    assert.ok(budgetOptions.pricingParameters.some((entry) => entry.chave === 'deslocamento-integracao' && entry.valorCentavos === 425));

    const editableDraftResponse = await request({
      method: 'POST',
      url: '/api/orcamentos',
      payload: { ...payload(clientId), description: 'Rascunho para validar edição' }
    });
    assert.equal(editableDraftResponse.statusCode, 201, editableDraftResponse.body);
    const editableDraft = editableDraftResponse.json<{ id: string; status: string }>();
    assert.equal(editableDraft.status, 'rascunho');

    const updateDraftResponse = await request({
      method: 'PATCH',
      url: `/api/orcamentos/${editableDraft.id}`,
      payload: {
        ...payload(clientId),
        description: 'Rascunho editado com sucesso',
        executionDays: 25
      }
    });
    assert.equal(updateDraftResponse.statusCode, 200, updateDraftResponse.body);
    assert.equal(updateDraftResponse.json<{ descricao: string }>().descricao, 'Rascunho editado com sucesso');
    assert.equal(updateDraftResponse.json<{ prazoExecucaoDias: number }>().prazoExecucaoDias, 25);

    const duplicateDraftResponse = await request({
      method: 'POST',
      url: `/api/orcamentos/${editableDraft.id}/duplicate`
    });
    assert.equal(duplicateDraftResponse.statusCode, 201, duplicateDraftResponse.body);
    const duplicatedDraft = duplicateDraftResponse.json<{ id: string; status: string; descricao: string }>();
    assert.notEqual(duplicatedDraft.id, editableDraft.id);
    assert.equal(duplicatedDraft.status, 'rascunho');
    assert.equal(duplicatedDraft.descricao, 'Rascunho editado com sucesso');

    const draftListResponse = await request({
      method: 'GET',
      url: '/api/orcamentos?status=rascunho&query=Rascunho%20editado'
    });
    assert.equal(draftListResponse.statusCode, 200, draftListResponse.body);
    assert.ok(draftListResponse.json<Array<{ id: string }>>().some((entry) => entry.id === editableDraft.id));

    const deleteDuplicateResponse = await request({
      method: 'DELETE',
      url: `/api/orcamentos/${duplicatedDraft.id}`
    });
    assert.equal(deleteDuplicateResponse.statusCode, 204, deleteDuplicateResponse.body);

    const deletedDraftResponse = await request({
      method: 'GET',
      url: `/api/orcamentos/${duplicatedDraft.id}`
    });
    assert.equal(deletedDraftResponse.statusCode, 404, deletedDraftResponse.body);

    const createResponse = await request({ method: 'POST', url: '/api/orcamentos', payload: payload(clientId) });
    assert.equal(createResponse.statusCode, 201, createResponse.body);
    const created = createResponse.json<{ id: string; status: string; valorTotal: number; history: unknown[] }>();
    assert.equal(created.status, 'rascunho');
    assert.equal(created.valorTotal, 105_000);
    assert.equal(created.history.length, 1);

    const opportunityResponse = await request({
      method: 'POST',
      url: '/api/oportunidades',
      payload: {
        clienteId: clientId,
        titulo: 'Oportunidade vinculada ao orçamento',
        valorEstimado: created.valorTotal,
        orcamentoId: created.id
      }
    });
    assert.equal(opportunityResponse.statusCode, 201, opportunityResponse.body);
    const linkedOpportunity = opportunityResponse.json<{ id: string; estagio: string }>();
    assert.equal(linkedOpportunity.estagio, 'Proposta');

    const viewedResponse = await request({ method: 'POST', url: `/api/orcamentos/${created.id}/viewed` });
    assert.equal(viewedResponse.statusCode, 200, viewedResponse.body);
    assert.ok(viewedResponse.json<{ visualizadoEm: string }>().visualizadoEm);

    const emitResponse = await request({ method: 'POST', url: `/api/orcamentos/${created.id}/emit` });
    assert.equal(emitResponse.statusCode, 200, emitResponse.body);
    const emitted = emitResponse.json<{ status: string; codigoOrcamento: string; clientSnapshot: { nome: string } }>();
    assert.equal(emitted.status, 'emitido');
    assert.match(emitted.codigoOrcamento, /^ORC-\d{4}-0001$/);
    assert.equal(emitted.clientSnapshot.nome, 'Cliente Integração');

    for (const status of ['enviado', 'em_negociacao'] as const) {
      const transition = await request({
        method: 'POST',
        url: `/api/orcamentos/${created.id}/transitions`,
        payload: { status }
      });
      assert.equal(transition.statusCode, 200, transition.body);
      assert.equal(transition.json<{ status: string }>().status, status);
    }

    const idempotencyKey = 'approval-integration-0001';
    const approvalPayload = {
      idempotencyKey,
      project: { mode: 'create', projectId: null, name: 'Projeto originado da aprovação' }
    };
    const approveResponse = await request({
      method: 'POST', url: `/api/orcamentos/${created.id}/approve`, payload: approvalPayload
    });
    assert.equal(approveResponse.statusCode, 200, approveResponse.body);
    const approval = approveResponse.json<{ projectId: string; installmentIds: string[]; idempotent: boolean }>();
    assert.equal(approval.idempotent, false);
    assert.equal(approval.installmentIds.length, 2);

    const opportunityAfterApproval = await request({ method: 'GET', url: `/api/oportunidades/${linkedOpportunity.id}` });
    assert.equal(opportunityAfterApproval.statusCode, 200, opportunityAfterApproval.body);
    const wonOpportunity = opportunityAfterApproval.json<{ estagio: string; projetoId: string; orcamentoId: string }>();
    assert.equal(wonOpportunity.estagio, 'Ganho');
    assert.equal(wonOpportunity.projetoId, approval.projectId);
    assert.equal(wonOpportunity.orcamentoId, created.id);

    const repeatedApproval = await request({
      method: 'POST', url: `/api/orcamentos/${created.id}/approve`, payload: approvalPayload
    });
    assert.equal(repeatedApproval.statusCode, 200, repeatedApproval.body);
    assert.equal(repeatedApproval.json<{ idempotent: boolean }>().idempotent, true);

    const projectsAfterApproval = await db.select().from(schema.projetos).where(eq(schema.projetos.id, approval.projectId));
    const installmentsAfterApproval = await db.select().from(schema.parcelas).where(eq(schema.parcelas.orcamentoId, created.id));
    assert.equal(projectsAfterApproval.length, 1);
    assert.equal(installmentsAfterApproval.length, 2);
    assert.deepEqual(installmentsAfterApproval.map((entry) => entry.valor), [42_000, 63_000]);
    assert.ok(installmentsAfterApproval.every((entry) => entry.valorPago === 0 && entry.statusPagamento === 'Pendente'));

    const travelResponse = await request({
      method: 'POST',
      url: '/api/financeiro/viagens',
      payload: {
        clienteId: clientId,
        projetoId: approval.projectId,
        finalidade: 'Levantamento de campo',
        destino: 'Florianópolis/SC',
        dataInicio: '2026-07-18',
        dataFim: '2026-07-19',
        adiantamento: 30_000,
        status: 'prestacao_pendente'
      }
    });
    assert.equal(travelResponse.statusCode, 201, travelResponse.body);
    const travel = travelResponse.json<{ id: string }>();

    const expenseResponse = await request({
      method: 'POST',
      url: '/api/financeiro/despesas',
      payload: {
        clienteId: clientId,
        projetoId: approval.projectId,
        viagemId: travel.id,
        descricao: 'Hospedagem da equipe',
        valor: 18_000,
        data: '2026-07-19',
        dataPagamento: '2026-07-19',
        categoria: 'Hospedagem',
        status: 'Pago',
        formaPagamento: 'Cartão'
      }
    });
    assert.equal(expenseResponse.statusCode, 200, expenseResponse.body);
    const expense = expenseResponse.json<{ id: string; categoriaCodigo: string }>();
    assert.equal(expense.categoriaCodigo, 'hospedagem');

    const travelsWithExpense = await request({ method: 'GET', url: '/api/financeiro/viagens' });
    const travelSummary = travelsWithExpense.json<Array<{ id: string; totalGasto: number; saldoPrestacao: number }>>()
      .find((entry) => entry.id === travel.id);
    assert.equal(travelSummary?.totalGasto, 18_000);
    assert.equal(travelSummary?.saldoPrestacao, 12_000);

    const deletePaidExpense = await request({
      method: 'DELETE',
      url: `/api/financeiro/despesas/${expense.id}`
    });
    assert.equal(deletePaidExpense.statusCode, 409, deletePaidExpense.body);
    const reversePaidExpense = await request({
      method: 'POST',
      url: `/api/financeiro/despesas/${expense.id}/estorno`,
      payload: { motivo: 'Pagamento da hospedagem devolvido para teste' }
    });
    assert.equal(reversePaidExpense.statusCode, 200, reversePaidExpense.body);
    assert.equal(reversePaidExpense.json<{ status: string }>().status, 'Estornado');

    const fiscalDocumentResponse = await request({
      method: 'POST',
      url: '/api/financeiro/notas-fiscais',
      payload: {
        clienteId: clientId,
        projetoId: approval.projectId,
        orcamentoId: created.id,
        numero: 'NFS-TESTE-001',
        dataEmissao: '2026-07-20',
        valor: 105_000,
        municipio: 'Florianópolis'
      }
    });
    assert.equal(fiscalDocumentResponse.statusCode, 201, fiscalDocumentResponse.body);

    const projectFinancialContext = await request({
      method: 'GET',
      url: `/api/projetos/${approval.projectId}/contexto-financeiro`
    });
    assert.equal(projectFinancialContext.statusCode, 200, projectFinancialContext.body);
    assert.ok(projectFinancialContext.json<{ custoPrevisto: number }>().custoPrevisto > 0);
    assert.equal(projectFinancialContext.json<{ custoRealizado: number }>().custoRealizado, 0);

    const projectFinancialDecision = await request({
      method: 'POST',
      url: `/api/projetos/${approval.projectId}/decisao-financeira`,
      payload: {
        tipo: 'manter_sem_alteracao',
        motivo: 'Contrato e parcelas permanecem válidos após a revisão operacional.'
      }
    });
    assert.equal(projectFinancialDecision.statusCode, 201, projectFinancialDecision.body);

    const initialKpis = await request({ method: 'GET', url: '/api/orcamentos/kpis' });
    assert.equal(initialKpis.statusCode, 200, initialKpis.body);
    assert.deepEqual(
      (({ totalApprovedCents, accountsReceivableCents, receivedCents }) => ({ totalApprovedCents, accountsReceivableCents, receivedCents }))(
        initialKpis.json<{ totalApprovedCents: number; accountsReceivableCents: number; receivedCents: number }>()
      ),
      { totalApprovedCents: 105_000, accountsReceivableCents: 105_000, receivedCents: 0 }
    );

    const partialResponse = await request({
      method: 'POST',
      url: `/api/financeiro/parcelas/${approval.installmentIds[0]}/recebimentos`,
      payload: {
        valorPrincipal: 20_000,
        juros: 0,
        multa: 0,
        desconto: 0,
        taxas: 0,
        dataRecebimento: '2026-07-20'
      }
    });
    assert.equal(partialResponse.statusCode, 201, partialResponse.body);
    assert.equal(partialResponse.json<{ parcela: { valorPago: number; statusPagamento: string } }>().parcela.valorPago, 20_000);
    assert.equal(partialResponse.json<{ parcela: { valorPago: number; statusPagamento: string } }>().parcela.statusPagamento, 'Parcialmente pago');

    const overpaymentResponse = await request({
      method: 'POST',
      url: `/api/financeiro/parcelas/${approval.installmentIds[0]}/recebimentos`,
      payload: {
        valorPrincipal: 22_001,
        dataRecebimento: '2026-07-20'
      }
    });
    assert.equal(overpaymentResponse.statusCode, 409, overpaymentResponse.body);

    const partialKpis = await request({ method: 'GET', url: '/api/orcamentos/kpis' });
    assert.equal(partialKpis.json<{ receivedCents: number; accountsReceivableCents: number }>().receivedCents, 20_000);
    assert.equal(partialKpis.json<{ receivedCents: number; accountsReceivableCents: number }>().accountsReceivableCents, 85_000);

    const paidResponse = await request({
      method: 'PATCH',
      url: `/api/financeiro/parcelas/${approval.installmentIds[0]}`,
      payload: { statusPagamento: 'Pago' }
    });
    assert.equal(paidResponse.statusCode, 200, paidResponse.body);
    assert.equal(paidResponse.json<{ valorPago: number }>().valorPago, 42_000);

    const paidKpis = await request({ method: 'GET', url: '/api/orcamentos/kpis' });
    assert.equal(paidKpis.json<{ receivedCents: number; accountsReceivableCents: number }>().receivedCents, 42_000);
    assert.equal(paidKpis.json<{ receivedCents: number; accountsReceivableCents: number }>().accountsReceivableCents, 63_000);

    const receiptsResponse = await request({
      method: 'GET',
      url: `/api/financeiro/parcelas/${approval.installmentIds[0]}/recebimentos`
    });
    assert.equal(receiptsResponse.statusCode, 200, receiptsResponse.body);
    const receipts = receiptsResponse.json<Array<{ id: string }>>();
    let lastChargeback: { parcela: { valorPago: number; dataPagamento: string | null } } | undefined;
    for (const receipt of receipts) {
      const chargebackResponse = await request({
        method: 'POST',
        url: `/api/financeiro/recebimentos/${receipt.id}/estorno`,
        payload: { motivo: 'Pagamento devolvido ao cliente para teste' }
      });
      assert.equal(chargebackResponse.statusCode, 200, chargebackResponse.body);
      lastChargeback = chargebackResponse.json<{ parcela: { valorPago: number; dataPagamento: string | null } }>();
    }
    assert.equal(lastChargeback?.parcela.valorPago, 0);
    assert.equal(lastChargeback?.parcela.dataPagamento, null);

    const paidAgainResponse = await request({
      method: 'PATCH',
      url: `/api/financeiro/parcelas/${approval.installmentIds[0]}`,
      payload: { statusPagamento: 'Pago' }
    });
    assert.equal(paidAgainResponse.statusCode, 200, paidAgainResponse.body);

    const revisionResponse = await request({
      method: 'POST',
      url: `/api/orcamentos/${created.id}/revisions`,
      payload: { reason: 'Ajuste de escopo solicitado pelo cliente' }
    });
    assert.equal(revisionResponse.statusCode, 201, revisionResponse.body);
    const revision = revisionResponse.json<{ id: string; status: string; versao: number; substituiOrcamentoId: string }>();
    assert.equal(revision.status, 'rascunho');
    assert.equal(revision.versao, 2);
    assert.equal(revision.substituiOrcamentoId, created.id);

    const revisionEmit = await request({ method: 'POST', url: `/api/orcamentos/${revision.id}/emit` });
    assert.equal(revisionEmit.statusCode, 200, revisionEmit.body);
    const revisionApproval = await request({
      method: 'POST',
      url: `/api/orcamentos/${revision.id}/approve`,
      payload: {
        idempotencyKey: 'approval-integration-0002',
        project: { mode: 'existing', projectId: approval.projectId, name: null }
      }
    });
    assert.equal(revisionApproval.statusCode, 200, revisionApproval.body);

    const originalAfterRevision = await request({ method: 'GET', url: `/api/orcamentos/${created.id}` });
    assert.equal(originalAfterRevision.json<{ status: string }>().status, 'substituido');
    const canceledOriginalInstallments = await db.select().from(schema.parcelas).where(eq(schema.parcelas.orcamentoId, created.id));
    assert.equal(canceledOriginalInstallments.filter((entry) => entry.statusPagamento === 'Pago').length, 1);
    assert.equal(canceledOriginalInstallments.filter((entry) => entry.statusPagamento === 'Cancelado' && entry.canceladaEm).length, 1);
    const revisionInstallments = await db.select().from(schema.parcelas).where(eq(schema.parcelas.orcamentoId, revision.id));
    assert.equal(revisionInstallments.reduce((sum, entry) => sum + entry.valor, 0), 63_000);

    const revisionKpis = await request({ method: 'GET', url: '/api/orcamentos/kpis' });
    assert.equal(revisionKpis.json<{ receivedCents: number; accountsReceivableCents: number }>().receivedCents, 42_000);
    assert.equal(revisionKpis.json<{ receivedCents: number; accountsReceivableCents: number }>().accountsReceivableCents, 63_000);

    const cancelRevision = await request({
      method: 'POST',
      url: `/api/orcamentos/${revision.id}/transitions`,
      payload: { status: 'cancelado', reason: 'Cliente suspendeu a contratação' }
    });
    assert.equal(cancelRevision.statusCode, 200, cancelRevision.body);
    assert.equal(cancelRevision.json<{ status: string }>().status, 'cancelado');

    const rejectionCreate = await request({ method: 'POST', url: '/api/orcamentos', payload: payload(clientId) });
    const rejectionId = rejectionCreate.json<{ id: string }>().id;
    assert.equal((await request({ method: 'POST', url: `/api/orcamentos/${rejectionId}/emit` })).statusCode, 200);
    const rejection = await request({
      method: 'POST',
      url: `/api/orcamentos/${rejectionId}/transitions`,
      payload: { status: 'rejeitado', reason: 'Preço não aprovado pelo cliente' }
    });
    assert.equal(rejection.statusCode, 200, rejection.body);
    assert.equal(rejection.json<{ status: string }>().status, 'rejeitado');

    const rollbackCreate = await request({ method: 'POST', url: '/api/orcamentos', payload: payload(clientId) });
    const rollbackId = rollbackCreate.json<{ id: string }>().id;
    assert.equal((await request({ method: 'POST', url: `/api/orcamentos/${rollbackId}/emit` })).statusCode, 200);
    const rollbackApproval = await request({
      method: 'POST',
      url: `/api/orcamentos/${rollbackId}/approve`,
      payload: {
        idempotencyKey,
        project: { mode: 'create', projectId: null, name: 'Projeto que deve sofrer rollback' }
      }
    });
    assert.equal(rollbackApproval.statusCode, 400, rollbackApproval.body);

    const rollbackBudget = await request({ method: 'GET', url: `/api/orcamentos/${rollbackId}` });
    assert.equal(rollbackBudget.json<{ status: string }>().status, 'emitido');
    assert.equal((await db.select().from(schema.parcelas).where(eq(schema.parcelas.orcamentoId, rollbackId))).length, 0);
    assert.equal((await db.select().from(schema.projetos).where(eq(schema.projetos.nome, 'Projeto que deve sofrer rollback'))).length, 0);

    const reportResponse = await request({ method: 'GET', url: '/api/relatorios/geral' });
    assert.equal(reportResponse.statusCode, 200, reportResponse.body);
    const report = reportResponse.json<{ financeiro: { receitaRecebida: number; resultadoCaixa: number } }>();
    assert.equal(report.financeiro.receitaRecebida, 42_000);
    assert.equal(report.financeiro.resultadoCaixa, 42_000);

    const detail = await request({ method: 'GET', url: `/api/orcamentos/${revision.id}` });
    assert.ok(detail.json<{ history: unknown[]; versions: unknown[] }>().history.length >= 3);
    assert.ok(detail.json<{ history: unknown[]; versions: unknown[] }>().versions.length >= 2);
  } finally {
    await server.close();
    const client = (db as unknown as { $client: { close: () => void } }).$client;
    client.close();
    await Promise.allSettled(dbFiles.map((file) => fs.rm(file, { force: true })));
  }
});
