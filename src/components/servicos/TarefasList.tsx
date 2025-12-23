import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Check, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  fetchTarefasByServico,
  createTarefa,
  updateTarefa,
  deleteTarefa,
  calcularProgressoServico
} from '@/modules/operations/services/servico-tarefas.service';
import {
  registrarTarefaAdicionada,
  registrarTarefaConcluida
} from '@/modules/operations/services/servico-eventos.service';
import { supabase } from '@/integrations/supabase/client';

interface TarefasListProps {
  servicoId: string;
  onProgressUpdate?: (progresso: number) => void;
}

export function TarefasList({ servicoId, onProgressUpdate }: TarefasListProps) {
  const [novaTarefa, setNovaTarefa] = useState('');
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
    await supabase
      .from('fato_servico')
      .update({ progresso })
      .eq('id_servico', servicoId);
    onProgressUpdate?.(progresso);
  };

  const criarMutation = useMutation({
    mutationFn: async (titulo: string) => {
      const { data, error } = await createTarefa({
        id_servico: servicoId,
        titulo,
        concluida: false,
        ordem: tarefas.length
      });
      if (error) throw error;
      await registrarTarefaAdicionada(servicoId, titulo);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servico-tarefas', servicoId] });
      setNovaTarefa('');
      toast.success('Tarefa adicionada');
      atualizarProgresso();
    },
    onError: () => toast.error('Erro ao adicionar tarefa')
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, concluida, titulo }: { id: string; concluida: boolean; titulo: string }) => {
      const { error } = await updateTarefa(id, { concluida });
      if (error) throw error;
      if (concluida) {
        await registrarTarefaConcluida(servicoId, titulo);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servico-tarefas', servicoId] });
      atualizarProgresso();
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
    },
    onError: () => toast.error('Erro ao remover tarefa')
  });

  const handleAddTarefa = () => {
    if (!novaTarefa.trim()) return;
    criarMutation.mutate(novaTarefa.trim());
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
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Nova tarefa..."
          value={novaTarefa}
          onChange={(e) => setNovaTarefa(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddTarefa()}
        />
        <Button onClick={handleAddTarefa} disabled={!novaTarefa.trim() || criarMutation.isPending}>
          <Plus className="h-4 w-4 mr-1" />
          Adicionar
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-4 text-muted-foreground">Carregando...</div>
      ) : tarefas.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Nenhuma tarefa cadastrada. Adicione tarefas para acompanhar o progresso.
        </div>
      ) : (
        <div className="space-y-2">
          {tarefas.map((tarefa) => (
            <div
              key={tarefa.id_tarefa}
              className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
            >
              <Checkbox
                checked={tarefa.concluida}
                onCheckedChange={(checked) =>
                  toggleMutation.mutate({
                    id: tarefa.id_tarefa,
                    concluida: !!checked,
                    titulo: tarefa.titulo
                  })
                }
              />
              <span className={tarefa.concluida ? 'flex-1 line-through text-muted-foreground' : 'flex-1'}>
                {tarefa.titulo}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => deleteMutation.mutate(tarefa.id_tarefa)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
