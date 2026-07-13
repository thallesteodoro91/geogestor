import { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { z } from 'zod';
import { Layout } from '../../components/Layout';
import { Modal } from '../../components/Modal';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, PencilSimple, Trash, FilePdf, FileText, Target, TrendUp, CurrencyDollar, MagnifyingGlass, Receipt, Info, Percent, ShieldCheck, MapPin, Tag } from '@phosphor-icons/react';
import { matchesSearch } from '../../utils/searchHelpers';
import { cn } from '../../utils/cn';
import { primaryActionButtonClass, primaryActionIconClass, primarySubmitButtonClass, secondarySmallActionButtonClass } from '../../utils/actionStyles';
import { CustomSelect } from '../../components/CustomSelect';
import { MetricCard } from '../../components/MetricCard';
import { geoFieldClass, geoKickerClass, geoPurpleSurfaceClass } from '../../utils/geoTheme';
import { apiClient } from '../../services/apiClient';
import {
  filterBarClass,
  filterClearButtonClass,
  filterControlClass,
  filterSearchInputClass
} from '../../utils/filterStyles';

interface ClienteMin {
  id: string;
  nome: string;
}

interface ProjetoMin {
  id: string;
  nome: string;
  clienteId?: string | null;
}

interface OrcamentoServicoItem {
  quantidade?: number | string;
  descricao?: string;
  valorUnitario?: number | string;
  descontoPct?: number | string;
  total?: number | string;
}

interface OrcamentoDespesaItem {
  descricao?: string;
  valor?: number | string;
}

interface OrcamentoItem {
  id: string;
  clienteId: string;
  clienteNome?: string;
  projetoId?: string | null;
  projetoNome?: string | null;
  status: string;
  valorTotal: number;
  descricao?: string | null;
  anotacoes?: string | null;
  formaDePagamento?: string | null;
  desconto?: number | null;
  codigoOrcamento?: string | null;
  dataOrcamento?: string | null;
  itensJson?: string | OrcamentoServicoItem[];
  possuiMarco?: boolean;
  marcoQtd?: number | null;
  marcoValor?: number | null;
  possuiImposto?: boolean;
  impostoPorcentagem?: number | null;
  titulo?: string | null;
  validadeDias?: number | string | null;
  condicoesPagamento?: string | null;
  possuiArt?: boolean | number;
  artValor?: number | null;
  despesasJson?: string | Record<string, unknown>[];
  itens?: OrcamentoServicoItem[];
  despesas?: OrcamentoDespesaItem[];
}

const orcamentoFieldClass = cn(geoFieldClass, 'h-9 w-full px-3 text-xs font-medium text-text-primary');
const orcamentoTextareaClass = cn(geoFieldClass, 'w-full resize-none px-4 py-2.5 text-xs font-medium text-text-primary');
const orcamentoPanelClass = 'geo-card space-y-4 p-4';
const orcamentoDarkFieldClass =
  'geo-focus-ring w-full rounded-lg border border-brand-primary-300/15 bg-brand-primary-900/40 px-2 py-1 text-xs font-bold text-white outline-none transition-[border-color,box-shadow] focus:border-brand-primary-300 focus:ring-2 focus:ring-brand-primary-400/20';
const orcamentoIconButtonClass =
  'geo-focus-ring inline-flex items-center justify-center rounded-full border p-2 shadow-sm transition-[background-color,color,border-color,transform] active:scale-95';

const parseOrcamentoList = <T,>(value: unknown): T[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value as T[];
  if (typeof value !== 'string') return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
};

const parseDecimal = (value: string | number | undefined) => {
  if (typeof value === 'number') return value;
  return parseFloat(value || '0') || 0;
};

const centsToCurrencyInput = (value: string | number | undefined) => {
  const cents = parseDecimal(value);
  return (cents / 100).toString();
};

