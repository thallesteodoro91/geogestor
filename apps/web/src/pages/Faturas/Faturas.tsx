import { DatePickerField } from '../../components/Form';
import { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Modal } from '../../components/Modal';
import { Check, Printer, MagnifyingGlass } from '@phosphor-icons/react';
import { matchesSearch } from '../../utils/searchHelpers';
import { cn } from '../../utils/cn';
import { apiFetch, apiClient } from '../../services/apiClient';
import {
  geoGreenLabelClass,
  geoGreenSurfaceClass,
  geoGreenValueClass,
  geoOrangeLabelClass,
  geoOrangeSurfaceClass,
  geoOrangeValueClass,
  geoPurpleLabelClass,
  geoPurpleSurfaceClass,
  geoPurpleValueClass
} from '../../utils/geoTheme';

interface Parcela {
  id: string;
  orcamentoId: string;
  orcamentoDescricao?: string;
  clienteNome: string;
  clienteId: string;
  numeroParcela: number;
  totalParcelas: number;
  valor: number; // in cents
  dataVencimento: string;
  statusPagamento: string;
}

export function Faturas() {
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pendentes' | 'recebidas'>('pendentes');
  const [selectedFatura, setSelectedFatura] = useState<Parcela | null>(null);
  const [search, setSearch] = useState('');
  const [dataInicioFilter, setDataInicioFilter] = useState('');
  const [dataFimFilter, setDataFimFilter] = useState('');

  const fetchDados = () => {
    Promise.resolve().then(() => {
      setLoading(true);
    });
    apiClient.get<Parcela[]>('/api/financeiro/parcelas')
      .then(data => {
        setParcelas(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchDados();
  }, []);

  const handleMarcarComoPago = async (id: string) => {
    try {
      const res = await apiFetch(`/api/financeiro/parcelas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statusPagamento: 'Pago' })
      });
      if (res.ok) {
        fetchDados();
        if (selectedFatura?.id === id) {
          setSelectedFatura(null);
        }
      } else {
        const errorData = await res.json().catch(() => null);
        alert(errorData?.error || 'Erro ao processar pagamento.');
      }
    } catch {
      alert('Erro de conexão ao processar pagamento.');
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
  };

  const getFaturaStatus = (item: Parcela) => {
    if (item.statusPagamento === 'Pago') return 'Pago';
    const venc = new Date(item.dataVencimento);
    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    return venc < hoje ? 'Atrasado' : 'Pendente';
  };

  // Calcular estatísticas
  const faturamentoTotal = parcelas.reduce((acc, curr) => acc + curr.valor, 0);
  const totalRecebido = parcelas.filter(p => p.statusPagamento === 'Pago').reduce((acc, curr) => acc + curr.valor, 0);
  const totalAtrasado = parcelas.filter(p => {
    return p.statusPagamento === 'Pendente' && new Date(p.dataVencimento) < new Date();
  }).reduce((acc, curr) => acc + curr.valor, 0);
  const totalPendente = faturamentoTotal - totalRecebido - totalAtrasado;

  // Filtrar parcelas
  const filteredParcelas = parcelas.filter(p => {
    const status = getFaturaStatus(p);
    const matchesTab = activeTab === 'pendentes' ? status !== 'Pago' : status === 'Pago';
    const matchesSearchTerm = matchesSearch(p.clienteNome, search) || 
                              matchesSearch(p.orcamentoDescricao, search);
    const matchesStart = !dataInicioFilter || p.dataVencimento >= dataInicioFilter;
    const matchesEnd = !dataFimFilter || p.dataVencimento <= dataFimFilter;
    return matchesTab && matchesSearchTerm && matchesStart && matchesEnd;
  });
  const hasInvoiceFilters = Boolean(search || dataInicioFilter || dataFimFilter);

  return (
    <Layout>
      {/* Esconder layout principal durante a impressão */}
      <div className="print:hidden">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs uppercase tracking-[0.2em] font-medium bg-zinc-100 text-zinc-500 dark:text-zinc-400 mb-4">
              Faturamento
            </span>
            <h1 className="text-5xl font-semibold tracking-tighter text-zinc-950 dark:text-white">
              Controle de Faturas
            </h1>
            <p className="mt-3 text-lg text-zinc-500 dark:text-zinc-400 font-medium">
              Gerencie parcelas de serviços, recibos e recebimentos de clientes.
            </p>
          </div>
        </div>

        {/* Stats Bento Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <div className={cn(geoGreenSurfaceClass, 'rounded-[2rem] p-6 ring-1 ring-emerald-300/15 shadow-sm')}>
            <span className={cn('text-xs font-semibold uppercase tracking-wider', geoGreenLabelClass)}>Total Faturado</span>
            <p className={cn('mt-2 text-3xl font-bold', geoGreenValueClass)}>{formatCurrency(faturamentoTotal)}</p>
          </div>
          <div className={cn(geoGreenSurfaceClass, 'rounded-[2rem] p-6 ring-1 ring-emerald-300/15 shadow-sm')}>
            <span className={cn('text-xs font-semibold uppercase tracking-wider', geoGreenLabelClass)}>Total Recebido</span>
            <p className={cn('mt-2 text-3xl font-bold', geoGreenValueClass)}>{formatCurrency(totalRecebido)}</p>
          </div>
          <div className={cn(geoOrangeSurfaceClass, 'rounded-[2rem] p-6 ring-1 ring-orange-300/15 shadow-sm')}>
            <span className={cn('text-xs font-semibold uppercase tracking-wider', geoOrangeLabelClass)}>Pendente (A Vencer)</span>
            <p className={cn('mt-2 text-3xl font-bold', geoOrangeValueClass)}>{formatCurrency(totalPendente)}</p>
          </div>
          <div className={cn(geoPurpleSurfaceClass, 'rounded-[2rem] p-6 ring-1 ring-violet-300/15 shadow-sm')}>
            <span className={cn('text-xs font-semibold uppercase tracking-wider', geoPurpleLabelClass)}>Total Atrasado</span>
            <p className={cn('mt-2 text-3xl font-bold', geoPurpleValueClass)}>{formatCurrency(totalAtrasado)}</p>
          </div>
        </div>

        {/* Filtros Globais (Acima das abas) */}
        <div className="mb-6 rounded-[1.5rem] border border-zinc-200/70 bg-white/85 py-3 px-5 shadow-sm ring-1 ring-zinc-950/[0.03] backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/75">
          <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-[minmax(260px,1.4fr)_repeat(2,minmax(150px,0.7fr))_auto] items-center">
            <div className="relative">
              <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input 
                type="text" 
                placeholder="Buscar por cliente ou orçamento..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-9 w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 text-xs font-semibold text-zinc-700 outline-none transition-all placeholder:text-zinc-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/10 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>
            <DatePickerField
              value={dataInicioFilter}
              onChange={(event) => setDataInicioFilter(event.target.value)}
              className="h-9 rounded-xl border border-zinc-200 bg-white px-2.5 text-xs font-semibold text-zinc-700 outline-none transition-all focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/10 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              aria-label="Vencimento inicial"
            />
            <DatePickerField
              value={dataFimFilter}
              onChange={(event) => setDataFimFilter(event.target.value)}
              className="h-9 rounded-xl border border-zinc-200 bg-white px-2.5 text-xs font-semibold text-zinc-700 outline-none transition-all focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/10 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              aria-label="Vencimento final"
            />
            {hasInvoiceFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setDataInicioFilter('');
                  setDataFimFilter('');
                }}
                className="h-9 rounded-xl border border-zinc-200 px-3 text-xs font-semibold text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-950 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-950 dark:hover:text-white"
              >
                Limpar
              </button>
            )}
          </div>
          <p className="mt-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            {filteredParcelas.length} de {parcelas.length} fatura(s) exibidas
          </p>
        </div>

        {/* Abas de Navegação (Abaixo dos filtros) */}
        <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800 mb-8 overflow-x-auto hide-scrollbar">
          <button 
            onClick={() => setActiveTab('pendentes')}
            className={`px-6 py-3 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'pendentes' 
                ? 'border-zinc-950 text-zinc-950 dark:text-white' 
                : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            Faturas em Aberto
          </button>
          <button 
            onClick={() => setActiveTab('recebidas')}
            className={`px-6 py-3 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'recebidas' 
                ? 'border-zinc-950 text-zinc-950 dark:text-white' 
                : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            Histórico Recebido
          </button>
        </div>

        {/* Faturas list */}
        <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 ring-1 ring-zinc-900/5 shadow-sm">
          {loading ? (
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">Carregando faturas...</p>
          ) : filteredParcelas.length === 0 ? (
            <p className="text-zinc-400 text-sm">Nenhuma fatura encontrada.</p>
          ) : (
            <div className="divide-y divide-zinc-50">
              {filteredParcelas.map(item => {
                const status = getFaturaStatus(item);
                return (
                  <div key={item.id} className="py-5 flex items-center justify-between gap-6 hover:bg-zinc-50/50 dark:bg-zinc-900/50 px-4 rounded-2xl transition-colors">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3 mb-1.5">
                        <span className={`text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          status === 'Pago' ? 'bg-emerald-50 text-emerald-700' :
                          status === 'Atrasado' ? 'bg-red-50 text-red-700 animate-pulse' :
                          'bg-amber-50 text-amber-700'
                        }`}>
                          {status}
                        </span>
                        <span className="text-xs text-zinc-400">Vencimento: {new Date(item.dataVencimento).toLocaleDateString()}</span>
                      </div>
                      <p className="font-semibold text-zinc-950 dark:text-white truncate">{item.clienteNome}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{item.orcamentoDescricao || 'Sem descrição do orçamento'}</p>
                    </div>

                    <div className="flex items-center gap-4">
                      <p className="font-bold text-zinc-900 dark:text-zinc-100 text-lg">{formatCurrency(item.valor)}</p>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setSelectedFatura(item)}
                          className="px-3 py-2 bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100 rounded-xl text-xs font-semibold text-zinc-700 active:scale-[0.97]"
                        >
                          Ver Recibo
                        </button>
                        {status !== 'Pago' && (
                          <button 
                            onClick={() => handleMarcarComoPago(item.id)}
                            className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center hover:bg-emerald-100 active:scale-[0.97]"
                            title="Confirmar Recebimento"
                          >
                            <Check weight="bold" className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={!!selectedFatura}
        onClose={() => setSelectedFatura(null)}
        title="GeoGestor • Fatura / Recibo"
        maxWidth="max-w-2xl"
      >
        {selectedFatura && (
          <div className="flex flex-col justify-between h-full">
            {/* Cabeçalho da Fatura - Emitido data */}
            <div className="border-b border-zinc-100 dark:border-zinc-800 pb-6 mb-6">
              <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Emitido em: {new Date().toLocaleDateString()}</p>
            </div>

            {/* Info Cliente */}
            <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
              <div>
                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">Destinatário</span>
                <p className="font-bold text-zinc-900 dark:text-zinc-100">{selectedFatura.clienteNome}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">ID do Cliente: {selectedFatura.clienteId}</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">Vencimento</span>
                <p className="font-semibold text-zinc-900 dark:text-zinc-100">{new Date(selectedFatura.dataVencimento).toLocaleDateString()}</p>
                <span className={`inline-block mt-2 text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  selectedFatura.statusPagamento === 'Pago' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                }`}>
                  {selectedFatura.statusPagamento}
                </span>
              </div>
            </div>

            {/* Detalhes do Serviço */}
            <div className="bg-zinc-50 dark:bg-zinc-950 rounded-2xl p-6 mb-8 print:bg-white dark:bg-zinc-900 print:border print:border-zinc-200 dark:border-zinc-800">
              <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-2">Descrição dos Serviços</span>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">{selectedFatura.orcamentoDescricao || 'Serviços topográficos e consultoria de licenciamento ambiental'}</p>
              
              <div className="flex justify-between items-center pt-4 border-t border-zinc-200/60 text-sm">
                <span className="text-zinc-500 dark:text-zinc-400">Parcela de Orçamento (Ref: #{selectedFatura.orcamentoId.substring(0, 8)})</span>
                <span className="font-bold text-zinc-900 dark:text-zinc-100">{formatCurrency(selectedFatura.valor)}</span>
              </div>
            </div>

            {/* Botões / Rodapé */}
            <div className="flex items-center justify-between pt-6 border-t border-zinc-100 dark:border-zinc-800 print:hidden">
              <button 
                onClick={() => window.print()}
                className="flex items-center gap-2 bg-zinc-900 text-white rounded-full px-5 py-3 text-xs font-semibold hover:bg-zinc-800"
              >
                <Printer className="w-4 h-4" /> Imprimir Recibo
              </button>
              
              {selectedFatura.statusPagamento !== 'Pago' && (
                <button 
                  onClick={() => handleMarcarComoPago(selectedFatura.id)}
                  className="bg-emerald-600 text-white rounded-full px-5 py-3 text-xs font-semibold hover:bg-emerald-500"
                >
                  Marcar como Pago
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  );
}
