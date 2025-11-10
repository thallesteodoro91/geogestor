import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";

interface OrcamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orcamento?: any;
  clienteId?: string;
  onSuccess: () => void;
}

export function OrcamentoDialog({ open, onOpenChange, orcamento, clienteId, onSuccess }: OrcamentoDialogProps) {
  const { register, handleSubmit, setValue, reset, watch } = useForm({
    defaultValues: orcamento || { data_orcamento: new Date().toISOString().split('T')[0] }
  });
  
  const [clientes, setClientes] = useState<any[]>([]);
  const [servicos, setServicos] = useState<any[]>([]);

  const valorUnitario = watch("valor_unitario") || 0;
  const quantidade = watch("quantidade") || 1;
  const desconto = watch("desconto") || 0;
  const valorImposto = watch("valor_imposto") || 0;
  const custoServico = watch("custo_servico") || 0;

  const subtotal = Number(valorUnitario) * Number(quantidade);
  const receitaEsperada = subtotal - Number(desconto);
  const receitaEsperadaComImposto = receitaEsperada + Number(valorImposto);
  const lucroEsperado = receitaEsperada - Number(custoServico);
  const margemEsperada = receitaEsperada > 0 ? ((lucroEsperado / receitaEsperada) * 100).toFixed(2) : 0;

  useEffect(() => {
    if (open) {
      fetchData();
      if (orcamento) {
        Object.keys(orcamento).forEach(key => {
          setValue(key as any, orcamento[key]);
        });
      } else {
        setValue("data_orcamento", new Date().toISOString().split('T')[0]);
      }
      if (clienteId && !orcamento) {
        setValue("id_cliente", clienteId);
      }
    }
  }, [open, orcamento, clienteId, setValue]);

  const fetchData = async () => {
    const [clientesData, servicosData] = await Promise.all([
      supabase.from('dim_cliente').select('id_cliente, nome').order('nome'),
      supabase.from('fato_servico').select('id_servico, nome_do_servico, custo_servico').order('nome_do_servico')
    ]);
    
    if (clientesData.data) setClientes(clientesData.data);
    if (servicosData.data) setServicos(servicosData.data);
  };

  const handleServicoChange = (servicoId: string) => {
    setValue("id_servico", servicoId);
    const servico = servicos.find(s => s.id_servico === servicoId);
    if (servico && servico.custo_servico) {
      setValue("custo_servico", servico.custo_servico);
    }
  };

  const onSubmit = async (data: any) => {
    try {
      // Remove custo_servico pois não existe na tabela fato_orcamento
      const { custo_servico, ...dataWithoutCusto } = data;
      
      const sanitizedData = {
        ...dataWithoutCusto,
        valor_unitario: Number(data.valor_unitario),
        quantidade: Number(data.quantidade),
        desconto: data.desconto === '' ? 0 : Number(data.desconto),
        valor_imposto: data.valor_imposto === '' ? 0 : Number(data.valor_imposto),
        receita_esperada: receitaEsperada,
        receita_esperada_imposto: receitaEsperadaComImposto,
        lucro_esperado: lucroEsperado,
        margem_esperada: Number(margemEsperada),
        receita_realizada: data.receita_realizada === '' ? null : Number(data.receita_realizada),
        valor_faturado: data.valor_faturado === '' ? null : Number(data.valor_faturado),
      };

      if (orcamento) {
        const { error } = await supabase
          .from('fato_orcamento')
          .update(sanitizedData)
          .eq('id_orcamento', orcamento.id_orcamento);
        
        if (error) throw error;
        toast.success("Orçamento atualizado com sucesso!");
      } else {
        const { error } = await supabase
          .from('fato_orcamento')
          .insert([sanitizedData]);
        
        if (error) throw error;
        toast.success("Orçamento cadastrado com sucesso!");
      }
      
      reset();
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Erro ao salvar orçamento:', error);
      toast.error(error.message || "Erro ao salvar orçamento");
    }
  };

  const getSituacaoPagamentoColor = (situacao: string) => {
    switch(situacao) {
      case "Faturado": return "bg-green-500 hover:bg-green-600";
      case "Pendente": return "bg-yellow-500 hover:bg-yellow-600";
      case "Cancelado": return "bg-pink-500 hover:bg-pink-600";
      default: return "bg-muted";
    }
  };

  const getFormaPagamentoColor = (forma: string) => {
    switch(forma) {
      case "Dinheiro": return "bg-green-500 hover:bg-green-600";
      case "Pix": return "bg-blue-500 hover:bg-blue-600";
      case "Cartão": return "bg-yellow-500 hover:bg-yellow-600";
      case "Transferência Bancária": return "bg-gray-500 hover:bg-gray-600";
      default: return "bg-muted";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{orcamento ? "Editar Orçamento" : "Novo Orçamento"}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Dados Básicos */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Dados Básicos</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="id_cliente">Cliente *</Label>
                <Select 
                  onValueChange={(value) => setValue("id_cliente", value)} 
                  defaultValue={orcamento?.id_cliente || clienteId}
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
                <Label htmlFor="id_servico">Serviço *</Label>
                <Select 
                  onValueChange={handleServicoChange}
                  defaultValue={orcamento?.id_servico}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um serviço" />
                  </SelectTrigger>
                  <SelectContent>
                    {servicos.map((servico) => (
                      <SelectItem key={servico.id_servico} value={servico.id_servico}>
                        {servico.nome_do_servico}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="data_orcamento">Data do Orçamento *</Label>
                <Input 
                  id="data_orcamento" 
                  type="date" 
                  {...register("data_orcamento", { required: true })} 
                />
              </div>
            </div>
          </div>

          {/* Valores e Cálculos */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Valores e Cálculos</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="valor_unitario">Valor Unitário (R$) *</Label>
                <Input 
                  id="valor_unitario" 
                  type="number" 
                  step="0.01" 
                  {...register("valor_unitario", { required: true })} 
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="quantidade">Quantidade *</Label>
                <Input 
                  id="quantidade" 
                  type="number" 
                  {...register("quantidade", { required: true })} 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="desconto">Desconto (R$)</Label>
                <Input 
                  id="desconto" 
                  type="number" 
                  step="0.01" 
                  {...register("desconto")} 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="valor_imposto">Valor Imposto (R$)</Label>
                <Input 
                  id="valor_imposto" 
                  type="number" 
                  step="0.01" 
                  {...register("valor_imposto")} 
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
            </div>

            {/* Resumo Financeiro */}
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <h4 className="font-semibold">Resumo Financeiro</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Subtotal: <span className="font-semibold">R$ {subtotal.toFixed(2)}</span></div>
                <div>Receita Esperada: <span className="font-semibold">R$ {receitaEsperada.toFixed(2)}</span></div>
                <div>Lucro Esperado: <span className="font-semibold">R$ {lucroEsperado.toFixed(2)}</span></div>
                <div>Margem Esperada: <span className="font-semibold">{margemEsperada}%</span></div>
                <div className="col-span-2">Receita Esperada + Imposto: <span className="font-semibold">R$ {receitaEsperadaComImposto.toFixed(2)}</span></div>
              </div>
            </div>
          </div>

          {/* Status e Faturamento */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Status e Faturamento</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Orçamento Convertido</Label>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="orcamento_convertido"
                    onCheckedChange={(checked) => setValue("orcamento_convertido", checked)}
                    defaultChecked={orcamento?.orcamento_convertido}
                  />
                  <Label htmlFor="orcamento_convertido" className="text-sm font-normal cursor-pointer">
                    Sim, foi convertido em serviço
                  </Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Faturamento Realizado</Label>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="faturamento"
                    onCheckedChange={(checked) => setValue("faturamento", checked)}
                    defaultChecked={orcamento?.faturamento}
                  />
                  <Label htmlFor="faturamento" className="text-sm font-normal cursor-pointer">
                    Sim, foi faturado
                  </Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="data_do_faturamento">Data do Faturamento</Label>
                <Input 
                  id="data_do_faturamento" 
                  type="date" 
                  {...register("data_do_faturamento")} 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="valor_faturado">Valor Faturado (R$)</Label>
                <Input 
                  id="valor_faturado" 
                  type="number" 
                  step="0.01" 
                  {...register("valor_faturado")} 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="receita_realizada">Receita Realizada (R$)</Label>
                <Input 
                  id="receita_realizada" 
                  type="number" 
                  step="0.01" 
                  {...register("receita_realizada")} 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="situacao_do_pagamento">Situação do Pagamento</Label>
                <Select 
                  onValueChange={(value) => setValue("situacao_do_pagamento", value)} 
                  defaultValue={orcamento?.situacao_do_pagamento}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Faturado">
                      <Badge className={getSituacaoPagamentoColor("Faturado")}>Faturado</Badge>
                    </SelectItem>
                    <SelectItem value="Pendente">
                      <Badge className={getSituacaoPagamentoColor("Pendente")}>Pendente</Badge>
                    </SelectItem>
                    <SelectItem value="Cancelado">
                      <Badge className={getSituacaoPagamentoColor("Cancelado")}>Cancelado</Badge>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="forma_de_pagamento">Forma de Pagamento</Label>
                <Select 
                  onValueChange={(value) => setValue("forma_de_pagamento", value)} 
                  defaultValue={orcamento?.forma_de_pagamento}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Dinheiro">
                      <Badge className={getFormaPagamentoColor("Dinheiro")}>Dinheiro</Badge>
                    </SelectItem>
                    <SelectItem value="Pix">
                      <Badge className={getFormaPagamentoColor("Pix")}>Pix</Badge>
                    </SelectItem>
                    <SelectItem value="Cartão">
                      <Badge className={getFormaPagamentoColor("Cartão")}>Cartão</Badge>
                    </SelectItem>
                    <SelectItem value="Transferência Bancária">
                      <Badge className={getFormaPagamentoColor("Transferência Bancária")}>Transferência Bancária</Badge>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