export function Orcamentos() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const handledRouteActionRef = useRef(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedOrcamento, setSelectedOrcamento] = useState<OrcamentoItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [formaFilter, setFormaFilter] = useState('Todos');
  const [dataInicioFilter, setDataInicioFilter] = useState('');
  const [dataFimFilter, setDataFimFilter] = useState('');

  // Form states
  const [clienteId, setClienteId] = useState('');
  const [projetoId, setProjetoId] = useState('');
  const [status, setStatus] = useState('Em Análise');
  const [descricao, setDescricao] = useState('');
  const [anotacoes, setAnotacoes] = useState('');
  const [formaDePagamento, setFormaPagamento] = useState('');
  const [, setDesconto] = useState('');
  const [codigoOrcamento, setCodigoOrcamento] = useState('');
  const [dataOrcamento, setDataOrcamento] = useState('');
  const [titulo, setTitulo] = useState('');
  const [validadeDias, setValidadeDias] = useState('15');
  const [condicoesPagamento, setCondicoesPagamento] = useState('50% na aprovação + 50% na entrega técnica');
  
  // Custom Service Items
  const [items, setItems] = useState<Array<{
    quantidade: string;
    descricao: string;
    valorUnitario: string;
    descontoPct: string;
  }>>([]);

  // Ge geodesic marker fields
  const [possuiMarco, setPossuiMarco] = useState(false);
  const [marcoQtd, setMarcoQtd] = useState('');
  const [marcoValor, setMarcoValor] = useState('');

  // Tax fields
  const [possuiImposto, setPossuiImposto] = useState(false);
  const [impostoPorcentagem, setImpostoPorcentagem] = useState('');

  // ART fields (Custo Interno)
  const [possuiArt, setPossuiArt] = useState(false);
  const [artValor, setArtValor] = useState('150');

  // Desconto Global (%)
  const [descontoGlobalPct, setDescontoGlobalPct] = useState('0');

  // Despesas Internas (Custos Operacionais)
  const [despesasInternas, setDespesasInternas] = useState<Array<{ descricao: string; valor: string }>>([]);

  // Live calculations & Gerencial metrics
  const getFinanceiroResumo = () => {
    const receitaBrutaServicos = items.reduce((acc, item) => {
      const qty = parseFloat(item.quantidade) || 0;
      const unitVal = parseFloat(item.valorUnitario) || 0;
      return acc + (qty * unitVal);
    }, 0);

    const descontoItens = items.reduce((acc, item) => {
      const qty = parseFloat(item.quantidade) || 0;
      const unitVal = parseFloat(item.valorUnitario) || 0;
      const disc = parseFloat(item.descontoPct) || 0;
      return acc + (qty * unitVal * (disc / 100));
    }, 0);

    const subtotalApósDescItens = receitaBrutaServicos - descontoItens;
    const descGlobalVal = subtotalApósDescItens * ((parseFloat(descontoGlobalPct) || 0) / 100);
    const descontoTotal = descontoItens + descGlobalVal;
    
    const receitaServicosLiquida = receitaBrutaServicos - descontoTotal;
    const marcoTotal = possuiMarco ? ((parseFloat(marcoQtd) || 0) * (parseFloat(marcoValor) || 0)) : 0;
    const baseCliente = receitaServicosLiquida + marcoTotal;

    const taxPct = possuiImposto ? parseFloat(impostoPorcentagem) || 0 : 0;
    const impostosVal = baseCliente * (taxPct / 100);
    const receitaEsperadaCliente = baseCliente + impostosVal; // Total pago pelo cliente

    const despesasVal = despesasInternas.reduce((acc, d) => acc + (parseFloat(d.valor) || 0), 0);
    const artVal = possuiArt ? parseFloat(artValor) || 0 : 0;

    // Custo Total Interno = Despesas Internas + Marcos + ART + Impostos
    const custoTotal = despesasVal + marcoTotal + artVal + impostosVal;
    const lucroEsperado = receitaEsperadaCliente - custoTotal;
    const margemPct = receitaEsperadaCliente > 0 ? (lucroEsperado / receitaEsperadaCliente) * 100 : 0;

    return {
      receitaBrutaServicos,
      descontoTotal,
      marcoTotal,
      impostosVal,
      receitaEsperadaCliente,
      despesasVal,
      artVal,
      custoTotal,
      lucroEsperado,
      margemPct
    };
  };

  const calculateTotal = () => {
    return getFinanceiroResumo().receitaEsperadaCliente;
  };

  // Queries
  const { data: orcamentos = [], isLoading: loadingOrcamentos } = useQuery<OrcamentoItem[]>({
    queryKey: ['orcamentos'],
    queryFn: () => apiClient.get<OrcamentoItem[]>('/api/financeiro/orcamentos')
  });

  const { data: clientes = [], isLoading: loadingClientes } = useQuery<ClienteMin[]>({
    queryKey: ['clientes'],
    queryFn: () => apiClient.get<ClienteMin[]>('/api/clientes')
  });

  const { data: projetos = [], isLoading: loadingProjetos } = useQuery<ProjetoMin[]>({
    queryKey: ['projetos'],
    queryFn: () => apiClient.get<ProjetoMin[]>('/api/projetos')
  });

  const projetosDoCliente = projetos.filter((projeto) => projeto.clienteId === clienteId);
  const loading = loadingOrcamentos || loadingClientes || loadingProjetos;

  useEffect(() => {
    if (!projetoId) return;
    const stillBelongsToClient = projetos.some((projeto) => projeto.id === projetoId && projeto.clienteId === clienteId);
    if (!stillBelongsToClient) {
      setTimeout(() => {
        setProjetoId('');
      }, 0);
    }
  }, [clienteId, projetoId, projetos]);

  // Mutations
  const deleteMutation = useMutation({
    mutationKey: ['deleteOrcamento'],
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/financeiro/orcamentos/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
    },
    onError: () => {
      alert('Erro ao excluir orçamento');
    }
  });

  const submitMutation = useMutation({
    mutationKey: ['submitOrcamento'],
    mutationFn: async (payload: Omit<OrcamentoItem, 'id'>) => {
      return selectedOrcamento
        ? apiClient.patch(`/api/financeiro/orcamentos/${selectedOrcamento.id}`, payload)
        : apiClient.post('/api/financeiro/orcamentos', payload);
    },
    onSuccess: () => {
      setShowModal(false);
      queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
    },
    onError: (err) => {
      alert(err instanceof Error ? err.message : 'Erro de conexão.');
    }
  });

  // Action methods
  const openCreateModal = useCallback((initialClienteId?: string) => {
    setSelectedOrcamento(null);
    const nextClienteId = initialClienteId && clientes.some((cliente) => cliente.id === initialClienteId)
      ? initialClienteId
      : clientes[0]?.id || '';
    setClienteId(nextClienteId);
    setProjetoId('');
    setStatus('Em Análise');
    setDescricao('');
    setAnotacoes('');
    setFormaPagamento('');
    setDesconto('');
    setCodigoOrcamento('');
    setDataOrcamento(new Date().toISOString().substring(0, 10));
    setTitulo('');
    setValidadeDias('15');
    setCondicoesPagamento('50% na aprovação + 50% na entrega técnica');
    setItems([{ quantidade: '1', descricao: '', valorUnitario: '', descontoPct: '0' }]);
    setPossuiMarco(false);
    setMarcoQtd('');
    setMarcoValor('');
    setPossuiImposto(false);
    setImpostoPorcentagem('');
    setPossuiArt(false);
    setArtValor('150');
    setDescontoGlobalPct('0');
    setDespesasInternas([]);
    setShowModal(true);
  }, [clientes]);

  const openEditModal = (orc: OrcamentoItem) => {
    setSelectedOrcamento(orc);
    setClienteId(orc.clienteId || '');
    setProjetoId(orc.projetoId || '');
    setStatus(orc.status || 'Em Análise');
    setDescricao(orc.descricao || '');
    setAnotacoes(orc.anotacoes || '');
    setFormaPagamento(orc.formaDePagamento || '');
    setDesconto(orc.desconto ? (orc.desconto / 100).toString() : '');
    setCodigoOrcamento(orc.codigoOrcamento || '');
    setDataOrcamento(orc.dataOrcamento || new Date().toISOString().substring(0, 10));
    setTitulo(orc.titulo || '');
    setValidadeDias(orc.validadeDias ? orc.validadeDias.toString() : '15');
    setCondicoesPagamento(orc.condicoesPagamento || orc.formaDePagamento || '');

    const parsedItems = parseOrcamentoList<OrcamentoServicoItem>(orc.itens ?? orc.itensJson);

    if (parsedItems && parsedItems.length > 0) {
      setItems(parsedItems.map((item: OrcamentoServicoItem) => ({
        quantidade: String(item.quantidade || 1),
        descricao: item.descricao || '',
        valorUnitario: centsToCurrencyInput(item.valorUnitario),
        descontoPct: String(item.descontoPct || 0)
      })));
    } else {
      setItems([{
        quantidade: '1',
        descricao: orc.descricao || '',
        valorUnitario: ((orc.valorTotal || 0) / 100).toString(),
        descontoPct: '0'
      }]);
    }

    setPossuiMarco(!!orc.possuiMarco);
    setMarcoQtd(orc.marcoQtd ? orc.marcoQtd.toString() : '');
    setMarcoValor(orc.marcoValor ? (orc.marcoValor / 100).toString() : '');
    setPossuiImposto(!!orc.possuiImposto);
    setImpostoPorcentagem(orc.impostoPorcentagem ? orc.impostoPorcentagem.toString() : '');
    setPossuiArt(!!orc.possuiArt);
    setArtValor(orc.artValor ? (orc.artValor / 100).toString() : '150');
    setDescontoGlobalPct(orc.desconto ? (orc.desconto).toString() : '0');
    
    const parsedDespesas = parseOrcamentoList<OrcamentoDespesaItem>(orc.despesas ?? orc.despesasJson);
    const despesasFromNormalizedTable = Array.isArray(orc.despesas);
    setDespesasInternas(parsedDespesas.map((desp) => ({
      descricao: desp.descricao || '',
      valor: despesasFromNormalizedTable ? centsToCurrencyInput(desp.valor) : String(desp.valor || '')
    })));

    setShowModal(true);
  };

  useEffect(() => {
    const routeState = location.state as { createForClienteId?: string } | null;
    if (handledRouteActionRef.current || !routeState?.createForClienteId || loadingClientes) return;

    handledRouteActionRef.current = true;
    openCreateModal(routeState.createForClienteId);
  }, [clientes, loadingClientes, location.state, openCreateModal]);

  const handleDelete = (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este orçamento e todas as parcelas vinculadas?')) return;
    deleteMutation.mutate(id);
  };

  const handleGeneratePdf = async (orcamento: OrcamentoItem) => {
    try {
      const { gerarOrcamentoPDF } = await import('../../utils/pdfGenerator');
      gerarOrcamentoPDF(orcamento);
    } catch {
      alert('Erro ao gerar o PDF do orcamento.');
    }
  };

  // Focus Trap and Escape Key Handler for the modal
  useEffect(() => {
    if (!showModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowModal(false);
        return;
      }

      if (e.key === 'Tab') {
        const modalEl = document.getElementById('budget-modal');
        if (!modalEl) return;

        const focusableElements = modalEl.querySelectorAll(
          'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex="0"]'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    // Auto-focus first input
    const timer = setTimeout(() => {
      const firstInput = document.getElementById('codigoOrcamento');
      if (firstInput) {
        firstInput.focus();
      }
    }, 100);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
    };
  }, [showModal]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteId) {
      alert('Selecione um cliente para vincular ao orçamento.');
      return;
    }
    if (items.length === 0) {
      alert('Adicione pelo menos um item ao orçamento.');
      return;
    }
    const hasEmptyItem = items.some(item => !item.descricao || !item.valorUnitario);
    if (hasEmptyItem) {
      alert('Preencha a descrição e o valor unitário de todos os itens.');
      return;
    }

    const calculatedTotalValue = calculateTotal();
    const finalTotalCents = Math.round(calculatedTotalValue * 100);
    const itens = items.map(item => {
      const quantidade = parseDecimal(item.quantidade) || 1;
      const valorUnitario = Math.round(parseDecimal(item.valorUnitario) * 100);
      const descontoPct = parseDecimal(item.descontoPct);

      return {
        quantidade,
        descricao: item.descricao,
        valorUnitario,
        descontoPct,
        total: Math.round(quantidade * valorUnitario * (1 - descontoPct / 100))
      };
    });
    const despesas = despesasInternas
      .filter(despesa => despesa.descricao || despesa.valor)
      .map(despesa => ({
        descricao: despesa.descricao || 'Despesa Interna',
        valor: Math.round(parseDecimal(despesa.valor) * 100)
      }));

    const payload = {
      clienteId,
      projetoId: projetoId || null,
      valorTotal: finalTotalCents,
      status,
      descricao: items[0]?.descricao || descricao || 'Serviço',
      anotacoes: anotacoes || null,
      formaDePagamento: formaDePagamento || null,
      desconto: Math.round(getFinanceiroResumo().descontoTotal * 100),
      codigoOrcamento: codigoOrcamento || null,
      dataOrcamento: dataOrcamento || null,
      titulo: titulo || null,
      validadeDias: validadeDias || null,
      condicoesPagamento: condicoesPagamento || null,
      itens,
      possuiMarco,
      marcoQtd: possuiMarco ? (parseInt(marcoQtd) || null) : null,
      marcoValor: possuiMarco ? Math.round((parseFloat(marcoValor || "0") || 0) * 100) : null,
      possuiImposto,
      impostoPorcentagem: possuiImposto ? (parseFloat(impostoPorcentagem || "0") || null) : null,
      possuiArt,
      artValor: possuiArt ? Math.round((parseFloat(artValor || "0") || 0) * 100) : null,
      despesas
    };

    const schemaValidation = z.object({
      clienteId: z.string().min(1, 'Selecione um cliente'),
      valorTotal: z.number().min(1, 'Valor total inválido'),
    });

    const validation = schemaValidation.safeParse(payload);
    if (!validation.success) {
      alert(validation.error.issues[0].message);
      return;
    }

    submitMutation.mutate(payload);
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pago':
      case 'Aprovado':
        return 'bg-brand-green-50 text-brand-green-700 ring-1 ring-brand-green-600/10 dark:bg-brand-green-400/10 dark:text-brand-green-100 dark:ring-brand-green-300/20';
      case 'Em Análise':
        return 'bg-brand-rajah-50 text-brand-rajah-900 ring-1 ring-brand-rajah-600/10 dark:bg-brand-rajah-400/10 dark:text-brand-rajah-100 dark:ring-brand-rajah-300/20';
      case 'Rejeitado':
      case 'Cancelado':
        return 'bg-brand-red-50 text-brand-red-700 ring-1 ring-brand-red-600/10 dark:bg-brand-red-400/10 dark:text-brand-red-100 dark:ring-brand-red-300/20';
      default:
        return 'bg-brand-surface text-zinc-600 ring-1 ring-black/5 dark:bg-brand-surface-muted dark:text-zinc-300 dark:ring-white/10';
    }
  };

  // KPIs calculations
  const safeOrcamentos = Array.isArray(orcamentos) ? orcamentos : [];
  const statusOptions = Array.from(new Set(safeOrcamentos.map((orc) => orc.status).filter((item): item is string => Boolean(item))));
  const formaOptions = Array.from(new Set(safeOrcamentos.map((orc) => orc.formaDePagamento).filter((item): item is string => Boolean(item))));
  const filteredOrcamentos = safeOrcamentos.filter((orc) => {
    const searchable = [
      orc.clienteNome,
      orc.projetoNome,
      orc.codigoOrcamento,
      orc.descricao,
      orc.status,
      orc.formaDePagamento
    ].filter(Boolean).join(' ');
    const matchesSearchTerm = matchesSearch(searchable, searchTerm);
    const matchesStatus = statusFilter === 'Todos' || orc.status === statusFilter;
    const matchesForma = formaFilter === 'Todos' || orc.formaDePagamento === formaFilter;
    const matchesStart = !dataInicioFilter || (orc.dataOrcamento && orc.dataOrcamento >= dataInicioFilter);
    const matchesEnd = !dataFimFilter || (orc.dataOrcamento && orc.dataOrcamento <= dataFimFilter);
    return matchesSearchTerm && matchesStatus && matchesForma && matchesStart && matchesEnd;
  });
  const hasBudgetFilters = Boolean(searchTerm || statusFilter !== 'Todos' || formaFilter !== 'Todos' || dataInicioFilter || dataFimFilter);
  const totalOrcamentos = filteredOrcamentos.length;
  const orcamentosAprovados = filteredOrcamentos.filter((o: OrcamentoItem) => o.status === 'Aprovado' || o.status === 'Pago');
  const receitaEsperada = orcamentosAprovados.reduce((acc: number, curr: OrcamentoItem) => acc + curr.valorTotal, 0);
  const taxaConversao = totalOrcamentos > 0 ? Math.round((orcamentosAprovados.length / totalOrcamentos) * 100) : 0;

  return (
    <Layout>
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-6">
        <div>
          <span className={cn(geoKickerClass, 'mb-4')}>
            Comercial
          </span>
          <h1 className="text-5xl font-semibold tracking-tighter text-text-primary">
            Orçamentos
          </h1>
          <p className="mt-3 text-lg text-text-secondary font-medium">
            Gerencie propostas comerciais, acompanhe aprovações e gere PDFs.
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => openCreateModal()}
            className={primaryActionButtonClass}
            aria-label="Criar novo orçamento"
          >
            <span>Novo Orçamento</span>
            <div className={primaryActionIconClass}>
              <Plus size={16} weight="bold" aria-hidden="true" />
            </div>
          </button>
        </div>
      </div>

      {/* KPIs Row */}
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard label="Total de Orçamentos" value={totalOrcamentos} tone="geral" icon={<FileText size={22} weight="duotone" aria-hidden="true" />} />
        <MetricCard label="Receita Aprovada" value={formatCurrency(receitaEsperada)} tone="positive" delay={0.05} icon={<TrendUp size={22} weight="duotone" aria-hidden="true" />} />
        <MetricCard label="Taxa de Conversão" value={`${taxaConversao}%`} tone="positive" delay={0.1} icon={<Target size={22} weight="duotone" aria-hidden="true" />} />
      </div>

      <div className={cn('mb-6', filterBarClass)}>
        <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-[minmax(260px,1.4fr)_repeat(4,minmax(140px,0.7fr))_auto] items-center">
          <div className="relative">
            <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por cliente, código, serviço ou propriedade..."
              className={filterSearchInputClass}
            />
          </div>
          <CustomSelect
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder="Todos os status"
            className="min-w-0"
            options={[{ label: 'Todos os status', value: 'Todos' }, ...statusOptions.map((value) => ({ label: value, value }))]}
          />
          <CustomSelect
            value={formaFilter}
            onChange={setFormaFilter}
            placeholder="Todas as formas"
            className="min-w-0"
            options={[{ label: 'Todas as formas', value: 'Todos' }, ...formaOptions.map((value) => ({ label: value, value }))]}
          />
          <input
            type="date"
            value={dataInicioFilter}
            onChange={(event) => setDataInicioFilter(event.target.value)}
            className={filterControlClass}
            aria-label="Data inicial"
          />
          <input
            type="date"
            value={dataFimFilter}
            onChange={(event) => setDataFimFilter(event.target.value)}
            className={filterControlClass}
            aria-label="Data final"
          />
          {hasBudgetFilters && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('Todos');
                setFormaFilter('Todos');
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
          {filteredOrcamentos.length} de {safeOrcamentos.length} orçamento(s) exibidos
        </p>
      </div>

      {loading ? (
        <div className="py-24 flex justify-center">
          <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }} className="h-8 w-8 animate-spin rounded-full border-2 border-brand-primary-100 border-t-brand-primary-500 dark:border-brand-primary-300/20 dark:border-t-brand-primary-200" />
        </div>
      ) : (
        <div className="geo-card p-8">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-text-primary flex items-center gap-3">
              <CurrencyDollar size={20} className="text-text-muted" aria-hidden="true" /> Histórico de Propostas
            </h3>
          </div>

          <div className="space-y-4">
            {safeOrcamentos.length === 0 ? <p className="text-text-secondary text-sm">Nenhum orçamento lançado.</p> : filteredOrcamentos.length === 0 ? (
              <div className="geo-empty-state p-12 text-center">
                <MagnifyingGlass className="mb-4 h-10 w-10 text-brand-primary-200" />
                <p className="text-sm font-semibold text-text-secondary">Nenhum orçamento encontrado com os filtros atuais.</p>
              </div>
            ) : (
              filteredOrcamentos.map((orc: OrcamentoItem) => (
                <div key={orc.id} className="geo-card-interactive group flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-text-primary truncate">{orc.clienteNome}</p>
                      {orc.codigoOrcamento && (
                        <span className="geo-badge-base bg-brand-primary-50 px-1.5 py-0.5 font-mono text-xs font-bold text-brand-primary-700 dark:bg-brand-primary-400/10 dark:text-brand-primary-100">
                          {orc.codigoOrcamento}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-text-secondary truncate mt-0.5">{orc.descricao || 'Sem descrição'}</p>
                    <p className="text-xs text-text-muted truncate mt-1">
                      {orc.projetoNome ? `Propriedade: ${orc.projetoNome}` : 'Sem propriedade vinculada'}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right">
                      <p className="font-bold text-success dark:text-emerald-400">{formatCurrency(orc.valorTotal)}</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase mt-1 ${getStatusColor(orc.status)}`}>
                        {orc.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 transition-opacity">
                      <button 
                        onClick={() => handleGeneratePdf(orc)} 
                        className={cn(orcamentoIconButtonClass, 'border-brand-turquoise-200/80 bg-brand-turquoise-50 text-brand-turquoise-700 hover:bg-brand-turquoise-100 dark:border-brand-turquoise-300/20 dark:bg-brand-turquoise-400/10 dark:text-brand-turquoise-100')} 
                        aria-label={`Gerar PDF para orçamento de ${orc.clienteNome}`}
                        title="Gerar PDF"
                      >
                        <FilePdf size={16} weight="regular" aria-hidden="true" />
                      </button>
                      <button 
                        onClick={() => openEditModal(orc)} 
                        className={cn(orcamentoIconButtonClass, 'border-brand-primary-200/80 bg-brand-primary-50 text-brand-primary-700 hover:bg-brand-primary-100 dark:border-brand-primary-300/20 dark:bg-brand-primary-400/10 dark:text-brand-primary-100')} 
                        aria-label={`Editar orçamento de ${orc.clienteNome}`}
                        title="Editar"
                      >
                        <PencilSimple size={16} weight="regular" aria-hidden="true" />
                      </button>
                      <button 
                        onClick={() => handleDelete(orc.id)} 
                        className={cn(orcamentoIconButtonClass, 'border-brand-red-200/80 bg-brand-red-50 text-brand-red-700 hover:bg-brand-red-100 dark:border-brand-red-300/20 dark:bg-brand-red-400/10 dark:text-brand-red-100')} 
                        aria-label={`Excluir orçamento de ${orc.clienteNome}`}
                        title="Excluir"
                      >
                        <Trash size={16} weight="regular" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modal Orçamento */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={selectedOrcamento ? 'Editar Orçamento' : 'Novo Orçamento'}
        maxWidth="max-w-5xl"
      >
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 space-y-5 pb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label htmlFor="titulo" className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5">Título da Proposta Comercial</label>
              <input id="titulo" type="text" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Levantamento Geodésico Planialtimétrico" className={cn(orcamentoFieldClass, 'font-semibold')} />
            </div>
            <div>
              <label htmlFor="codigoOrcamento" className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5">Código Interno</label>
              <input id="codigoOrcamento" type="text" value={codigoOrcamento} onChange={e => setCodigoOrcamento(e.target.value)} placeholder="Ex: ORC-2026-001" className={orcamentoFieldClass} />
            </div>
            <div>
              <label htmlFor="dataOrcamento" className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5">Emissão</label>
              <input id="dataOrcamento" type="date" required value={dataOrcamento} onChange={e => setDataOrcamento(e.target.value)} className={orcamentoFieldClass} />
            </div>
            <div>
              <label htmlFor="clienteId" className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5">Cliente Vinculado</label>
              <select id="clienteId" required value={clienteId} onChange={e => setClienteId(e.target.value)} className={orcamentoFieldClass}>
                <option value="" className="text-text-placeholder">Selecione um cliente...</option>
                {(Array.isArray(clientes) ? clientes : []).map((c: ClienteMin) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="projetoId" className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5">Propriedade / Imóvel</label>
              <select
                id="projetoId"
                value={projetoId}
                onChange={e => setProjetoId(e.target.value)}
                disabled={!clienteId}
                className={orcamentoFieldClass}
              >
                <option value="">Cliente geral</option>
                {projetosDoCliente.map((projeto) => (
                  <option key={projeto.id} value={projeto.id}>{projeto.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="validadeDias" className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5">Validade (Dias)</label>
              <input id="validadeDias" type="number" value={validadeDias} onChange={e => setValidadeDias(e.target.value)} placeholder="15" className={orcamentoFieldClass} />
            </div>
            <div>
              <label htmlFor="status" className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5">Status da Proposta</label>
              <select id="status" value={status} onChange={e => setStatus(e.target.value)} className={orcamentoFieldClass}>
                <option value="Em Análise">Em Análise</option>
                <option value="Aprovado">Aprovado</option>
                <option value="Rejeitado">Rejeitado</option>
                <option value="Pago">Pago</option>
              </select>
            </div>
          </div>

          {/* Dynamic Items list */}
          <div className={orcamentoPanelClass}>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted">Itens e Serviços</label>
              <button
                type="button"
                onClick={() => setItems([...items, { quantidade: '1', descricao: '', valorUnitario: '', descontoPct: '0' }])}
                className={cn(secondarySmallActionButtonClass, 'min-h-8 px-3 py-1')}
              >
                <Plus size={14} weight="bold" aria-hidden="true" /> Adicionar Item
              </button>
            </div>
            
            {items.length === 0 ? (
              <div className="geo-empty-state py-6 text-center text-sm text-text-placeholder">
                Nenhum item adicionado. Adicione ao menos um item/serviço.
              </div>
            ) : (
              <div className="space-y-3 pr-1">
                {items.map((item, index) => (
                  <div key={index} className="geo-card grid grid-cols-1 items-center gap-3 p-3 md:grid-cols-12">
                    <div className="col-span-12 md:col-span-1">
                      <label htmlFor={`item-qty-${index}`} className="block md:hidden text-xs font-bold uppercase tracking-wider text-text-muted mb-1">Qtd</label>
                      <input
                        id={`item-qty-${index}`}
                        type="number"
                        required
                        min="1"
                        value={item.quantidade}
                        onChange={e => {
                          const newItems = [...items];
                          newItems[index].quantidade = e.target.value;
                          setItems(newItems);
                        }}
                        placeholder="Qtd"
                        title="Quantidade"
                        className={cn(orcamentoFieldClass, 'h-auto px-2 py-2 text-center text-sm')}
                      />
                    </div>
                    <div className="col-span-12 md:col-span-6">
                      <label htmlFor={`item-desc-${index}`} className="block md:hidden text-xs font-bold uppercase tracking-wider text-text-muted mb-1">Descrição</label>
                      <input
                        id={`item-desc-${index}`}
                        type="text"
                        required
                        value={item.descricao}
                        onChange={e => {
                          const newItems = [...items];
                          newItems[index].descricao = e.target.value;
                          setItems(newItems);
                        }}
                        placeholder="Descrição do serviço"
                        className={cn(orcamentoFieldClass, 'h-auto py-2 text-sm')}
                      />
                    </div>
                    <div className="col-span-12 md:col-span-3">
                      <label htmlFor={`item-val-${index}`} className="block md:hidden text-xs font-bold uppercase tracking-wider text-text-muted mb-1">Valor Unit. (R$)</label>
                      <input
                        id={`item-val-${index}`}
                        type="number"
                        step="0.01"
                        required
                        min="0"
                        value={item.valorUnitario}
                        onChange={e => {
                          const newItems = [...items];
                          newItems[index].valorUnitario = e.target.value;
                          setItems(newItems);
                        }}
                        placeholder="Valor Unit. (R$)"
                        className={cn(orcamentoFieldClass, 'h-auto px-2.5 py-2 text-sm font-semibold')}
                      />
                    </div>
                    <div className="col-span-12 md:col-span-1">
                      <label htmlFor={`item-desc-pct-${index}`} className="block md:hidden text-xs font-bold uppercase tracking-wider text-text-muted mb-1">Desc. %</label>
                      <input
                        id={`item-desc-pct-${index}`}
                        type="number"
                        min="0"
                        max="100"
                        value={item.descontoPct}
                        onChange={e => {
                          const newItems = [...items];
                          newItems[index].descontoPct = e.target.value;
                          setItems(newItems);
                        }}
                        placeholder="Desc. %"
                        title="Desconto %"
                        className={cn(orcamentoFieldClass, 'h-auto px-2 py-2 text-center text-sm')}
                      />
                    </div>
                    <div className="col-span-12 md:col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setItems(items.filter((_, i) => i !== index))}
                        className="geo-focus-ring flex w-full items-center justify-center rounded-lg p-2 text-text-muted transition-[background-color,color] hover:bg-brand-red-50 hover:text-brand-red-700 dark:hover:bg-brand-red-400/10 dark:hover:text-brand-red-100 md:w-auto"
                        aria-label={`Remover item ${index + 1}`}
                      >
                        <Trash size={16} weight="regular" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Desconto Global */}
          <div className={cn(geoPurpleSurfaceClass, 'geo-card flex items-center justify-between p-4 text-white')}>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-brand-rajah-400/10 p-2 text-brand-rajah-200">
                <Percent size={20} weight="bold" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold">Desconto Global (%)</span>
                <span className="text-xs text-zinc-400">Aplicado sobre o valor total dos serviços</span>
              </div>
            </div>
            <div className="w-24">
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={descontoGlobalPct}
                onChange={e => setDescontoGlobalPct(e.target.value)}
                placeholder="0"
                className={cn(orcamentoDarkFieldClass, 'h-10 px-3 text-center')}
              />
            </div>
          </div>

          {/* Toggles: Marco Geodésico | Imposto | ART */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Marco Geodésico */}
            <div className={cn(geoPurpleSurfaceClass, 'geo-card space-y-3 p-4 text-white')}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <MapPin size={18} className="text-brand-primary-200" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white">Marco Topográfico</span>
                    <span className="text-xs text-zinc-400">Marcos físicos</span>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input type="checkbox" checked={possuiMarco} onChange={e => setPossuiMarco(e.target.checked)} className="sr-only peer" />
                  <div className="peer h-4.5 w-8 rounded-full bg-zinc-800 peer-checked:bg-brand-primary-500 peer-focus:ring-2 peer-focus:ring-brand-primary-400/30 peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:left-[2px] after:top-[2px] after:h-3.5 after:w-3.5 after:rounded-full after:bg-zinc-400 after:transition-transform after:content-[''] peer-checked:after:bg-white"></div>
                </label>
              </div>
              <AnimatePresence>
                {possuiMarco && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden pt-2 grid grid-cols-2 gap-2 border-t border-zinc-800/60">
                    <div>
                      <span className="block text-[9px] font-bold uppercase text-zinc-400 mb-1">Qtd</span>
                      <input type="number" min="1" value={marcoQtd} onChange={e => setMarcoQtd(e.target.value)} placeholder="0" className={orcamentoDarkFieldClass} />
                    </div>
                    <div>
                      <span className="block text-[9px] font-bold uppercase text-zinc-400 mb-1">Valor Unit.</span>
                      <input type="number" step="0.01" value={marcoValor} onChange={e => setMarcoValor(e.target.value)} placeholder="R$ 0" className={cn(orcamentoDarkFieldClass, 'text-brand-green-200')} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Imposto */}
            <div className={cn(geoPurpleSurfaceClass, 'geo-card space-y-3 p-4 text-white')}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Tag size={18} className="text-brand-rajah-200" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white">% Imposto</span>
                    <span className="text-xs text-zinc-400">Não obrigatório</span>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input type="checkbox" checked={possuiImposto} onChange={e => setPossuiImposto(e.target.checked)} className="sr-only peer" />
                  <div className="peer h-4.5 w-8 rounded-full bg-zinc-800 peer-checked:bg-brand-rajah-500 peer-focus:ring-2 peer-focus:ring-brand-rajah-400/30 peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:left-[2px] after:top-[2px] after:h-3.5 after:w-3.5 after:rounded-full after:bg-zinc-400 after:transition-transform after:content-[''] peer-checked:after:bg-white"></div>
                </label>
              </div>
              <AnimatePresence>
                {possuiImposto && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden pt-2 border-t border-zinc-800/60">
                    <span className="block text-[9px] font-bold uppercase text-zinc-400 mb-1">Alíquota Fiscal (%)</span>
                    <input type="number" step="0.01" value={impostoPorcentagem} onChange={e => setImpostoPorcentagem(e.target.value)} placeholder="Ex: 6.00" className={cn(orcamentoDarkFieldClass, 'text-brand-rajah-200')} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ART (Anotação de Responsabilidade Técnica) */}
            <div className={cn(geoPurpleSurfaceClass, 'geo-card space-y-3 p-4 text-white')}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck size={18} className="text-brand-indigo-200" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white">Emitir ART</span>
                    <span className="text-xs text-zinc-400">Custo interno oculto</span>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input type="checkbox" checked={possuiArt} onChange={e => setPossuiArt(e.target.checked)} className="sr-only peer" />
                  <div className="peer h-4.5 w-8 rounded-full bg-zinc-800 peer-checked:bg-brand-indigo-500 peer-focus:ring-2 peer-focus:ring-brand-indigo-400/30 peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:left-[2px] after:top-[2px] after:h-3.5 after:w-3.5 after:rounded-full after:bg-zinc-400 after:transition-transform after:content-[''] peer-checked:after:bg-white"></div>
                </label>
              </div>
              <AnimatePresence>
                {possuiArt && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden pt-2 border-t border-zinc-800/60">
                    <span className="block text-[9px] font-bold uppercase text-purple-300/80 mb-1">Taxa CREA/CFT (R$)</span>
                    <input type="number" step="0.01" value={artValor} onChange={e => setArtValor(e.target.value)} placeholder="150.00" className={cn(orcamentoDarkFieldClass, 'text-brand-indigo-200')} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Despesas Internas */}
          <div className={cn(orcamentoPanelClass, 'space-y-3')}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CurrencyDollar size={18} className="text-emerald-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-text-primary">Despesas ({despesasInternas.length})</span>
              </div>
              <button
                type="button"
                onClick={() => setDespesasInternas([...despesasInternas, { descricao: '', valor: '' }])}
                className={cn(secondarySmallActionButtonClass, 'min-h-8 px-3 py-1 text-brand-green-700 dark:text-brand-green-100')}
              >
                <Plus size={14} weight="bold" /> Adicionar Despesa
              </button>
            </div>
            <p className="text-xs text-text-muted flex items-center gap-1.5 leading-normal">
              <Info size={14} className="flex-shrink-0 text-zinc-400" />
              Despesas adicionadas aqui serão contabilizadas como custos internos. No documento do cliente, aparecerão apenas como &quot;Custo dos Serviços&quot;.
            </p>
            {despesasInternas.length > 0 && (
              <div className="space-y-2 pt-1">
                {despesasInternas.map((desp, index) => (
                  <div key={index} className="geo-card flex items-center gap-2 p-2.5">
                    <input
                      type="text"
                      required
                      value={desp.descricao}
                      onChange={e => {
                        const next = [...despesasInternas];
                        next[index].descricao = e.target.value;
                        setDespesasInternas(next);
                      }}
                      placeholder="Descrição da despesa (ex: Auxiliar, Combustível, Pedágio)"
                      className="geo-focus-ring flex-1 rounded-lg bg-transparent px-2 py-1 text-xs font-medium text-text-primary outline-none"
                    />
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={desp.valor}
                      onChange={e => {
                        const next = [...despesasInternas];
                        next[index].valor = e.target.value;
                        setDespesasInternas(next);
                      }}
                      placeholder="R$ 0,00"
                      className={cn(orcamentoFieldClass, 'h-auto w-28 px-2 py-1 text-right font-bold')}
                    />
                    <button
                      type="button"
                      onClick={() => setDespesasInternas(despesasInternas.filter((_, i) => i !== index))}
                      className="geo-focus-ring rounded-lg p-1 text-text-muted transition-colors hover:text-brand-red-700 dark:hover:text-brand-red-100"
                    >
                      <Trash size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Condições e Observações */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="condicoesPagamento" className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5">Condições de Pagamento</label>
              <input id="condicoesPagamento" type="text" value={condicoesPagamento} onChange={e => setCondicoesPagamento(e.target.value)} placeholder="Ex: 50% na aprovação + 50% na entrega" className={orcamentoFieldClass} />
            </div>
            <div>
              <label htmlFor="formaDePagamento" className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5">Forma de Pagamento</label>
              <input id="formaDePagamento" type="text" value={formaDePagamento} onChange={e => setFormaPagamento(e.target.value)} placeholder="Ex: PIX, Transferência, Boleto" className={orcamentoFieldClass} />
            </div>
          </div>

          <div>
            <label htmlFor="anotacoes" className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">Observações Adicionais</label>
            <textarea id="anotacoes" value={anotacoes} onChange={e => setAnotacoes(e.target.value)} placeholder="Anotações internas..." rows={2} className={orcamentoTextareaClass} />
          </div>

          {/* NOVO RESUMO FINANCEIRO PREMIUM ESTILO LOVABLE */}
          {(() => {
            const res = getFinanceiroResumo();
            const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
            
            return (
              <div className={cn(geoPurpleSurfaceClass, 'geo-card relative overflow-hidden p-6 text-white md:p-8')}>
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-800/80">
                  <div className="rounded-lg border border-brand-primary-300/20 bg-brand-primary-400/10 p-2.5 text-brand-primary-100">
                    <Receipt size={22} weight="duotone" />
                  </div>
                  <div>
                    <h4 className="text-base font-extrabold tracking-tight text-white flex items-center gap-2">
                      Resumo Financeiro Gerencial
                      <span className="text-xs uppercase font-black tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Live Preview
                      </span>
                    </h4>
                    <p className="text-xs text-zinc-400">Análise instantânea de margem, receitas e custos ocultos</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 py-2">
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-zinc-400 block">Receita Bruta</span>
                    <span className="text-base md:text-lg font-bold text-white block truncate">{fmt(res.receitaBrutaServicos)}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-zinc-400 block">Desconto Total</span>
                    <span className="text-base md:text-lg font-bold text-rose-400 block truncate">-{fmt(res.descontoTotal)}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-zinc-400 block">Despesas Internas</span>
                    <span className="text-base md:text-lg font-bold text-zinc-300 block truncate">{fmt(res.despesasVal)}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-zinc-400 block">Impostos</span>
                    <span className="text-base md:text-lg font-bold text-amber-400 block truncate">{fmt(res.impostosVal)}</span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs font-medium text-zinc-400 block">Marcos Topográficos</span>
                    <span className="text-base md:text-lg font-bold text-zinc-300 block truncate">{fmt(res.marcoTotal)}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-zinc-400 block">ART (Custo Interno)</span>
                    <span className="text-base md:text-lg font-bold text-purple-400 block truncate">{fmt(res.artVal)}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-zinc-400 block">Receita + Impostos</span>
                    <span className="text-base md:text-lg font-extrabold text-blue-400 block truncate">{fmt(res.receitaEsperadaCliente)}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-zinc-400 block">Custo Operacional Total</span>
                    <span className="text-base md:text-lg font-extrabold text-rose-500 block truncate">{fmt(res.custoTotal)}</span>
                  </div>
                </div>

                {/* Lucro Esperado & Margem Esperada */}
                <div className={cn(geoPurpleSurfaceClass, 'geo-card mt-8 flex flex-col items-center justify-between gap-6 border-brand-primary-300/15 p-6 pt-6 text-white sm:flex-row')}>
                  <div className="flex flex-col text-center sm:text-left">
                    <span className="text-xs uppercase tracking-wider text-zinc-400 font-bold">Lucro Líquido Real</span>
                    <span className="text-3xl md:text-4xl font-black text-emerald-400 tracking-tight mt-1">
                      {fmt(res.lucroEsperado)}
                    </span>
                  </div>

                  <div className="flex flex-col items-center sm:items-end min-w-[180px]">
                    <span className="text-xs uppercase tracking-wider text-zinc-400 font-bold">Margem Esperada</span>
                    <span className={`text-2xl md:text-3xl font-black tracking-tight mt-0.5 ${res.margemPct >= 30 ? 'text-emerald-400' : res.margemPct >= 15 ? 'text-amber-400' : 'text-rose-400'}`}>
                      {res.margemPct.toFixed(2)}%
                    </span>
                    <div className="w-full bg-zinc-800 h-2 rounded-full mt-2 overflow-hidden max-w-[160px]">
                      <div
                        className={`h-full transition-[width,background-color] duration-500 ${res.margemPct >= 30 ? 'bg-emerald-500' : res.margemPct >= 15 ? 'bg-amber-500' : 'bg-rose-500'}`}
                        style={{ width: `${Math.min(Math.max(res.margemPct, 0), 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Footer Ações */}
          <div className="pt-4 flex items-center justify-end gap-3 flex-shrink-0">
            <button type="button" onClick={() => setShowModal(false)} className={cn(secondarySmallActionButtonClass, 'px-6 py-3 font-semibold')}>Cancelar</button>
            <button type="submit" className={cn(primarySubmitButtonClass, 'px-8 py-3 font-bold')}>Salvar Orçamento</button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
