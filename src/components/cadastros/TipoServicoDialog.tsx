import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TipoServicoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipoServico?: any;
  onSuccess: () => void;
}

export function TipoServicoDialog({ open, onOpenChange, tipoServico, onSuccess }: TipoServicoDialogProps) {
  const [categorias, setCategorias] = useState<any[]>([]);

  const { register, handleSubmit, setValue, watch, reset } = useForm({
    defaultValues: {
      nome: tipoServico?.nome || "",
      id_categoria: tipoServico?.id_categoria || "",
      descricao: tipoServico?.descricao || "",
      valor_sugerido: tipoServico?.valor_sugerido || 0,
      ativo: tipoServico?.ativo ?? true
    }
  });

  const watchedCategoria = watch("id_categoria");
  const watchedAtivo = watch("ativo");

  useEffect(() => {
    if (open) {
      fetchCategorias();
      reset({
        nome: tipoServico?.nome || "",
        id_categoria: tipoServico?.id_categoria || "",
        descricao: tipoServico?.descricao || "",
        valor_sugerido: tipoServico?.valor_sugerido || 0,
        ativo: tipoServico?.ativo ?? true
      });
    }
  }, [open, tipoServico, reset]);

  const fetchCategorias = async () => {
    const { data } = await supabase
      .from('dim_categoria_servico')
      .select('*')
      .order('nome');
    if (data) setCategorias(data);
  };

  const onSubmit = async (data: any) => {
    try {
      // Get tenant_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: tenantData } = await supabase.rpc('get_user_tenant_id', { _user_id: user.id });
      if (!tenantData) throw new Error("Tenant não encontrado");

      const servicoData = {
        nome: data.nome,
        id_categoria: data.id_categoria || null,
        descricao: data.descricao || null,
        valor_sugerido: data.valor_sugerido || 0,
        ativo: data.ativo,
        tenant_id: tenantData
      };

      if (tipoServico) {
        const { error } = await supabase
          .from('dim_tiposervico')
          .update(servicoData)
          .eq('id_tiposervico', tipoServico.id_tiposervico);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('dim_tiposervico')
          .insert([servicoData]);
        if (error) throw error;
      }

      toast.success(tipoServico ? "Serviço atualizado com sucesso!" : "Serviço criado com sucesso!");
      onSuccess();
      reset();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Erro ao salvar serviço:', error);
      toast.error("Erro ao salvar serviço: " + error.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{tipoServico ? 'Editar Serviço' : 'Novo Serviço'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input {...register("nome")} placeholder="Nome do serviço" required />
          </div>

          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select
              value={watchedCategoria}
              onValueChange={(value) => setValue("id_categoria", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {categorias.map((cat) => (
                  <SelectItem key={cat.id_categoria} value={cat.id_categoria}>
                    {cat.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Valor Sugerido (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              {...register("valor_sugerido", { valueAsNumber: true })}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea {...register("descricao")} placeholder="Descrição opcional" rows={3} />
          </div>

          <div className="flex items-center justify-between">
            <Label>Ativo</Label>
            <Switch
              checked={watchedAtivo}
              onCheckedChange={(checked) => setValue("ativo", checked)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">
              {tipoServico ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
