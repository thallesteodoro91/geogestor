import { CurrencyDollar, FolderSimple, MagnifyingGlass, PencilSimple, Plus, Receipt, Tag, Trash } from '@phosphor-icons/react';
import { matchesSearch } from '../../utils/searchHelpers';
import { cn } from '../../utils/cn';
import { expenseActionButtonClass, primaryActionIconClass, primarySubmitButtonClass } from '../../utils/actionStyles';
import { CustomSelect } from '../../components/CustomSelect';
import { MetricCard } from '../../components/MetricCard';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Layout } from '../../components/Layout';
import { Modal } from '../../components/Modal';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { CheckboxField, DatePickerField, FormSelect } from '../../components/Form';
import { apiFetch, apiClient } from '../../services/apiClient';
import {
  filterBarClass,
  filterClearButtonClass,
  filterControlClass,
  filterSearchInputClass
} from '../../utils/filterStyles';

const TIPOS_CUSTO = ['Fixo', 'Variavel de campo', 'Cartorio e taxas', 'Tributario', 'Operacional', 'Reembolsavel'];
const CENTROS_CUSTO = ['Administrativo', 'Campo', 'Cartorio', 'Tributos', 'Software', 'Equipamentos', 'Servicos'];

const CATEGORIAS = ['Combustível', 'Cartório', 'Alimentação', 'Equipamento', 'Viagem', 'Impostos', 'Salários', 'Outros'];

export interface DespesaItem {
  id: string;
  projetoId?: string | null;
  projetoNome?: string;
  descricao: string;
  fornecedor?: string | null;
  numeroDocumento?: string | null;
  valor: number;
  data: string;
  dataCompetencia?: string | null;
  dataPagamento?: string | null;
  categoria: string;
  tipoCusto?: string | null;
  centroCusto?: string | null;
  reembolsavel?: boolean | number | null;
  observacoes?: string | null;
  status: string;
  formaPagamento: string;
}

export interface ProjetoMin {
  id: string;
  nome: string;
}

