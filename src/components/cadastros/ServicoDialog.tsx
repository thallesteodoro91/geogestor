import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { SERVICE_STATUS } from "@/constants/serviceStatus";

interface ServicoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  servico?: any;
  clienteId?: string;
  onSuccess: () => void;
}

export function ServicoDialog({ open, onOpenChange, servico, clienteId, onSuccess }: ServicoDialogProps) {
  const { register, handleSubmit, setValue, reset } = useForm({
    defaultValues: servico || {}
  });
  
  const [clientes, setClientes] = useState<any[]>([]);
  const [propriedades, setPropriedades] = useState<any[]>([]);
  const [empresas, setEmpresas] = useState<any[]>([]);

  useEffect(() => {
    if (open) {
      fetchData();
      if (servico) {
        Object.keys(servico).forEach(key => {
          setValue(key as any, servico[key]);
        });
      }
      if (clienteId && !servico) {
        setValue("id_cliente", clienteId);
      }
    }
  }, [open, servico, clienteId, setValue]);

  const fetchData = async () => {
    const [clientesData, propriedadesData, empresasData] = await Promise.all([
      supabase.from('dim_cliente').select('id_cliente, nome').order('nome'),
      supabase.from('dim_propriedade').select('id_propriedade, nome_da_propriedade').order('nome_da_propriedade'),
      supabase.from('dim_empresa').select('id_empresa, nome').order('nome')
    ]);
    
    if (clientesData.data) setClientes(clientesData.data);
    if (propriedadesData.data) setPropriedades(propriedadesData.data);
    if (empresasData.data) setEmpresas(empresasData.data);
  };

  const onSubmit = async (data: any) => {
    try {
      const sanitizedData = {
        ...data,
        receita_servico: data.receita_servico === '' ? null : Number(data.receita_servico),
        custo_servico: data.custo_servico === '' ? null : Number(data.custo_servico),
        numero_de_servicos_concluidos: data.numero_de_servicos_concluidos === '' ? null : Number(data.numero_de_servicos_concluidos),
      };

      if (servico) {
        const { error } = await supabase
          .from('fato_servico')
          .update(sanitizedData)
          .eq('id_servico', servico.id_servico);
        
        if (error) throw error;
        toast.success("Serviço atualizado com sucesso!");
      } else {
        const { error } = await supabase
          .from('fato_servico')
          .insert([sanitizedData]);
        
        if (error) throw error;
        toast.success("Serviço cadastrado com sucesso!");
      }
      
      reset();
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Erro ao salvar serviço:', error);
      toast.error(error.message || "Erro ao salvar serviço");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{servico ? "Editar Serviço" : "Novo Serviço"}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="nome_do_servico">Nome do Serviço *</Label>
              <Input id="nome_do_servico" {...register("nome_do_servico", { required: true })} />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="id_cliente">Cliente</Label>
              <Select 
                onValueChange={(value) => setValue("id_cliente", value)} 
                defaultValue={servico?.id_cliente || clienteId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cliente" />
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
              <Label htmlFor="id_propriedade">Propriedade</Label>
              <Select 
                onValueChange={(value) => setValue("id_propriedade", value)} 
                defaultValue={servico?.id_propriedade}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma propriedade" />
                </SelectTrigger>
                <SelectContent>
                  {propriedades.map((prop) => (
                    <SelectItem key={prop.id_propriedade} value={prop.id_propriedade}>
                      {prop.nome_da_propriedade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="id_empresa">Empresa</Label>
              <Select 
                onValueChange={(value) => setValue("id_empresa", value)} 
                defaultValue={servico?.id_empresa}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma empresa" />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((empresa) => (
                    <SelectItem key={empresa.id_empresa} value={empresa.id_empresa}>
                      {empresa.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria</Label>
              <Input id="categoria" {...register("categoria")} />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="data_do_servico_inicio">Data de Início</Label>
              <Input id="data_do_servico_inicio" type="date" {...register("data_do_servico_inicio")} />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="data_do_servico_fim">Data de Conclusão</Label>
              <Input id="data_do_servico_fim" type="date" {...register("data_do_servico_fim")} />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="situacao_do_servico">Situação do Serviço</Label>
              <Select 
                onValueChange={(value) => setValue("situacao_do_servico", value)} 
                defaultValue={servico?.situacao_do_servico}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SERVICE_STATUS.EM_ANDAMENTO}>{SERVICE_STATUS.EM_ANDAMENTO}</SelectItem>
                  <SelectItem value={SERVICE_STATUS.CONCLUIDO}>{SERVICE_STATUS.CONCLUIDO}</SelectItem>
                  <SelectItem value={SERVICE_STATUS.CANCELADO}>{SERVICE_STATUS.CANCELADO}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="receita_servico">Receita do Serviço (R$)</Label>
              <Input 
                id="receita_servico" 
                type="number" 
                step="0.01" 
                {...register("receita_servico")} 
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="custo_servico">Custo do Serviço (R$)</Label>
              <Input 
                id="custo_servico" 
                type="number" 
                step="0.01" 
                {...register("custo_servico")} 
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="numero_de_servicos_concluidos">Número de Serviços Concluídos</Label>
              <Input 
                id="numero_de_servicos_concluidos" 
                type="number" 
                {...register("numero_de_servicos_concluidos")} 
              />
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
