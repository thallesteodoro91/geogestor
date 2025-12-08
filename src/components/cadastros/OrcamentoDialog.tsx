import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, MapPin, Info } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";

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
  const { createNotification } = useNotifications();

  const { register, handleSubmit, setValue, watch, control, reset } = useForm({
    defaultValues: {
      id_cliente: clienteId || orcamento?.id_cliente || "",
      data_orcamento: orcamento?.data_orcamento || new Date().toISOString().split('T')[0],
      itens: orcamento?.itens || [{
        id_servico: "",
        quantidade: 1,
        valor_unitario: 0,
        desconto: 0,
        custo_servico: 0
      }],
      incluir_marco: orcamento?.incluir_marco || false,
      marco_quantidade: orcamento?.marco_quantidade || 0,
      marco_valor_unitario: orcamento?.marco_valor_unitario || 0,
      incluir_imposto: orcamento?.incluir_imposto || false,
      percentual_imposto: orcamento?.percentual_imposto || 0,
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
  const watchedIncluirMarco = watch("incluir_marco");
  const watchedMarcoQuantidade = watch("marco_quantidade");
  const watchedMarcoValorUnitario = watch("marco_valor_unitario");
  const watchedIncluirImposto = watch("incluir_imposto");
  const watchedPercentualImposto = watch("percentual_imposto");

  // Função para buscar o nome do serviço selecionado
  const getServicoNome = (servicoId: string) => {
    const servico = servicos.find(s => s.id_tiposervico === servicoId);
    return servico?.nome || null;
  };

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
            desconto: 0,
            custo_servico: 0
          }],
          incluir_marco: orcamento.incluir_marco || false,
          marco_quantidade: orcamento.marco_quantidade || 0,
          marco_valor_unitario: orcamento.marco_valor_unitario || 0,
          incluir_imposto: orcamento.incluir_imposto || false,
          percentual_imposto: orcamento.percentual_imposto || 0,
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
      supabase.from('dim_tiposervico').select('id_tiposervico, nome, valor_sugerido, dim_categoria_servico(nome)').eq('ativo', true).order('nome')
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
    // Helper to safely parse numbers
    const toNum = (val: any): number => {
      const parsed = parseFloat(val);
      return isNaN(parsed) ? 0 : parsed;
    };

    // Custo Total = soma dos custos de cada serviço
    const custoTotal = (watchedItens || []).reduce((acc, item) => {
      const custoItem = toNum(item?.quantidade) * toNum(item?.custo_servico);
      return acc + custoItem;
    }, 0);

    // Receita Esperada = soma dos valores cobrados (valor unitário * quantidade - desconto)
    const receitaEsperadaServicos = (watchedItens || []).reduce((acc, item) => {
      const valorItem = toNum(item?.quantidade) * toNum(item?.valor_unitario);
      const valorComDesconto = valorItem - toNum(item?.desconto);
      return acc + valorComDesconto;
    }, 0);

    // Valor total dos marcos
    const marcoValorTotal = watchedIncluirMarco 
      ? toNum(watchedMarcoQuantidade) * toNum(watchedMarcoValorUnitario) 
      : 0;

    // Receita total incluindo marcos
    const receitaEsperada = receitaEsperadaServicos + marcoValorTotal;

    // Total de Impostos (calculado por percentual sobre a receita esperada)
    const percentualImposto = watchedIncluirImposto ? toNum(watchedPercentualImposto) : 0;
    const totalImpostos = receitaEsperada * (percentualImposto / 100);
    
    // Receita Esperada + Impostos
    const receitaComImposto = receitaEsperada + totalImpostos;
    
    // Lucro Esperado = Receita - Custos
    const lucroEsperado = receitaEsperada - custoTotal;
    
    // Margem Esperada = (Lucro / Receita) * 100
    const margemEsperada = receitaEsperada > 0 ? (lucroEsperado / receitaEsperada) * 100 : 0;
    
    return { 
      custoTotal, 
      receitaEsperada, 
      marcoValorTotal,
      totalImpostos,
      percentualImposto,
      receitaComImposto,
      lucroEsperado, 
      margemEsperada 
    };
  };

  const { custoTotal, receitaEsperada, marcoValorTotal, totalImpostos, percentualImposto, receitaComImposto, lucroEsperado, margemEsperada } = calcularTotais();

  const onSubmit = async (data: any) => {
    try {
      const orcamentoData = {
        id_cliente: data.id_cliente,
        data_orcamento: data.data_orcamento,
        quantidade: data.itens.reduce((acc: number, item: any) => acc + (item.quantidade || 0), 0),
        valor_unitario: receitaEsperada / data.itens.length,
        desconto: data.itens.reduce((acc: number, item: any) => acc + (item.desconto || 0), 0),
        incluir_imposto: data.incluir_imposto,
        percentual_imposto: data.incluir_imposto ? data.percentual_imposto : 0,
        valor_imposto: totalImpostos,
        receita_esperada: receitaEsperada,
        receita_esperada_imposto: receitaComImposto,
        lucro_esperado: lucroEsperado,
        margem_esperada: margemEsperada,
        incluir_marco: data.incluir_marco,
        marco_quantidade: data.incluir_marco ? data.marco_quantidade : 0,
        marco_valor_unitario: data.incluir_marco ? data.marco_valor_unitario : 0,
        marco_valor_total: marcoValorTotal,
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
        desconto: item.desconto,
        valor_mao_obra: item.custo_servico
      }));

      const { error: itensError } = await supabase
        .from('fato_orcamento_itens')
        .insert(itensData);

      if (itensError) throw itensError;

      // Criar notificação para novo orçamento
      if (!orcamento) {
        const clienteNome = clientes.find(c => c.id_cliente === data.id_cliente)?.nome || 'Cliente';
        await createNotification(
          'orcamento',
          'Novo Orçamento',
          `Orçamento criado para ${clienteNome} - R$ ${receitaEsperada.toFixed(2)}`,
          '/servicos-orcamentos',
          'normal',
          orcamentoId
        );
      }

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
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg">Valores e Cálculos</h3>
                <span className="text-sm text-muted-foreground">
                  ({fields.length} {fields.length === 1 ? 'serviço' : 'serviços'})
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({
                  id_servico: "",
                  quantidade: 1,
                  valor_unitario: 0,
                  desconto: 0,
                  custo_servico: 0
                })}
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Serviço
              </Button>
            </div>

            {fields.map((field, index) => (
              <div key={field.id} className="p-4 border rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {watchedItens[index]?.id_servico 
                      ? `#${index + 1} - ${getServicoNome(watchedItens[index].id_servico)}`
                      : `Serviço #${index + 1}`
                    }
                  </span>
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

                <div className="grid grid-cols-4 gap-4">
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
                      onValueChange={(value) => {
                        setValue(`itens.${index}.id_servico`, value);
                        // Auto-fill valor_sugerido when service is selected
                        const selectedServico = servicos.find(s => s.id_tiposervico === value);
                        if (selectedServico?.valor_sugerido) {
                          setValue(`itens.${index}.valor_unitario`, selectedServico.valor_sugerido);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {servicos.map((servico) => (
                          <SelectItem key={servico.id_tiposervico} value={servico.id_tiposervico}>
                            {servico.dim_categoria_servico?.nome ? `${servico.dim_categoria_servico.nome} - ` : ''}{servico.nome}
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
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Desconto</Label>
                    <Input
                      type="number"
                      step="0.01"
                      {...register(`itens.${index}.desconto` as const)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Custo do Serviço</Label>
                    <Input
                      type="number"
                      step="0.01"
                      {...register(`itens.${index}.custo_servico` as const)}
                    />
                  </div>
                </div>
              </div>
            ))}

            {/* Opção Marco */}
            <div className="p-4 border rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    <span className="font-medium">Marco</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Incluir marcos topográficos no orçamento</p>
                </div>
                <Switch 
                  checked={watchedIncluirMarco}
                  onCheckedChange={(checked) => setValue("incluir_marco", checked)}
                />
              </div>
              
              {watchedIncluirMarco && (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <Label>Quantidade</Label>
                    <Input 
                      type="number" 
                      min="0"
                      {...register("marco_quantidade", { valueAsNumber: true })} 
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Valor Unitário (R$)</Label>
                    <Input 
                      type="number" 
                      step="0.01"
                      min="0"
                      {...register("marco_valor_unitario", { valueAsNumber: true })} 
                      placeholder="0.00"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Resumo Financeiro */}
          <div className="p-4 bg-muted rounded-lg space-y-3">
            <h3 className="font-semibold">Resumo Financeiro</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Custo Total:</span>
                <p className="font-semibold">R$ {custoTotal.toFixed(2)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Receita Serviços:</span>
                <p className="font-semibold">R$ {(receitaEsperada - marcoValorTotal).toFixed(2)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">
                  Impostos{watchedIncluirImposto ? ` (${percentualImposto}%)` : ''}:
                </span>
                <p className="font-semibold">R$ {totalImpostos.toFixed(2)}</p>
              </div>
            </div>
            {marcoValorTotal > 0 && (
              <div className="grid grid-cols-3 gap-4 text-sm pt-2 border-t border-border">
                <div>
                  <span className="text-muted-foreground">Marcos ({watchedMarcoQuantidade}x):</span>
                  <p className="font-semibold text-accent">R$ {marcoValorTotal.toFixed(2)}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Receita Total:</span>
                  <p className="font-semibold">R$ {receitaEsperada.toFixed(2)}</p>
                </div>
              </div>
            )}
            <div className="grid grid-cols-3 gap-4 text-sm pt-2 border-t border-border">
              <div>
                <span className="text-muted-foreground">Receita + Impostos:</span>
                <p className="font-semibold">R$ {receitaComImposto.toFixed(2)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Lucro Esperado:</span>
                <p className="font-semibold text-primary">R$ {lucroEsperado.toFixed(2)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Margem Esperada:</span>
                <p className="font-semibold text-primary">{margemEsperada.toFixed(2)}%</p>
              </div>
            </div>
          </div>

          {/* III. Situação e Faturamento */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Situação e Faturamento</h3>
            
            {/* Toggle de Imposto */}
            <div className="p-4 border rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Info className="h-3 w-3" />
                <span>A inclusão de impostos não é obrigatória.</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <span className="font-medium">Incluir Imposto?</span>
                  <p className="text-xs text-muted-foreground">Aplicar percentual de imposto sobre a receita</p>
                </div>
                <Switch 
                  checked={watchedIncluirImposto}
                  onCheckedChange={(checked) => setValue("incluir_imposto", checked)}
                />
              </div>
              
              {watchedIncluirImposto && (
                <div className="pt-2">
                  <div className="space-y-2">
                    <Label>Percentual de Imposto (%)</Label>
                    <Input 
                      type="number" 
                      step="0.01"
                      min="0"
                      max="100"
                      {...register("percentual_imposto", { valueAsNumber: true })} 
                      placeholder="0.00"
                    />
                  </div>
                </div>
              )}
            </div>
            
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
                  <SelectTrigger className={
                    watchedSituacao === "Pago" ? "text-[hsl(142,76%,36%)]" : 
                    watchedSituacao === "Cancelado" ? "text-[hsl(0,100%,50%)]" : 
                    watchedSituacao === "Pendente" ? "text-[hsl(48,96%,53%)]" :
                    watchedSituacao === "Parcial" ? "text-[hsl(217,91%,60%)]" : ""
                  }>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pendente" className="text-[hsl(48,96%,53%)]">Pendente</SelectItem>
                    <SelectItem value="Pago" className="text-[hsl(142,76%,36%)]">Pago</SelectItem>
                    <SelectItem value="Cancelado" className="text-[hsl(0,100%,50%)]">Cancelado</SelectItem>
                    <SelectItem value="Parcial" className="text-[hsl(217,91%,60%)]">Parcial</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 col-span-2">
                <Label>Forma de Pagamento</Label>
                <Select
                  value={watch("forma_de_pagamento")}
                  onValueChange={(value) => setValue("forma_de_pagamento", value)}
                >
                  <SelectTrigger className={
                    watch("forma_de_pagamento") === "PIX" ? "text-[hsl(142,76%,36%)]" :
                    watch("forma_de_pagamento") === "Dinheiro" ? "text-[hsl(142,76%,45%)]" :
                    watch("forma_de_pagamento") === "Cartão" ? "text-[hsl(217,91%,60%)]" :
                    watch("forma_de_pagamento") === "Transferência" ? "text-[hsl(262,83%,58%)]" :
                    watch("forma_de_pagamento") === "Boleto" ? "text-[hsl(25,95%,53%)]" : ""
                  }>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PIX" className="text-[hsl(142,76%,36%)]">PIX</SelectItem>
                    <SelectItem value="Dinheiro" className="text-[hsl(142,76%,45%)]">Dinheiro</SelectItem>
                    <SelectItem value="Cartão" className="text-[hsl(217,91%,60%)]">Cartão</SelectItem>
                    <SelectItem value="Transferência" className="text-[hsl(262,83%,58%)]">Transferência</SelectItem>
                    <SelectItem value="Boleto" className="text-[hsl(25,95%,53%)]">Boleto</SelectItem>
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
