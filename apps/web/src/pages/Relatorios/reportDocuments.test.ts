import assert from 'node:assert/strict';
import test from 'node:test';
import type { ManagerialReport } from '@geogestor/contracts';
import { buildReportDocumentModel } from './reportDocumentModel';
import { createManagerialReportPdfDefinition, downloadManagerialReportPdf } from './reportPdfGenerator';

const report: ManagerialReport = {
  generatedAt: '2026-01-01T01:30:00.000Z',
  period: {
    startDate: '2026-09-01', endDate: '2026-09-30', previousStartDate: '2026-08-02', previousEndDate: '2026-08-31',
    label: '2026-09-01 a 2026-09-30', comparisonLabel: '2026-08-02 a 2026-08-31',
    rules: {
      contractedRevenue: 'Competência do orçamento.', receivedRevenue: 'Caixa dos recebimentos.',
      pendingRevenue: 'Competência das parcelas.', paidExpenses: 'Caixa das despesas.',
      projects: 'Coorte por início.', activeArea: 'Somente áreas conhecidas.'
    }
  },
  state: { hasSourceData: true, hasFilteredData: true, sourceRecordCount: 8, filteredRecordCount: 7 },
  financial: {
    kpis: {
      contractedRevenue: 27_000, receivedRevenue: 14_000, pendingRevenue: 11_000, overdueRevenue: 11_000,
      paidExpenses: 3_000, cashResult: 11_000, estimatedTaxes: 2_700,
      approvedBudgets: 5, decidedBudgets: 7, conversionRate: 71.4
    },
    composition: { contractedBudgetCount: 5, receivedEventCount: 4, pendingItemCount: 2, paidExpenseCount: 2 },
    previous: { contractedRevenue: 7_000, receivedRevenue: 7_000, paidExpenses: 0, cashResult: 7_000 },
    monthly: [{ month: '2026-09', receivedRevenue: 14_000, paidExpenses: 3_000, cashResult: 11_000 }],
    expensesByCategory: [{ category: 'Combustível & campo', paidTotal: 3_000, launchedTotal: 3_000, count: 2 }],
    alerts: [{ id: 'overdue', code: 'overdue_revenue', severity: 'critical', href: '/financeiro', valueCents: 11_000 }]
  },
  operational: {
    kpis: {
      totalProjects: 3, activeProjects: 2, completedProjects: 1, cancelledProjects: 0,
      overdueProjects: 1, dueSoonProjects: 1, activeAreaHa: 12.5, projectsWithKnownArea: 1
    },
    previousCompletedProjects: 0,
    byStatus: [{ label: 'Em Andamento', count: 2 }, { label: 'Concluído', count: 1 }],
    byType: [{ label: 'Rural', count: 3 }],
    byMunicipality: [{ label: 'Florianópolis', count: 3 }],
    deadlines: [{ id: 'p1', name: 'Projeto crítico <script>inerte</script>', status: 'Em Andamento', dueDate: '2026-09-16', daysUntilDue: -1 }],
    alerts: [{ id: 'projects', code: 'overdue_projects', severity: 'critical', href: '/projetos', count: 1 }]
  }
};

test('prévia e definição PDF preservam indicadores, tabelas, alertas, agenda e critérios do tipo', () => {
  const financial = buildReportDocumentModel(report, 'financeiro');
  assert.deepEqual(financial.sections.map((section) => section.title), [
    'Indicadores financeiros', 'Evolução do caixa', 'Despesas pagas por categoria'
  ]);
  assert.equal(financial.alerts.length, 1);
  assert.ok(financial.criteria.includes('Competência das parcelas.'));
  assert.equal(financial.sections.some((section) => section.title.includes('operacionais')), false);

  const projects = buildReportDocumentModel(report, 'projetos');
  assert.ok(projects.sections.some((section) => section.title === 'Agenda crítica de entregas'));
  assert.equal(projects.sections.some((section) => section.title.includes('financeiros')), false);

  const executive = buildReportDocumentModel(report, 'executivo');
  assert.equal(executive.summary.length, 3);
  assert.equal(executive.alerts.length, 2);
  assert.equal(executive.issuedAt, '31/12/2025');

  const definition = createManagerialReportPdfDefinition(report, 'executivo', {
    version: 1, appLogo: '', logo: 'data:image/png;base64,quebrado', razao: 'SkyGeo QA', cnpj: '',
    telefone: '', email: '', endereco: '', conselhoProfissional: '', registroProfissional: '', cor: 'inválida', termos: ''
  });
  const serialized = JSON.stringify(definition);
  assert.match(serialized, /SkyGeo QA/);
  assert.match(serialized, /Pontos de atenção/);
  assert.match(serialized, /Projeto crítico <script>inerte<\/script>/);
  assert.doesNotMatch(serialized, /"image":"data:image\/png;base64,quebrado"/);
  assert.match(serialized, /#4338ca/);
});

test('download PDF só resolve após a operação assíncrona e propaga falha', async () => {
  let release!: () => void;
  let completed = false;
  const pending = new Promise<void>((resolve) => { release = () => { completed = true; resolve(); }; });
  const make = { createPdf: () => ({ download: () => pending }) };
  const operation = downloadManagerialReportPdf(make, { content: [] }, 'relatorio.pdf');
  await Promise.resolve();
  assert.equal(completed, false);
  release();
  await operation;
  assert.equal(completed, true);

  await assert.rejects(
    () => downloadManagerialReportPdf({ createPdf: () => ({ download: async () => { throw new Error('download bloqueado'); } }) }, { content: [] }, 'relatorio.pdf'),
    /download bloqueado/
  );
});
