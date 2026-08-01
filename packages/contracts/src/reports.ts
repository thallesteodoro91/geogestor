export type ReportAlertSeverity = 'critical' | 'warning' | 'info';
export type ReportAlertCode =
  | 'overdue_revenue'
  | 'negative_cash'
  | 'low_conversion'
  | 'overdue_projects'
  | 'unknown_area';

export interface ReportPeriod {
  startDate: string | null;
  endDate: string | null;
  previousStartDate: string | null;
  previousEndDate: string | null;
  label: string;
  comparisonLabel: string | null;
  rules: {
    contractedRevenue: string;
    receivedRevenue: string;
    pendingRevenue: string;
    paidExpenses: string;
    projects: string;
    activeArea: string;
  };
}

export interface ReportFinancialKpis {
  contractedRevenue: number;
  receivedRevenue: number;
  pendingRevenue: number;
  overdueRevenue: number;
  paidExpenses: number;
  cashResult: number;
  estimatedTaxes: number;
  approvedBudgets: number;
  decidedBudgets: number;
  conversionRate: number | null;
}

export interface ReportFinancialComparison {
  contractedRevenue: number;
  receivedRevenue: number;
  paidExpenses: number;
  cashResult: number;
}

export interface ReportMonthlyPoint {
  month: string;
  receivedRevenue: number;
  paidExpenses: number;
  cashResult: number;
}

export interface ReportExpenseCategory {
  category: string;
  paidTotal: number;
  launchedTotal: number;
  count: number;
}

export interface ReportProjectBreakdown {
  label: string;
  count: number;
}

export interface ReportDeadline {
  id: string;
  name: string;
  status: string;
  dueDate: string;
  daysUntilDue: number;
}

export interface ReportOperationalKpis {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  cancelledProjects: number;
  overdueProjects: number;
  dueSoonProjects: number;
  activeAreaHa: number | null;
  projectsWithKnownArea: number;
}

export interface ReportAlert {
  id: string;
  code: ReportAlertCode;
  severity: ReportAlertSeverity;
  href: string;
  valueCents?: number;
  count?: number;
  threshold?: number;
  /** @deprecated A apresentação pertence ao cliente. Use `code` e os parâmetros estruturados. */
  title?: string;
  /** @deprecated A apresentação pertence ao cliente. Use `code` e os parâmetros estruturados. */
  description?: string;
}

export interface ManagerialReport {
  generatedAt: string;
  period: ReportPeriod;
  state: {
    hasSourceData: boolean;
    hasFilteredData: boolean;
    sourceRecordCount: number;
    filteredRecordCount: number;
  };
  financial: {
    kpis: ReportFinancialKpis;
    previous: ReportFinancialComparison | null;
    monthly: ReportMonthlyPoint[];
    expensesByCategory: ReportExpenseCategory[];
    alerts: ReportAlert[];
  };
  operational: {
    kpis: ReportOperationalKpis;
    previousCompletedProjects: number | null;
    byStatus: ReportProjectBreakdown[];
    byType: ReportProjectBreakdown[];
    byMunicipality: ReportProjectBreakdown[];
    deadlines: ReportDeadline[];
    alerts: ReportAlert[];
  };
  /** @deprecated Compatibilidade temporária. Use `operational.byStatus`. */
  projetosPorStatus?: Array<{ status: string; count: number }>;
  /** @deprecated Compatibilidade temporária. Use `operational.byType`. */
  projetosPorTipo?: Array<{ tipo: string; count: number }>;
  /** @deprecated Compatibilidade temporária. Use `operational.kpis.activeAreaHa`. */
  areaTotal?: number;
  /** @deprecated Compatibilidade temporária. Use `financial` e `operational`. */
  orcamentosStats?: Array<{ status: string; total: number; count: number }>;
  /** @deprecated Compatibilidade temporária. Use `financial.kpis`. */
  parcelasStats?: Array<{ statusPagamento: string; total: number }>;
  /** @deprecated Compatibilidade temporária. Use `financial.expensesByCategory`. */
  despesasPorCategoria?: Array<{ categoria: string; total: number }>;
  /** @deprecated Compatibilidade temporária. Use `financial.kpis`. */
  financeiro?: {
    receitaContratada: number;
    receitaRecebida: number;
    receitaPendente: number;
    despesasPagas: number;
    impostosPrevistos: number;
    resultadoCaixa: number;
  };
  /** @deprecated Compatibilidade temporária. Use `financial.monthly`. */
  historicoMensal?: {
    receitasMensais: Array<{ mes: string; total: number }>;
    despesasMensais: Array<{ mes: string; total: number }>;
  };
}
