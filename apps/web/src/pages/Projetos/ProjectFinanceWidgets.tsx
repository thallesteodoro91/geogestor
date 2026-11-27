import { Plus } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { AuraNumericValue, AuraProgress, AuraWidget } from '../../components/AuraWidget';
import './project-finance-aura.css';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const percent = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });

interface ProjectFinanceMetrics {
  custoRealizado: number;
  custoPrevisto: number;
  desvioCusto: number;
  percentualCustoConsumido: number | null;
  valorRecebido: number;
  valorFaturado: number;
}

export function ProjectFinanceWidgets({ metrics, expensePath }: { metrics: ProjectFinanceMetrics; expensePath: string }) {
  const money = (cents: number) => currency.format(cents / 100);
  const costRatio = metrics.percentualCustoConsumido === null ? null : metrics.percentualCustoConsumido / 100;
  const receiptRatio = metrics.valorFaturado > 0 ? metrics.valorRecebido / metrics.valorFaturado : null;

  return (
    <div className="project-finance-aura-grid">
      <AuraWidget size="medium" tone="violet" aria-labelledby="project-aura-cost" className="project-finance-aura project-finance-aura--cost">
        <header className="project-finance-aura__header">
          <h3 id="project-aura-cost">Custo do projeto</h3>
          <Link to={expensePath} className="geo-focus-ring project-finance-aura__action">
            <Plus aria-hidden="true" size={15} /> Registrar despesa
          </Link>
        </header>
        <div>
          <div className="project-finance-aura__caption">
            <span>Custo previsto {costRatio === null ? '· Sem previsão' : money(metrics.custoPrevisto)}</span>
            {costRatio !== null && <span className="project-finance-aura__muted">{percent.format(costRatio)} consumido</span>}
          </div>
          {costRatio !== null && <AuraProgress fraction={costRatio} />}
        </div>
        <dl className="project-finance-aura__costs">
          <div>
            <dt>Custo realizado</dt>
            <dd><AuraNumericValue value={metrics.custoRealizado} currency /></dd>
          </div>
          <div>
            <dt>{costRatio !== null && metrics.desvioCusto > 0 ? 'Acima da previsão' : 'Desvio de custo'}</dt>
            <dd>{costRatio === null ? 'Indisponível' : <AuraNumericValue value={metrics.desvioCusto} currency />}</dd>
          </div>
        </dl>
      </AuraWidget>
      <AuraWidget size="medium" tone="gold" aria-labelledby="project-aura-receipt" className="project-finance-aura project-finance-aura--receipts">
        <header className="project-finance-aura__header">
          <h3 id="project-aura-receipt">Recebimentos do projeto</h3>
        </header>
        <div className="project-finance-aura__receipt-body">
          <div className="project-finance-aura__receipt-amount">
            <span className="sr-only">Recebido</span>
            <AuraNumericValue value={metrics.valorRecebido} currency />
          </div>
          {receiptRatio !== null && <AuraProgress fraction={receiptRatio} />}
          <div className="project-finance-aura__caption project-finance-aura__receipt-caption">
            <span className="project-finance-aura__muted">
              {receiptRatio === null ? 'Sem faturamento para comparar' : `${percent.format(receiptRatio)} do faturado`}
            </span>
            <span>Faturado {money(metrics.valorFaturado)}</span>
          </div>
        </div>
      </AuraWidget>
    </div>
  );
}
