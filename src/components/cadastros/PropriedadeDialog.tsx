import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useEffect } from "react";

interface PropriedadeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propriedade?: any;
  onSuccess: () => void;
}

export function PropriedadeDialog({ open, onOpenChange, propriedade, onSuccess }: PropriedadeDialogProps) {
  const { register, handleSubmit, setValue, reset } = useForm({
    defaultValues: propriedade || {}
  });
  
  const [clientes, setClientes] = useState<any[]>([]);

  useEffect(() => {
    if (open) {
      fetchClientes();
      if (propriedade) {
        // Preencher campos do formulário
        Object.keys(propriedade).forEach(key => {
          setValue(key as any, propriedade[key]);
        });
      }
    }
  }, [open, propriedade, setValue]);

  const fetchClientes = async () => {
    const { data } = await supabase
      .from('dim_cliente')
      .select('id_cliente, nome')
      .order('nome');
    
    if (data) setClientes(data);
  };

  const onSubmit = async (data: any) => {
    try {
      if (propriedade) {
        const { error } = await supabase
          .from('dim_propriedade')
          .update(data)
          .eq('id_propriedade', propriedade.id_propriedade);
        
        if (error) throw error;
        toast.success("Propriedade atualizada com sucesso!");
      } else {
        const { error } = await supabase
          .from('dim_propriedade')
          .insert([data]);
        
        if (error) throw error;
        toast.success("Propriedade cadastrada com sucesso!");
      }
      
      reset();
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar propriedade");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{propriedade ? "Editar Propriedade" : "Nova Propriedade"}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="nome_da_propriedade">Nome da Propriedade *</Label>
              <Input id="nome_da_propriedade" {...register("nome_da_propriedade", { required: true })} />
            </div>
            
            <div className="col-span-2 space-y-2">
              <Label htmlFor="id_cliente">Cliente Proprietário</Label>
              <Select onValueChange={(value) => setValue("id_cliente", value)} defaultValue={propriedade?.id_cliente}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cliente..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {clientes.map((cliente) => (
                    <SelectItem key={cliente.id_cliente} value={cliente.id_cliente}>
                      {cliente.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="area_ha">Área (ha)</Label>
              <Input id="area_ha" type="number" step="0.01" {...register("area_ha")} />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="situacao">Situação</Label>
              <Select onValueChange={(value) => setValue("situacao", value)} defaultValue={propriedade?.situacao}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ativo">Ativo</SelectItem>
                  <SelectItem value="Inativo">Inativo</SelectItem>
                  <SelectItem value="Em análise">Em análise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="cidade">Cidade</Label>
              <Input id="cidade" {...register("cidade")} />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="municipio">Município</Label>
              <Input id="municipio" {...register("municipio")} />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo</Label>
              <Input id="tipo" {...register("tipo")} />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="situacao_imovel">Situação do Imóvel</Label>
              <Input id="situacao_imovel" {...register("situacao_imovel")} />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="matricula">Matrícula</Label>
              <Input id="matricula" {...register("matricula")} />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="ccir">CCIR</Label>
              <Input id="ccir" {...register("ccir")} />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="car">CAR</Label>
              <Input id="car" {...register("car")} />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="itr">ITR</Label>
              <Input id="itr" {...register("itr")} />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="latitude">Latitude</Label>
              <Input id="latitude" type="number" step="0.000001" {...register("latitude")} />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="longitude">Longitude</Label>
              <Input id="longitude" type="number" step="0.000001" {...register("longitude")} />
            </div>
            
            <div className="col-span-2 space-y-2">
              <Label htmlFor="memorial_descritivo">Memorial Descritivo</Label>
              <Textarea id="memorial_descritivo" {...register("memorial_descritivo")} rows={4} />
            </div>
            
            <div className="col-span-2 space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea id="observacoes" {...register("observacoes")} rows={3} />
            </div>
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
