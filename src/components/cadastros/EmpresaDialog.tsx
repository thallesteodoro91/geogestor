import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EmpresaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresa?: any;
  onSuccess: () => void;
}

export function EmpresaDialog({ open, onOpenChange, empresa, onSuccess }: EmpresaDialogProps) {
  const { register, handleSubmit, reset } = useForm({
    defaultValues: empresa || {}
  });

  const onSubmit = async (data: any) => {
    try {
      if (empresa) {
        const { error } = await supabase
          .from('dim_empresa')
          .update(data)
          .eq('id_empresa', empresa.id_empresa);
        
        if (error) throw error;
        toast.success("Empresa atualizada com sucesso!");
      } else {
        const { error } = await supabase
          .from('dim_empresa')
          .insert([data]);
        
        if (error) throw error;
        toast.success("Empresa cadastrada com sucesso!");
      }
      
      reset();
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar empresa");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{empresa ? "Editar Empresa" : "Nova Empresa"}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome *</Label>
            <Input id="nome" {...register("nome", { required: true })} />
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
