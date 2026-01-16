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
import { StickyNote } from "lucide-react";

interface PropriedadeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propriedade?: any;
  defaultClienteId?: string;
  onSuccess: () => void;
}

export function PropriedadeDialog({ open, onOpenChange, propriedade, defaultClienteId, onSuccess }: PropriedadeDialogProps) {
  const { register, handleSubmit, setValue, reset } = useForm({
    defaultValues: propriedade || {}
  });
  const { isWithinLimit } = usePlanLimits();
  const { propertiesCount } = useResourceCounts();
  const isEditing = !!propriedade;
  const canAddProperty = isEditing || isWithinLimit('properties', propertiesCount);
  
  const [clientes, setClientes] = useState<any[]>([]);
  const [selectedClienteId, setSelectedClienteId] = useState<string | undefined>(
    propriedade?.id_cliente || defaultClienteId
  );

  useEffect(() => {
    if (open) {
      fetchClientes();
      if (propriedade) {
        // Preencher campos do formulário
        Object.keys(propriedade).forEach(key => {
          setValue(key as any, propriedade[key]);
        });
        setSelectedClienteId(propriedade.id_cliente);
      } else if (defaultClienteId) {
        setValue("id_cliente", defaultClienteId);
        setSelectedClienteId(defaultClienteId);
      }
    } else {
      // Reset when dialog closes
      setSelectedClienteId(undefined);
    }
  }, [open, propriedade, defaultClienteId, setValue]);

  const fetchClientes = async () => {
    const { data } = await supabase
      .from('dim_cliente')
      .select('id_cliente, nome')
      .order('nome');
    
    if (data) setClientes(data);
  };

  const onSubmit = async (data: any) => {
    if (!isEditing && !canAddProperty) {
      toast.error("Limite de propriedades atingido. Faça upgrade do seu plano.", {
        description: "Acesse Configurações > Plano para fazer upgrade.",
        action: {
          label: "Ver Planos",
          onClick: () => window.location.href = '/configuracoes',
        },
        duration: 6000,
      });
      return;
    }
    
    try {
      // Obter tenant_id para garantir isolamento de dados
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }
      
      const { data: memberData } = await supabase
        .from('tenant_members')
        .select('tenant_id')
        .eq('user_id', user.id)
        .single();
      
      if (!memberData?.tenant_id) {
        toast.error("Erro de configuração. Entre em contato com o suporte.");
        return;
      }
      
      // Converter strings vazias em null para campos numéricos
      const sanitizedData = {
        ...data,
        area_ha: data.area_ha === '' || data.area_ha === null || data.area_ha === undefined ? null : Number(data.area_ha),
        latitude: data.latitude === '' || data.latitude === null || data.latitude === undefined ? null : Number(data.latitude),
        longitude: data.longitude === '' || data.longitude === null || data.longitude === undefined ? null : Number(data.longitude),
        tenant_id: memberData.tenant_id, // Garantir tenant_id explícito
      };

      if (propriedade) {
        // Remover tenant_id do update (não deve ser alterado)
        const { tenant_id, ...updateData } = sanitizedData;
        
        const { error } = await supabase
          .from('dim_propriedade')
          .update(updateData)
          .eq('id_propriedade', propriedade.id_propriedade)
          .eq('tenant_id', memberData.tenant_id); // Filtro explícito de segurança
        
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
                onValueChange={(value) => {
                  setValue("id_cliente", value);
                  setSelectedClienteId(value);
                }} 
                value={selectedClienteId}
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
              <Label htmlFor="observacoes" className="flex items-center gap-2">
                <StickyNote className="h-4 w-4 text-amber-500" />
                Observações
              </Label>
              <Textarea id="observacoes" {...register("observacoes")} rows={3} placeholder="Observações sobre a propriedade..." />
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
