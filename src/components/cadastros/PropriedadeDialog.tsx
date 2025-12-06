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
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useResourceCounts } from "@/hooks/useResourceCounts";
import { PlanLimitAlert } from "@/components/plan/PlanLimitAlert";

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
  const { isWithinLimit } = usePlanLimits();
  const { propertiesCount } = useResourceCounts();
  const isEditing = !!propriedade;
  const canAddProperty = isEditing || isWithinLimit('properties', propertiesCount);
  
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
    if (!isEditing && !canAddProperty) {
      toast.error("Limite de propriedades atingido. Faça upgrade do seu plano.");
      return;
    }
    
    try {
      // Converter strings vazias em null para campos numéricos
      const sanitizedData = {
        ...data,
        area_ha: data.area_ha === '' || data.area_ha === null || data.area_ha === undefined ? null : Number(data.area_ha),
        latitude: data.latitude === '' || data.latitude === null || data.latitude === undefined ? null : Number(data.latitude),
        longitude: data.longitude === '' || data.longitude === null || data.longitude === undefined ? null : Number(data.longitude),
      };

      if (propriedade) {
        const { error } = await supabase
          .from('dim_propriedade')
          .update(sanitizedData)
          .eq('id_propriedade', propriedade.id_propriedade);
        
        if (error) throw error;
        toast.success("Propriedade atualizada com sucesso!");
      } else {
        const { error } = await supabase
          .from('dim_propriedade')
          .insert([sanitizedData]);
        
        if (error) throw error;
        toast.success("Propriedade cadastrada com sucesso!");
      }
      
      reset();
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Erro ao salvar propriedade:', error);
      toast.error(error.message || "Erro ao salvar propriedade");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{propriedade ? "Editar Propriedade" : "Nova Propriedade"}</DialogTitle>
        </DialogHeader>
        
        {!isEditing && <PlanLimitAlert resource="properties" currentCount={propertiesCount} />}
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="nome_da_propriedade">Nome da Propriedade *</Label>
              <Input id="nome_da_propriedade" {...register("nome_da_propriedade", { required: true })} />
            </div>
            
            <div className="col-span-2 space-y-2">
              <Label htmlFor="id_cliente">Cliente Proprietário (opcional)</Label>
              <Select 
                onValueChange={(value) => setValue("id_cliente", value)} 
                defaultValue={propriedade?.id_cliente || undefined}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Nenhum - deixar sem proprietário" />
                </SelectTrigger>
                <SelectContent>
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
              <Label htmlFor="possui_memorial_descritivo">Possui Memorial Descritivo?</Label>
              <Select 
                onValueChange={(value) => setValue("possui_memorial_descritivo", value)}
                defaultValue={propriedade?.possui_memorial_descritivo || undefined}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma opção" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sim">Sim</SelectItem>
                  <SelectItem value="Não">Não</SelectItem>
                </SelectContent>
              </Select>
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
            <Button type="submit" disabled={!isEditing && !canAddProperty}>Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
