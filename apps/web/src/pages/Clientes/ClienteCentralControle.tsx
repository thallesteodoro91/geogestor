import { DatePickerField, FormSelect, TimePickerField } from '../../components/Form';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Calendar,
  Check,
  CurrencyDollar,
  FileText,
  Info,
  ListChecks,
  Minus,
  Note,
  PencilSimple,
  Plus,
  Trash
} from '@phosphor-icons/react';
import { ModalAdicionarNota } from '../../components/ModalAdicionarNota';
import { Modal } from '../../components/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { getTaskPriorityTone } from '../../utils/taskPriority';
import { cn } from '../../utils/cn';
import { primarySmallActionButtonClass, primarySubmitButtonClass, secondarySmallActionButtonClass } from '../../utils/actionStyles';
import { geoFieldClass } from '../../utils/geoTheme';
import { apiFetch } from '../../services/apiClient';

type Projeto = {
  id: string;
  nome: string;
  status?: string | null;
  areaHa?: number | null;
  cidade?: string | null;
  municipio?: string | null;
  dataEntrega?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

type TaskPriority = 'Baixa' | 'Média' | 'Alta';

type Orcamento = {
  id: string;
  projetoId?: string | null;
  projetoNome?: string | null;
  codigoOrcamento?: string | null;
  descricao?: string | null;
  status?: string | null;
  valorTotal?: number | null;
  dataOrcamento?: string | null;
  createdAt?: string | null;
};

type Historico = {
  id: string;
  tipo: string;
  titulo?: string | null;
  categoria?: string | null;
  projetoId?: string | null;
  orcamentoId?: string | null;
  manual?: boolean | null;
  data: string;
  descricao: string;
};

type Tarefa = {
  id: string;
  clienteId?: string | null;
  clienteNome?: string | null;
  projetoId?: string | null;
  projetoNome?: string | null;
  titulo: string;
  descricao?: string | null;
  status: string;
  prioridade?: string | null;
  categoria?: string | null;
  contextoTipo?: string | null;
  dataLimite?: string | null;
};

type Compromisso = {
  id: string;
  titulo: string;
  descricao?: string | null;
  data: string;
  tipo: string;
  hora?: string | null;
  clienteId?: string | null;
  clienteNome?: string | null;
  projetoId?: string | null;
  projetoNome?: string | null;
};

interface TimelineItemData {
  editable?: boolean;
  source?: string;
  sourceId?: string;
  tipo?: string;
  tag?: string;
  date?: string;
  titulo?: string;
  title?: string;
  descricao?: string;
  body?: string;
  projetoId?: string;
}

interface ClienteCentralControleProps {
  clienteId: string;
  projetos: Projeto[];
  orcamentos: Orcamento[];
  historico: Historico[];
  loadingHistorico?: boolean;
  onlyTimeline?: boolean;
}

const API_BASE = '/api';

function isDone(status?: string | null) {
  return status === 'Concluído' || status === 'Concluido';
}

function formatDate(value?: string | null, withTime = false) {
  if (!value) return 'Sem data';
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString('pt-BR', withTime ? {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  } : {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function formatCurrency(cents?: number | null) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100);
}

const centralFieldClass = cn(geoFieldClass, 'px-3 py-2.5 text-sm font-medium');
const centralCompactFieldClass = cn(geoFieldClass, 'h-9 px-3 text-xs font-bold');
const centralTextareaClass = cn(geoFieldClass, 'resize-none px-3 py-2.5 text-sm font-medium');
const centralPanelClass = 'geo-card flex flex-col p-6';
const centralIconButtonClass = 'geo-focus-ring inline-flex items-center justify-center rounded-lg border border-brand-border bg-brand-surface text-zinc-500 shadow-sm transition-[background-color,color,border-color,transform] duration-150 hover:border-brand-primary-300/60 hover:bg-brand-primary-50/70 hover:text-brand-primary-700 active:scale-95 dark:text-zinc-300 dark:hover:bg-brand-primary-400/10 dark:hover:text-brand-primary-100';

function statusTone(status?: string | null) {
  if (isDone(status)) return 'geo-badge-base geo-badge-success';
  if (status === 'Aprovado' || status === 'Pago' || status === 'Em Andamento') return 'geo-badge-base geo-badge-primary';
  if (status === 'Rejeitado' || status === 'Atrasado') return 'geo-badge-base geo-badge-danger';
  return 'geo-badge-base geo-badge-warning';
}


function splitHistoricDescription(description?: string | null, fallbackTitle = '') {
  const safeDesc = String(description || '');
  const lines = safeDesc.split('\n').map(line => line.trim()).filter(Boolean);
  if (lines.length > 1 && lines[0].length <= 90) {
    return { title: lines[0], body: lines.slice(1).join('\n') };
  }
  return { title: fallbackTitle, body: safeDesc };
}

function normalizeTimelineText(value?: string | null) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function ClienteCentralControle({
  clienteId,
  projetos,
  orcamentos,
  historico,
  loadingHistorico = false,
  onlyTimeline = false
}: ClienteCentralControleProps) {
  const queryClient = useQueryClient();
  const projetoIds = useMemo(() => new Set(projetos.map(projeto => projeto.id)), [projetos]);

  const [showEventForm, setShowEventForm] = useState(false);
  const [isNotaModalOpen, setIsNotaModalOpen] = useState(false);
  const [eventTipo, setEventTipo] = useState('Observação');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventProjetoId, setEventProjetoId] = useState('');
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskProjetoId, setTaskProjetoId] = useState('');
  const [taskTitulo, setTaskTitulo] = useState('');
  const [taskDescricao, setTaskDescricao] = useState('');
  const [taskPrioridade, setTaskPrioridade] = useState<TaskPriority>('Média');
  const [taskDataLimite, setTaskDataLimite] = useState('');
  const [editingTaskId, setEditingTaskId] = useState('');

  const [showAgendaForm, setShowAgendaForm] = useState(false);
  const [agendaProjetoId, setAgendaProjetoId] = useState('');
  const [agendaTitulo, setAgendaTitulo] = useState('');
  const [agendaDescricao, setAgendaDescricao] = useState('');
  const [agendaData, setAgendaData] = useState(new Date().toISOString().split('T')[0]);
  const [agendaHora, setAgendaHora] = useState('');
  const [agendaTipo, setAgendaTipo] = useState('Visita de Campo');
  const [editingAgendaId, setEditingAgendaId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<
    | { type: 'task'; item: Tarefa }
    | { type: 'agenda'; item: Compromisso }
    | null
  >(null);

  const { data: tarefas = [], isLoading: loadingTarefas } = useQuery({
    queryKey: ['cliente-central-tarefas', clienteId],
    queryFn: async () => {
      const res = await apiFetch(`${API_BASE}/tarefas?clienteId=${clienteId}`);
      if (!res.ok) return [];
      return res.json();
    }
  });

  const { data: compromissos = [], isLoading: loadingCompromissos } = useQuery({
    queryKey: ['cliente-central-compromissos', clienteId],
    queryFn: async () => {
      const res = await apiFetch(`${API_BASE}/compromissos?clienteId=${clienteId}`);
      if (!res.ok) return [];
      return res.json();
    }
  });

  const { data: arquivosResumo = { cliente: 0, projetos: {} as Record<string, number>, total: 0 } } = useQuery({
    queryKey: ['cliente-central-arquivos', clienteId, projetos.map(projeto => projeto.id).join('|')],
    queryFn: async () => {
      const clienteFiles = await apiFetch(`${API_BASE}/arquivos/cliente/${clienteId}`)
        .then(res => res.ok ? res.json() : { files: [] })
        .catch(() => ({ files: [] }));

      const projetosFiles = await Promise.all(projetos.map(async (projeto) => {
        const data = await apiFetch(`${API_BASE}/arquivos/projeto/${projeto.id}`)
          .then(res => res.ok ? res.json() : { files: [] })
          .catch(() => ({ files: [] }));
        return [projeto.id, Array.isArray(data.files) ? data.files.length : 0] as const;
      }));

      const projetosMap = Object.fromEntries(projetosFiles);
      const clienteCount = Array.isArray(clienteFiles.files) ? clienteFiles.files.length : 0;
      const projetosCount = Object.values(projetosMap).reduce((acc, count) => acc + count, 0);

      return {
        cliente: clienteCount,
        projetos: projetosMap,
        total: clienteCount + projetosCount
      };
    }
  });

  const clienteTarefas = useMemo(
    () => (tarefas as Tarefa[]).filter(tarefa => tarefa.clienteId === clienteId || (tarefa.projetoId && projetoIds.has(tarefa.projetoId))),
    [clienteId, projetoIds, tarefas]
  );

  const clienteCompromissos = useMemo(
    () => (compromissos as Compromisso[]).filter(compromisso => compromisso.clienteId === clienteId || (compromisso.projetoId && projetoIds.has(compromisso.projetoId))),
    [clienteId, compromissos, projetoIds]
  );

  const tarefasPendentes = clienteTarefas.filter(tarefa => !isDone(tarefa.status));
  const tarefasConcluidas = clienteTarefas.length - tarefasPendentes.length;
  const taskProgress = clienteTarefas.length > 0 ? Math.round((tarefasConcluidas / clienteTarefas.length) * 100) : 0;

  const resetEventForm = () => {
    setEventTipo('Observação');
    setEventDate(new Date().toISOString().split('T')[0]);
    setEventTitle('');
    setEventDescription('');
    setEventProjetoId('');
    setEditingEventId(null);
  };

  const addEventMutation = useMutation({
    mutationFn: async () => {
      const description = eventDescription.trim() || eventTitle.trim();
      const res = await apiFetch(`${API_BASE}/clientes/${clienteId}/historico`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: eventTipo,
          titulo: eventTitle.trim() || eventTipo,
          categoria: eventTipo,
          projetoId: eventProjetoId || null,
          data: eventDate,
          descricao: description
        })
      });
      if (!res.ok) throw new Error('Erro ao registrar evento');
      return res.json();
    },
    onSuccess: () => {
      resetEventForm();
      setShowEventForm(false);
      queryClient.invalidateQueries({ queryKey: ['cliente-historico', clienteId] });
    },
    onError: () => alert('Erro ao registrar evento na jornada do cliente.')
  });

  const updateEventMutation = useMutation({
    mutationFn: async () => {
      if (!editingEventId) throw new Error('Evento não selecionado');
      const description = eventDescription.trim() || eventTitle.trim();
      const res = await apiFetch(`${API_BASE}/clientes/${clienteId}/historico/${editingEventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: eventTipo,
          titulo: eventTitle.trim() || eventTipo,
          categoria: eventTipo,
          projetoId: eventProjetoId || null,
          data: eventDate,
          descricao: description
        })
      });
      if (!res.ok) throw new Error('Erro ao atualizar evento');
      return res.json();
    },
    onSuccess: () => {
      resetEventForm();
      setShowEventForm(false);
      queryClient.invalidateQueries({ queryKey: ['cliente-historico', clienteId] });
    },
    onError: () => alert('Erro ao atualizar evento da jornada do cliente.')
  });

  const addTaskMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`${API_BASE}/tarefas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId,
          projetoId: taskProjetoId || null,
          titulo: taskTitulo,
          descricao: taskDescricao,
          status: 'A Fazer',
          prioridade: taskPrioridade,
          categoria: taskProjetoId ? 'Trabalho' : 'Interno',
          dataLimite: taskDataLimite
        })
      });
      if (!res.ok) throw new Error('Erro ao criar tarefa');
      return res.json();
    },
    onSuccess: () => {
      setTaskTitulo('');
      setTaskDescricao('');
      setTaskDataLimite('');
      setShowTaskForm(false);
      setEditingTaskId('');
      queryClient.invalidateQueries({ queryKey: ['cliente-central-tarefas', clienteId] });
      queryClient.invalidateQueries({ queryKey: ['tarefas'] });
      if (taskProjetoId) queryClient.invalidateQueries({ queryKey: ['projeto-tarefas', taskProjetoId] });
    },
    onError: () => alert('Erro ao criar tarefa.')
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, data }: { taskId: string; data: Record<string, unknown> }) => {
      const res = await apiFetch(`${API_BASE}/tarefas/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Erro ao atualizar tarefa');
      return res.json();
    },
    onSuccess: () => {
      setTaskTitulo('');
      setTaskDescricao('');
      setTaskDataLimite('');
      setShowTaskForm(false);
      setEditingTaskId('');
      queryClient.invalidateQueries({ queryKey: ['cliente-central-tarefas', clienteId] });
      queryClient.invalidateQueries({ queryKey: ['tarefas'] });
    },
    onError: () => alert('Erro ao atualizar tarefa.')
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await apiFetch(`${API_BASE}/tarefas/${taskId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao excluir tarefa');
      return res.json();
    },
    onSuccess: () => {
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['cliente-central-tarefas', clienteId] });
      queryClient.invalidateQueries({ queryKey: ['tarefas'] });
    },
    onError: () => alert('Erro ao excluir tarefa.')
  });

  const addAgendaMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`${API_BASE}/compromissos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId,
          projetoId: agendaProjetoId || null,
          titulo: agendaTitulo,
          descricao: agendaDescricao,
          data: agendaData,
          hora: agendaHora || null,
          tipo: agendaTipo
        })
      });
      if (!res.ok) throw new Error('Erro ao criar compromisso');
      return res.json();
    },
    onSuccess: () => {
      setAgendaTitulo('');
      setAgendaDescricao('');
      setAgendaProjetoId('');
      setAgendaHora('');
      setShowAgendaForm(false);
      setEditingAgendaId('');
      queryClient.invalidateQueries({ queryKey: ['cliente-central-compromissos', clienteId] });
      queryClient.invalidateQueries({ queryKey: ['compromissos'] });
    },
    onError: () => alert('Erro ao criar compromisso na agenda.')
  });

  const updateAgendaMutation = useMutation({
    mutationFn: async ({ agendaId, data }: { agendaId: string; data: Record<string, unknown> }) => {
      const res = await apiFetch(`${API_BASE}/compromissos/${agendaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Erro ao atualizar compromisso');
      return res.json();
    },
    onSuccess: () => {
      setAgendaTitulo('');
      setAgendaDescricao('');
      setAgendaProjetoId('');
      setAgendaHora('');
      setShowAgendaForm(false);
      setEditingAgendaId('');
      queryClient.invalidateQueries({ queryKey: ['cliente-central-compromissos', clienteId] });
      queryClient.invalidateQueries({ queryKey: ['compromissos'] });
    },
    onError: () => alert('Erro ao atualizar compromisso na agenda.')
  });

  const deleteAgendaMutation = useMutation({
    mutationFn: async (agendaId: string) => {
      const res = await apiFetch(`${API_BASE}/compromissos/${agendaId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao excluir compromisso');
      return res.json();
    },
    onSuccess: (_data, agendaId) => {
      setDeleteTarget(null);
      if (editingAgendaId === agendaId) {
        setAgendaTitulo('');
        setAgendaDescricao('');
        setAgendaProjetoId('');
        setAgendaHora('');
        setShowAgendaForm(false);
        setEditingAgendaId('');
      }
      queryClient.invalidateQueries({ queryKey: ['cliente-central-compromissos', clienteId] });
      queryClient.invalidateQueries({ queryKey: ['compromissos'] });
    },
    onError: () => alert('Erro ao excluir compromisso da agenda.')
  });

  const timelineItems = useMemo(() => {
    const eventos = (historico || []).map(item => {
      const safeDesc = item.descricao || '';
      const parsed = splitHistoricDescription(safeDesc, item.tipo || 'Evento');
      const projetoNome = item.projetoId ? projetos.find(projeto => projeto.id === item.projetoId)?.nome : null;
      return {
        id: `historico-${item.id}`,
        source: 'historico',
        sourceId: item.id,
        editable: item.manual !== false,
        tipo: item.tipo || 'Geral',
        titulo: item.titulo || '',
        categoria: item.categoria || item.tipo || 'Geral',
        projetoId: item.projetoId || '',
        orcamentoId: item.orcamentoId || '',
        descricao: safeDesc,
        date: item.data || new Date().toISOString(),
        title: item.titulo || parsed.title || 'Registro',
        body: `${item.titulo ? safeDesc : parsed.body}${projetoNome ? `\nPropriedade: ${projetoNome}` : ''}`,
        tag: item.categoria || item.tipo || 'Geral',
        tone: item.tipo === 'Servico' ? 'indigo' : item.tipo === 'Financeiro' ? 'emerald' : item.tipo === 'Nota' ? 'amber' : item.tipo === 'Tarefa' ? 'teal' : (item.tipo === 'Agenda' || item.tipo === 'Compromisso') ? 'violet' : 'zinc',
        sortDate: item.data ? new Date(item.data).getTime() : 0
      };
    });

    const eventText = eventos.map(item => normalizeTimelineText([
      item.title,
      item.body,
      item.tag,
      item.sourceId
    ].join(' ')));

    const hasHistoricMatch = (values: Array<string | null | undefined>) => {
      const candidates = values.map(normalizeTimelineText).filter(Boolean);
      return candidates.some(candidate => eventText.some(text => text.includes(candidate)));
    };

    const budgets = orcamentos
      .filter(orcamento => !eventos.some(item => item.orcamentoId === orcamento.id) && !hasHistoricMatch([
        orcamento.codigoOrcamento,
        orcamento.descricao
      ]))
      .map(orcamento => ({
      id: `orcamento-${orcamento.id}`,
      source: 'orcamento',
      sourceId: orcamento.id,
      editable: false,
      tipo: 'Orçamento',
      date: orcamento.dataOrcamento || orcamento.createdAt || '',
      title: orcamento.codigoOrcamento || 'Orçamento emitido',
      body: `${orcamento.descricao || 'Proposta vinculada ao cliente'} - ${formatCurrency(orcamento.valorTotal)}${orcamento.projetoNome ? `\nPropriedade: ${orcamento.projetoNome}` : '\nOrcamento geral do cliente'}`,
      tag: orcamento.status || 'Orçamento',
      tone: 'indigo',
      sortDate: new Date(orcamento.dataOrcamento || orcamento.createdAt || '').getTime() || 0
    }));

    const agenda = clienteCompromissos
      .filter(compromisso => !hasHistoricMatch([compromisso.titulo, compromisso.descricao]))
      .map(compromisso => ({
      id: `agenda-${compromisso.id}`,
      source: 'agenda',
      sourceId: compromisso.id,
      editable: false,
      tipo: 'Agenda',
      date: compromisso.data,
      title: compromisso.titulo,
      body: `${compromisso.tipo}${compromisso.projetoNome ? ` - ${compromisso.projetoNome}` : ' - Cliente geral'}${compromisso.descricao ? `\n${compromisso.descricao}` : ''}`,
      tag: 'Agenda',
      tone: 'violet',
      sortDate: new Date(`${compromisso.data}T00:00:00`).getTime() || 0
    }));

    const tarefasConcluidasTimeline = clienteTarefas
      .filter(tarefa => isDone(tarefa.status))
      .filter(tarefa => !hasHistoricMatch([tarefa.titulo, tarefa.descricao]))
      .map(tarefa => ({
        id: `tarefa-${tarefa.id}`,
        source: 'tarefa',
        sourceId: tarefa.id,
        editable: false,
        tipo: 'Tarefa',
        date: tarefa.dataLimite || '',
        title: 'Tarefa concluida',
        body: `${tarefa.titulo}${tarefa.projetoNome ? `\nPropriedade: ${tarefa.projetoNome}` : '\nCliente geral'}`,
        tag: tarefa.categoria || 'Tarefa',
        tone: 'emerald',
        sortDate: new Date(tarefa.dataLimite || '').getTime() || 0
      }));

    return [...eventos, ...budgets, ...agenda, ...tarefasConcluidasTimeline].sort((a, b) => b.sortDate - a.sortDate);
  }, [clienteCompromissos, clienteTarefas, historico, orcamentos, projetos]);

  const nextCompromissos = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingCompromissos = clienteCompromissos
      .filter(item => new Date(`${item.data}T00:00:00`).getTime() >= today.getTime())
      .map(item => ({ ...item, isProjectDeadline: false }));

    const upcomingProjetos = projetos
      .filter(p => p.dataEntrega && new Date(`${p.dataEntrega}T00:00:00`).getTime() >= today.getTime())
      .map(p => ({
        id: `proj-${p.id}`,
        titulo: `Entrega: ${p.nome}`,
        projetoNome: p.nome,
        clienteNome: '',
        data: p.dataEntrega || '',
        hora: 'Dia todo',
        tipo: 'Projeto',
        isProjectDeadline: true
      }));

    return [...upcomingCompromissos, ...upcomingProjetos]
      .sort((a, b) => new Date(`${a.data}T00:00:00`).getTime() - new Date(`${b.data}T00:00:00`).getTime())
      .slice(0, 15);
  }, [clienteCompromissos, projetos]);

  const handleAddEvent = (event: React.FormEvent) => {
    event.preventDefault();
    if (!eventTitle.trim() && !eventDescription.trim()) return;
    if (editingEventId) {
      updateEventMutation.mutate();
    } else {
      addEventMutation.mutate();
    }
  };

  const handleEditTimelineItem = (item: TimelineItemData) => {
    if (!item.editable || item.source !== 'historico') return;
    setEditingEventId(item.sourceId ?? null);
    setEventTipo(item.tipo || item.tag || 'Observação');
    setEventDate(item.date ? item.date.slice(0, 10) : new Date().toISOString().split('T')[0]);
    setEventTitle(item.titulo || item.title || '');
    setEventDescription(item.descricao || item.body || '');
    setEventProjetoId(item.projetoId || '');
    setShowEventForm(true);
  };

  const handleCancelEventForm = () => {
    resetEventForm();
    setShowEventForm(false);
  };

  const handleAddTask = (event: React.FormEvent) => {
    event.preventDefault();
    if (!taskTitulo.trim()) return;
    if (editingTaskId) {
      updateTaskMutation.mutate({ taskId: editingTaskId, data: {
        titulo: taskTitulo,
        descricao: taskDescricao,
        prioridade: taskPrioridade,
        dataLimite: taskDataLimite,
        projetoId: taskProjetoId || null
      } });
    } else {
      addTaskMutation.mutate();
    }
  };

  const handleEditTask = (tarefa: Tarefa) => {
    setTaskProjetoId(tarefa.projetoId || '');
    setTaskTitulo(tarefa.titulo);
    setTaskDescricao(tarefa.descricao || '');
    setTaskPrioridade((tarefa.prioridade || 'Média') as TaskPriority);
    setTaskDataLimite(tarefa.dataLimite || '');
    setEditingTaskId(tarefa.id);
    setShowTaskForm(true);
  };

  const handleAddAgenda = (event: React.FormEvent) => {
    event.preventDefault();
    if (!agendaTitulo.trim() || !agendaData) return;
    if (editingAgendaId) {
      updateAgendaMutation.mutate({ agendaId: editingAgendaId, data: {
        projetoId: agendaProjetoId || null,
        titulo: agendaTitulo,
        descricao: agendaDescricao,
        data: agendaData,
        hora: agendaHora || null,
        tipo: agendaTipo
      } });
    } else {
      addAgendaMutation.mutate();
    }
  };

  const handleEditAgenda = (compromisso: Compromisso) => {
    setAgendaProjetoId(compromisso.projetoId || '');
    setAgendaTitulo(compromisso.titulo || '');
    setAgendaDescricao(compromisso.descricao || '');
    setAgendaData(compromisso.data || '');
    setAgendaHora(compromisso.hora || '');
    setAgendaTipo(compromisso.tipo || 'Visita de Campo');
    setEditingAgendaId(compromisso.id);
    setShowAgendaForm(true);
  };

  return (
    <div className={cn('space-y-6', onlyTimeline && 'h-full')}>
      {!onlyTimeline && projetos.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {projetos.slice(0, 3).map(projeto => (
            <Link
              key={projeto.id}
              to={`/projetos/${projeto.id}`}
              className="geo-card-interactive group p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-950 dark:text-white truncate">{projeto.nome}</p>
                  <p className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400 truncate">
                    {projeto.cidade || projeto.municipio || 'Localidade não informada'}
                  </p>
                </div>
                <span className={cn('whitespace-nowrap px-2 py-0.5 text-xs font-bold', statusTone(projeto.status))}>
                  {projeto.status || 'Ativo'}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                <span className="geo-badge-base geo-badge-neutral px-2 py-1 text-xs">
                  {projeto.areaHa ? `${projeto.areaHa} ha` : 'Área pendente'}
                </span>
                <span className="geo-badge-base geo-badge-neutral px-2 py-1 text-xs">
                  {projeto.latitude && projeto.longitude ? 'Mapa vinculado' : 'Sem coordenadas'}
                </span>
                <span className="geo-badge-base geo-badge-neutral px-2 py-1 text-xs">
                  {orcamentos.filter(orcamento => orcamento.projetoId === projeto.id).length} orc.
                </span>
                <span className="geo-badge-base geo-badge-neutral px-2 py-1 text-xs">
                  {arquivosResumo.projetos[projeto.id] || 0} doc.
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className={cn("grid gap-5", onlyTimeline ? "h-full grid-cols-1" : "grid-cols-1 xl:grid-cols-[minmax(0,1.6fr)_minmax(310px,0.8fr)]")}>
        <section className={cn("geo-card p-6", onlyTimeline && "col-span-full flex h-full min-h-0 flex-col")}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-white flex items-center gap-2">
                Jornada do cliente
                <span className="group relative inline-flex">
                  <Info className="h-4 w-4 text-zinc-400 transition-colors hover:text-brand-primary-600 dark:hover:text-brand-primary-200" />
                  <span className="geo-surface-raised pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-72 -translate-x-1/2 rounded-lg p-3 text-xs font-medium leading-relaxed text-zinc-600 shadow-brand-lg dark:text-zinc-300 group-hover:block">
                    Registre anotações, conversas, documentos e decisões do cliente. Orçamentos, agenda e tarefas concluídas aparecem aqui automaticamente para contextualizar o relacionamento.
                  </span>
                </span>
              </h3>
              <p className="mt-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Histórico consolidado de anotações, orçamentos, agenda e checklist.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsNotaModalOpen(true)}
              className={primarySmallActionButtonClass}
            >
              <Plus className="w-4 h-4" />
              Adicionar
            </button>
          </div>

          <Modal
            isOpen={showEventForm}
            onClose={handleCancelEventForm}
            title={editingEventId ? 'Editar Evento da Jornada' : 'Adicionar Evento'}
            maxWidth="max-w-3xl"
          >
            <form onSubmit={handleAddEvent} className="space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                <div>
                  <label htmlFor="central-event-tipo" className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Tipo</label>
                  <FormSelect
                    id="central-event-tipo"
                    value={eventTipo}
                    onChange={event => setEventTipo(event.target.value)}
                    className={cn(centralCompactFieldClass, 'w-full')}
                  >
                    <option value="Observação">Observação</option>
                    <option value="Whatsapp">Whatsapp</option>
                    <option value="Ligação">Ligação</option>
                    <option value="Email">Email</option>
                    <option value="Reunião">Reunião</option>
                    <option value="Documento">Documento</option>
                  </FormSelect>
                </div>
                <div>
                  <label htmlFor="central-event-data" className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Data</label>
                  <DatePickerField
                    id="central-event-data"
                    value={eventDate}
                    onChange={event => setEventDate(event.target.value)}
                    className={cn(centralCompactFieldClass, 'w-full')}
                  />
                </div>
                <div>
                  <label htmlFor="central-event-projeto" className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Vinculo</label>
                  <FormSelect
                    id="central-event-projeto"
                    value={eventProjetoId}
                    onChange={event => setEventProjetoId(event.target.value)}
                    className={cn(centralCompactFieldClass, 'w-full')}
                  >
                    <option value="">Cliente geral</option>
                    {projetos.map(projeto => (
                      <option key={projeto.id} value={projeto.id}>{projeto.nome}</option>
                    ))}
                  </FormSelect>
                </div>
                <div>
                  <label htmlFor="central-event-title" className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Resumo / Título *</label>
                  <input
                    id="central-event-title"
                    required
                    value={eventTitle}
                    onChange={event => setEventTitle(event.target.value)}
                    placeholder="Ex: Documentação recebida"
                    className={cn(centralCompactFieldClass, 'w-full')}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="central-event-desc" className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Observações técnicas</label>
                <textarea
                  id="central-event-desc"
                  value={eventDescription}
                  onChange={event => setEventDescription(event.target.value)}
                  placeholder="Detalhe a conversa, pendência ou observação técnica..."
                  rows={2}
                  className={cn(centralTextareaClass, 'h-14 w-full p-2 text-xs font-semibold')}
                />
              </div>
              <div className="flex justify-end gap-2 border-t border-brand-border pt-2">
                <button type="button" onClick={handleCancelEventForm} className={secondarySmallActionButtonClass}>
                  Cancelar
                </button>
                <button type="submit" disabled={addEventMutation.isPending || updateEventMutation.isPending} className={primarySmallActionButtonClass}>
                  {editingEventId ? 'Salvar alterações' : 'Salvar evento'}
                </button>
              </div>
            </form>
          </Modal>

          <div className={cn('relative ml-4 min-h-[260px] space-y-5 border-l border-brand-border pl-7', onlyTimeline && 'flex-1')}>
            {loadingHistorico || loadingCompromissos ? (
              <div className="py-12 flex justify-center">
                <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }} className="h-7 w-7 animate-spin rounded-full border-2 border-brand-border border-t-brand-primary-600" />
              </div>
            ) : timelineItems.length === 0 ? (
              <div className="geo-empty-state flex-1 py-14 text-center">
                <Note className="mx-auto mb-3 h-10 w-10 text-zinc-300" />
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Nenhum evento registrado para este cliente.</p>
              </div>
            ) : (
              timelineItems.map(item => {
                const articleStyle = item.tone === 'indigo' ? 'geo-card-interactive border-brand-primary-300/70 p-4 ring-4 ring-brand-primary-400/10' :
                  item.tone === 'violet' ? 'geo-card-interactive border-brand-indigo-300/70 p-4 ring-4 ring-brand-indigo-400/10' :
                  item.tone === 'emerald' ? 'geo-card-interactive border-brand-green-300/70 p-4 ring-4 ring-brand-green-400/10' :
                  item.tone === 'amber' ? 'geo-card-interactive border-brand-rajah-300/70 p-4 ring-4 ring-brand-rajah-400/10' :
                  item.tone === 'teal' ? 'geo-card-interactive border-brand-turquoise-300/70 p-4 ring-4 ring-brand-turquoise-400/10' :
                  'geo-card-interactive p-4';

                return (
                <div key={item.id} className="relative">
                  <span className={`absolute -left-[47px] top-1 w-9 h-9 rounded-full ring-4 ring-white dark:ring-zinc-950 flex items-center justify-center shadow-sm border ${
                    item.tone === 'indigo' ? 'border-brand-primary-200/60 bg-brand-primary-50 text-brand-primary-600 dark:border-brand-primary-300/20 dark:bg-brand-primary-400/12 dark:text-brand-primary-200' :
                    item.tone === 'violet' ? 'border-brand-indigo-200/60 bg-brand-indigo-50 text-brand-indigo-600 dark:border-brand-indigo-300/20 dark:bg-brand-indigo-400/12 dark:text-brand-indigo-200' :
                    item.tone === 'emerald' ? 'border-brand-green-200/60 bg-brand-green-50 text-brand-green-600 dark:border-brand-green-300/20 dark:bg-brand-green-400/12 dark:text-brand-green-200' :
                    item.tone === 'amber' ? 'border-brand-rajah-200/60 bg-brand-rajah-50 text-brand-rajah-700 dark:border-brand-rajah-300/20 dark:bg-brand-rajah-400/12 dark:text-brand-rajah-100' :
                    item.tone === 'teal' ? 'border-brand-turquoise-200/60 bg-brand-turquoise-50 text-brand-turquoise-700 dark:border-brand-turquoise-300/20 dark:bg-brand-turquoise-400/12 dark:text-brand-turquoise-100' :
                    'border-brand-border bg-brand-surface text-zinc-500 dark:text-zinc-300'
                  }`}>
                    {item.tone === 'indigo' ? <FileText className="w-4 h-4" /> : item.tone === 'violet' ? <Calendar className="w-4 h-4" /> : item.tone === 'emerald' ? <CurrencyDollar className="w-4 h-4" /> : item.tone === 'teal' ? <Check className="w-4 h-4" /> : <Note className="w-4 h-4" />}
                  </span>
                  <article className={articleStyle}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-base font-semibold text-zinc-950 dark:text-white">{item.title}</h4>
                          <span className={cn('px-2 py-0.5 text-xs font-bold', statusTone(item.tag))}>
                            {item.tag}
                          </span>
                        </div>
                      </div>
                      {item.editable && (
                        <button
                          type="button"
                          onClick={() => handleEditTimelineItem(item)}
                          className={cn(centralIconButtonClass, 'h-8 w-8 shrink-0')}
                          title="Editar evento"
                          aria-label={`Editar evento ${item.title}`}
                        >
                          <PencilSimple className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {item.body && (
                      item.tipo === 'Documento' ? (
                        <div className="geo-card mt-3 space-y-2 p-3.5">
                          <div className="flex items-center gap-2 border-b border-brand-border pb-2 text-xs font-bold text-zinc-700 dark:text-zinc-200">
                            <FileText className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span>Caixa de Arquivos</span>
                          </div>
                          <div className="space-y-1.5 pt-0.5">
                            {item.body.split('\n').filter(l => l.trim().startsWith('-')).map((fileLine, idx) => (
                              <div key={idx} className="geo-card flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                                <span className="truncate">{fileLine.replace(/^- /, '')}</span>
                              </div>
                            ))}
                            {item.body.split('\n').filter(l => Boolean(l.trim()) && !l.trim().startsWith('-') && !l.includes('Arquivos anexados')).map((textLine, idx) => (
                              <p key={idx} className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">{textLine}</p>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed font-medium text-zinc-600 dark:text-zinc-300">
                          {item.body}
                        </p>
                      )
                    )}
                    <p className="mt-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400">{formatDate(item.date, item.date.includes('T'))}</p>
                  </article>
                </div>
              )})
            )}
          </div>
        </section>

        {!onlyTimeline && (
          <aside className="flex flex-col gap-6">
            <section className={cn(centralPanelClass, 'flex-1')}>
              <div className="flex items-center justify-between gap-3 mb-5">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-950 dark:text-white flex items-center gap-2">
                    <ListChecks className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
                    Checklist
                  </h3>
                  <p className="mt-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">Progresso</p>
                </div>
                <span className="text-sm font-bold text-zinc-950 dark:text-white">{tarefasConcluidas}/{clienteTarefas.length} ({taskProgress}%)</span>
              </div>

              <div className="mb-4 h-2 overflow-hidden rounded-full bg-brand-surface-muted">
                <div className="h-full rounded-full bg-brand-primary-600 transition-[width] duration-300" style={{ width: `${taskProgress}%` }} />
              </div>

              <button
                type="button"
                onClick={() => setShowTaskForm(value => !value)}
                className={cn(secondarySmallActionButtonClass, 'w-full justify-center py-3 text-sm')}
              >
                <Plus className="w-4 h-4" />
                Nova tarefa
              </button>

              {showTaskForm && (
                <form onSubmit={handleAddTask} className="geo-card mt-4 space-y-3 p-4">
                  <FormSelect
                    value={taskProjetoId}
                    onChange={event => setTaskProjetoId(event.target.value)}
                    className={cn(centralFieldClass, 'w-full')}
                  >
                    <option value="">Cliente geral</option>
                    {projetos.map(projeto => (
                      <option key={projeto.id} value={projeto.id}>
                        {projeto.nome}
                      </option>
                    ))}
                  </FormSelect>
                  <input
                    value={taskTitulo}
                    onChange={event => setTaskTitulo(event.target.value)}
                    placeholder="Título da tarefa"
                    className={cn(centralFieldClass, 'w-full')}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <FormSelect
                      value={taskPrioridade}
                      onChange={event => setTaskPrioridade(event.target.value as TaskPriority)}
                      className={centralFieldClass}
                    >
                      <option value="Baixa">Baixa</option>
                      <option value="Média">Média</option>
                      <option value="Alta">Alta</option>
                    </FormSelect>
                    <DatePickerField
                      value={taskDataLimite}
                      onChange={event => setTaskDataLimite(event.target.value)}
                      className={centralFieldClass}
                    />
                  </div>
                  <button type="submit" className={cn(primarySubmitButtonClass, 'w-full py-2.5 text-sm')}>
                    Salvar tarefa
                  </button>
                </form>
              )}

              <div className="mt-4 space-y-3 flex-1 overflow-y-auto pr-1 scrollbar-thin min-h-[120px] flex flex-col">
                {loadingTarefas ? (
                  <p className="py-6 text-center text-sm font-medium text-zinc-500 dark:text-zinc-400">Carregando tarefas...</p>
                ) : clienteTarefas.length === 0 ? (
                  <div className="geo-empty-state flex flex-1 flex-col items-center justify-center p-5 text-center">
                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      Nenhuma tarefa neste cliente.
                    </p>
                  </div>
                ) : (
                  clienteTarefas.map(tarefa => {
                    const priorityTone = getTaskPriorityTone(tarefa.prioridade);

                    return (
                    <div key={tarefa.id} className={`geo-card-interactive group border-l-4 p-3 ${priorityTone.cardClass}`}>
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => updateTaskMutation.mutate({ taskId: tarefa.id, data: { status: isDone(tarefa.status) ? 'A Fazer' : 'Concluído' } })}
                          className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors ${
                            isDone(tarefa.status)
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'border-brand-border bg-brand-surface'
                          }`}
                          aria-label={isDone(tarefa.status) ? `Reabrir tarefa ${tarefa.titulo}` : `Concluir tarefa ${tarefa.titulo}`}
                        >
                          {isDone(tarefa.status) && <Check className="w-3 h-3" weight="bold" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEditTask(tarefa)}
                          className={cn(centralIconButtonClass, 'mt-0.5 h-5 w-5 flex-shrink-0 border-0 shadow-none')}
                          title="Editar tarefa"
                        >
                          <PencilSimple className="w-3.5 h-3.5" />
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-semibold text-zinc-950 dark:text-white ${isDone(tarefa.status) ? 'line-through opacity-60' : ''}`}>
                            {tarefa.titulo}
                          </p>
                          <p className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400 truncate">
                            {tarefa.projetoNome || projetos.find(p => p.id === tarefa.projetoId)?.nome || tarefa.clienteNome || 'Cliente geral'}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset ${priorityTone.badgeClass}`}>
                              {priorityTone.label}
                            </span>
                            {tarefa.dataLimite && (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-zinc-500 dark:text-zinc-400">
                                <Calendar className="w-3.5 h-3.5" />
                                {formatDate(tarefa.dataLimite)}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget({ type: 'task', item: tarefa })}
                          disabled={deleteTaskMutation.isPending}
                          className="geo-focus-ring flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-[background-color,color,transform] hover:bg-brand-red-50 hover:text-brand-red-600 active:scale-95 disabled:cursor-wait disabled:opacity-50 dark:hover:bg-brand-red-400/10"
                          aria-label={`Excluir tarefa ${tarefa.titulo}`}
                          title="Excluir tarefa"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )})
                )}
              </div>
            </section>

            <section className={cn(centralPanelClass, 'flex-1')}>
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="text-lg font-semibold text-zinc-950 dark:text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
                  Agenda
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAgendaForm(value => !value)}
                  className={cn(centralIconButtonClass, 'h-9 w-9 rounded-full')}
                  aria-label={showAgendaForm ? 'Fechar formulário de compromisso' : 'Adicionar compromisso'}
                  aria-expanded={showAgendaForm}
                >
                  {showAgendaForm ? <Minus className="w-4 h-4" weight="bold" /> : <Plus className="w-4 h-4" />}
                </button>
              </div>

              {showAgendaForm && (
                <form onSubmit={handleAddAgenda} className="geo-card mb-4 space-y-3 p-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  <input
                    value={agendaTitulo}
                    onChange={event => setAgendaTitulo(event.target.value)}
                    placeholder="Título do compromisso"
                    className={cn(centralFieldClass, 'w-full')}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <DatePickerField
                      value={agendaData}
                      onChange={event => setAgendaData(event.target.value)}
                      className={cn(centralFieldClass, 'w-full')}
                    />
                    <TimePickerField
                      value={agendaHora}
                      onChange={event => setAgendaHora(event.target.value)}
                      className={cn(centralFieldClass, 'w-full')}
                    />
                    <FormSelect
                      value={agendaTipo}
                      onChange={event => setAgendaTipo(event.target.value)}
                      className={cn(centralFieldClass, 'w-full')}
                    >
                      <option value="Visita de Campo">Visita</option>
                      <option value="Reunião">Reunião</option>
                      <option value="Cartório">Cartório</option>
                      <option value="Entrega">Entrega</option>
                      <option value="Outro">Outro</option>
                    </FormSelect>
                  </div>
                  <FormSelect
                    value={agendaProjetoId}
                    onChange={event => setAgendaProjetoId(event.target.value)}
                    className={cn(centralFieldClass, 'w-full')}
                  >
                    <option value="">Cliente geral</option>
                    {projetos.map(projeto => (
                      <option key={projeto.id} value={projeto.id}>
                        {projeto.nome}
                      </option>
                    ))}
                  </FormSelect>
                  <textarea
                    value={agendaDescricao}
                    onChange={event => setAgendaDescricao(event.target.value)}
                    placeholder="Observações"
                    rows={2}
                    className={cn(centralTextareaClass, 'w-full')}
                  />
                  <button type="submit" className={cn(primarySubmitButtonClass, 'w-full')}>
                    Salvar compromisso
                  </button>
                </form>
              )}

              <div className="space-y-3 flex-1 overflow-y-auto pr-1 scrollbar-thin min-h-[150px] flex flex-col">
                {loadingCompromissos ? (
                  <p className="py-5 text-center text-sm font-medium text-zinc-500 dark:text-zinc-400">Carregando agenda...</p>
                ) : nextCompromissos.length === 0 ? (
                  <div className="geo-empty-state flex flex-1 flex-col items-center justify-center p-5 text-center">
                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Nenhum compromisso futuro vinculado.</p>
                  </div>
                ) : (
                  nextCompromissos.map(compromisso => (
                    <div key={compromisso.id} className="geo-card-interactive p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-zinc-950 dark:text-white truncate">{compromisso.titulo}</p>
                          <p className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400 truncate">
                            {compromisso.projetoNome || compromisso.clienteNome || 'Cliente geral'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'text-xs font-bold whitespace-nowrap',
                            compromisso.isProjectDeadline ? 'text-brand-indigo-600 dark:text-brand-indigo-300' : 'text-brand-primary-600 dark:text-brand-primary-300'
                          )}>
                            {formatDate(compromisso.data)} {compromisso.hora ? `- ${compromisso.hora}` : ''}
                          </span>
                          {!compromisso.isProjectDeadline && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleEditAgenda(compromisso)}
                                className={cn(centralIconButtonClass, 'h-6 w-6 flex-shrink-0 border-0 shadow-none')}
                                title="Editar compromisso"
                              >
                                <PencilSimple className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget({ type: 'agenda', item: compromisso })}
                                disabled={deleteAgendaMutation.isPending}
                                className="geo-focus-ring flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-zinc-400 transition-[background-color,color,transform] hover:bg-brand-red-50 hover:text-brand-red-600 active:scale-95 disabled:cursor-wait disabled:opacity-50 dark:hover:bg-brand-red-400/10"
                                title="Excluir compromisso"
                                aria-label={`Excluir compromisso ${compromisso.titulo}`}
                              >
                                <Trash className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </aside>
        )}
      </div>

      <ModalAdicionarNota
        isOpen={isNotaModalOpen}
        onClose={() => setIsNotaModalOpen(false)}
        clienteId={clienteId}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['cliente-historico', clienteId] });
        }}
      />
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget?.type === 'task') deleteTaskMutation.mutate(deleteTarget.item.id);
          if (deleteTarget?.type === 'agenda') deleteAgendaMutation.mutate(deleteTarget.item.id);
        }}
        title={deleteTarget?.type === 'task'
          ? `Excluir tarefa “${deleteTarget.item.titulo}”?`
          : `Excluir compromisso${deleteTarget?.item.titulo ? ` “${deleteTarget.item.titulo}”` : ''}?`}
        description={deleteTarget?.type === 'task'
          ? 'A tarefa será removida da central do cliente e do projeto vinculado, quando houver. Os cadastros do cliente e do projeto serão preservados. Esta ação não pode ser desfeita.'
          : 'O compromisso será removido da agenda e da central do cliente. Os cadastros do cliente e do projeto vinculado serão preservados. Esta ação não pode ser desfeita.'}
        confirmText={deleteTarget?.type === 'task' ? 'Excluir tarefa' : 'Excluir compromisso'}
        loading={deleteTaskMutation.isPending || deleteAgendaMutation.isPending}
      />
    </div>
  );
}
