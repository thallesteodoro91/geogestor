import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from 'sonner';
import { createServico, updateServico } from '@/modules/operations';
import { registrarCriacaoServico, registrarMudancaStatus } from '@/modules/operations/services/servico-eventos.service';
import { SERVICE_STATUS, SERVICE_STATUS_OPTIONS } from '@/constants/serviceStatus';

export interface ServicoFormData {
  nome_do_servico: string;
  descricao: string;
  id_cliente: string;
  id_propriedade: string;
  id_orcamento: string;
  data_do_servico_inicio: string;
  data_do_servico_fim: string;
  situacao_do_servico: string;
}

interface NovoServicoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingServico?: any;
}

const initialFormData: ServicoFormData = {
  nome_do_servico: '',
  descricao: '',
  id_cliente: '',
  id_propriedade: '',
  id_orcamento: '',
  data_do_servico_inicio: '',
  data_do_servico_fim: '',
  situacao_do_servico: SERVICE_STATUS.PENDENTE
};

export function NovoServicoDialog({
  open,
  onOpenChange,
  editingServico
}: NovoServicoDialogProps) {
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const isEditing = !!editingServico;

  const [formData, setFormData] = useState<ServicoFormData>(initialFormData);

  useEffect(() => {
    if (editingServico) {
      setFormData({
        nome_do_servico: editingServico.nome_do_servico || '',
        descricao: editingServico.descricao || '',
        id_cliente: editingServico.id_cliente || '',
        id_propriedade: editingServico.id_propriedade || '',
        id_orcamento: editingServico.id_orcamento || '',
        data_do_servico_inicio: editingServico.data_do_servico_inicio || '',
        data_do_servico_fim: editingServico.data_do_servico_fim || '',
        situacao_do_servico: editingServico.situacao_do_servico || 'Pendente'
      });
    } else if (!open) {
      setFormData(initialFormData);
    }
  }, [editingServico, open]);

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes', tenant?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('dim_cliente')
        .select('id_cliente, nome')
        .order('nome');
      return data || [];
    },
    enabled: open
  });

  const { data: propriedades = [] } = useQuery({
    queryKey: ['propriedades', tenant?.id, formData.id_cliente],
    queryFn: async () => {
      let query = supabase
        .from('dim_propriedade')
        .select('id_propriedade, nome_da_propriedade');
      if (formData.id_cliente) {
        query = query.eq('id_cliente', formData.id_cliente);
      }
      const { data } = await query.order('nome_da_propriedade');
      return data || [];
    },
    enabled: open
  });

  const { data: orcamentos = [] } = useQuery({
    queryKey: ['orcamentos', tenant?.id, formData.id_cliente],
    queryFn: async () => {
      let query = supabase
        .from('fato_orcamento')
        .select('id_orcamento, codigo_orcamento, data_orcamento')
        .eq('orcamento_convertido', true);
      if (formData.id_cliente) {
        query = query.eq('id_cliente', formData.id_cliente);
      }
      const { data } = await query.order('data_orcamento', { ascending: false });
      return data || [];
    },
    enabled: open
  });

  const mutation = useMutation({
    mutationFn: async (data: ServicoFormData) => {
      if (isEditing && editingServico?.id_servico) {
        const oldStatus = editingServico.situacao_do_servico;
        const { error } = await updateServico(editingServico.id_servico, {
          nome_do_servico: data.nome_do_servico,
          descricao: data.descricao || null,
          id_cliente: data.id_cliente || null,
          id_propriedade: data.id_propriedade || null,
          id_orcamento: data.id_orcamento || null,
          data_do_servico_inicio: data.data_do_servico_inicio || null,
          data_do_servico_fim: data.data_do_servico_fim || null,
          situacao_do_servico: data.situacao_do_servico
        });
        if (error) throw error;

        // Registrar evento de mudança de status
        if (oldStatus !== data.situacao_do_servico) {
          await registrarMudancaStatus(editingServico.id_servico, oldStatus || 'Pendente', data.situacao_do_servico);
        }
      } else {
        const { data: newServico, error } = await createServico({
          nome_do_servico: data.nome_do_servico,
          descricao: data.descricao || null,
          id_cliente: data.id_cliente || null,
          id_propriedade: data.id_propriedade || null,
          id_orcamento: data.id_orcamento || null,
          data_do_servico_inicio: data.data_do_servico_inicio || null,
          data_do_servico_fim: data.data_do_servico_fim || null,
          situacao_do_servico: data.situacao_do_servico,
          progresso: 0
        });
        if (error) throw error;

        // Registrar evento de criação
        if (newServico) {
          await registrarCriacaoServico(newServico.id_servico, data.nome_do_servico);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      queryClient.invalidateQueries({ queryKey: ['servico', editingServico?.id_servico] });
      queryClient.invalidateQueries({ queryKey: ['servico-eventos'] });
      toast.success(isEditing ? 'Serviço atualizado com sucesso!' : 'Serviço criado com sucesso!');
      onOpenChange(false);
      setFormData(initialFormData);
    },
    onError: (error: any) => {
      toast.error(`Erro: ${error.message}`);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome_do_servico || !formData.id_cliente || !formData.data_do_servico_inicio || !formData.data_do_servico_fim) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    mutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Serviço' : 'Novo Serviço'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Título do Serviço *</Label>
            <Input
              id="nome"
              value={formData.nome_do_servico}
              onChange={(e) => setFormData(prev => ({ ...prev, nome_do_servico: e.target.value }))}
              placeholder="Ex: Georreferenciamento Fazenda X"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
              placeholder="Descreva o serviço..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Select
                value={formData.id_cliente}
                onValueChange={(value) => setFormData(prev => ({ 
                  ...prev, 
                  id_cliente: value,
                  id_propriedade: '',
                  id_orcamento: ''
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id_cliente} value={c.id_cliente}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Propriedade</Label>
              <Select
                value={formData.id_propriedade}
                onValueChange={(value) => setFormData(prev => ({ ...prev, id_propriedade: value }))}
                disabled={!formData.id_cliente}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {propriedades.map((p) => (
                    <SelectItem key={p.id_propriedade} value={p.id_propriedade}>
                      {p.nome_da_propriedade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Orçamento Vinculado</Label>
            <Select
              value={formData.id_orcamento}
              onValueChange={(value) => setFormData(prev => ({ ...prev, id_orcamento: value }))}
              disabled={!formData.id_cliente}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um orçamento aprovado" />
              </SelectTrigger>
              <SelectContent>
                {orcamentos.map((o) => (
                  <SelectItem key={o.id_orcamento} value={o.id_orcamento}>
                    {o.codigo_orcamento || o.id_orcamento.slice(0, 8)} - {o.data_orcamento}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="data_inicio">Data de Início *</Label>
              <Input
                id="data_inicio"
                type="date"
                value={formData.data_do_servico_inicio}
                onChange={(e) => setFormData(prev => ({ ...prev, data_do_servico_inicio: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="data_fim">Prazo (Data Término) *</Label>
              <Input
                id="data_fim"
                type="date"
                value={formData.data_do_servico_fim}
                onChange={(e) => setFormData(prev => ({ ...prev, data_do_servico_fim: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={formData.situacao_do_servico}
              onValueChange={(value) => setFormData(prev => ({ ...prev, situacao_do_servico: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SERVICE_STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar Serviço'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
