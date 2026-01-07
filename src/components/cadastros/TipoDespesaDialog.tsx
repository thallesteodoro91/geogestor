import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect, useState } from "react";

interface TipoDespesaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipoDespesa?: any;
  onSuccess: () => void;
}

export function TipoDespesaDialog({ open, onOpenChange, tipoDespesa, onSuccess }: TipoDespesaDialogProps) {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const { register, handleSubmit, reset } = useForm({
    defaultValues: tipoDespesa || {}
  });

  useEffect(() => {
    if (open) {
      reset(tipoDespesa || {});
      fetchTenantId();
    }
  }, [open, tipoDespesa, reset]);

  const fetchTenantId = async () => {
    const user = await supabase.auth.getUser();
    const { data: tid } = await supabase.rpc('get_user_tenant_id', { _user_id: user.data.user?.id });
    setTenantId(tid);
  };

  const onSubmit = async (data: any) => {
    try {
      const payload = {
        categoria: data.categoria,
        descricao: data.descricao,
      };

      if (tipoDespesa) {
        const { error } = await supabase
          .from('dim_tipodespesa')
          .update(payload)
          .eq('id_tipodespesa', tipoDespesa.id_tipodespesa);
        
        if (error) throw error;
        toast.success("Tipo de despesa atualizado com sucesso!");
      } else {
        const { error } = await supabase
          .from('dim_tipodespesa')
          .insert([{ ...payload, tenant_id: tenantId }]);
        
        if (error) throw error;
        toast.success("Tipo de despesa cadastrado com sucesso!");
      }
      
      reset();
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar tipo de despesa");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{tipoDespesa ? "Editar Tipo de Despesa" : "Novo Tipo de Despesa"}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="categoria">Categoria *</Label>
            <Input 
              id="categoria" 
              {...register("categoria", { required: true })} 
              placeholder="Ex: Combustível, Material, Manutenção..." 
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea id="descricao" {...register("descricao")} rows={3} placeholder="Descrição do tipo de despesa..." />
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