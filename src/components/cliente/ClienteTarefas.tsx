import { useState } from 'react';
import { format, isPast, isWithinInterval, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  FileWarning,
  Building2,
  ScrollText,
  Landmark,
  Globe,
  ClipboardList,
  Hammer,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useClienteTarefas, useMarcarTarefaConcluida, useDeleteTarefa } from '@/hooks/useClienteTarefas';
import { useRegistrarNota } from '@/hooks/useClienteEventos';
import { ClienteTarefa } from '@/modules/crm/services/cliente-tarefas.service';
import { toast } from 'sonner';

interface ClienteTarefasProps {
  clienteId: string;
  filtroCategoria?: string;
  filtroServico?: string;
  onAddTarefa: () => void;
}

const categoriaConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  documento_cliente: { icon: FileWarning, color: 'text-red-500 bg-red-500/10 border-red-500/20', label: 'Documento' },
  prefeitura: { icon: Building2, color: 'text-orange-500 bg-orange-500/10 border-orange-500/20', label: 'Prefeitura' },
  cartorio: { icon: ScrollText, color: 'text-purple-500 bg-purple-500/10 border-purple-500/20', label: 'Cartório' },
  incra: { icon: Landmark, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20', label: 'INCRA' },
  sigef: { icon: Globe, color: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20', label: 'SIGEF' },
  interno: { icon: ClipboardList, color: 'text-blue-500 bg-blue-500/10 border-blue-500/20', label: 'Interno' },
  trabalho: { icon: Hammer, color: 'text-green-500 bg-green-500/10 border-green-500/20', label: 'Trabalho' },
};

const prioridadeConfig: Record<string, { color: string; label: string }> = {
  baixa: { color: '', label: 'Baixa' },
  media: { color: 'border-l-yellow-500', label: 'Média' },
  alta: { color: 'border-l-orange-500', label: 'Alta' },
  urgente: { color: 'border-l-red-500 animate-pulse', label: 'Urgente' },
};

function getVencimentoStatus(dataVencimento: string | null | undefined) {
  if (!dataVencimento) return null;

  const data = new Date(dataVencimento);
  const hoje = new Date();

  if (isPast(data) && data.toDateString() !== hoje.toDateString()) {
    return { status: 'vencida', icon: AlertCircle, color: 'text-red-500' };
  }

  if (isWithinInterval(data, { start: hoje, end: addDays(hoje, 3) })) {
    return { status: 'proxima', icon: Clock, color: 'text-yellow-500' };
  }

  return null;
}

export function ClienteTarefas({
  clienteId,
  filtroCategoria,
  filtroServico,
  onAddTarefa,
}: ClienteTarefasProps) {
  const { data: tarefas, isLoading } = useClienteTarefas(clienteId, {
    categoria: filtroCategoria,
    id_servico: filtroServico,
  });
  const marcarConcluida = useMarcarTarefaConcluida();
  const deleteTarefa = useDeleteTarefa();
  const registrarNota = useRegistrarNota();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleToggleConcluida = async (tarefa: ClienteTarefa) => {
    try {
      await marcarConcluida.mutateAsync({
        id: tarefa.id_tarefa,
        clienteId,
        concluida: !tarefa.concluida,
      });

      // Registrar evento na timeline quando concluir
      if (!tarefa.concluida) {
        await registrarNota.mutateAsync({
          clienteId,
          titulo: 'Tarefa concluída',
          descricao: `Tarefa "${tarefa.titulo}" foi marcada como concluída`,
          servicoId: tarefa.id_servico || undefined,
          categoria: tarefa.categoria,
        });
      }

      toast.success(
        tarefa.concluida ? 'Tarefa reaberta' : 'Tarefa concluída!'
      );
    } catch (error) {
      toast.error('Erro ao atualizar tarefa');
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteTarefa.mutateAsync({ id, clienteId });
      toast.success('Tarefa removida');
    } catch (error) {
      toast.error('Erro ao remover tarefa');
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 items-center">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>
    );
  }

  const concluidas = tarefas?.filter((t) => t.concluida).length || 0;
  const total = tarefas?.length || 0;
  const progresso = total > 0 ? (concluidas / total) * 100 : 0;

  if (!tarefas?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground mb-4">Nenhuma tarefa cadastrada</p>
        <Button onClick={onAddTarefa} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Nova tarefa
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Progresso</span>
          <span className="font-medium">
            {concluidas} de {total} ({Math.round(progresso)}%)
          </span>
        </div>
        <Progress value={progresso} className="h-2" />
      </div>

      {/* Add button */}
      <Button onClick={onAddTarefa} variant="outline" className="w-full" size="sm">
        <Plus className="h-4 w-4 mr-2" />
        Nova tarefa
      </Button>

      {/* Tasks list */}
      <div className="space-y-2">
        {tarefas.map((tarefa) => {
          const catConfig = categoriaConfig[tarefa.categoria] || categoriaConfig.interno;
          const prioConfig = prioridadeConfig[tarefa.prioridade] || prioridadeConfig.media;
          const vencimento = getVencimentoStatus(tarefa.data_vencimento);
          const Icon = catConfig.icon;

          return (
            <div
              key={tarefa.id_tarefa}
              className={`group flex items-start gap-3 p-3 rounded-lg border bg-card hover:shadow-sm transition-all border-l-4 ${
                prioConfig.color
              } ${tarefa.concluida ? 'opacity-60' : ''}`}
            >
              <Checkbox
                checked={tarefa.concluida}
                onCheckedChange={() => handleToggleConcluida(tarefa)}
                className="mt-0.5"
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`font-medium text-sm ${
                      tarefa.concluida ? 'line-through text-muted-foreground' : ''
                    }`}
                  >
                    {tarefa.titulo}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-xs ${catConfig.color}`}
                  >
                    <Icon className="h-3 w-3 mr-1" />
                    {catConfig.label}
                  </Badge>
                  {vencimento && !tarefa.concluida && (
                    <span className={`flex items-center gap-1 text-xs ${vencimento.color}`}>
                      <vencimento.icon className="h-3 w-3" />
                      {vencimento.status === 'vencida' ? 'Vencida' : 'Próxima'}
                    </span>
                  )}
                </div>

                {tarefa.observacoes && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                    {tarefa.observacoes}
                  </p>
                )}

                {tarefa.data_vencimento && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Prazo: {format(new Date(tarefa.data_vencimento), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                )}
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-muted-foreground hover:text-destructive"
                    disabled={deletingId === tarefa.id_tarefa}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remover tarefa?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação não pode ser desfeita. A tarefa será removida permanentemente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDelete(tarefa.id_tarefa)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Remover
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          );
        })}
      </div>
    </div>
  );
}
