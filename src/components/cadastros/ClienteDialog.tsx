import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { logAuditEvent } from "@/services/audit.service";
import { formatPhoneNumber } from "@/lib/formatPhone";
import { formatCPF, formatCNPJ } from "@/lib/formatDocument";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useResourceCounts } from "@/hooks/useResourceCounts";
import { PlanLimitAlert } from "@/components/plan/PlanLimitAlert";
import { useFormDraft } from "@/hooks/useFormDraft";
import type { UseFormReturn } from "react-hook-form";



interface ClienteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente?: any;
  onSuccess: () => void;
}

export function ClienteDialog({ open, onOpenChange, cliente, onSuccess }: ClienteDialogProps) {
  const { register, handleSubmit, setValue, reset, watch } = useForm({
    defaultValues: cliente || {}
  });
  const isEditing = !!cliente;
  const { isWithinLimit } = usePlanLimits();
  const { clientsCount } = useResourceCounts();
  const canAddClient = isEditing || isWithinLimit('clients', clientsCount);

  const { clearDraft } = useFormDraft({
    key: 'cliente:new',
    form: { watch, reset } as unknown as UseFormReturn<any>,
    enabled: open && !isEditing,
    onAfterRestore: (v: any) => {
      if (v?.origem) setProspeccaoOptions(String(v.origem).split(',').map((o: string) => o.trim()).filter(Boolean));
      if (v?.categoria) setCategoriaOptions(String(v.categoria).split(',').map((c: string) => c.trim()).filter(Boolean));
    },
  });


  const [prospeccaoOptions, setProspeccaoOptions] = useState<string[]>(
    cliente?.origem ? cliente.origem.split(',').map((o: string) => o.trim()) : []
  );
  const [categoriaOptions, setCategoriaOptions] = useState<string[]>(
    cliente?.categoria ? cliente.categoria.split(',').map((c: string) => c.trim()) : []
  );

  const telefone = watch("telefone");
  const celular = watch("celular");
  const cpf = watch("cpf");
  const cnpj = watch("cnpj");

  useEffect(() => {
    if (cliente) {
      setProspeccaoOptions(
        cliente.origem ? cliente.origem.split(',').map((o: string) => o.trim()) : []
      );
      setCategoriaOptions(
        cliente.categoria ? cliente.categoria.split(',').map((c: string) => c.trim()) : []
      );
      setValue("telefone", cliente.telefone || '');
      setValue("celular", cliente.celular || '');
      setValue("cpf", cliente.cpf || '');
      setValue("cnpj", cliente.cnpj || '');
    }
  }, [cliente, setValue]);

  const handleProspeccaoToggle = (option: string) => {
    setProspeccaoOptions(prev => 
      prev.includes(option) 
        ? prev.filter(o => o !== option)
        : [...prev, option]
    );
  };

  const handleCategoriaToggle = (option: string) => {
    setCategoriaOptions(prev => 
      prev.includes(option) 
        ? prev.filter(c => c !== option)
        : [...prev, option]
    );
  };

  const onSubmit = async (data: any) => {
    if (!isEditing && !canAddClient) {
      toast.error("Limite de clientes do plano atingido.", {
        description: "Faça upgrade para adicionar mais clientes.",
        action: { label: "Ver planos", onClick: () => (window.location.href = "/assinatura") },
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
      
      const submitData = {
        ...data,
        origem: prospeccaoOptions.join(', '),
        categoria: categoriaOptions.join(', '),
        tenant_id: memberData.tenant_id, // Garantir tenant_id explícito
      };

      if (cliente) {
        const { tenant_id, ...updateData } = submitData;
        
        const { error } = await supabase
          .from('dim_cliente')
          .update(updateData)
          .eq('id_cliente', cliente.id_cliente)
          .eq('tenant_id', memberData.tenant_id);
        
        if (error) throw error;
        await logAuditEvent({ action: 'UPDATE', entity: 'Cliente', entityId: cliente.id_cliente, oldData: { ...cliente }, newData: updateData });
        toast.success("Cliente atualizado com sucesso!");
      } else {
        const { data: newCliente, error } = await supabase
          .from('dim_cliente')
          .insert([submitData])
          .select('id_cliente')
          .single();
        
        if (error) throw error;
        await logAuditEvent({ action: 'INSERT', entity: 'Cliente', entityId: newCliente?.id_cliente, newData: submitData });
        toast.success("Cliente cadastrado com sucesso!");
      }
      
      reset();
      setProspeccaoOptions([]);
      setCategoriaOptions([]);
      clearDraft();
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      const planLimit = (await import("@/lib/planLimitError")).getPlanLimitMessage(error);
      if (planLimit) {
        toast.error(planLimit.title, { description: planLimit.description });
      } else {
        toast.error(error.message || "Erro ao salvar cliente");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{cliente ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto max-h-[calc(90vh-200px)] space-y-4 pr-2">
          {!isEditing && <PlanLimitAlert resource="clients" currentCount={clientsCount} />}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input id="nome" {...register("nome", { required: true })} />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register("email")} />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input 
                id="telefone"
                onChange={(e) => {
                  const formatted = formatPhoneNumber(e.target.value);
                  setValue("telefone", formatted);
                }}
                value={telefone || ''}
                placeholder="(00) 000000000"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="celular">Celular</Label>
              <Input 
                id="celular"
                onChange={(e) => {
                  const formatted = formatPhoneNumber(e.target.value);
                  setValue("celular", formatted);
                }}
                value={celular || ''}
                placeholder="(00) 000000000"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="cpf">CPF</Label>
              <Input 
                id="cpf"
                onChange={(e) => {
                  const formatted = formatCPF(e.target.value);
                  setValue("cpf", formatted);
                }}
                value={cpf || ''}
                placeholder="000.000.000-00"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input 
                id="cnpj"
                onChange={(e) => {
                  const formatted = formatCNPJ(e.target.value);
                  setValue("cnpj", formatted);
                }}
                value={cnpj || ''}
                placeholder="00.000.000/0000-00"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="situacao">Situação</Label>
              <Select onValueChange={(value) => setValue("situacao", value)} defaultValue={cliente?.situacao}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ativo">Ativo</SelectItem>
                  <SelectItem value="Inativo">Inativo</SelectItem>
                  <SelectItem value="Pendente">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="endereco">Endereço</Label>
              <Input id="endereco" {...register("endereco")} />
            </div>
            
            <div className="col-span-2 grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label>Prospecção</Label>
                <div className="space-y-2">
                  {["Indicação", "Evento", "Cliente antigo", "Site", "Rede social"].map(option => (
                    <div key={option} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`prospeccao-${option}`}
                        checked={prospeccaoOptions.includes(option)}
                        onCheckedChange={() => handleProspeccaoToggle(option)}
                      />
                      <Label 
                        htmlFor={`prospeccao-${option}`} 
                        className="text-sm font-normal cursor-pointer"
                      >
                        {option}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="space-y-3">
                <Label>Categoria do Cliente</Label>
                <div className="space-y-2">
                  {["Governo", "Pessoa Física", "Pessoa Jurídica"].map(option => (
                    <div key={option} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`categoria-${option}`}
                        checked={categoriaOptions.includes(option)}
                        onCheckedChange={() => handleCategoriaToggle(option)}
                      />
                      <Label 
                        htmlFor={`categoria-${option}`} 
                        className="text-sm font-normal cursor-pointer"
                      >
                        {option}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
          </div>

          <div className="col-span-2 space-y-2">
            <Label htmlFor="anotacoes">Observações</Label>
            <Textarea
              id="anotacoes"
              {...register("anotacoes")}
              placeholder="Observações sobre o cliente..."
              rows={3}
            />
          </div>

          </div>

          <DialogFooter className="mt-4 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!isEditing && !canAddClient}>Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