export function Despesas() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [selectedDespesa, setSelectedDespesa] = useState<DespesaItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DespesaItem | null>(null);

  // Form states
  const [projetoId, setProjetoId] = useState('');
  const [descricao, setDescricao] = useState('');
  const [fornecedor, setFornecedor] = useState('');
  const [numeroDocumento, setNumeroDocumento] = useState('');
  const [valor, setValor] = useState('');
  const [data, setData] = useState(new Date().toISOString().split('T')[0]);
  const [dataCompetencia, setDataCompetencia] = useState(new Date().toISOString().split('T')[0]);
  const [dataPagamento, setDataPagamento] = useState('');
  const [categoria, setCategoria] = useState('Combustível');
  const [tipoCusto, setTipoCusto] = useState('Variavel de campo');
  const [centroCusto, setCentroCusto] = useState('Campo');
  const [reembolsavel, setReembolsavel] = useState(false);
  const [observacoes, setObservacoes] = useState('');
  const [status, setStatus] = useState('Pendente');
  const [formaPagamento, setFormaPagamento] = useState('Pix');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState('Todos');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [tipoCustoFilter, setTipoCustoFilter] = useState('Todos');
  const [centroCustoFilter, setCentroCustoFilter] = useState('Todos');
  const [reembolsavelFilter, setReembolsavelFilter] = useState('Todos');
  const [dataInicioFilter, setDataInicioFilter] = useState('');
  const [dataFimFilter, setDataFimFilter] = useState('');

  // Queries
  const { data: despesas = [], isLoading: despesasLoading } = useQuery<DespesaItem[]>({
    queryKey: ['despesas'],
    queryFn: () => apiClient.get<DespesaItem[]>('/api/financeiro/despesas')
  });

  const { data: projetos = [], isLoading: projetosLoading } = useQuery<ProjetoMin[]>({
    queryKey: ['projetos'],
    queryFn: () => apiClient.get<ProjetoMin[]>('/api/projetos')
  });

  const loading = despesasLoading || projetosLoading;

  const filteredDespesas = despesas.filter((desp) => {
    const linkedProj = projetos.find((p) => p.id === desp.projetoId);
    const searchable = [
      desp.descricao,
      desp.fornecedor,
      desp.numeroDocumento,
      desp.categoria,
      desp.tipoCusto,
      desp.centroCusto,
      desp.status,
      desp.formaPagamento,
      desp.observacoes,
      desp.projetoNome,
      linkedProj?.nome
    ].filter(Boolean).join(' ');
    const matchesSearchTerm = matchesSearch(searchable, searchTerm);
    const matchesCategoria = categoriaFilter === 'Todos' || desp.categoria === categoriaFilter;
    const matchesStatus = statusFilter === 'Todos' || desp.status === statusFilter;
    const matchesTipoCusto = tipoCustoFilter === 'Todos' || desp.tipoCusto === tipoCustoFilter;
    const matchesCentroCusto = centroCustoFilter === 'Todos' || desp.centroCusto === centroCustoFilter;
    const isReembolsavel = Boolean(desp.reembolsavel);
    const matchesReembolsavel =
      reembolsavelFilter === 'Todos' ||
      (reembolsavelFilter === 'Sim' && isReembolsavel) ||
      (reembolsavelFilter === 'Nao' && !isReembolsavel);
    const matchesStart = !dataInicioFilter || (desp.data && desp.data >= dataInicioFilter);
    const matchesEnd = !dataFimFilter || (desp.data && desp.data <= dataFimFilter);
    return matchesSearchTerm && matchesCategoria && matchesStatus && matchesTipoCusto && matchesCentroCusto && matchesReembolsavel && matchesStart && matchesEnd;
  });
  const hasExpenseFilters = Boolean(
    searchTerm ||
    categoriaFilter !== 'Todos' ||
    statusFilter !== 'Todos' ||
    tipoCustoFilter !== 'Todos' ||
    centroCustoFilter !== 'Todos' ||
    reembolsavelFilter !== 'Todos' ||
    dataInicioFilter ||
    dataFimFilter
  );

  // Stats calculation
  const totalDespesas = filteredDespesas.reduce((acc: number, curr) => acc + curr.valor, 0);
  const despesasPagas = filteredDespesas.filter((d) => d.status === 'Pago').reduce((acc: number, curr) => acc + curr.valor, 0);
  const despesasPendentes = filteredDespesas.filter((d) => d.status !== 'Pago').reduce((acc: number, curr) => acc + curr.valor, 0);

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/financeiro/despesas/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao excluir despesa');
    },
    onSuccess: () => {
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['despesas'] });
      queryClient.invalidateQueries({ queryKey: ['dre-financeiro'] });
    },
    onError: () => {
      alert('Erro ao excluir despesa');
    }
  });

  const submitMutation = useMutation({
    mutationFn: async (payload: Omit<DespesaItem, 'id'>) => {
      const url = selectedDespesa 
        ? `/api/financeiro/despesas/${selectedDespesa.id}` 
        : '/api/financeiro/despesas';
      const method = selectedDespesa ? 'PATCH' : 'POST';
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || 'Erro ao salvar despesa');
      }
      return res.json();
    },
    onSuccess: () => {
      setShowModal(false);
      queryClient.invalidateQueries({ queryKey: ['despesas'] });
      queryClient.invalidateQueries({ queryKey: ['dre-financeiro'] });
    },
    onError: (err) => {
      alert(err instanceof Error ? err.message : 'Erro ao salvar despesa.');
    }
  });

  // Actions
  const openCreateModal = () => {
    setSelectedDespesa(null);
    setDespProjetoId('');
    setDescricao('');
    setFornecedor('');
    setNumeroDocumento('');
    setValor('');
    setData(new Date().toISOString().split('T')[0]);
    setDataCompetencia(new Date().toISOString().split('T')[0]);
    setDataPagamento('');
    setCategoria('Combustível');
    setTipoCusto('Variavel de campo');
    setCentroCusto('Campo');
    setReembolsavel(false);
    setObservacoes('');
    setStatus('Pendente');
    setFormaPagamento('Pix');
    setShowModal(true);
  };

  const openEditModal = (desp: DespesaItem) => {
    setSelectedDespesa(desp);
    setDespProjetoId(desp.projetoId || '');
    setDescricao(desp.descricao || '');
    setFornecedor(desp.fornecedor || '');
    setNumeroDocumento(desp.numeroDocumento || '');
    setValor((desp.valor / 100).toString());
    setData(desp.data || '');
    setDataCompetencia(desp.dataCompetencia || desp.data || '');
    setDataPagamento(desp.dataPagamento || '');
    setCategoria(desp.categoria || 'Combustível');
    setTipoCusto(desp.tipoCusto || 'Operacional');
    setCentroCusto(desp.centroCusto || 'Administrativo');
    setReembolsavel(Boolean(desp.reembolsavel));
    setObservacoes(desp.observacoes || '');
    setStatus(desp.status || 'Pendente');
    setFormaPagamento(desp.formaPagamento || 'Pix');
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    setDeleteTarget(despesas.find((despesa) => despesa.id === id) ?? null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      projetoId: projetoId || null,
      descricao,
      fornecedor: fornecedor || null,
      numeroDocumento: numeroDocumento || null,
      valor: Math.round((parseFloat(valor || "0") || 0) * 100),
      data,
      dataCompetencia: dataCompetencia || data,
      dataPagamento: dataPagamento || null,
      categoria,
      tipoCusto,
      centroCusto,
      reembolsavel,
      observacoes: observacoes || null,
      status,
      formaPagamento
    };

    // Validation
    const schema = z.object({
      descricao: z.string().min(1, 'Descrição é obrigatória'),
      valor: z.number().min(1, 'Valor inválido'),
      data: z.string().min(1, 'Selecione uma data')
    });

    const validation = schema.safeParse(payload);
    if (!validation.success) {
      alert(validation.error.issues[0].message);
      return;
    }

    submitMutation.mutate(payload);
  };

  const setDespProjetoId = (id: string) => {
    setProjetoId(id);
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
  };

  const getStatusColor = (status: string) => {
    return status === 'Pago' 
      ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10'
      : 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/10';
  };

  return (
    <Layout>
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
        <div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs uppercase tracking-[0.2em] font-medium bg-zinc-100 text-zinc-500 dark:text-zinc-400 mb-4">
            Gestão Financeira
          </span>
          <h1 className="text-5xl font-semibold tracking-tighter text-zinc-950 dark:text-white">
            Despesas
          </h1>
          <p className="mt-3 text-lg text-zinc-500 dark:text-zinc-400 font-medium">
            Controle de despesas, custos operacionais e reembolsos vinculados.
          </p>
        </div>
        
        <button 
          onClick={openCreateModal}
          className={cn(expenseActionButtonClass, 'font-medium')}
        >
          <span>Nova Despesa</span>
          <div className={primaryActionIconClass}>
            <Plus weight="bold" className="w-4 h-4" />
          </div>
        </button>
      </div>

      {/* Bento Grid Cards stats */}
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard label="Total Despesas" value={formatCurrency(totalDespesas)} tone="danger" icon={<CurrencyDollar weight="duotone" className="h-5 w-5" />} />
        <MetricCard label="Total Pago" value={formatCurrency(despesasPagas)} tone="danger" delay={0.05} icon={<CurrencyDollar weight="duotone" className="h-5 w-5" />} />
        <MetricCard label="Pendente" value={formatCurrency(despesasPendentes)} tone="danger" delay={0.1} icon={<CurrencyDollar weight="duotone" className="h-5 w-5" />} />
      </div>

      <div className={cn('mb-6', filterBarClass)}>
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-[minmax(280px,1.4fr)_repeat(7,minmax(126px,0.7fr))_auto] items-center">
          <div className="relative">
            <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por descrição, fornecedor, documento, projeto ou forma..."
              className={filterSearchInputClass}
            />
          </div>
          <CustomSelect
            value={categoriaFilter}
            onChange={setCategoriaFilter}
            placeholder="Todas as categorias"
            className="min-w-0"
            options={[{ label: 'Todas as categorias', value: 'Todos' }, ...CATEGORIAS.map((value) => ({ label: value, value }))]}
          />
          <CustomSelect
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder="Todos os status"
            className="min-w-0"
            options={['Todos', 'Pendente', 'Pago', 'Atrasado'].map((value) => ({ label: value === 'Todos' ? 'Todos os status' : value, value }))}
          />
          <CustomSelect
            value={tipoCustoFilter}
            onChange={setTipoCustoFilter}
            placeholder="Todos os tipos"
            className="min-w-0"
            options={[{ label: 'Todos os tipos', value: 'Todos' }, ...TIPOS_CUSTO.map((value) => ({ label: value, value }))]}
          />
          <CustomSelect
            value={centroCustoFilter}
            onChange={setCentroCustoFilter}
            placeholder="Todos os centros"
            className="min-w-0"
            options={[{ label: 'Todos os centros', value: 'Todos' }, ...CENTROS_CUSTO.map((value) => ({ label: value, value }))]}
          />
          <CustomSelect
            value={reembolsavelFilter}
            onChange={setReembolsavelFilter}
            placeholder="Reembolso"
            className="min-w-0"
            options={[
              { label: 'Reembolso', value: 'Todos' },
              { label: 'Reembolsável', value: 'Sim' },
              { label: 'Não reembolsável', value: 'Nao' }
            ]}
          />
          <DatePickerField
            value={dataInicioFilter}
            onChange={(event) => setDataInicioFilter(event.target.value)}
            className={filterControlClass}
            aria-label="Data inicial"
          />
          <DatePickerField
            value={dataFimFilter}
            onChange={(event) => setDataFimFilter(event.target.value)}
            className={filterControlClass}
            aria-label="Data final"
          />
          {hasExpenseFilters && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setCategoriaFilter('Todos');
                setStatusFilter('Todos');
                setTipoCustoFilter('Todos');
                setCentroCustoFilter('Todos');
                setReembolsavelFilter('Todos');
                setDataInicioFilter('');
                setDataFimFilter('');
              }}
              className={filterClearButtonClass}
            >
              Limpar
            </button>
          )}
        </div>
        <p className="mt-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          {filteredDespesas.length} de {despesas.length} despesa(s) exibidas
        </p>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="py-24 flex justify-center">
            <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-8 h-8 rounded-full border-2 border-zinc-200 dark:border-zinc-800 border-t-zinc-900 animate-spin" />
          </div>
        ) : despesas.length === 0 ? (
          <div className="bg-transparent border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-[2rem] p-20 flex flex-col items-center justify-center text-center">
            <Receipt weight="duotone" className="w-16 h-16 text-zinc-300 mb-4" />
            <p className="text-zinc-500 dark:text-zinc-400 text-lg font-medium">Nenhuma despesa cadastrada ainda.</p>
          </div>
        ) : filteredDespesas.length === 0 ? (
          <div className="bg-transparent border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-[2rem] p-16 flex flex-col items-center justify-center text-center">
            <MagnifyingGlass className="w-12 h-12 text-zinc-300 mb-4" />
            <p className="text-zinc-500 dark:text-zinc-400 text-lg font-medium">Nenhuma despesa encontrada com os filtros atuais.</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-zinc-900 rounded-[2rem] shadow-[0_10px_30px_rgba(0,0,0,0.01)] ring-1 ring-zinc-900/5 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">Data</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">Descrição</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">Categoria</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">Projeto</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">Valor</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-zinc-400 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredDespesas.map((desp) => {
                  const linkedProj = projetos.find((p) => p.id === desp.projetoId);
                  return (
                    <tr key={desp.id} className="hover:bg-zinc-50/40 transition-colors">
                      <td className="px-6 py-4 text-sm text-zinc-500 dark:text-zinc-400">
                        {new Date(desp.data).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-zinc-900 dark:text-zinc-100">{desp.descricao}</div>
                        {desp.observacoes && <div className="text-xs text-zinc-400 truncate max-w-[200px]" title={desp.observacoes}>{desp.observacoes}</div>}
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-500 dark:text-zinc-400">
                        <span className="flex items-center gap-1.5">
                          <Tag weight="bold" className="w-3.5 h-3.5 text-zinc-400" />
                          {desp.categoria}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-500 dark:text-zinc-400">
                        {linkedProj ? (
                          <span className="flex items-center gap-1.5 text-zinc-700">
                            <FolderSimple weight="bold" className="w-4 h-4 text-zinc-400" />
                            {linkedProj.nome}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold tracking-wider uppercase ${getStatusColor(desp.status)}`}>
                          {desp.status || 'Pendente'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-zinc-950 dark:text-white">
                        {formatCurrency(desp.valor)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button 
                            onClick={() => openEditModal(desp)}
                            className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 transition-all shadow-sm"
                            title="Editar Despesa"
                          >
                            <PencilSimple className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(desp.id)}
                            className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200/80 dark:border-red-800/60 flex items-center justify-center text-red-600 dark:text-red-400 hover:bg-red-100 transition-all shadow-sm"
                            title="Excluir Despesa"
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal structure */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={selectedDespesa ? 'Editar Despesa' : 'Nova Despesa'}
        maxWidth="max-w-5xl"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="despesa-desc" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Descrição *</label>
            <input 
              id="despesa-desc"
              type="text" 
              required 
              value={descricao} 
              onChange={e => setDescricao(e.target.value)} 
              placeholder="Ex: Combustível viagem de campo" 
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-400 transition-all font-medium" 
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label htmlFor="despesa-fornecedor" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Fornecedor</label>
              <input
                id="despesa-fornecedor"
                type="text"
                value={fornecedor}
                onChange={e => setFornecedor(e.target.value)}
                placeholder="Cartorio, prefeitura, posto..."
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-400 transition-all font-medium"
              />
            </div>
            <div>
              <label htmlFor="despesa-numero-documento" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Documento / comprovante</label>
              <input
                id="despesa-numero-documento"
                type="text"
                value={numeroDocumento}
                onChange={e => setNumeroDocumento(e.target.value)}
                placeholder="NF, recibo, guia ou protocolo"
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-400 transition-all font-medium"
              />
            </div>
            <div>
              <label htmlFor="despesa-valor" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Valor (R$) *</label>
              <input 
                id="despesa-valor"
                type="number" 
                step="0.01" 
                required 
                value={valor} 
                onChange={e => setValor(e.target.value)} 
                placeholder="0.00" 
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-400 transition-all font-medium" 
              />
            </div>
            <div>
              <label htmlFor="despesa-data" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Data *</label>
              <DatePickerField
                id="despesa-data"
                required 
                value={data} 
                onChange={e => setData(e.target.value)} 
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-400 transition-all font-medium" 
              />
            </div>
            <div>
              <label htmlFor="despesa-competencia" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Competencia</label>
              <DatePickerField
                id="despesa-competencia"
                value={dataCompetencia}
                onChange={e => setDataCompetencia(e.target.value)}
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-400 transition-all font-medium"
              />
            </div>
            <div>
              <label htmlFor="despesa-data-pagamento" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Data de pagamento</label>
              <DatePickerField
                id="despesa-data-pagamento"
                value={dataPagamento}
                onChange={e => setDataPagamento(e.target.value)}
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-400 transition-all font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label htmlFor="despesa-categoria" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Categoria</label>
              <FormSelect
                id="despesa-categoria"
                value={categoria} 
                onChange={e => setCategoria(e.target.value)} 
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-400 transition-all font-medium appearance-none"
              >
                {CATEGORIAS.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </FormSelect>
            </div>
            <div>
              <label htmlFor="despesa-projeto" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Projeto Vinculado</label>
              <FormSelect
                id="despesa-projeto"
                value={projetoId} 
                onChange={e => setProjetoId(e.target.value)} 
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-400 transition-all font-medium appearance-none"
              >
                <option value="">Nenhum</option>
                {projetos.map((proj) => (
                  <option key={proj.id} value={proj.id}>{proj.nome}</option>
                ))}
              </FormSelect>
            </div>
            <div>
              <label htmlFor="despesa-tipo-custo" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Tipo de custo</label>
              <FormSelect
                id="despesa-tipo-custo"
                value={tipoCusto}
                onChange={e => setTipoCusto(e.target.value)}
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-400 transition-all font-medium appearance-none"
              >
                {TIPOS_CUSTO.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
              </FormSelect>
            </div>
            <div>
              <label htmlFor="despesa-centro-custo" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Centro de custo</label>
              <FormSelect
                id="despesa-centro-custo"
                value={centroCusto}
                onChange={e => setCentroCusto(e.target.value)}
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-400 transition-all font-medium appearance-none"
              >
                {CENTROS_CUSTO.map((centro) => <option key={centro} value={centro}>{centro}</option>)}
              </FormSelect>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label htmlFor="despesa-status" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Status Pagamento</label>
              <FormSelect
                id="despesa-status"
                value={status} 
                onChange={e => setStatus(e.target.value)} 
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-400 transition-all font-medium appearance-none"
              >
                <option value="Pendente">Pendente</option>
                <option value="Pago">Pago</option>
                <option value="Atrasado">Atrasado</option>
              </FormSelect>
            </div>
            <div>
              <label htmlFor="despesa-forma" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Forma de Pagamento</label>
              <FormSelect
                id="despesa-forma"
                value={formaPagamento} 
                onChange={e => setFormaPagamento(e.target.value)} 
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-400 transition-all font-medium appearance-none"
              >
                <option value="Pix">Pix</option>
                <option value="Dinheiro">Dinheiro</option>
                <option value="Cartão de Crédito">Cartão de Crédito</option>
                <option value="Boleto">Boleto</option>
                <option value="Transferência">Transferência Bancária</option>
              </FormSelect>
            </div>
          </div>

          <CheckboxField id="despesa-reembolsavel" label="Despesa reembolsável pelo cliente" checked={reembolsavel} onChange={setReembolsavel} className="rounded-xl border border-emerald-200 bg-emerald-50/70 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200" />

          <div>
            <label htmlFor="despesa-obs" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Observações</label>
            <textarea 
              id="despesa-obs"
              value={observacoes} 
              onChange={e => setObservacoes(e.target.value)} 
              placeholder="Adicione notas adicionais sobre a despesa..." 
              rows={3} 
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-400 transition-all resize-none font-medium leading-relaxed" 
            />
          </div>

          <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-3">
            <button 
              type="button" 
              onClick={() => setShowModal(false)} 
              className="px-6 py-3 rounded-full text-zinc-500 dark:text-zinc-400 font-semibold hover:text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={submitMutation.isPending}
              className={cn(primarySubmitButtonClass, 'px-6 py-3')}
            >
              {selectedDespesa ? 'Salvar Despesa' : 'Cadastrar'}
            </button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); }}
        title={`Excluir despesa${deleteTarget?.descricao ? ` “${deleteTarget.descricao}”` : ''}?`}
        description="A despesa será removida e os totais financeiros e indicadores da DRE serão recalculados. Os vínculos com projeto e cliente serão preservados. Esta ação não pode ser desfeita."
        confirmText="Excluir despesa"
        loading={deleteMutation.isPending}
      />
    </Layout>
  );
}
