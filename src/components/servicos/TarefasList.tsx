import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit2, ChevronDown, ChevronUp, Calendar, AlertTriangle, Clock, Sparkles } from 'lucide-react';
import { format, differenceInDays, isPast, isToday, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarUI } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  fetchTarefasByServico,
  createTarefa,
  updateTarefa,
  deleteTarefa,
  calcularProgressoServico,
  ServicoTarefa,
} from '@/modules/operations/services/servico-tarefas.service';
import {
  registrarTarefaAdicionada,
  registrarTarefaConcluida
} from '@/modules/operations/services/servico-eventos.service';
import { supabase } from '@/integrations/supabase/client';

interface TarefasListProps {
  servicoId: string;
  categoriaServico?: string;
  onProgressUpdate?: (progresso: number) => void;
}

const prioridadeConfig: Record<string, { label: string; color: string; border: string }> = {
  baixa: { label: 'Baixa', color: 'bg-muted text-muted-foreground', border: 'border-l-muted-foreground/40' },
  media: { label: 'Média', color: 'bg-blue-500/15 text-blue-700 dark:text-blue-400', border: 'border-l-blue-500' },
  alta: { label: 'Alta', color: 'bg-amber-500/15 text-amber-700 dark:text-amber-400', border: 'border-l-amber-500' },
  urgente: { label: 'Urgente', color: 'bg-red-500/15 text-red-700 dark:text-red-400', border: 'border-l-red-500' },
};

const categoriaConfig: Record<string, string> = {
  geral: 'Geral',
  campo: 'Campo',
  escritorio: 'Escritório',
  protocolo: 'Protocolo',
  entrega: 'Entrega',
};

const sugestoesPorCategoria: Record<string, { titulo: string; categoria: string }[]> = {
  georreferenciamento: [
    { titulo: 'Levantamento de campo', categoria: 'campo' },
    { titulo: 'Processamento de dados', categoria: 'escritorio' },
    { titulo: 'Confecção de planta', categoria: 'escritorio' },
    { titulo: 'Protocolo SIGEF', categoria: 'protocolo' },
    { titulo: 'Certificação INCRA', categoria: 'protocolo' },
  ],
  desmembramento: [
    { titulo: 'Levantamento topográfico', categoria: 'campo' },
    { titulo: 'Memorial descritivo', categoria: 'escritorio' },
    { titulo: 'Aprovação prefeitura', categoria: 'protocolo' },
    { titulo: 'Registro cartório', categoria: 'protocolo' },
  ],
  _default: [
    { titulo: 'Planejamento', categoria: 'geral' },
    { titulo: 'Execução de campo', categoria: 'campo' },
    { titulo: 'Processamento', categoria: 'escritorio' },
    { titulo: 'Entrega ao cliente', categoria: 'entrega' },
  ],
};

function getVencimentoStatus(dataVencimento?: string | null) {
  if (!dataVencimento) return null;
  const data = new Date(dataVencimento + 'T00:00:00');
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const diff = differenceInDays(data, hoje);

  if (diff < 0) return { label: `Atrasada ${Math.abs(diff)}d`, status: 'overdue' as const };
  if (diff === 0) return { label: 'Vence hoje', status: 'today' as const };
  if (diff <= 3) return { label: `${diff}d restantes`, status: 'soon' as const };
  return { label: format(data, 'dd/MM', { locale: ptBR }), status: 'ok' as const };
}

