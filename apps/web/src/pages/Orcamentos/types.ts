import type {
  AdjustmentType,
  BudgetStatus,
  CostClassification,
  FinancialComponent,
  InstallmentDefinition
} from '@geogestor/contracts';

export interface BudgetListItem {
  id: string;
  groupId: string;
  version: number;
  number?: string | null;
  status: BudgetStatus;
  description?: string | null;
  serviceType?: string | null;
  propertyType?: string | null;
  propertyName?: string | null;
  municipality?: string | null;
  state?: string | null;
  technicalLead?: string | null;
  issueDate?: string | null;
  validUntil?: string | null;
  totalCents: number;
  estimatedTaxesCents?: number | null;
  netFeesCents?: number | null;
  estimatedProfitCents?: number | null;
  marginBasisPoints?: number | null;
  clientId: string;
  clientName: string;
  projectId?: string | null;
  projectName?: string | null;
  viewedAt?: string | null;
}

export interface BudgetKpis {
  total: number;
  counts: Record<BudgetStatus, number>;
  viewed: number;
  totalBudgetedCents: number;
  totalApprovedCents: number;
  averageApprovedTicketCents: number;
  conversionBasisPoints: number;
  estimatedTaxesCents: number;
  estimatedNetFeesCents: number;
  accountsReceivableCents: number;
  receivedCents: number;
  conversionByService: Array<{
    serviceType: string;
    eligible: number;
    approved: number;
    conversionBasisPoints: number;
  }>;
}

export interface BudgetOptions {
  clients: Array<{ id: string; name: string; document?: string | null }>;
  projects: Array<{ id: string; clientId: string; name: string; status: string }>;
  properties: Array<{
    id: string;
    clientId: string;
    name: string;
    municipality?: string | null;
    city?: string | null;
    areaHa?: number | null;
    record?: string | null;
  }>;
  taxProfiles: Array<{
    id: string;
    nome: string;
    taxes: Array<{
      id: string;
      nome: string;
      sigla: string;
      ratePercent: string;
      baseCalculo: 'tributavel' | 'servicos' | 'taxas' | 'total';
      inclusoNoPreco: boolean;
      cumulativo: boolean;
    }>;
  }>;
  templates: Array<{
    id: string;
    nome: string;
    servicoTipo?: string | null;
    descricao?: string | null;
    content: Partial<BudgetFormState>;
  }>;
  pricingParameters: Array<{
    id: string;
    chave: string;
    nome: string;
    categoria: string;
    unidade?: string | null;
    valorCentavos?: number | null;
    valorDecimal?: string | null;
  }>;
}

export interface BudgetFormItem {
  id: string;
  code: string;
  group: string;
  stage: string;
  category: string;
  description: string;
  unit: string;
  quantity: string;
  unitCost: string;
  unitPrice: string;
  discountType: AdjustmentType;
  discountValue: string;
  additionType: AdjustmentType;
  additionValue: string;
  taxable: boolean;
  component: FinancialComponent;
  optional: boolean;
  notes: string;
}

export interface BudgetFormCost {
  id: string;
  category: string;
  description: string;
  amount: string;
  classification: CostClassification;
  taxable: boolean;
  notes: string;
}

export interface BudgetFormTax {
  id: string;
  taxId?: string | null;
  name: string;
  acronym: string;
  ratePercent: string;
  calculationBase: 'tributavel' | 'servicos' | 'taxas' | 'total';
  includedInPrice: boolean;
  cumulative: boolean;
  manualAdjustment: string;
  adjustmentReason: string;
}

export interface BudgetFormState {
  clientId: string;
  projectId: string;
  propertyId: string;
  description: string;
  internalNotes: string;
  clientNotes: string;
  terms: string;
  issueDate: string;
  validUntil: string;
  technicalLead: string;
  source: string;
  serviceType: string;
  propertyType: 'rural' | 'urbano';
  propertyName: string;
  municipality: string;
  state: string;
  methodology: string;
  deliverables: string;
  executionDays: string;
  characterization: {
    estimatedArea: string;
    areaUnit: string;
    estimatedPerimeter: string;
    estimatedVertices: string;
    neighbors: string;
    record: string;
    registryOffice: string;
    ruralCode: string;
    approximateCoordinates: string;
    distanceKm: string;
    accessConditions: string;
    terrain: string;
    vegetation: string;
    complexity: string;
    travelRequired: boolean;
    lodgingRequired: boolean;
    additionalTeam: boolean;
    equipment: string;
    surveyMethod: string;
    physicalGroundControl: string;
    gnssElectronicBase: string;
    technicalNotes: string;
  };
  globalDiscountType: AdjustmentType;
  globalDiscountValue: string;
  globalAdditionType: AdjustmentType;
  globalAdditionValue: string;
  items: BudgetFormItem[];
  costs: BudgetFormCost[];
  taxes: BudgetFormTax[];
  paymentType: string;
  paymentDescription: string;
  paymentMethod: string;
  financialAccount: string;
  interestBasisPoints: string;
  fineBasisPoints: string;
  earlyDiscountBasisPoints: string;
  installments: InstallmentDefinition[];
}

