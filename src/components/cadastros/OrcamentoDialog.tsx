import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

interface OrcamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orcamento?: any;
  clienteId?: string;
  onSuccess: () => void;
}

export function OrcamentoDialog({ open, onOpenChange, orcamento, clienteId, onSuccess }: OrcamentoDialogProps) {
  const [clientes, setClientes] = useState<any[]>([]);
  const [servicos, setServicos] = useState<any[]>([]);
  const [clienteData, setClienteData] = useState<any>(null);

  const { register, handleSubmit, setValue, watch, control, reset } = useForm({
    defaultValues: {
      id_cliente: clienteId || orcamento?.id_cliente || "",
      data_orcamento: orcamento?.data_orcamento || new Date().toISOString().split('T')[0],
      itens: orcamento?.itens || [{
        id_servico: "",
        quantidade: 1,
        valor_unitario: 0,
        valor_imposto: 0,
        desconto: 0
      }],
      orcamento_convertido: orcamento?.orcamento_convertido || false,
      faturamento: orcamento?.faturamento || false,
      data_do_faturamento: orcamento?.data_do_faturamento || "",
      situacao_do_pagamento: orcamento?.situacao_do_pagamento || "",
      forma_de_pagamento: orcamento?.forma_de_pagamento || "",
      anotacoes: orcamento?.anotacoes || ""
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "itens"
  });

  const watchedItens = watch("itens");
  const watchedClienteId = watch("id_cliente");
  const watchedSituacao = watch("situacao_do_pagamento");

  useEffect(() => {
    if (open) {
      fetchData();
      if (clienteId) {
        setValue("id_cliente", clienteId);
        fetchClienteData(clienteId);
      }
      if (orcamento) {
        reset({
          id_cliente: orcamento.id_cliente,
          data_orcamento: orcamento.data_orcamento,
          itens: orcamento.itens || [{
            id_servico: "",
            quantidade: 1,
            valor_unitario: 0,
            valor_imposto: 0,
            desconto: 0
          }],
          orcamento_convertido: orcamento.orcamento_convertido,
          faturamento: orcamento.faturamento,
          data_do_faturamento: orcamento.data_do_faturamento,
          situacao_do_pagamento: orcamento.situacao_do_pagamento,
          forma_de_pagamento: orcamento.forma_de_pagamento,
          anotacoes: orcamento.anotacoes || ""
        });
        if (orcamento.id_cliente) {
          fetchClienteData(orcamento.id_cliente);
        }
      }
    }
  }, [open, orcamento, clienteId]);

  useEffect(() => {
    if (watchedClienteId) {
      fetchClienteData(watchedClienteId);
    }
  }, [watchedClienteId]);

  const fetchData = async () => {
    const [clientesRes, servicosRes] = await Promise.all([
      supabase.from('dim_cliente').select('id_cliente, nome').order('nome'),
      supabase.from('fato_servico').select('id_servico, nome_do_servico, custo_servico').order('nome_do_servico')
    ]);

    if (clientesRes.data) setClientes(clientesRes.data);
    if (servicosRes.data) setServicos(servicosRes.data);
  };

  const fetchClienteData = async (clienteId: string) => {
    const { data } = await supabase
      .from('dim_cliente')
      .select('endereco, telefone, celular')
      .eq('id_cliente', clienteId)
      .single();
    
    if (data) {
      setClienteData(data);
    }
  };

  const calcularTotais = () => {
    const subtotal = watchedItens.reduce((acc, item) => {
      const valorItem = (item.quantidade || 0) * (item.valor_unitario || 0);
      const valorComDesconto = valorItem - (item.desconto || 0);
      return acc + valorComDesconto;
    }, 0);

    const totalImpostos = watchedItens.reduce((acc, item) => acc + (item.valor_imposto || 0), 0);
    const receitaEsperada = subtotal - totalImpostos;
    
    return { subtotal, totalImpostos, receitaEsperada };
  };

  const { subtotal, totalImpostos, receitaEsperada } = calcularTotais();

  const onSubmit = async (data: any) => {
    try {
      const orcamentoData = {
        id_cliente: data.id_cliente,
        data_orcamento: data.data_orcamento,
        quantidade: data.itens.reduce((acc: number, item: any) => acc + (item.quantidade || 0), 0),
        valor_unitario: subtotal / data.itens.length,
        desconto: data.itens.reduce((acc: number, item: any) => acc + (item.desconto || 0), 0),
        valor_imposto: totalImpostos,
        receita_esperada: receitaEsperada,
        receita_esperada_imposto: receitaEsperada,
        orcamento_convertido: data.orcamento_convertido,
        faturamento: data.faturamento,
        data_do_faturamento: data.data_do_faturamento || null,
        situacao_do_pagamento: data.situacao_do_pagamento,
        forma_de_pagamento: data.forma_de_pagamento,
        anotacoes: data.anotacoes
      };

      let orcamentoId = orcamento?.id_orcamento;

      if (orcamento) {
        const { error } = await supabase
          .from('fato_orcamento')
          .update(orcamentoData)
          .eq('id_orcamento', orcamento.id_orcamento);

        if (error) throw error;
      } else {
        const { data: novoOrcamento, error } = await supabase
          .from('fato_orcamento')
          .insert([orcamentoData])
          .select()
          .single();

        if (error) throw error;
        orcamentoId = novoOrcamento.id_orcamento;
      }

      // Deletar itens antigos e inserir novos
      if (orcamento) {
        await supabase
          .from('fato_orcamento_itens')
          .delete()
          .eq('id_orcamento', orcamentoId);
      }

      const itensData = data.itens.map((item: any) => ({
        id_orcamento: orcamentoId,
        id_servico: item.id_servico,
        quantidade: item.quantidade,
        valor_unitario: item.valor_unitario,
        valor_imposto: item.valor_imposto,
        desconto: item.desconto
      }));

      const { error: itensError } = await supabase
        .from('fato_orcamento_itens')
        .insert(itensData);

      if (itensError) throw itensError;

      toast.success(orcamento ? "Orçamento atualizado com sucesso!" : "Orçamento criado com sucesso!");
      onSuccess();
      reset();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Erro ao salvar orçamento:', error);
      toast.error("Erro ao salvar orçamento: " + error.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{orcamento ? 'Editar Orçamento' : 'Novo Orçamento'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* I. Dados Básicos */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Dados Básicos</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cliente *</Label>
                <Select
                  value={watchedClienteId}
                  onValueChange={(value) => setValue("id_cliente", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cliente" />
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
                <Label>Data do Orçamento *</Label>
                <Input type="date" {...register("data_orcamento")} required />
              </div>
            </div>

            {clienteData && (
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div className="space-y-2">
                  <Label>Endereço</Label>
                  <Input value={clienteData.endereco || ''} readOnly className="bg-background" />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={clienteData.telefone || clienteData.celular || ''} readOnly className="bg-background" />
                </div>
              </div>
            )}
          </div>

          {/* II. Valores e Cálculos */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Valores e Cálculos</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({
                  id_servico: "",
                  quantidade: 1,
                  valor_unitario: 0,
                  valor_imposto: 0,
                  desconto: 0
                })}
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Serviço
              </Button>
            </div>

            {fields.map((field, index) => (
              <div key={field.id} className="p-4 border rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Serviço {index + 1}</span>
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-5 gap-4">
                  <div className="space-y-2">
                    <Label>Quantidade</Label>
                    <Input
                      type="number"
                      step="0.01"
                      {...register(`itens.${index}.quantidade` as const)}
                    />
                  </div>

                  <div className="space-y-2 col-span-2">
                    <Label>Serviço</Label>
                    <Select
                      value={watchedItens[index]?.id_servico}
                      onValueChange={(value) => setValue(`itens.${index}.id_servico`, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
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
                    <Label>Valor Unitário</Label>
                    <Input
                      type="number"
                      step="0.01"
                      {...register(`itens.${index}.valor_unitario` as const)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Valor Imposto</Label>
                    <Input
                      type="number"
                      step="0.01"
                      {...register(`itens.${index}.valor_imposto` as const)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-4">
                  <div className="space-y-2">
                    <Label>Desconto</Label>
                    <Input
                      type="number"
                      step="0.01"
                      {...register(`itens.${index}.desconto` as const)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Resumo Financeiro */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <h3 className="font-semibold">Resumo Financeiro</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Subtotal:</span>
                <p className="font-semibold">R$ {subtotal.toFixed(2)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Impostos:</span>
                <p className="font-semibold">R$ {totalImpostos.toFixed(2)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Receita Esperada:</span>
                <p className="font-semibold text-primary">R$ {receitaEsperada.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* III. Situação e Faturamento */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Situação e Faturamento</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Orçamento Convertido?</Label>
                <Select
                  value={watch("orcamento_convertido") ? "sim" : "nao"}
                  onValueChange={(value) => setValue("orcamento_convertido", value === "sim")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sim">Sim</SelectItem>
                    <SelectItem value="nao">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Faturamento Realizado?</Label>
                <Select
                  value={watch("faturamento") ? "sim" : "nao"}
                  onValueChange={(value) => setValue("faturamento", value === "sim")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sim">Sim</SelectItem>
                    <SelectItem value="nao">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Data do Faturamento</Label>
                <Input type="date" {...register("data_do_faturamento")} />
              </div>

              <div className="space-y-2">
                <Label>Situação do Pagamento</Label>
                <Select
                  value={watchedSituacao}
                  onValueChange={(value) => setValue("situacao_do_pagamento", value)}
                >
                  <SelectTrigger className={watchedSituacao === "Cancelado" ? "text-[#FF0000]" : ""}>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pendente">Pendente</SelectItem>
                    <SelectItem value="Pago">Pago</SelectItem>
                    <SelectItem value="Cancelado" className="text-[#FF0000]">Cancelado</SelectItem>
                    <SelectItem value="Parcial">Parcial</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 col-span-2">
                <Label>Forma de Pagamento</Label>
                <Select
                  value={watch("forma_de_pagamento")}
                  onValueChange={(value) => setValue("forma_de_pagamento", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PIX">PIX</SelectItem>
                    <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="Cartão">Cartão</SelectItem>
                    <SelectItem value="Transferência">Transferência</SelectItem>
                    <SelectItem value="Boleto">Boleto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Anotações */}
          <div className="space-y-2">
            <Label>Anotações</Label>
            <Textarea
              {...register("anotacoes")}
              placeholder="Observações adicionais..."
              rows={4}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">
              {orcamento ? 'Atualizar' : 'Criar'} Orçamento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
