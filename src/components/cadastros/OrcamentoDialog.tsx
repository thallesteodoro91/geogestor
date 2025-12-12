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
import { Plus, Trash2, MapPin, Info, Receipt, User, Calculator, DollarSign, StickyNote, Percent } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { getCurrentTenantId } from "@/services/supabase.service";

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
  const [tiposDespesa, setTiposDespesa] = useState<any[]>([]);
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
        desconto: 0
      }],
      despesas: [] as { id_tipodespesa: string; descricao: string; valor: number }[],
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

  const { fields: despesaFields, append: appendDespesa, remove: removeDespesa } = useFieldArray({
    control,
    name: "despesas"
  });

  const watchedItens = watch("itens");
  const watchedDespesas = watch("despesas");
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

  // Função para buscar o nome do tipo de despesa
  const getTipoDespesaNome = (tipoDespesaId: string) => {
    const tipo = tiposDespesa.find(t => t.id_tipodespesa === tipoDespesaId);
    return tipo?.categoria || null;
  };

  const fetchOrcamentoItens = async (orcamentoId: string) => {
    const { data, error } = await supabase
      .from('fato_orcamento_itens')
      .select('*')
      .eq('id_orcamento', orcamentoId);
    if (error) {
      console.error('Erro ao buscar itens do orçamento:', error);
      return [];
    }
    return data || [];
  };

  const fetchOrcamentoDespesas = async (orcamentoId: string) => {
    const { data, error } = await supabase
      .from('fato_despesas')
      .select('*, dim_tipodespesa(categoria)')
      .eq('id_orcamento', orcamentoId);
    if (error) {
      console.error('Erro ao buscar despesas do orçamento:', error);
      return [];
    }
    return data || [];
  };

  useEffect(() => {
    if (open) {
      const loadData = async () => {
        // 1. Primeiro, buscar dados de clientes, serviços e tipos de despesa
        await fetchData();
        
        // 2. Se for modo de edição, buscar dados do orçamento
        if (orcamento) {
          const [itensDb, despesasDb] = await Promise.all([
            fetchOrcamentoItens(orcamento.id_orcamento),
            fetchOrcamentoDespesas(orcamento.id_orcamento)
          ]);
          
          const itensFormatados = itensDb.length > 0 
            ? itensDb.map((item: any) => ({
                id_servico: item.id_servico || "",
                quantidade: item.quantidade || 1,
                valor_unitario: item.valor_unitario || 0,
                desconto: item.desconto || 0
              }))
            : [{
                id_servico: "",
                quantidade: 1,
                valor_unitario: 0,
                desconto: 0
              }];

          const despesasFormatadas = despesasDb.map((d: any) => ({
            id_tipodespesa: d.id_tipodespesa || "",
            descricao: d.observacoes || "",
            valor: d.valor_da_despesa || 0
          }));

          // 3. Reset com todos os dados (clientes já carregados)
          reset({
            id_cliente: orcamento.id_cliente || "",
            data_orcamento: orcamento.data_orcamento,
            itens: itensFormatados,
            despesas: despesasFormatadas,
            incluir_marco: orcamento.incluir_marco || false,
            marco_quantidade: orcamento.marco_quantidade || 0,
            marco_valor_unitario: orcamento.marco_valor_unitario || 0,
            incluir_imposto: orcamento.incluir_imposto || false,
            percentual_imposto: orcamento.percentual_imposto || 0,
            orcamento_convertido: orcamento.orcamento_convertido || false,
            faturamento: orcamento.faturamento || false,
            data_do_faturamento: orcamento.data_do_faturamento || "",
            situacao_do_pagamento: orcamento.situacao_do_pagamento || "",
            forma_de_pagamento: orcamento.forma_de_pagamento || "",
            anotacoes: orcamento.anotacoes || ""
          });
          
          if (orcamento.id_cliente) {
            fetchClienteData(orcamento.id_cliente);
          }
        } else if (clienteId) {
          setValue("id_cliente", clienteId);
          fetchClienteData(clienteId);
        }
      };
      
      loadData();
    }
  }, [open, orcamento, clienteId]);

  useEffect(() => {
    if (watchedClienteId) {
      fetchClienteData(watchedClienteId);
    }
  }, [watchedClienteId]);

  const fetchData = async () => {
    const [clientesRes, servicosRes, tiposDespesaRes] = await Promise.all([
      supabase.from('dim_cliente').select('id_cliente, nome').order('nome'),
      supabase.from('dim_tiposervico').select('id_tiposervico, nome, valor_sugerido, dim_categoria_servico(nome)').eq('ativo', true).order('nome'),
      supabase.from('dim_tipodespesa').select('id_tipodespesa, categoria, subcategoria').order('categoria')
    ]);

    if (clientesRes.data) setClientes(clientesRes.data);
    if (servicosRes.data) setServicos(servicosRes.data);
    if (tiposDespesaRes.data) setTiposDespesa(tiposDespesaRes.data);
  };

  const fetchClienteData = async (clienteId: string) => {
    const [clienteRes, propriedadeRes] = await Promise.all([
      supabase
        .from('dim_cliente')
        .select('endereco, telefone, celular')
        .eq('id_cliente', clienteId)
        .maybeSingle(),
      supabase
        .from('dim_propriedade')
        .select('cidade, municipio')
        .eq('id_cliente', clienteId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    ]);
    
    const cidade = propriedadeRes.data?.cidade || propriedadeRes.data?.municipio || '';
    
    if (clienteRes.data) {
      setClienteData({
        ...clienteRes.data,
        cidade
      });
    }
  };

  const calcularTotais = () => {
    // Helper to safely parse numbers
    const toNum = (val: any): number => {
      const parsed = parseFloat(val);
      return isNaN(parsed) ? 0 : parsed;
    };

    // Desconto Total = soma dos descontos em valor absoluto
    const descontoTotal = (watchedItens || []).reduce((acc, item) => {
      const valorBruto = Math.floor(toNum(item?.quantidade)) * Math.floor(toNum(item?.valor_unitario));
      const descontoPercent = toNum(item?.desconto);
      const valorDesconto = valorBruto * (descontoPercent / 100);
      return acc + valorDesconto;
    }, 0);

    // Receita Esperada = soma dos valores cobrados (valor unitário * quantidade - desconto em %)
    const receitaEsperada = (watchedItens || []).reduce((acc, item) => {
      const valorItem = Math.floor(toNum(item?.quantidade)) * Math.floor(toNum(item?.valor_unitario));
      const descontoPercent = toNum(item?.desconto);
      const valorComDesconto = valorItem * (1 - descontoPercent / 100);
      return acc + valorComDesconto;
    }, 0);

    // Total de Despesas do Orçamento
    const totalDespesasOrcamento = (watchedDespesas || []).reduce((acc, d) => acc + toNum(d?.valor), 0);

    // Valor total dos marcos (COMO CUSTO, não receita)
    const marcoValorTotal = watchedIncluirMarco 
      ? Math.floor(toNum(watchedMarcoQuantidade)) * toNum(watchedMarcoValorUnitario)
      : 0;

    // Custo total incluindo marcos e despesas
    const custoTotal = marcoValorTotal + totalDespesasOrcamento;

    // Total de Impostos (calculado por percentual sobre a receita esperada)
    const percentualImposto = watchedIncluirImposto ? toNum(watchedPercentualImposto) : 0;
    const totalImpostos = receitaEsperada * (percentualImposto / 100);
    
    // Receita Esperada + Impostos (valor que cliente paga)
    const receitaComImposto = receitaEsperada + totalImpostos;
    
    // Lucro Esperado = Receita - Custos - Impostos (impostos deduzidos do lucro)
    const lucroEsperado = receitaEsperada - custoTotal - totalImpostos;
    
    // Margem Esperada = (Lucro / Receita) * 100
    const margemEsperada = receitaEsperada > 0 ? (lucroEsperado / receitaEsperada) * 100 : 0;
    
    return { 
      custoTotal,
      totalDespesasOrcamento,
      receitaEsperada,
      descontoTotal,
      marcoValorTotal,
      totalImpostos,
      percentualImposto,
      receitaComImposto,
      lucroEsperado, 
      margemEsperada 
    };
  };

  const { custoTotal, totalDespesasOrcamento, receitaEsperada, descontoTotal, marcoValorTotal, totalImpostos, percentualImposto, receitaComImposto, lucroEsperado, margemEsperada } = calcularTotais();

  // Formatação de moeda brasileira
  const formatCurrency = (value: number): string => {
    return value.toLocaleString('pt-BR', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  };

  const onSubmit = async (data: any) => {
    try {
      // Obter tenant_id para RLS
      const tenantId = await getCurrentTenantId();
      if (!tenantId) {
        toast.error("Erro: Sessão inválida. Faça login novamente.");
        return;
      }

      // Sanitizar campos UUID: converter "" para null
      const sanitizeUuid = (value: string | null | undefined): string | null => {
        return value && value.trim() !== '' ? value : null;
      };

      // Validar cliente obrigatório
      if (!data.id_cliente || data.id_cliente.trim() === '') {
        toast.error("Por favor, selecione um cliente.");
        return;
      }

      // Filtrar apenas itens com serviço válido
      const servicosValidos = data.itens.filter(
        (item: any) => item.id_servico && item.id_servico.trim() !== ''
      );

      if (servicosValidos.length === 0) {
        toast.error("Por favor, adicione pelo menos um serviço.");
        return;
      }

      const orcamentoData = {
        id_cliente: sanitizeUuid(data.id_cliente),
        data_orcamento: data.data_orcamento,
        quantidade: servicosValidos.reduce((acc: number, item: any) => acc + (item.quantidade || 0), 0),
        valor_unitario: servicosValidos.length > 0 ? receitaEsperada / servicosValidos.length : 0,
        desconto: servicosValidos.reduce((acc: number, item: any) => acc + (item.desconto || 0), 0),
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
        situacao_do_pagamento: sanitizeUuid(data.situacao_do_pagamento) ? data.situacao_do_pagamento : null,
        forma_de_pagamento: sanitizeUuid(data.forma_de_pagamento) ? data.forma_de_pagamento : null,
        anotacoes: data.anotacoes || null,
        tenant_id: tenantId
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

        // Deletar despesas antigas vinculadas ao orçamento
        await supabase
          .from('fato_despesas')
          .delete()
          .eq('id_orcamento', orcamentoId);
      }

      // Inserir apenas itens com serviço válido
      const itensData = servicosValidos.map((item: any) => ({
        id_orcamento: orcamentoId,
        id_servico: sanitizeUuid(item.id_servico),
        quantidade: item.quantidade || 1,
        valor_unitario: item.valor_unitario || 0,
        desconto: item.desconto || 0,
        valor_mao_obra: 0,
        tenant_id: tenantId
      }));

      if (itensData.length > 0) {
        const { error: itensError } = await supabase
          .from('fato_orcamento_itens')
          .insert(itensData);

        if (itensError) throw itensError;
      }

      // Inserir despesas vinculadas ao orçamento
      const despesasValidas = (data.despesas || []).filter(
        (d: any) => d.valor && d.valor > 0
      );

      if (despesasValidas.length > 0) {
        const despesasData = despesasValidas.map((d: any) => ({
          id_orcamento: orcamentoId,
          id_tipodespesa: sanitizeUuid(d.id_tipodespesa),
          valor_da_despesa: d.valor,
          data_da_despesa: data.data_orcamento,
          observacoes: d.descricao || null,
          tenant_id: tenantId
        }));

        const { error: despesasError } = await supabase
          .from('fato_despesas')
          .insert(despesasData);

        if (despesasError) throw despesasError;
      }

      // Criar notificação para novo orçamento com nome do cliente e propriedade
      if (!orcamento) {
        const clienteNome = clientes.find(c => c.id_cliente === data.id_cliente)?.nome || 'Cliente';
        
        // Buscar propriedade do cliente
        const { data: propriedadeData } = await supabase
          .from('dim_propriedade')
          .select('nome_da_propriedade')
          .eq('id_cliente', data.id_cliente)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const mensagem = propriedadeData?.nome_da_propriedade
          ? `Novo orçamento para ${clienteNome}, propriedade ${propriedadeData.nome_da_propriedade} - R$ ${formatCurrency(receitaEsperada)}`
          : `Novo orçamento para ${clienteNome} - R$ ${formatCurrency(receitaEsperada)}`;

        await createNotification(
          'orcamento',
          'Novo Orçamento',
          mensagem,
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
        {!orcamento && (
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground bg-muted/50 rounded-md border border-border/50">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span>Certifique-se de cadastrar o cliente antes de criar o orçamento.</span>
          </div>
        )}
        
        <DialogHeader>
          <DialogTitle>{orcamento ? 'Editar Orçamento' : 'Novo Orçamento'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* I. Dados Básicos */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-blue-500" />
              <h3 className="font-semibold text-lg">Dados Básicos</h3>
            </div>
            
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
              <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
                <div className="space-y-2">
                  <Label>Endereço</Label>
                  <Input value={clienteData.endereco || ''} readOnly className="bg-background" />
                </div>
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input value={clienteData.cidade || ''} readOnly className="bg-background" />
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
                <Calculator className="h-5 w-5 text-orange-500" />
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

                <div className="grid grid-cols-5 gap-4">
                  <div className="space-y-2">
                    <Label>Quantidade</Label>
                    <Input
                      type="number"
                      step="1"
                      min="1"
                      {...register(`itens.${index}.quantidade` as const, { valueAsNumber: true })}
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
                          setValue(`itens.${index}.valor_unitario`, Math.floor(selectedServico.valor_sugerido));
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
                    <Label>Valor Unitário (R$)</Label>
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      {...register(`itens.${index}.valor_unitario` as const, { valueAsNumber: true })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Desconto (%)</Label>
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      {...register(`itens.${index}.desconto` as const, { valueAsNumber: true })}
                    />
                  </div>
                </div>

              </div>
            ))}

          </div>

          {/* Marco e Imposto - lado a lado */}
          <div className="grid grid-cols-2 gap-4">
            {/* Marco */}
            <div className="p-4 border rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    <span className="font-medium">Marco</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Marcos topográficos</p>
                </div>
                <Switch 
                  checked={watchedIncluirMarco}
                  onCheckedChange={(checked) => setValue("incluir_marco", checked)}
                />
              </div>
              
              {watchedIncluirMarco && (
                <div className="space-y-3 pt-2">
                  <div className="space-y-2">
                    <Label>Quantidade</Label>
                    <Input 
                      type="number" 
                      step="1"
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
                      placeholder="0,00"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Imposto */}
            <div className="p-4 border rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Percent className="h-5 w-5 text-orange-500" />
                    <span className="font-medium">Imposto</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Não obrigatório</p>
                </div>
                <Switch 
                  checked={watchedIncluirImposto}
                  onCheckedChange={(checked) => setValue("incluir_imposto", checked)}
                />
              </div>
              
              {watchedIncluirImposto && (
                <div className="pt-2">
                  <div className="space-y-2">
                    <Label>Percentual (%)</Label>
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
          </div>

          {/* III. Despesas */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-green-500" />
                <h3 className="font-semibold text-lg">Despesas</h3>
                <span className="text-sm text-muted-foreground">
                  ({despesaFields.length} {despesaFields.length === 1 ? 'despesa' : 'despesas'})
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => appendDespesa({
                  id_tipodespesa: "",
                  descricao: "",
                  valor: 0
                })}
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Despesa
              </Button>
            </div>
            
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Info className="h-3 w-3" />
              Despesas adicionadas aqui serão contabilizadas como custos internos. No documento do cliente, aparecerão apenas como "Custo dos Serviços".
            </p>

            {despesaFields.map((field, index) => (
              <div key={field.id} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">
                    {watchedDespesas[index]?.descricao 
                      ? `#${index + 1} - ${watchedDespesas[index].descricao}`
                      : `Despesa #${index + 1}`
                    }
                  </span>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => removeDespesa(index)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo de Despesa</Label>
                    <Select
                      value={watchedDespesas[index]?.id_tipodespesa || ""}
                      onValueChange={(value) => setValue(`despesas.${index}.id_tipodespesa`, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {tiposDespesa.map((tipo) => (
                          <SelectItem key={tipo.id_tipodespesa} value={tipo.id_tipodespesa}>
                            {tipo.categoria}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Input 
                      placeholder="Ex: Combustível ida/volta" 
                      {...register(`despesas.${index}.descricao`)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Valor (R$)</Label>
                    <Input 
                      type="number" 
                      step="0.01" 
                      min="0"
                      placeholder="0,00"
                      {...register(`despesas.${index}.valor`, { valueAsNumber: true })}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* IV. Resumo Financeiro */}
          <div className="p-4 bg-muted rounded-lg space-y-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Resumo Financeiro</h3>
            </div>
            
            {/* Linha 1 - 4 colunas */}
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div className="text-center">
                <span className="text-muted-foreground text-xs block whitespace-nowrap">Receita Esperada</span>
                <p className="font-semibold whitespace-nowrap">R$ {formatCurrency(receitaEsperada)}</p>
              </div>
              <div className="text-center">
                <span className="text-muted-foreground text-xs block whitespace-nowrap">Desconto Total</span>
                <p className="font-semibold text-destructive whitespace-nowrap">- R$ {formatCurrency(descontoTotal)}</p>
              </div>
              <div className="text-center">
                <span className="text-muted-foreground text-xs block whitespace-nowrap">Despesas</span>
                <p className="font-semibold whitespace-nowrap">R$ {formatCurrency(totalDespesasOrcamento)}</p>
              </div>
              <div className="text-center">
                <span className="text-muted-foreground text-xs block whitespace-nowrap">
                  Impostos{watchedIncluirImposto ? ` (${percentualImposto}%)` : ''}
                </span>
                <p className="font-semibold whitespace-nowrap">R$ {formatCurrency(totalImpostos)}</p>
              </div>
            </div>
            
            {/* Linha 2 - 4 colunas */}
            <div className="grid grid-cols-4 gap-4 text-sm pt-3 border-t border-border">
              <div className="text-center">
                <span className="text-muted-foreground text-xs block whitespace-nowrap">Marcos ({watchedMarcoQuantidade || 0}x)</span>
                <p className="font-semibold whitespace-nowrap">R$ {formatCurrency(marcoValorTotal)}</p>
              </div>
              <div className="text-center">
                <span className="text-muted-foreground text-xs block whitespace-nowrap">Receita + Impostos</span>
                <p className="font-semibold whitespace-nowrap">R$ {formatCurrency(receitaComImposto)}</p>
              </div>
              <div className="text-center">
                <span className="text-muted-foreground text-xs block whitespace-nowrap">Custo Total</span>
                <p className="font-semibold text-destructive whitespace-nowrap">R$ {formatCurrency(custoTotal)}</p>
              </div>
              <div className="text-center">
                <span className="text-muted-foreground text-xs block whitespace-nowrap">Lucro Esperado</span>
                <p className={`font-semibold whitespace-nowrap ${lucroEsperado >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  R$ {formatCurrency(lucroEsperado)}
                </p>
              </div>
            </div>
            
            {/* Linha 3 - Margem centralizada */}
            <div className="flex justify-center pt-3 border-t border-border">
              <div className="text-center">
                <span className="text-muted-foreground text-xs block">Margem Esperada</span>
                <p className={`font-semibold text-lg ${margemEsperada >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {margemEsperada.toFixed(2)}%
                </p>
              </div>
            </div>
          </div>

          {/* V. Anotações */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <StickyNote className="h-5 w-5 text-yellow-500" />
              <Label className="font-semibold text-lg">Anotações</Label>
            </div>
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