export interface BudgetDetail extends Omit<BudgetListItem, 'groupId' | 'version' | 'number' | 'totalCents'> {
  grupoId: string;
  versao: number;
  codigoOrcamento?: string | null;
  valorTotal: number;
  status: BudgetStatus;
  descricao?: string | null;
  anotacoes?: string | null;
  observacoesCliente?: string | null;
  termosCondicoes?: string | null;
  dataEmissao?: string | null;
  validadeAte?: string | null;
  responsavelTecnico?: string | null;
  servicoTipo?: string | null;
  imovelTipo?: 'rural' | 'urbano' | null;
  imovelNome?: string | null;
  municipio?: string | null;
  uf?: string | null;
  metodologia?: string | null;
  entregaveis?: string | null;
  prazoExecucaoDias?: number | null;
  projetoId?: string | null;
  propriedadeId?: string | null;
  clienteId: string;
  clientName: string;
  clientDocument?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  visualizadoEm?: string | null;
  projectName?: string | null;
  characterization?: Record<string, unknown> | null;
  descontoGlobalTipo?: AdjustmentType | null;
  descontoGlobalValor?: string | null;
  acrescimoGlobalTipo?: AdjustmentType | null;
  acrescimoGlobalValor?: string | null;
  subtotalServicos?: number | null;
  subtotalDespesas?: number | null;
  subtotalTaxas?: number | null;
  custoTotalEstimado?: number | null;
  impostosPrevistos?: number | null;
  honorariosBrutos?: number | null;
  honorariosLiquidos?: number | null;
  lucroEstimado?: number | null;
  margemPontosBase?: number | null;
  markupPontosBase?: number | null;
  valorReembolsavel?: number | null;
  valorNaoTributavel?: number | null;
  items: Array<{
    id: string;
    code?: string | null;
    group?: string | null;
    stage?: string | null;
    category?: string | null;
    description: string;
    unit: string;
    quantity: string;
    unitCostCents: number;
    unitPriceCents: number;
    discount: { type: AdjustmentType; value: string };
    addition: { type: AdjustmentType; value: string };
    taxable: boolean;
    component: FinancialComponent;
    optional: boolean;
    notes?: string | null;
    totalCents: number;
  }>;
  costs: Array<{
    id: string;
    category: string;
    description: string;
    amountCents: number;
    classification: CostClassification;
    taxable: boolean;
    notes?: string | null;
  }>;
  taxes: Array<{
    id: string;
    taxId?: string | null;
    name: string;
    acronym: string;
    ratePercent: string;
    calculationBase: 'tributavel' | 'servicos' | 'taxas' | 'total';
    includedInPrice: boolean;
    cumulative: boolean;
    manualAdjustmentCents: number;
    adjustmentReason?: string | null;
    baseCents: number;
    amountCents: number;
  }>;
  payment: {
    type: string;
    description?: string | null;
    installments: InstallmentDefinition[];
    paymentMethod?: string | null;
    financialAccount?: string | null;
    interestBasisPoints: number;
    fineBasisPoints: number;
    earlyDiscountBasisPoints: number;
  } | null;
  history: Array<{
    id: string;
    statusAnterior?: string | null;
    statusNovo: string;
    motivo?: string | null;
    usuarioId: string;
    createdAt: string;
  }>;
  versions: Array<{ id: string; status: string; versao: number; createdAt: string; motivo?: string | null }>;
  installments: Array<{
    id: string;
    numero: number;
    valor: number;
    valorPago: number;
    dataVencimento: string;
    dataPagamento?: string | null;
    statusPagamento: string;
  }>;
}
