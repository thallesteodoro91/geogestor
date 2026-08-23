import { forwardRef, useEffect, useImperativeHandle, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Layout } from '../../components/Layout';
import { Modal } from '../../components/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DatePickerField, FormError, FormFooter, FormSection } from '../../components/Form';
import { motion } from 'framer-motion';
import { formatPhoneBR } from '../../utils/formatters';
import { CLIENT_ORIGIN_OPTIONS, getClientOriginTagClass } from '../../utils/clientTags';
import { cn } from '../../utils/cn';
import { apiClient } from '../../services/apiClient';
import { primaryActionButtonClass, primaryActionIconClass, primarySubmitButtonClass } from '../../utils/actionStyles';
import { 
  Plus, 
  AddressBook, 
  MagnifyingGlass, 
  Trash, 
  PencilSimple, 
  Phone, 
  EnvelopeSimple, 
  Buildings, 
  MapPin, 
  ArrowRight, 
  CheckCircle,
  WhatsappLogo,
  UserPlus,
  CalendarBlank,
  Globe
} from '@phosphor-icons/react';

export interface Contato {
  id: string;
  nome: string;
  email?: string | null;
  telefone?: string | null;
  empresa?: string | null;
  cidade?: string | null;
  observacoes?: string | null;
  origem?: string | null;
  dataCadastro?: string | null;
  status: 'ativo' | 'convertido';
  clienteConvertidoId?: string | null;
  convertidoEm?: string | null;
  createdAt?: string;
}

