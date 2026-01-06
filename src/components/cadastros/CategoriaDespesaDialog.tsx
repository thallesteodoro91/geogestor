import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect, useState } from "react";

interface CategoriaDespesaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoria?: any;
  onSuccess: () => void;
}

export function CategoriaDespesaDialog({ open, onOpenChange, categoria, onSuccess }: CategoriaDespesaDialogProps) {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const { register, handleSubmit, reset } = useForm({
    defaultValues: categoria || {}
  });

  useEffect(() => {
    if (open) {
      reset(categoria || {});
      fetchTenantId();
    }
  }, [open, categoria, reset]);

  const fetchTenantId = async () => {
    const { data } = await supabase.rpc('get_user_tenant_id', { _user_id: (await supabase.auth.getUser()).data.user?.id });
    setTenantId(data);
  };

  const onSubmit = async (data: any) => {
    try {
      if (categoria) {
        const { error } = await supabase
          .from('dim_categoria_despesa')
          .update({ nome: data.nome, descricao: data.descricao })
          .eq('id_categoria_despesa', categoria.id_categoria_despesa);
        
        if (error) throw error;
        toast.success("Categoria atualizada com sucesso!");
      } else {
        const { error } = await supabase
          .from('dim_categoria_despesa')
          .insert([{ nome: data.nome, descricao: data.descricao, tenant_id: tenantId }]);
        
        if (error) throw error;
        toast.success("Categoria cadastrada com sucesso!");
      }
      
      reset();
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar categoria");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md z-[1000]">
        <DialogHeader>
          <DialogTitle>{categoria ? "Editar Categoria de Despesa" : "Nova Categoria de Despesa"}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome *</Label>
            <Input id="nome" {...register("nome", { required: true })} placeholder="Ex: Operacional" />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea id="descricao" {...register("descricao")} rows={3} placeholder="Descrição da categoria..." />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
