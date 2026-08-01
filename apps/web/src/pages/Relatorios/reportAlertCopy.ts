import type { ReportAlert } from '@geogestor/contracts';
import { formatCurrency } from './reportPresentation';

export function reportAlertCopy(alert: ReportAlert) {
  switch (alert.code) {
    case 'overdue_revenue':
      return {
        title: 'Recebimentos vencidos exigem atenção',
        description: `Há ${formatCurrency(alert.valueCents ?? 0)} em parcelas vencidas ainda não recebidas.`
      };
    case 'negative_cash':
      return {
        title: 'Resultado de caixa negativo',
        description: 'As despesas pagas superam os recebimentos no período selecionado.'
      };
    case 'low_conversion':
      return {
        title: `Conversão comercial abaixo de ${alert.threshold ?? 30}%`,
        description: 'Revise propostas rejeitadas ou expiradas para identificar oportunidades de melhoria.'
      };
    case 'overdue_projects': {
      const count = alert.count ?? 0;
      return {
        title: 'Projetos com prazo vencido',
        description: `${count} ${count === 1 ? 'projeto ativo ultrapassou' : 'projetos ativos ultrapassaram'} a previsão de entrega.`
      };
    }
    case 'unknown_area': {
      const count = alert.count ?? 0;
      return {
        title: 'Área não informada em projetos ativos',
        description: `Complete a área de ${count} ${count === 1 ? 'projeto' : 'projetos'} para melhorar a leitura da carteira territorial.`
      };
    }
    default:
      return {
        title: alert.title || 'Ponto de atenção',
        description: alert.description || 'Consulte os detalhes para revisar este indicador.'
      };
  }
}
