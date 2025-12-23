import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  fetchEquipeByServico,
  createDesignacao,
  deleteDesignacao,
  FUNCOES_EQUIPE
} from '@/modules/operations/services/servico-equipes.service';
import { registrarMembroEquipe } from '@/modules/operations/services/servico-eventos.service';
import { supabase } from '@/integrations/supabase/client';

interface EquipeListProps {
  servicoId: string;
}

export function EquipeList({ servicoId }: EquipeListProps) {
  const [open, setOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedFuncao, setSelectedFuncao] = useState('');
  const queryClient = useQueryClient();

  const { data: equipe = [], isLoading } = useQuery({
    queryKey: ['servico-equipe', servicoId],
    queryFn: async () => {
      const { data, error } = await fetchEquipeByServico(servicoId);
      if (error) throw error;
      return data || [];
    }
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ['tenant-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_tenant_profiles');
      if (error) throw error;
      return data || [];
    }
  });

  const criarMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await createDesignacao({
        id_servico: servicoId,
        user_id: selectedUser,
        funcao: selectedFuncao
      });
      if (error) throw error;
      const usuario = usuarios.find(u => u.id === selectedUser);
      await registrarMembroEquipe(servicoId, usuario?.full_name || 'Usuário', selectedFuncao);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servico-equipe', servicoId] });
      setOpen(false);
      setSelectedUser('');
      setSelectedFuncao('');
      toast.success('Membro adicionado à equipe');
    },
    onError: () => toast.error('Erro ao adicionar membro')
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await deleteDesignacao(id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servico-equipe', servicoId] });
      toast.success('Membro removido da equipe');
    },
    onError: () => toast.error('Erro ao remover membro')
  });

  const usuariosDisponiveis = usuarios.filter(
    u => !equipe.some(e => e.user_id === u.id)
  );

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {equipe.length} membro(s) designado(s)
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={usuariosDisponiveis.length === 0}>
              <Plus className="h-4 w-4 mr-1" />
              Adicionar Membro
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Membro à Equipe</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Usuário</Label>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um usuário" />
                  </SelectTrigger>
                  <SelectContent>
                    {usuariosDisponiveis.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name || user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Função no Projeto</Label>
                <Select value={selectedFuncao} onValueChange={setSelectedFuncao}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma função" />
                  </SelectTrigger>
                  <SelectContent>
                    {FUNCOES_EQUIPE.map((funcao) => (
                      <SelectItem key={funcao} value={funcao}>
                        {funcao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                onClick={() => criarMutation.mutate()}
                disabled={!selectedUser || !selectedFuncao || criarMutation.isPending}
              >
                Adicionar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-4 text-muted-foreground">Carregando...</div>
      ) : equipe.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <UserCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
          Nenhum membro designado. Adicione membros da equipe para este serviço.
        </div>
      ) : (
        <div className="space-y-2">
          {equipe.map((membro) => (
            <div
              key={membro.id_designacao}
              className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
            >
              <Avatar className="h-10 w-10">
                <AvatarImage src={membro.profiles?.avatar_url || undefined} />
                <AvatarFallback>{getInitials(membro.profiles?.full_name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="font-medium">{membro.profiles?.full_name || 'Usuário'}</div>
                <div className="text-sm text-muted-foreground">{membro.funcao}</div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => deleteMutation.mutate(membro.id_designacao)}
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