export function TarefasList({ servicoId, categoriaServico, onProgressUpdate }: TarefasListProps) {
  const [showForm, setShowForm] = useState(false);
  const [novaTarefa, setNovaTarefa] = useState('');
  const [novaPrioridade, setNovaPrioridade] = useState('media');
  const [novaDataVencimento, setNovaDataVencimento] = useState<Date | undefined>();
  const [novoResponsavel, setNovoResponsavel] = useState('');
  const [novaCategoria, setNovaCategoria] = useState('geral');

  const [editTarefa, setEditTarefa] = useState<ServicoTarefa | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [sugerindo, setSugerindo] = useState(false);

  const queryClient = useQueryClient();

  const { data: tarefas = [], isLoading } = useQuery({
    queryKey: ['servico-tarefas', servicoId],
    queryFn: async () => {
      const { data, error } = await fetchTarefasByServico(servicoId);
      if (error) throw error;
      return data || [];
    }
  });

  const atualizarProgresso = async () => {
    const progresso = await calcularProgressoServico(servicoId);
    await supabase.from('fato_servico').update({ progresso }).eq('id_servico', servicoId);
    onProgressUpdate?.(progresso);
  };

  const criarMutation = useMutation({
    mutationFn: async (data: { titulo: string; prioridade: string; data_vencimento?: string | null; responsavel?: string | null; categoria: string; ordem: number }) => {
      const { data: result, error } = await createTarefa({
        id_servico: servicoId,
        titulo: data.titulo,
        concluida: false,
        ordem: data.ordem,
        prioridade: data.prioridade,
        data_vencimento: data.data_vencimento,
        responsavel: data.responsavel,
        categoria: data.categoria,
      });
      if (error) throw error;
      await registrarTarefaAdicionada(servicoId, data.titulo);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servico-tarefas', servicoId] });
      resetForm();
      toast.success('Tarefa adicionada');
      atualizarProgresso();
    },
    onError: () => toast.error('Erro ao adicionar tarefa')
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, concluida, titulo }: { id: string; concluida: boolean; titulo: string }) => {
      const { error } = await updateTarefa(id, { concluida });
      if (error) throw error;
      if (concluida) await registrarTarefaConcluida(servicoId, titulo);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servico-tarefas', servicoId] });
      atualizarProgresso();
    },
    onError: () => toast.error('Erro ao atualizar tarefa')
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ServicoTarefa> }) => {
      const { error } = await updateTarefa(id, data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servico-tarefas', servicoId] });
      setEditOpen(false);
      setEditTarefa(null);
      toast.success('Tarefa atualizada');
    },
    onError: () => toast.error('Erro ao atualizar tarefa')
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await deleteTarefa(id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servico-tarefas', servicoId] });
      toast.success('Tarefa removida');
      atualizarProgresso();
      setDeleteId(null);
    },
    onError: () => toast.error('Erro ao remover tarefa')
  });

  const resetForm = () => {
    setNovaTarefa('');
    setNovaPrioridade('media');
    setNovaDataVencimento(undefined);
    setNovoResponsavel('');
    setNovaCategoria('geral');
    setShowForm(false);
  };

  const handleAddTarefa = () => {
    if (!novaTarefa.trim()) return;
    criarMutation.mutate({
      titulo: novaTarefa.trim(),
      prioridade: novaPrioridade,
      data_vencimento: novaDataVencimento ? format(novaDataVencimento, 'yyyy-MM-dd') : null,
      responsavel: novoResponsavel.trim() || null,
      categoria: novaCategoria,
      ordem: tarefas.length,
    });
  };

  const handleSugerirTarefas = async () => {
    setSugerindo(true);
    const cat = categoriaServico?.toLowerCase() || '';
    const sugestoes = sugestoesPorCategoria[cat] || sugestoesPorCategoria._default;
    try {
      for (let i = 0; i < sugestoes.length; i++) {
        await createTarefa({
          id_servico: servicoId,
          titulo: sugestoes[i].titulo,
          concluida: false,
          ordem: i,
          prioridade: 'media',
          categoria: sugestoes[i].categoria,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['servico-tarefas', servicoId] });
      toast.success(`${sugestoes.length} tarefas sugeridas adicionadas`);
      atualizarProgresso();
    } catch {
      toast.error('Erro ao sugerir tarefas');
    } finally {
      setSugerindo(false);
    }
  };

  const totalTarefas = tarefas.length;
  const tarefasConcluidas = tarefas.filter(t => t.concluida).length;
  const progresso = totalTarefas > 0 ? Math.round((tarefasConcluidas / totalTarefas) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {tarefasConcluidas} de {totalTarefas} concluídas ({progresso}%)
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
          {showForm ? <ChevronUp className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
          {showForm ? 'Fechar' : 'Nova tarefa'}
        </Button>
      </div>

      {/* Formulário expandível */}
      {showForm && (
        <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
          <Input
            placeholder="Título da tarefa *"
            value={novaTarefa}
            onChange={(e) => setNovaTarefa(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTarefa()}
          />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Select value={novaPrioridade} onValueChange={setNovaPrioridade}>
              <SelectTrigger><SelectValue placeholder="Prioridade" /></SelectTrigger>
              <SelectContent>
                {Object.entries(prioridadeConfig).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={novaCategoria} onValueChange={setNovaCategoria}>
              <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                {Object.entries(categoriaConfig).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('justify-start text-left font-normal', !novaDataVencimento && 'text-muted-foreground')}>
                  <Calendar className="h-4 w-4 mr-1" />
                  {novaDataVencimento ? format(novaDataVencimento, 'dd/MM', { locale: ptBR }) : 'Prazo'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarUI mode="single" selected={novaDataVencimento} onSelect={setNovaDataVencimento} initialFocus className="p-3 pointer-events-auto" locale={ptBR} />
              </PopoverContent>
            </Popover>
            <Input placeholder="Responsável" value={novoResponsavel} onChange={(e) => setNovoResponsavel(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={resetForm}>Cancelar</Button>
            <Button size="sm" onClick={handleAddTarefa} disabled={!novaTarefa.trim() || criarMutation.isPending}>
              {criarMutation.isPending ? 'Adicionando...' : 'Adicionar'}
            </Button>
          </div>
        </div>
      )}

      {/* Lista de tarefas */}
      {isLoading ? (
        <div className="text-center py-4 text-muted-foreground">Carregando...</div>
      ) : tarefas.length === 0 ? (
        <div className="text-center py-8 space-y-3">
          <p className="text-muted-foreground">Nenhuma tarefa cadastrada.</p>
          <Button variant="outline" onClick={handleSugerirTarefas} disabled={sugerindo}>
            <Sparkles className="h-4 w-4 mr-2" />
            {sugerindo ? 'Adicionando...' : 'Sugerir tarefas padrão'}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {tarefas.map((tarefa) => {
            const prio = prioridadeConfig[tarefa.prioridade || 'media'] || prioridadeConfig.media;
            const vencimento = !tarefa.concluida ? getVencimentoStatus(tarefa.data_vencimento) : null;
            const isUrgente = tarefa.prioridade === 'urgente' && !tarefa.concluida;

            return (
              <div
                key={tarefa.id_tarefa}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border border-l-4 bg-card hover:bg-muted/50 transition-colors',
                  prio.border,
                  tarefa.concluida && 'opacity-60',
                  isUrgente && 'animate-pulse'
                )}
              >
                <Checkbox
                  checked={tarefa.concluida}
                  onCheckedChange={(checked) =>
                    toggleMutation.mutate({ id: tarefa.id_tarefa, concluida: !!checked, titulo: tarefa.titulo })
                  }
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn('text-sm', tarefa.concluida && 'line-through text-muted-foreground')}>
                      {tarefa.titulo}
                    </span>
                    <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', prio.color)}>
                      {prio.label}
                    </Badge>
                    {tarefa.categoria && tarefa.categoria !== 'geral' && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {categoriaConfig[tarefa.categoria] || tarefa.categoria}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                    {tarefa.responsavel && <span>{tarefa.responsavel}</span>}
                    {vencimento && (
                      <span className={cn(
                        'flex items-center gap-1',
                        vencimento.status === 'overdue' && 'text-red-600 dark:text-red-400',
                        vencimento.status === 'today' && 'text-amber-600 dark:text-amber-400',
                        vencimento.status === 'soon' && 'text-amber-600 dark:text-amber-400',
                      )}>
                        {vencimento.status === 'overdue' ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                        {vencimento.label}
                      </span>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => { setEditTarefa(tarefa); setEditOpen(true); }}>
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleteId(tarefa.id_tarefa)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog de edição */}
      <EditTarefaDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        tarefa={editTarefa}
        onSave={(data) => {
          if (!editTarefa) return;
          editMutation.mutate({ id: editTarefa.id_tarefa, data });
        }}
        isPending={editMutation.isPending}
      />

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover tarefa?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ─── Dialog de Edição Inline ─── */
function EditTarefaDialog({
  open,
  onOpenChange,
  tarefa,
  onSave,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tarefa: ServicoTarefa | null;
  onSave: (data: Partial<ServicoTarefa>) => void;
  isPending: boolean;
}) {
  const [titulo, setTitulo] = useState('');
  const [prioridade, setPrioridade] = useState('media');
  const [categoria, setCategoria] = useState('geral');
  const [responsavel, setResponsavel] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [dataVencimento, setDataVencimento] = useState<Date | undefined>();

  // Sync state when tarefa changes
  const [lastId, setLastId] = useState<string | null>(null);
  if (tarefa && tarefa.id_tarefa !== lastId) {
    setLastId(tarefa.id_tarefa);
    setTitulo(tarefa.titulo);
    setPrioridade(tarefa.prioridade || 'media');
    setCategoria(tarefa.categoria || 'geral');
    setResponsavel(tarefa.responsavel || '');
    setObservacoes(tarefa.observacoes || '');
    setDataVencimento(tarefa.data_vencimento ? new Date(tarefa.data_vencimento + 'T00:00:00') : undefined);
  }

  const handleSave = () => {
    onSave({
      titulo,
      prioridade,
      categoria,
      responsavel: responsavel.trim() || null,
      observacoes: observacoes.trim() || null,
      data_vencimento: dataVencimento ? format(dataVencimento, 'yyyy-MM-dd') : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Editar Tarefa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Título *</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={setPrioridade}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(prioridadeConfig).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(categoriaConfig).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Prazo</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !dataVencimento && 'text-muted-foreground')}>
                  <Calendar className="h-4 w-4 mr-2" />
                  {dataVencimento ? format(dataVencimento, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarUI mode="single" selected={dataVencimento} onSelect={setDataVencimento} initialFocus className="p-3 pointer-events-auto" locale={ptBR} />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label>Responsável</Label>
            <Input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Nome do responsável" />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!titulo.trim() || isPending}>
            {isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
