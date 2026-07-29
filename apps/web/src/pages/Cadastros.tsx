import { useState } from 'react';
import { Layout } from '../components/Layout';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FormError, FormFooter, FormSection, FormSelect } from '../components/Form';
import { 
  Plus, 
  Trash, 
  PencilSimple, 
  Tag, 
  Wrench, 
  CurrencyDollar, 
  SquaresFour,
  MagnifyingGlass
} from '@phosphor-icons/react';
import { cn } from '../utils/cn';
import { primaryActionButtonClass, primaryActionIconClass, primarySubmitButtonClass } from '../utils/actionStyles';

interface TipoServico {
  id: string;
  nome: string;
  categoria: string;
  valorSugerido: number; // in cents
}

interface TipoDespesa {
  id: string;
  categoria: string;
  descricao: string;
}

export function Cadastros() {
  const [activeTab, setActiveTab] = useState<'servicos' | 'despesas'>('servicos');
  const [searchServicos, setSearchServicos] = useState('');
  const [searchDespesas, setSearchDespesas] = useState('');

  // Modals / Editors
  const [showModal, setShowModal] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; type: 'servicos' | 'despesas' } | null>(null);

  // Form states - Servico
  const [servNome, setServNome] = useState('');
  const [servCategoria, setServCategoria] = useState('Topografia');
  const [servValor, setServValor] = useState('');

  // Form states - Despesa
  const [despCategoria, setDespCategoria] = useState('Combustível');
  const [despDescricao, setDespDescricao] = useState('');
  
  // Lists with lazy state initialization
  const [servicos, setServicos] = useState<TipoServico[]>(() => {
    const localServ = localStorage.getItem('geogestor_tipos_servico');
    if (localServ) {
      return JSON.parse(localServ);
    } else {
      const defaults = [
        { id: '1', nome: 'Levantamento Planialtimétrico Cadastral', categoria: 'Topografia', valorSugerido: 250000 },
        { id: '2', nome: 'Georreferenciamento de Imóvel Rural', categoria: 'Georreferenciamento', valorSugerido: 450000 },
        { id: '3', nome: 'Demarcação de Divisas', categoria: 'Topografia', valorSugerido: 180000 },
        { id: '4', nome: 'Retificação de Área', categoria: 'Regularização', valorSugerido: 300000 },
      ];
      localStorage.setItem('geogestor_tipos_servico', JSON.stringify(defaults));
      return defaults;
    }
  });

  const [despesas, setDespesas] = useState<TipoDespesa[]>(() => {
    const localDesp = localStorage.getItem('geogestor_tipos_despesa');
    if (localDesp) {
      return JSON.parse(localDesp);
    } else {
      const defaults = [
        { id: '1', categoria: 'Combustível', descricao: 'Abastecimento para trabalho de campo' },
        { id: '2', categoria: 'Cartório', descricao: 'Custas com certidões e averbações de imóveis' },
        { id: '3', categoria: 'Alimentação', descricao: 'Refeições da equipe de campo' },
        { id: '4', categoria: 'Equipamento', descricao: 'Manutenção de RTK, Estação Total ou Drones' },
      ];
      localStorage.setItem('geogestor_tipos_despesa', JSON.stringify(defaults));
      return defaults;
    }
  });

  const saveServicos = (list: TipoServico[]) => {
    setServicos(list);
    localStorage.setItem('geogestor_tipos_servico', JSON.stringify(list));
  };

  const saveDespesas = (list: TipoDespesa[]) => {
    setDespesas(list);
    localStorage.setItem('geogestor_tipos_despesa', JSON.stringify(list));
  };

  const openCreateModal = () => {
    setSelectedId(null);
    setFormError('');
    setServNome('');
    setServCategoria('Topografia');
    setServValor('');
    setDespCategoria('Combustível');
    setDespDescricao('');
    setShowModal(true);
  };

  const openEditModal = (item: TipoServico | TipoDespesa) => {
    setSelectedId(item.id);
    setFormError('');
    if (activeTab === 'servicos') {
      const s = item as TipoServico;
      setServNome(s.nome);
      setServCategoria(s.categoria);
      setServValor((s.valorSugerido / 100).toString());
    } else {
      const d = item as TipoDespesa;
      setDespCategoria(d.categoria);
      setDespDescricao(d.descricao);
    }
    setShowModal(true);
  };

  const handleDelete = (id: string, name: string) => {
    setDeleteTarget({ id, name, type: activeTab });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'servicos') {
      const updated = servicos.filter(s => s.id !== deleteTarget.id);
      saveServicos(updated);
    } else {
      const updated = despesas.filter(d => d.id !== deleteTarget.id);
      saveDespesas(updated);
    }
    setDeleteTarget(null);
  };

  const parseCurrencyToCents = (value: string) => {
    const sanitized = value
      .trim()
      .replace(/\s/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
      .replace(/[^\d.]/g, '');
    const parsed = Number.parseFloat(sanitized);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (activeTab === 'servicos') {
      if (!servNome.trim()) {
        setFormError('Informe o nome do serviço.');
        return;
      }
      const parsedVal = parseCurrencyToCents(servValor);
      if (!parsedVal || parsedVal <= 0) {
        setFormError('Informe um valor sugerido válido.');
        return;
      }
      
      if (selectedId) {
        // Edit
        const updated = servicos.map(s => s.id === selectedId 
          ? { ...s, nome: servNome, categoria: servCategoria, valorSugerido: parsedVal }
          : s
        );
        saveServicos(updated);
      } else {
        // Create
        const newItem: TipoServico = {
          id: crypto.randomUUID(),
          nome: servNome,
          categoria: servCategoria,
          valorSugerido: parsedVal
        };
        saveServicos([...servicos, newItem]);
      }
    } else {
      if (!despDescricao.trim()) {
        setFormError('Informe a descrição do item de despesa.');
        return;
      }

      if (selectedId) {
        // Edit
        const updated = despesas.map(d => d.id === selectedId 
          ? { ...d, categoria: despCategoria, descricao: despDescricao }
          : d
        );
        saveDespesas(updated);
      } else {
        // Create
        const newItem: TipoDespesa = {
          id: crypto.randomUUID(),
          categoria: despCategoria,
          descricao: despDescricao
        };
        saveDespesas([...despesas, newItem]);
      }
    }

    setShowModal(false);
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
  };

  const filteredServicos = servicos.filter((item) => {
    const query = searchServicos.trim().toLowerCase();
    if (!query) return true;
    return [item.nome, item.categoria].join(' ').toLowerCase().includes(query);
  });

  const filteredDespesas = despesas.filter((item) => {
    const query = searchDespesas.trim().toLowerCase();
    if (!query) return true;
    return [item.categoria, item.descricao].join(' ').toLowerCase().includes(query);
  });

  const currentSearch = activeTab === 'servicos' ? searchServicos : searchDespesas;
  const activeCount = activeTab === 'servicos' ? filteredServicos.length : filteredDespesas.length;
  const totalCount = activeTab === 'servicos' ? servicos.length : despesas.length;
  const serviceCategoryCount = new Set(servicos.map((item) => item.categoria)).size;
  const expenseCategoryCount = new Set(despesas.map((item) => item.categoria)).size;

  return (
    <Layout>
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
        <div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs uppercase tracking-[0.2em] font-medium bg-zinc-100 text-zinc-500 dark:text-zinc-400 mb-4">
            Parâmetros do Sistema
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-white sm:text-4xl">
            Cadastros Auxiliares
          </h1>
          <p className="mt-3 text-lg text-zinc-500 dark:text-zinc-400 font-medium">
            Configure tabelas auxiliares de tipos de serviço e categorias de despesa.
          </p>
        </div>
        
        <button 
          onClick={openCreateModal}
          className={cn(primaryActionButtonClass, 'font-medium')}
        >
          <span>Novo Item</span>
          <div className={primaryActionIconClass}>
            <Plus weight="bold" className="w-4 h-4" />
          </div>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto hide-scrollbar rounded-2xl border border-zinc-200/70 bg-white/80 p-2 shadow-sm ring-1 ring-zinc-950/[0.03] backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-900/80 dark:ring-white/[0.03] gap-2 mb-8">
        <button 
          onClick={() => setActiveTab('servicos')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
            activeTab === 'servicos' 
              ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-indigo-200/70 dark:bg-zinc-800 dark:text-indigo-200 dark:ring-indigo-400/20' 
              : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-100'
          }`}
        >
          <Wrench weight={activeTab === 'servicos' ? 'fill' : 'regular'} className="w-5 h-5" />
          Tipos de Serviço ({servicos.length})
        </button>
        <button 
          onClick={() => setActiveTab('despesas')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
            activeTab === 'despesas' 
              ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-indigo-200/70 dark:bg-zinc-800 dark:text-indigo-200 dark:ring-indigo-400/20' 
              : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-100'
          }`}
        >
          <CurrencyDollar weight={activeTab === 'despesas' ? 'fill' : 'regular'} className="w-5 h-5" />
          Categorias de Despesa ({despesas.length})
        </button>
      </div>

      <div className="mb-8 rounded-3xl border border-zinc-200/70 bg-white/80 p-4 shadow-sm ring-1 ring-zinc-950/[0.03] backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-900/80 dark:ring-white/[0.03]">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {activeTab === 'servicos' ? 'Catálogo de serviços' : 'Catálogo financeiro'}
            </p>
            <p className="mt-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {activeTab === 'servicos'
                ? 'Usado para preencher orçamentos com mais rapidez.'
                : 'Usado para padronizar lançamentos e relatórios de despesas.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {totalCount} cadastro(s)
            </span>
            <span className="rounded-full border border-indigo-200/70 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:border-indigo-400/20 dark:bg-indigo-400/10 dark:text-indigo-200">
              {activeTab === 'servicos' ? `${serviceCategoryCount} categoria(s)` : `${expenseCategoryCount} grupo(s)`}
            </span>
          </div>
        </div>
        <div className="relative">
          <MagnifyingGlass className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={activeTab === 'servicos' ? searchServicos : searchDespesas}
            onChange={(event) => activeTab === 'servicos' ? setSearchServicos(event.target.value) : setSearchDespesas(event.target.value)}
            placeholder={activeTab === 'servicos' ? 'Buscar tipo de serviço por nome ou categoria...' : 'Buscar categoria ou descrição de despesa...'}
            className="h-11 w-full rounded-2xl border border-zinc-200 bg-white pl-10 pr-24 text-sm font-medium text-zinc-900 outline-none transition-all placeholder:text-zinc-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
          {currentSearch && (
            <button
              type="button"
              onClick={() => activeTab === 'servicos' ? setSearchServicos('') : setSearchDespesas('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl px-3 py-1.5 text-xs font-semibold text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
            >
              Limpar
            </button>
          )}
        </div>
        <p className="mt-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          {activeTab === 'servicos'
            ? `${activeCount} de ${totalCount} tipo(s) de serviço exibidos`
            : `${activeCount} de ${totalCount} categoria(s) exibidas`}
        </p>
      </div>

      {/* List Container */}
      <div className="space-y-4">
        {activeTab === 'servicos' ? (
          servicos.length === 0 ? (
            <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium text-center py-12">Nenhum serviço auxiliar cadastrado.</p>
          ) : filteredServicos.length === 0 ? (
            <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium text-center py-12">Nenhum tipo de serviço encontrado com a busca atual.</p>
          ) : (
            filteredServicos.map((item) => (
              <div 
                key={item.id}
                className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:shadow-sm transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl border flex items-center justify-center flex-shrink-0 ${
                    item.categoria === 'Georreferenciamento' ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200/60 dark:border-indigo-800/60' :
                    item.categoria === 'Topografia' ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/60 dark:border-emerald-800/60' :
                    item.categoria === 'Regularização' ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-200/60 dark:border-teal-800/60' :
                    item.categoria === 'Licenciamento' ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200/60 dark:border-amber-800/60' :
                    'bg-violet-50 dark:bg-violet-950/40 border-violet-200/60 dark:border-violet-800/60'
                  }`}>
                    <Tag weight="duotone" className={`w-6 h-6 ${
                      item.categoria === 'Georreferenciamento' ? 'text-indigo-500 dark:text-indigo-400' :
                      item.categoria === 'Topografia' ? 'text-emerald-500 dark:text-emerald-400' :
                      item.categoria === 'Regularização' ? 'text-teal-500 dark:text-teal-400' :
                      item.categoria === 'Licenciamento' ? 'text-amber-500 dark:text-amber-400' :
                      'text-violet-500 dark:text-violet-400'
                    }`} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-zinc-950 dark:text-white leading-tight">{item.nome}</h4>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-zinc-400 font-semibold uppercase tracking-wider">
                      <span>{item.categoria}</span>
                      <span>•</span>
                      <span className="text-zinc-800 dark:text-zinc-200">Sugerido: {formatCurrency(item.valorSugerido)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                  <button 
                    onClick={() => openEditModal(item)}
                    className="w-9 h-9 rounded-lg border border-zinc-100 dark:border-zinc-800 hover:border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:text-zinc-100 flex items-center justify-center transition-colors"
                  >
                    <PencilSimple className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDelete(item.id, item.nome)}
                    className="w-9 h-9 rounded-lg border border-zinc-100 dark:border-zinc-800 hover:border-red-200 text-zinc-400 hover:text-red-600 flex items-center justify-center transition-colors"
                  >
                    <Trash className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )
        ) : (
          despesas.length === 0 ? (
            <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium text-center py-12">Nenhuma categoria de despesa cadastrada.</p>
          ) : filteredDespesas.length === 0 ? (
            <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium text-center py-12">Nenhuma categoria encontrada com a busca atual.</p>
          ) : (
            filteredDespesas.map((item) => (
              <div 
                key={item.id}
                className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:shadow-sm transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-100 dark:border-zinc-700 flex items-center justify-center text-zinc-500 dark:text-zinc-400 flex-shrink-0">
                    <SquaresFour weight="duotone" className="w-6 h-6 text-zinc-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-zinc-950 dark:text-white leading-tight">{item.categoria}</h4>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">{item.descricao}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                  <button 
                    onClick={() => openEditModal(item)}
                    className="w-9 h-9 rounded-lg border border-zinc-100 dark:border-zinc-800 hover:border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:text-zinc-100 flex items-center justify-center transition-colors"
                  >
                    <PencilSimple className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDelete(item.id, item.categoria)}
                    className="w-9 h-9 rounded-lg border border-zinc-100 dark:border-zinc-800 hover:border-red-200 text-zinc-400 hover:text-red-600 flex items-center justify-center transition-colors"
                  >
                    <Trash className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )
        )}
      </div>

      {/* Editor Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={selectedId ? 'Editar Cadastro' : 'Novo Cadastro'}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <FormError message={formError} />
          <FormSection
            title={activeTab === 'servicos' ? 'Tipo de serviço' : 'Categoria de despesa'}
            description={activeTab === 'servicos' ? 'Cadastre serviços recorrentes para acelerar orçamentos.' : 'Padronize despesas usadas no controle financeiro.'}
            className="bg-white/70 dark:bg-zinc-800/35 dark:border-zinc-700/80"
          >
          {activeTab === 'servicos' ? (
            <>
              <div>
                <label htmlFor="cadastro-serv-nome" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Nome do Serviço</label>
                <input 
                  id="cadastro-serv-nome"
                  type="text" 
                  required 
                  value={servNome} 
                  onChange={e => setServNome(e.target.value)} 
                  placeholder="Ex: Demarcação Topográfica" 
                  className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3.5 text-sm font-semibold text-zinc-900 transition-all placeholder:text-zinc-400 focus:border-indigo-300 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-indigo-400/60" 
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="cadastro-serv-cat" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Categoria</label>
                  <FormSelect
                    id="cadastro-serv-cat"
                    value={servCategoria} 
                    onChange={e => setServCategoria(e.target.value)} 
                    className="w-full appearance-none rounded-xl border border-zinc-200 bg-white px-4 py-3.5 text-sm font-semibold text-zinc-900 transition-all focus:border-indigo-300 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-100 dark:focus:border-indigo-400/60"
                  >
                    <option value="Topografia">Topografia</option>
                    <option value="Georreferenciamento">Georreferenciamento</option>
                    <option value="Regularização">Regularização</option>
                    <option value="Consultoria">Consultoria</option>
                    <option value="Outro">Outro</option>
                  </FormSelect>
                </div>

                <div>
                  <label htmlFor="cadastro-serv-valor" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Valor Sugerido (R$)</label>
                  <input 
                    id="cadastro-serv-valor"
                    type="text" 
                    required
                    value={servValor} 
                    onChange={e => setServValor(e.target.value)} 
                    placeholder="0,00"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3.5 text-sm font-semibold text-zinc-900 transition-all placeholder:text-zinc-400 focus:border-indigo-300 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-indigo-400/60" 
                  />
                </div>
              </div>
              <div className="rounded-2xl border border-indigo-200/70 bg-indigo-50/80 px-4 py-3 text-xs font-medium leading-relaxed text-indigo-800 dark:border-indigo-400/20 dark:bg-indigo-400/10 dark:text-indigo-200">
                Este valor fica como referência inicial no orçamento, mas pode ser ajustado em cada proposta.
              </div>
            </>
          ) : (
            <>
              <div>
                <label htmlFor="cadastro-desp-cat" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Categoria da Despesa</label>
                <FormSelect
                  id="cadastro-desp-cat"
                  value={despCategoria} 
                  onChange={e => setDespCategoria(e.target.value)} 
                  className="w-full appearance-none rounded-xl border border-zinc-200 bg-white px-4 py-3.5 text-sm font-semibold text-zinc-900 transition-all focus:border-indigo-300 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-100 dark:focus:border-indigo-400/60"
                >
                  <option value="Combustível">Combustível</option>
                  <option value="Cartório">Cartório</option>
                  <option value="Alimentação">Alimentação</option>
                  <option value="Equipamento">Equipamento</option>
                  <option value="Salários/Diárias">Salários/Diárias</option>
                  <option value="Outro">Outro</option>
                </FormSelect>
              </div>

              <div>
                <label htmlFor="cadastro-desp-desc" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Descrição / Detalhe</label>
                <textarea 
                  id="cadastro-desp-desc"
                  value={despDescricao} 
                  onChange={e => setDespDescricao(e.target.value)} 
                  rows={3} 
                  required
                  placeholder="Ex: Abastecimento de caminhonete de campo..."
                  className="w-full resize-none rounded-xl border border-zinc-200 bg-white px-4 py-3.5 text-sm font-medium text-zinc-900 transition-all placeholder:text-zinc-400 focus:border-indigo-300 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-indigo-400/60"
                ></textarea>
              </div>
              <div className="rounded-2xl border border-indigo-200/70 bg-indigo-50/80 px-4 py-3 text-xs font-medium leading-relaxed text-indigo-800 dark:border-indigo-400/20 dark:bg-indigo-400/10 dark:text-indigo-200">
                Uma descrição clara melhora filtros, relatórios financeiros e importações futuras.
              </div>
            </>
          )}
          </FormSection>

          <FormFooter>
            <button 
              type="button" 
              onClick={() => setShowModal(false)} 
              className="px-6 py-3 rounded-full text-zinc-500 dark:text-zinc-400 font-semibold hover:text-zinc-950 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-xs"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className={cn(primarySubmitButtonClass, 'px-6 py-3 text-xs')}
            >
              Salvar
            </button>
          </FormFooter>
        </form>
      </Modal>
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={`Excluir ${deleteTarget?.type === 'servicos' ? 'serviço' : 'tipo de despesa'}${deleteTarget?.name ? ` “${deleteTarget.name}”` : ''}?`}
        description={deleteTarget?.type === 'servicos'
          ? 'O serviço deixará de aparecer neste cadastro auxiliar e nas seleções futuras. Os registros já existentes não serão alterados. Esta ação não pode ser desfeita.'
          : 'O tipo de despesa deixará de aparecer neste cadastro auxiliar e nas seleções futuras. As despesas já registradas não serão alteradas. Esta ação não pode ser desfeita.'}
        confirmText={deleteTarget?.type === 'servicos' ? 'Excluir serviço' : 'Excluir tipo de despesa'}
      />
    </Layout>
  );
}
