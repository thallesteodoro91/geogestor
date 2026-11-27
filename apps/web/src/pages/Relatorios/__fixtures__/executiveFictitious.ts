import type { ManagerialReport } from '@geogestor/contracts';
// Explicitly fictitious, no database or application service.
export const fictitiousExecutiveReport: ManagerialReport = {
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
    byMunicipality: [{ label: 'Município fictício', count: 3 }],
    deadlines: [{ id: 'p1', name: 'EXEMPLO FICTÍCIO — Projeto de teste', status: 'Em Andamento', dueDate: '2026-09-16', daysUntilDue: -1 }],
    alerts: [{ id: 'projects', code: 'overdue_projects', severity: 'critical', href: '/projetos', count: 1 }]
  }
};