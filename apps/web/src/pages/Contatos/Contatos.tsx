import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { Modal } from '../../components/Modal';
import { FormError, FormFooter, FormSection } from '../../components/Form';
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
  createdAt?: string;
}

export function Contatos() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Todos' | 'ativo' | 'convertido'>('Todos');
  const [showModal, setShowModal] = useState(false);
  const [editingContato, setEditingContato] = useState<Contato | null>(null);
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

  const { data: contatos = [], isLoading } = useQuery<Contato[]>({
    queryKey: ['contatos'],
    queryFn: async () => {
      try {
        return await apiClient.get<Contato[]>('/api/contatos');
      } catch {
        return [];
      }
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: Partial<Contato>) => {
      if (editingContato) {
        return await apiClient.put<Contato>(`/api/contatos/${editingContato.id}`, payload);
      } else {
        return await apiClient.post<Contato>('/api/contatos', payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contatos'] });
      handleCloseModal();
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
    }
  });

  const convertMutation = useMutation({
    mutationFn: async (contato: Contato) => {
      await apiClient.post(`/api/contatos/${contato.id}/converter`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contatos'] });
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
    if (!confirm('Deseja converter este contato em um Cliente e inseri-lo no CRM?')) return;
    
    // Converte no backend (que agora cria Cliente e Oportunidade)
    convertMutation.mutate(contato, {
      onSuccess: () => {
        alert('✅ Sucesso! O Lead foi convertido em Cliente e já está no Funil de Vendas (CRM).');
      },
      onError: () => {
        alert('❌ Erro ao converter o Lead. Tente novamente.');
      }
    });
  };

  const filteredContatos = contatos.filter(item => {
    const matchesSearch = !searchTerm || 
      item.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.empresa && item.empresa.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.cidade && item.cidade.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'Todos' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-8 pt-8 md:pt-12 pb-16 animate-fadeIn">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-6 md:p-8 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <AddressBook weight="duotone" className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-heading font-bold text-zinc-900 dark:text-white">
                Contatos & Leads
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Cadastre prospecções rápidas e converta em clientes com um clique
              </p>
            </div>
          </div>

          <button
            onClick={() => handleOpenModal()}
            className={cn(primaryActionButtonClass, 'shrink-0')}
          >
            <span>Novo Contato</span>
            <div className={primaryActionIconClass}>
              <Plus weight="bold" className="w-4 h-4" />
            </div>
          </button>
        </div>

        {/* Filters and Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-[1.5rem] border border-zinc-200/70 bg-white/85 shadow-sm backdrop-blur dark:border-zinc-700/80 dark:bg-zinc-800/50">
          <div className="relative flex-1 max-w-md">
            <MagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar por nome, empresa ou cidade..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all shadow-sm"
            />
          </div>

          <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60">
            {(['Todos', 'ativo', 'convertido'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
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

        {/* Grid List */}
        {isLoading ? (
          <div className="py-20 text-center text-zinc-400">Carregando contatos...</div>
        ) : filteredContatos.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900/60 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-2xl p-16 text-center space-y-3">
            <AddressBook className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto" />
            <p className="text-zinc-600 dark:text-zinc-400 font-medium">Nenhum contato encontrado.</p>
            <p className="text-xs text-zinc-400">Clique em "Novo Contato" para adicionar sua primeira prospecção.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredContatos.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-white dark:bg-zinc-900 rounded-2xl border transition-all hover:shadow-md flex flex-col justify-between p-6 space-y-5 ${
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
                      <span className="shrink-0 text-xs font-medium text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                        Lead
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
                <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenModal(item)}
                      className="p-2 text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                      title="Editar"
                      aria-label="Editar contato"
                    >
                      <PencilSimple className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Excluir contato ${item.nome}?`)) deleteMutation.mutate(item.id);
                      }}
                      className="p-2 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      title="Excluir"
                      aria-label="Excluir contato"
                    >
                      <Trash className="w-5 h-5" />
                    </button>
                    {item.telefone && (
                      <a
                        href={`https://wa.me/55${item.telefone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors flex items-center justify-center"
                        title="Abrir no WhatsApp"
                        aria-label="Abrir no WhatsApp"
                      >
                        <WhatsappLogo weight="bold" className="w-5 h-5" />
                      </a>
                    )}
                  </div>

                  <button
                    onClick={() => handleExportToClient(item)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all active:scale-95 ${
                      item.status === 'convertido'
                        ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-emerald-600 hover:text-white'
                        : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/20'
                    }`}
                  >
                    <UserPlus weight="bold" className="w-3.5 h-3.5" />
                    <span>{item.status === 'convertido' ? 'Re-exportar' : 'Exportar p/ Clientes'}</span>
                    <ArrowRight weight="bold" className="w-3 h-3" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Modal Amplo */}
        {showModal && (
          <Modal isOpen={showModal} onClose={handleCloseModal} title={editingContato ? "Editar Contato" : "Novo Contato"} maxWidth="max-w-2xl">
            <div className="space-y-4 pt-1">
              <form onSubmit={handleSave} className="space-y-5">
                <FormError message={formError} />
                <FormSection title="Dados do contato" description="Capture o essencial agora e complemente o relacionamento depois.">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Nome Completo / Referência *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Arquiteto Roberto ou Proprietário Sítio Azul"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="w-full min-w-0 px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm font-medium focus:ring-2 focus:ring-emerald-500/30 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Telefone / Celular (com DDD)
                    </label>
                    <input
                      type="text"
                      placeholder="(48) 99618-7505"
                      value={telefone}
                      onChange={handlePhoneChange}
                      className="w-full min-w-0 px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm font-medium focus:ring-2 focus:ring-emerald-500/30 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      E-mail
                    </label>
                    <input
                      type="email"
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
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Empresa / Organização
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Construtora Alfa"
                      value={empresa}
                      onChange={(e) => setEmpresa(e.target.value)}
                      className="w-full min-w-0 px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm font-medium focus:ring-2 focus:ring-emerald-500/30 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Cidade / Região
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Florianópolis - SC"
                      value={cidade}
                      onChange={(e) => setCidade(e.target.value)}
                      className="w-full min-w-0 px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm font-medium focus:ring-2 focus:ring-emerald-500/30 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Origem / Canal de Prospecção
                    </label>
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
                            className={`rounded-lg px-2 py-1 text-xs font-bold transition-all ${
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
                        type="text"
                        placeholder="Ou digite origem personalizada..."
                        value={origem}
                        onChange={(e) => setOrigem(e.target.value)}
                        className="w-full min-w-0 px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm font-medium focus:ring-2 focus:ring-emerald-500/30 focus:outline-none"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Data de Cadastro (Automática)
                    </label>
                    <input
                      type="date"
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
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Anotações Rápidas / Interesse
                  </label>
                  <textarea
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
                    className="px-5 py-2.5 rounded-full text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all shadow-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saveMutation.isPending}
                    className={cn(primarySubmitButtonClass, 'px-6 py-2.5 text-xs font-bold')}
                  >
                    {saveMutation.isPending ? 'Salvando...' : 'Salvar Contato'}
                  </button>
                </FormFooter>
              </form>
            </div>
          </Modal>
        )}
      </div>
    </Layout>
  );
}
