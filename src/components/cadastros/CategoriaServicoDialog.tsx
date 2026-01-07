import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CategoriaServicoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoria?: any;
  onSuccess: () => void;
}

export function CategoriaServicoDialog({ open, onOpenChange, categoria, onSuccess }: CategoriaServicoDialogProps) {
  const { register, handleSubmit, reset } = useForm({
    defaultValues: {
      nome: categoria?.nome || "",
      descricao: categoria?.descricao || ""
    }
  });

  useEffect(() => {
    if (open) {
      reset({
        nome: categoria?.nome || "",
        descricao: categoria?.descricao || ""
      });
    }
  }, [open, categoria, reset]);

  const onSubmit = async (data: any) => {
    try {
      // Get tenant_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: tenantData } = await supabase.rpc('get_user_tenant_id', { _user_id: user.id });
      if (!tenantData) throw new Error("Tenant não encontrado");

      const categoriaData = {
        nome: data.nome,
        descricao: data.descricao || null,
        tenant_id: tenantData
      };

      if (categoria) {
        const { error } = await supabase
          .from('dim_categoria_servico')
          .update(categoriaData)
          .eq('id_categoria', categoria.id_categoria);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('dim_categoria_servico')
          .insert([categoriaData]);
        if (error) throw error;
      }

      toast.success(categoria ? "Categoria atualizada com sucesso!" : "Categoria criada com sucesso!");
      onSuccess();
      reset();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Erro ao salvar categoria:', error);
      toast.error("Erro ao salvar categoria: " + error.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{categoria ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input {...register("nome")} placeholder="Nome da categoria" required />
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
              {categoria ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
