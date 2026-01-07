import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TipoServicoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipoServico?: any;
  onSuccess: () => void;
}

export function TipoServicoDialog({ open, onOpenChange, tipoServico, onSuccess }: TipoServicoDialogProps) {
  const { register, handleSubmit, reset } = useForm({
    defaultValues: {
      nome: tipoServico?.nome || "",
      categoria: tipoServico?.categoria || "",
      descricao: tipoServico?.descricao || "",
    }
  });

  useEffect(() => {
    if (open) {
      reset({
        nome: tipoServico?.nome || "",
        categoria: tipoServico?.categoria || "",
        descricao: tipoServico?.descricao || "",
      });
    }
  }, [open, tipoServico, reset]);

  const onSubmit = async (data: any) => {
    try {
      // Get tenant_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: tenantData } = await supabase.rpc('get_user_tenant_id', { _user_id: user.id });
      if (!tenantData) throw new Error("Tenant não encontrado");

      const servicoData = {
        nome: data.nome,
        categoria: data.categoria || null,
        descricao: data.descricao || null,
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
            <Input {...register("categoria")} placeholder="Ex: Topografia, Georreferenciamento..." />
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea {...register("descricao")} placeholder="Descrição opcional" rows={3} />
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