interface PaginatedContatos {
  items: Contato[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface ContatosHandle {
  openCreate: () => void;
}

interface ContatosProps {
  embedded?: boolean;
  toolbarLeading?: ReactNode;
}

export const Contatos = forwardRef<ContatosHandle, ContatosProps>(function Contatos({ embedded = false, toolbarLeading }, ref) {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchTerm = searchParams.get('q') || '';
  const statusParam = searchParams.get('status');
  const statusFilter: 'Todos' | 'ativo' | 'convertido' = statusParam === 'ativo' || statusParam === 'convertido' ? statusParam : 'Todos';
  const requestedPage = Number.parseInt(searchParams.get('page') || '1', 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = 12;
  const [showModal, setShowModal] = useState(false);
  const [editingContato, setEditingContato] = useState<Contato | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Contato | null>(null);
  const [formError, setFormError] = useState('');

  // Form states
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [cidade, setCidade] = useState('');
  const [origem, setOrigem] = useState('');
  const [dataCadastro, setDataCadastro] = useState(new Date().toISOString().split('T')[0]);
  const [observacoes, setObservacoes] = useState('');

  const { data, isLoading, isError, error, refetch } = useQuery<PaginatedContatos>({
    queryKey: ['contatos', { page, pageSize, q: searchTerm, status: statusFilter }],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (searchTerm) params.set('q', searchTerm);
      if (statusFilter !== 'Todos') params.set('status', statusFilter);
      return apiClient.get<PaginatedContatos>(`/api/contatos?${params.toString()}`);
    },
    placeholderData: (previous) => previous
  });
  const contatos = data?.items || [];
  const totalPages = data?.pagination.totalPages || 1;

  useEffect(() => {
    if (!isLoading && page > totalPages) {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        if (totalPages > 1) next.set('page', String(totalPages));
        else next.delete('page');
        return next;
      }, { replace: true });
    }
  }, [isLoading, page, setSearchParams, totalPages]);

  const updateUrlFilter = (key: string, value: string) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (value && value !== 'Todos') next.set(key, value);
      else next.delete(key);
      next.delete('page');
      return next;
    }, { replace: true });
  };

  const saveMutation = useMutation({
    mutationFn: async (payload: Partial<Contato>) => {
      if (editingContato) {
        return await apiClient.put<Contato>(`/api/contatos/${editingContato.id}`, payload);
      } else {
        return await apiClient.post<Contato>('/api/contatos', payload);
      }
    },
    onSuccess: () => {
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['contatos'] });
      queryClient.invalidateQueries({ queryKey: ['lead-analytics'] });
      handleCloseModal();
      toast.success(editingContato ? 'Lead atualizado.' : 'Lead cadastrado.');
    },
    onError: (err: unknown) => {
      setFormError(err instanceof Error ? err.message : 'Não foi possível salvar o contato.');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/contatos/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contatos'] });
      queryClient.invalidateQueries({ queryKey: ['lead-analytics'] });
      toast.success('Lead excluído.');
    },
    onError: (mutationError) => toast.error(mutationError instanceof Error ? mutationError.message : 'Não foi possível excluir o lead.')
  });

  const convertMutation = useMutation({
    mutationFn: async (contato: Contato) => {
      await apiClient.post(`/api/contatos/${contato.id}/converter`);
    },
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['contatos'] }),
        queryClient.invalidateQueries({ queryKey: ['lead-analytics'] }),
        queryClient.invalidateQueries({ queryKey: ['opportunities'] }),
        queryClient.invalidateQueries({ queryKey: ['opportunity-analytics'] }),
        queryClient.invalidateQueries({ queryKey: ['opportunity-options'] })
      ]);
    }
  });

  const handleOpenModal = (contato?: Contato) => {
    setFormError('');
    if (contato) {
      setEditingContato(contato);
      setNome(contato.nome || '');
      setEmail(contato.email || '');
      setTelefone(formatPhoneBR(contato.telefone || ''));
      setEmpresa(contato.empresa || '');
      setCidade(contato.cidade || '');
      setOrigem(contato.origem || '');
      setDataCadastro(contato.dataCadastro || contato.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0]);
      setObservacoes(contato.observacoes || '');
    } else {
      setEditingContato(null);
      setNome('');
      setEmail('');
      setTelefone('');
      setEmpresa('');
      setCidade('');
      setOrigem('');
      setDataCadastro(new Date().toISOString().split('T')[0]);
      setObservacoes('');
    }
    setShowModal(true);
  };

  useImperativeHandle(ref, () => ({
    openCreate: () => handleOpenModal()
  }));

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingContato(null);
    setFormError('');
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTelefone(formatPhoneBR(e.target.value));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!nome.trim()) {
      setFormError('Informe o nome ou referência do contato.');
      return;
    }
    saveMutation.mutate({
      nome,
      email,
      telefone,
      empresa,
      cidade,
      origem,
      dataCadastro,
      observacoes
    });
  };

  const handleExportToClient = async (contato: Contato) => {
    if (!confirm('Deseja converter este lead em cliente e criar ou atualizar sua oportunidade comercial?')) return;
    
    // Converte no backend (que agora cria Cliente e Oportunidade)
    convertMutation.mutate(contato, {
      onSuccess: () => {
        toast.success('Lead convertido em cliente e oportunidade comercial.');
      },
      onError: (conversionError) => {
        toast.error(conversionError instanceof Error ? conversionError.message : 'Não foi possível converter o lead. Tente novamente.');
      }
    });
  };

  const setPage = (nextPage: number) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (nextPage > 1) next.set('page', String(nextPage));
      else next.delete('page');
      return next;
    }, { replace: true });
  };

  const content = (
      <div className={cn('mx-auto w-full min-w-0 max-w-7xl animate-fadeIn', embedded ? 'space-y-6 pb-8' : 'space-y-8 pb-16 pt-8 md:pt-12')}>
        {/* Cabeçalho usado somente quando a listagem é exibida fora do CRM. */}
        {!embedded && <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-6 md:p-8 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <AddressBook weight="duotone" className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-heading font-bold text-zinc-900 dark:text-white">
                Leads
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Cadastre, acompanhe e converta leads sem perder o histórico comercial
              </p>
            </div>
          </div>

          <button
            onClick={() => handleOpenModal()}
            className={cn(primaryActionButtonClass, 'shrink-0')}
          >
            <span>Novo lead</span>
            <div className={primaryActionIconClass}>
              <Plus weight="bold" className="w-4 h-4" />
            </div>
          </button>
        </div>}

        {/* Filters and Search Bar */}
        <div className={cn('min-w-0', embedded && toolbarLeading && '2xl:flex 2xl:items-start 2xl:gap-4')}>
          {embedded && toolbarLeading ? <div className="min-w-0 2xl:flex-1">{toolbarLeading}</div> : null}
          <div className={cn('flex min-w-0 flex-col items-stretch gap-3 sm:flex-row sm:items-center', embedded && toolbarLeading && 'mt-3 2xl:mt-0 2xl:shrink-0')}>
          <div className="relative w-full min-w-0 sm:w-[32rem] sm:max-w-[55vw] 2xl:w-[26rem] 2xl:max-w-none">
            <MagnifyingGlass aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <label htmlFor="lead-search" className="sr-only">Buscar leads</label>
            <input
              id="lead-search"
              name="lead-search"
              type="search"
              autoComplete="off"
              placeholder="Buscar por contato, empresa ou cidade…"
              value={searchTerm}
              onChange={(e) => updateUrlFilter('q', e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-[background-color,border-color,color,box-shadow] shadow-sm"
            />
          </div>

          <div className="flex w-fit max-w-full self-start items-center gap-1 overflow-x-auto rounded-xl border border-zinc-200/60 bg-zinc-100 p-1 shadow-sm dark:border-zinc-700/60 dark:bg-zinc-800/80 sm:self-auto sm:gap-2">
            {(['Todos', 'ativo', 'convertido'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => updateUrlFilter('status', st)}
                aria-pressed={statusFilter === st}
                className={`shrink-0 whitespace-nowrap rounded-lg px-4 py-1.5 text-xs font-medium capitalize transition-[background-color,color,box-shadow] ${
                  statusFilter === st
                    ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                {st === 'ativo' ? 'Leads Ativos' : st === 'convertido' ? 'Já Convertidos' : 'Todos'}
              </button>
            ))}
          </div>
          </div>
        </div>

        {/* Grid List */}
        {isLoading ? (
          <div className="py-20 text-center text-zinc-400" role="status" aria-live="polite">Carregando leads…</div>
        ) : isError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-8 text-center dark:border-rose-400/20 dark:bg-rose-500/[0.07]">
            <p className="font-medium text-rose-700 dark:text-rose-200">{error instanceof Error ? error.message : 'Não foi possível carregar os leads.'}</p>
            <button type="button" onClick={() => refetch()} className="geo-button-base geo-button-secondary geo-focus-ring mt-4 min-h-10 px-4">Tentar novamente</button>
          </div>
        ) : contatos.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900/60 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-2xl p-16 text-center space-y-3">
            <AddressBook className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto" />
            <p className="text-zinc-600 dark:text-zinc-400 font-medium">Nenhum lead encontrado.</p>
            <p className="text-xs text-zinc-400">Ajuste os filtros ou cadastre um novo lead.</p>
          </div>
        ) : (
          <>
          <div className="grid min-w-0 grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {contatos.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`min-w-0 space-y-5 rounded-2xl border bg-white p-6 transition-[border-color,box-shadow] hover:shadow-md dark:bg-zinc-900 flex flex-col justify-between ${
                  item.status === 'convertido'
                    ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/20 dark:bg-emerald-950/10'
                    : 'border-zinc-200 dark:border-zinc-800'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-heading font-semibold text-zinc-900 dark:text-white text-base leading-tight">
                      {item.nome}
                    </h3>
                    {item.status === 'convertido' ? (
                      <span className="shrink-0 flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle weight="fill" className="w-3.5 h-3.5" />
                        Convertido
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        Ativo
                      </span>
                    )}
                  </div>

                  {item.empresa && (
                    <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                      <Buildings className="w-3.5 h-3.5 text-zinc-400" />
                      <span>{item.empresa}</span>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {item.cidade && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                        <span>{item.cidade}</span>
                      </div>
                    )}
                    {item.origem && (
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${getClientOriginTagClass(item.origem)}`}>
                        <Globe className="h-3 w-3" /> {item.origem}
                      </span>
                    )}
                    {item.dataCadastro && (
                      <div className="flex items-center gap-1 text-xs text-zinc-400">
                        <CalendarBlank className="w-3.5 h-3.5" />
                        <span>{new Date(item.dataCadastro + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-1 flex items-center gap-3 text-xs text-zinc-600 dark:text-zinc-300">
                    {item.telefone && (
                      <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800/80 px-2.5 py-1 rounded-lg border border-zinc-100 dark:border-zinc-800">
                        <Phone weight="bold" className="w-3 h-3 text-emerald-600" />
                        <span>{formatPhoneBR(item.telefone)}</span>
                      </div>
                    )}
                    {item.email && (
                      <div className="flex items-center gap-1.5 truncate">
                        <EnvelopeSimple className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span className="truncate">{item.email}</span>
                      </div>
                    )}
                  </div>

                  {item.observacoes && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/80 line-clamp-3">
                      {item.observacoes}
                    </p>
                  )}
                </div>

                {/* Footer Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800/80">
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      onClick={() => handleOpenModal(item)}
                      className="geo-focus-ring rounded-lg p-2 text-zinc-500 transition-colors hover:bg-indigo-50 hover:text-indigo-700 dark:text-zinc-300 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300"
                      title="Editar"
                      aria-label={`Editar lead ${item.nome}`}
                    >
                      <PencilSimple className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(item)}
                      className="geo-focus-ring rounded-lg p-2 text-zinc-500 transition-colors hover:bg-red-50 hover:text-red-700 dark:text-zinc-300 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                      title="Excluir"
                      aria-label={`Excluir lead ${item.nome}`}
                    >
                      <Trash className="w-5 h-5" />
                    </button>
                    {item.telefone && (
                      <a
                        href={`https://wa.me/55${item.telefone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="geo-focus-ring rounded-lg p-2 text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors flex items-center justify-center"
                        title="Abrir no WhatsApp"
                        aria-label="Abrir no WhatsApp"
                      >
                        <WhatsappLogo weight="bold" className="w-5 h-5" />
                      </a>
                    )}
                  </div>

                  <button
                      type="button"
                      onClick={() => item.status === 'ativo' && handleExportToClient(item)}
                      disabled={item.status === 'convertido' || convertMutation.isPending}
                    className={`ml-auto flex max-w-full items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold shadow-sm transition-[background-color,box-shadow,transform] active:scale-95 ${
                      item.status === 'convertido'
                        ? 'cursor-default bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                        : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/20'
                    }`}
                  >
                    <UserPlus weight="bold" className="w-3.5 h-3.5" />
                    <span>{item.status === 'convertido' ? 'Convertido' : convertMutation.isPending ? 'Convertendo…' : 'Converter lead'}</span>
                    <ArrowRight weight="bold" className="w-3 h-3" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
          {totalPages > 1 && (
            <nav aria-label="Paginação de leads" className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:flex-row dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-sm text-zinc-500 dark:text-zinc-400" aria-live="polite">
                Página <span className="font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">{page}</span> de <span className="font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">{totalPages}</span> · {data?.pagination.total || 0} lead(s)
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1}
                  className="geo-button-base geo-button-secondary geo-focus-ring min-h-10 px-4 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages}
                  className="geo-button-base geo-button-secondary geo-focus-ring min-h-10 px-4 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Próxima
                </button>
              </div>
            </nav>
          )}
          </>
        )}

        {/* Modal Amplo */}
        {showModal && (
          <Modal isOpen={showModal} onClose={handleCloseModal} title={editingContato ? "Editar lead" : "Novo lead"} maxWidth="max-w-2xl">
            <div className="space-y-4 pt-1">
              <form onSubmit={handleSave} className="space-y-5">
                <FormError message={formError} />
                <FormSection title="Dados do contato" description="Capture o essencial agora e complemente o relacionamento depois.">
                <div>
                  <label htmlFor="lead-name" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Nome Completo / Referência *
                  </label>
                  <input
                    id="lead-name"
                    name="nome"
                    type="text"
                    required
                    autoComplete="name"
                    placeholder="Ex: Arquiteto Roberto ou Proprietário Sítio Azul"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="w-full min-w-0 px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm font-medium focus:ring-2 focus:ring-emerald-500/30 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="lead-phone" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Telefone / Celular (com DDD)
                    </label>
                    <input
                      id="lead-phone"
                      name="telefone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="(48) 99618-7505"
                      value={telefone}
                      onChange={handlePhoneChange}
                      className="w-full min-w-0 px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm font-medium focus:ring-2 focus:ring-emerald-500/30 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="lead-email" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      E-mail
                    </label>
                    <input
                      id="lead-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      spellCheck={false}
                      placeholder="email@exemplo.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full min-w-0 px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm font-medium focus:ring-2 focus:ring-emerald-500/30 focus:outline-none"
                    />
                  </div>
                </div>

                </FormSection>

                <FormSection title="Contexto comercial">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="lead-company" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Empresa / Organização
                    </label>
                    <input
                      id="lead-company"
                      name="empresa"
                      type="text"
                      autoComplete="organization"
                      placeholder="Ex: Construtora Alfa"
                      value={empresa}
                      onChange={(e) => setEmpresa(e.target.value)}
                      className="w-full min-w-0 px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm font-medium focus:ring-2 focus:ring-emerald-500/30 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="lead-city" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Cidade / Região
                    </label>
                    <input
                      id="lead-city"
                      name="cidade"
                      type="text"
                      autoComplete="address-level2"
                      placeholder="Ex: Florianópolis - SC"
                      value={cidade}
                      onChange={(e) => setCidade(e.target.value)}
                      className="w-full min-w-0 px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm font-medium focus:ring-2 focus:ring-emerald-500/30 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Origem / Canal de Prospecção
                    </span>
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {CLIENT_ORIGIN_OPTIONS.map((opt) => {
                        const isCustom = !CLIENT_ORIGIN_OPTIONS.filter(o => o !== 'Outro').includes(origem);
                        const isSelected = opt === 'Outro' ? isCustom : origem === opt;
                        
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => {
                              if (opt === 'Outro') {
                                if (!isCustom) {
                                  setOrigem('');
                                }
                              } else {
                                setOrigem(opt);
                              }
                            }}
                            className={`rounded-lg px-2 py-1 text-xs font-bold transition-[background-color,border-color,color,box-shadow] ${
                              isSelected
                                ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600/30'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                            }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                    {(!CLIENT_ORIGIN_OPTIONS.filter(o => o !== 'Outro').includes(origem)) && (
                      <input
                        id="lead-origin"
                        name="origem"
                        aria-label="Origem personalizada"
                        type="text"
                        autoComplete="off"
                        placeholder="Ou digite origem personalizada..."
                        value={origem}
                        onChange={(e) => setOrigem(e.target.value)}
                        className="w-full min-w-0 px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm font-medium focus:ring-2 focus:ring-emerald-500/30 focus:outline-none"
                      />
                    )}
                  </div>

                  <div>
                    <label htmlFor="lead-created-at" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Data de Cadastro (Automática)
                    </label>
                    <DatePickerField
                      id="lead-created-at"
                      name="dataCadastro"
                      required
                      value={dataCadastro}
                      onChange={(e) => setDataCadastro(e.target.value)}
                      className="w-full min-w-0 px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm font-medium focus:ring-2 focus:ring-emerald-500/30 focus:outline-none"
                    />
                    <span className="text-xs text-zinc-400 mt-1 block">
                      Puxado automaticamente da data do seu computador
                    </span>
                  </div>
                </div>

                <div>
                  <label htmlFor="lead-notes" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Anotações Rápidas / Interesse
                  </label>
                  <textarea
                    id="lead-notes"
                    name="observacoes"
                    rows={3}
                    placeholder="Ex: Quer orçar georreferenciamento de 40ha para o mês que vem."
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    className="w-full min-w-0 px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm font-medium focus:ring-2 focus:ring-emerald-500/30 focus:outline-none resize-none"
                  />
                </div>
                </FormSection>

                <FormFooter>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-5 py-2.5 rounded-full text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-[background-color,border-color,color,box-shadow,transform] shadow-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saveMutation.isPending}
                    className={cn(primarySubmitButtonClass, 'px-6 py-2.5 text-xs font-bold')}
                  >
                    {saveMutation.isPending ? 'Salvando…' : 'Salvar lead'}
                  </button>
                </FormFooter>
              </form>
            </div>
          </Modal>
        )}
        <ConfirmDialog
          isOpen={Boolean(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); }}
          title={`Excluir lead${deleteTarget?.nome ? ` “${deleteTarget.nome}”` : ''}?`}
          description="O lead será removido do CRM somente se não possuir oportunidades comerciais ativas. Clientes já convertidos e registros comerciais existentes serão preservados. Esta ação não pode ser desfeita."
          confirmText="Excluir lead"
          loading={deleteMutation.isPending}
        />
      </div>
  );

  return embedded ? content : <Layout>{content}</Layout>;
});
