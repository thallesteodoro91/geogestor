import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { formatPhoneNumber } from "@/lib/formatPhone";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useResourceCounts } from "@/hooks/useResourceCounts";
import { PlanLimitAlert } from "@/components/plan/PlanLimitAlert";
import { StickyNote } from "lucide-react";

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
  const { isWithinLimit } = usePlanLimits();
  const { clientsCount } = useResourceCounts();
  const isEditing = !!cliente;
  const canAddClient = isEditing || isWithinLimit('clients', clientsCount);

  const [prospeccaoOptions, setProspeccaoOptions] = useState<string[]>(
    cliente?.origem ? cliente.origem.split(',').map((o: string) => o.trim()) : []
  );
  const [categoriaOptions, setCategoriaOptions] = useState<string[]>(
    cliente?.categoria ? cliente.categoria.split(',').map((c: string) => c.trim()) : []
  );

  const telefone = watch("telefone");
  const celular = watch("celular");

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
      toast.error("Limite de clientes atingido. Faça upgrade do seu plano.");
      return;
    }
    
    try {
      const submitData = {
        ...data,
        origem: prospeccaoOptions.join(', '),
        categoria: categoriaOptions.join(', ')
      };

      if (cliente) {
        const { error } = await supabase
          .from('dim_cliente')
          .update(submitData)
          .eq('id_cliente', cliente.id_cliente);
        
        if (error) throw error;
        toast.success("Cliente atualizado com sucesso!");
      } else {
        const { error } = await supabase
          .from('dim_cliente')
          .insert([submitData]);
        
        if (error) throw error;
        toast.success("Cliente cadastrado com sucesso!");
      }
      
      reset();
      setProspeccaoOptions([]);
      setCategoriaOptions([]);
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar cliente");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto z-[1000]">
        <DialogHeader>
          <DialogTitle>{cliente ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
        </DialogHeader>
        
        {!isEditing && <PlanLimitAlert resource="clients" currentCount={clientsCount} />}
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
              <Input id="cpf" {...register("cpf")} />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input id="cnpj" {...register("cnpj")} />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="situacao">Situação do Serviço</Label>
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
            
            <div className="col-span-2 space-y-2">
              <Label htmlFor="anotacoes" className="flex items-center gap-2">
                <StickyNote className="h-4 w-4 text-amber-500" />
                Observações
              </Label>
              <Textarea id="anotacoes" {...register("anotacoes")} rows={4} placeholder="Observações sobre o cliente..." />
            </div>
          </div>

          <DialogFooter>
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
