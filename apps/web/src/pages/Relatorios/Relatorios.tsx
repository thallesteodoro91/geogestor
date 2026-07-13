import { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Printer, Coins, Briefcase } from '@phosphor-icons/react';
import { cn } from '../../utils/cn';
import { primaryActionButtonClass, primaryActionIconClass } from '../../utils/actionStyles';
import { geoFieldClass, geoTabButtonClass } from '../../utils/geoTheme';
import { apiClient } from '../../services/apiClient';

interface ProjetoStatusStat {
  status: string;
  count: number;
}

interface OrcamentoStat {
  status: string;
  count: number;
  total: number;
}

interface DespesaCategoriaStat {
  categoria: string;
  total: number;
}

interface RelatorioStats {
  projetosPorStatus?: ProjetoStatusStat[];
  projetosPorTipo?: Array<{ tipo: string; count: number }>;
  areaTotal?: number;
  orcamentosStats?: OrcamentoStat[];
  despesasPorCategoria?: DespesaCategoriaStat[];
}

export function Relatorios() {
  const [stats, setStats] = useState<RelatorioStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState<'financeiro' | 'projetos'>('financeiro');
  const [dataInicioFilter, setDataInicioFilter] = useState('');
  const [dataFimFilter, setDataFimFilter] = useState('');

  useEffect(() => {
    apiClient.get<RelatorioStats>('/api/relatorios/geral')
      .then(data => {
        setStats(data);
      })
      .catch(error => {
        console.error('Erro ao carregar relatório geral:', error);
      })
      .finally(() => setLoading(false));
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100);
  };

  const reportTabClass = (tab: typeof reportType, tone: Parameters<typeof geoTabButtonClass>[1]) =>
    cn(geoTabButtonClass(reportType === tab, tone), 'rounded-full px-6 py-3');

  return (
    <Layout>
      {/* Esconder do layout principal ao imprimir */}
      <div className="print:hidden">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs uppercase tracking-[0.2em] font-medium bg-zinc-100 text-zinc-500 dark:text-zinc-400 mb-4">
              Exportação
            </span>
            <h1 className="text-5xl font-semibold tracking-tighter text-zinc-950 dark:text-white">
              Relatórios & Faturamento
            </h1>
            <p className="mt-3 text-lg text-zinc-500 dark:text-zinc-400 font-medium">
              Gere documentos prontos para impressão ou exportação em PDF.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={handlePrint}
              className={primaryActionButtonClass}
            >
              <span>Imprimir / PDF</span>
              <div className={cn(primaryActionIconClass, 'group-hover:translate-x-0 group-hover:translate-y-0.5')}>
                <Printer weight="bold" className="w-4 h-4" />
              </div>
            </button>
          </div>
        </div>

        {/* Seleção de Relatório e Filtros */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-12 border-b border-zinc-100 dark:border-zinc-800 pb-6">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setReportType('financeiro')}
              className={reportTabClass('financeiro', 'finance')}
            >
              <Coins className="w-4 h-4" /> Relatório Financeiro Geral
            </button>
            <button 
              onClick={() => setReportType('projetos')}
              className={reportTabClass('projetos', 'field')}
            >
              <Briefcase className="w-4 h-4" /> Relatório Operacional de Projetos
            </button>
          </div>

          <div className="flex items-center gap-2 bg-zinc-50/70 dark:bg-zinc-900/50 p-1.5 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60">
            <span className="text-xs font-semibold text-zinc-500 pl-2">Período:</span>
            <input
              type="date"
              value={dataInicioFilter}
              onChange={(event) => setDataInicioFilter(event.target.value)}
              className={cn(geoFieldClass, 'h-9 px-2.5 text-xs font-semibold')}
              aria-label="Data inicial"
            />
            <span className="text-xs text-zinc-400">até</span>
            <input
              type="date"
              value={dataFimFilter}
              onChange={(event) => setDataFimFilter(event.target.value)}
              className={cn(geoFieldClass, 'h-9 px-2.5 text-xs font-semibold')}
              aria-label="Data final"
            />
            {(dataInicioFilter || dataFimFilter) && (
              <button
                type="button"
                onClick={() => {
                  setDataInicioFilter('');
                  setDataFimFilter('');
                }}
                className="h-9 rounded-xl px-2.5 text-xs font-semibold text-zinc-500 hover:bg-zinc-200/50 dark:hover:bg-zinc-800"
              >
                Limpar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Relatório Imprimível - Box com design minimalista premium */}
      <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-12 ring-1 ring-zinc-900/5 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.03)] print:shadow-none print:ring-0 print:p-0 max-w-4xl mx-auto">
        
        {/* Cabeçalho do Relatório */}
        <div className="flex justify-between items-start border-b border-zinc-100 dark:border-zinc-800 pb-8 mb-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 uppercase">GeoGestor • Relatório Corporativo</h2>
            <p className="text-sm text-text-secondary mt-1 uppercase tracking-wider">
              Emitido em {new Date().toLocaleDateString()}
              {dataInicioFilter || dataFimFilter ? ` • Período: ${dataInicioFilter || 'Início'} a ${dataFimFilter || 'Atual'}` : ''}
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs uppercase font-bold tracking-widest text-text-secondary block">Tipo do Documento</span>
            <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {reportType === 'financeiro' ? 'Demonstração Financeira' : 'Status Operacional'}
            </span>
          </div>
        </div>

        {loading ? (
          <p className="text-zinc-500 dark:text-zinc-400 py-12 text-center">Carregando dados consolidados...</p>
        ) : (
          <div>
            {reportType === 'financeiro' ? (
              // Relatório Financeiro
              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">1. Resumo de Receitas (Orçamentos)</h3>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-100 dark:border-zinc-800 text-xs font-semibold text-text-secondary uppercase">
                        <th className="pb-3">Status</th>
                        <th className="pb-3 text-right">Qtd</th>
                        <th className="pb-3 text-right">Total Acumulado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50 text-sm text-zinc-600">
                      {stats?.orcamentosStats?.map((item: OrcamentoStat) => (
                        <tr key={item.status}>
                          <td className="py-4 font-medium text-zinc-900 dark:text-zinc-100">{item.status}</td>
                          <td className="py-4 text-right">{item.count}</td>
                          <td className="py-4 text-right">{formatCurrency(item.total)}</td>
                        </tr>
                      ))}
                      {(!stats?.orcamentosStats || stats.orcamentosStats.length === 0) && (
                        <tr>
                          <td colSpan={3} className="py-4 text-center text-zinc-400">Nenhum dado lançado.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">2. Detalhamento de Despesas por Categoria</h3>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-100 dark:border-zinc-800 text-xs font-semibold text-text-secondary uppercase">
                        <th className="pb-3">Categoria</th>
                        <th className="pb-3 text-right">Total Gasto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50 text-sm text-zinc-600">
                      {stats?.despesasPorCategoria?.map((item: DespesaCategoriaStat) => (
                        <tr key={item.categoria}>
                          <td className="py-4 font-medium text-zinc-900 dark:text-zinc-100">{item.categoria}</td>
                          <td className="py-4 text-right text-red-600">-{formatCurrency(item.total)}</td>
                        </tr>
                      ))}
                      {(!stats?.despesasPorCategoria || stats.despesasPorCategoria.length === 0) && (
                        <tr>
                          <td colSpan={2} className="py-4 text-center text-zinc-400">Nenhum custo registrado.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Balanço Geral */}
                <div className="pt-8 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                  <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Balanço / Saúde Geral</span>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-zinc-950 dark:text-white">
                      {formatCurrency(
                        (stats?.orcamentosStats?.reduce((acc: number, curr: OrcamentoStat) => acc + (curr.total || 0), 0) || 0) -
                        (stats?.despesasPorCategoria?.reduce((acc: number, curr: DespesaCategoriaStat) => acc + (curr.total || 0), 0) || 0)
                      )}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              // Relatório Operacional
              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">1. Status dos Projetos</h3>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-100 dark:border-zinc-800 text-xs font-semibold text-text-secondary uppercase">
                        <th className="pb-3">Fase de Andamento</th>
                        <th className="pb-3 text-right">Quantidade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50 text-sm text-zinc-600">
                      {stats?.projetosPorStatus?.map((item: ProjetoStatusStat) => (
                        <tr key={item.status}>
                          <td className="py-4 font-medium text-zinc-900 dark:text-zinc-100">{item.status}</td>
                          <td className="py-4 text-right">{item.count}</td>
                        </tr>
                      ))}
                      {(!stats?.projetosPorStatus || stats.projetosPorStatus.length === 0) && (
                        <tr>
                          <td colSpan={2} className="py-4 text-center text-zinc-400">Nenhum projeto registrado.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="pt-8 border-t border-zinc-100 dark:border-zinc-800 text-center">
                  <p className="text-xs text-text-secondary uppercase tracking-widest font-bold mb-1">Notas Finais</p>
                  <p className="text-sm text-text-muted leading-relaxed max-w-lg mx-auto">
                    Os dados exibidos neste relatório refletem de forma fiel os dados coletados das pastas locais no Windows e inseridos no banco local.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
