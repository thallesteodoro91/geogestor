import { CheckCircle, CurrencyDollar, Eye, FileText, Receipt, Wallet } from '@phosphor-icons/react';
import { AuraBalanceSummary, AuraMediumMetric, AuraProgressWidget, AuraReceivedWidget, AuraSmallBalance } from '../../components/AuraWidget';
import { formatBasisPoints } from './budgetForm';
import type { BudgetKpis } from './types';
import './budget-aura.css';

const countFormat = new Intl.NumberFormat('pt-BR');

export function BudgetPulseWidgets({ kpis, onShowApproved }: { kpis: BudgetKpis; onShowApproved?: () => void }) {
  const approved = kpis.counts.aprovado;
  const eligible = approved + kpis.counts.rejeitado + kpis.counts.expirado;
  return (
    <div className="budget-aura-grid" role="group" aria-label="Indicadores resumidos de orçamentos">
      <AuraBalanceSummary className="budget-aura--approved-value" label="Valor aprovado"
        value={kpis.totalApprovedCents} currency detail="Versões aprovadas vigentes"
        icon={<CheckCircle size={17} />}
        action={onShowApproved && approved > 0 && <button type="button" className="geo-focus-ring aura-balance-summary__action" onClick={onShowApproved}>Ver aprovados</button>}
      />
      <AuraReceivedWidget compact className="budget-aura--receipts" value={kpis.receivedCents} context="Parcelas liquidadas" />
      <AuraSmallBalance compact currency className="budget-aura--receivables" label="A receber"
        value={kpis.accountsReceivableCents} context="Parcelas em aberto" icon={<Wallet size={16} />} />
      <AuraProgressWidget as="article" className="budget-aura--rate" label="Taxa de conversão"
        value={eligible > 0 ? formatBasisPoints(kpis.conversionBasisPoints) : 'Sem base comparável'}
        badge={eligible > 0 ? `${countFormat.format(approved)} de ${countFormat.format(eligible)} elegíveis` : undefined}
        detail={eligible === 0 ? 'Nenhuma proposta elegível encerrada' : undefined}
        fraction={eligible > 0 ? kpis.conversionBasisPoints / 10_000 : undefined}
      />
    </div>
  );
}

export function BudgetAnalysisWidgets({ kpis }: { kpis: BudgetKpis }) {
  return (
    <div className="budget-aura-analysis-grid">
      <AuraMediumMetric className="budget-aura--budgeted" label="Total orçado" value={kpis.totalBudgetedCents} currency icon={<FileText size={17} />} />
      <AuraMediumMetric className="budget-aura--fees" label="Honorários líquidos" value={kpis.estimatedNetFeesCents} currency icon={<Wallet size={17} />} />
      <AuraMediumMetric className="budget-aura--taxes" label="Impostos previstos" value={kpis.estimatedTaxesCents} currency icon={<Receipt size={17} />} />
      <AuraMediumMetric className="budget-aura--ticket" label="Ticket médio aprovado" value={kpis.averageApprovedTicketCents} currency icon={<CurrencyDollar size={17} />} />
      <AuraMediumMetric className="budget-aura--count" label="Total de orçamentos" value={kpis.total} icon={<FileText size={17} />} />
      <AuraMediumMetric className="budget-aura--viewed" label="Visualizados" value={kpis.viewed} icon={<Eye size={17} />} />
    </div>
  );
}
