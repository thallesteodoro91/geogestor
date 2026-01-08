import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, MapPin, User, Calculator, DollarSign, StickyNote, Percent, ChevronLeft, ChevronRight, Check, Building, UserPlus, Home, Receipt, CreditCard, Banknote, Smartphone, ArrowLeftRight, FileText, Info } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { getCurrentTenantId } from "@/services/supabase.service";
import { formatPhoneNumber } from "@/lib/formatPhone";
import { formatCPF, formatCNPJ } from "@/lib/formatDocument";
import { cn } from "@/lib/utils";
import { despesaOrcamentoSchema } from "@/lib/validations";
import { z } from "zod";

interface OrcamentoWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orcamento?: any;
  clienteId?: string;
  onSuccess: () => void;
}

type WizardStep = 'cliente' | 'propriedade' | 'orcamento';

const WIZARD_STEPS: { id: WizardStep; label: string; icon: React.ReactNode }[] = [
  { id: 'cliente', label: 'Cliente', icon: <User className="h-4 w-4" /> },
  { id: 'propriedade', label: 'Propriedade', icon: <Home className="h-4 w-4" /> },
  { id: 'orcamento', label: 'Orçamento', icon: <Calculator className="h-4 w-4" /> },
];

// Opções para Prospecção e Categoria do Cliente
const PROSPECCAO_OPCOES = ["Indicação", "Redes Sociais", "Site", "Ligação", "WhatsApp", "Outro"];
const CATEGORIA_CLIENTE_OPCOES = ["Produtor Rural", "Empresa", "Pessoa Física", "Governo", "ONG"];

export function OrcamentoWizard({ open, onOpenChange, orcamento, clienteId, onSuccess }: OrcamentoWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('cliente');
  const [clientes, setClientes] = useState<any[]>([]);
  const [servicos, setServicos] = useState<any[]>([]);
  const [tiposDespesa, setTiposDespesa] = useState<any[]>([]);
  const [propriedades, setPropriedades] = useState<any[]>([]);
  const [clienteData, setClienteData] = useState<any>(null);
  const [createNewCliente, setCreateNewCliente] = useState(false);
  const [createNewPropriedade, setCreateNewPropriedade] = useState(false);
  const [newClienteId, setNewClienteId] = useState<string | null>(null);
  const [newPropriedadeId, setNewPropriedadeId] = useState<string | null>(null);
  const { createNotification } = useNotifications();

  // Form for new cliente
  const clienteForm = useForm({
    defaultValues: {
      nome: "",
      email: "",
      telefone: "",
      celular: "",
      cpf: "",
      cnpj: "",
      endereco: "",
      categoria: [] as string[],
      origem: [] as string[],
      anotacoes: ""
    }
  });

  // Form for new propriedade
  const propriedadeForm = useForm({
    defaultValues: {
      nome_da_propriedade: "",
      area_ha: "",
      cidade: "",
      observacoes: ""
    }
  });

  // Main orcamento form
  const { register, handleSubmit, setValue, watch, control, reset } = useForm({
    defaultValues: {
      id_cliente: clienteId || orcamento?.id_cliente || "",
      id_propriedade: orcamento?.id_propriedade || "",
      data_orcamento: orcamento?.data_orcamento || new Date().toISOString().split('T')[0],
      codigo_orcamento: orcamento?.codigo_orcamento || "",
      itens: orcamento?.itens || [{ id_servico: "", quantidade: 1, valor_unitario: 0 }],
      despesas: [] as { id_tipodespesa: string; descricao: string; valor: number }[],
      desconto_global: orcamento?.desconto || 0, // Desconto global em %
      incluir_marco: orcamento?.incluir_marco || false,
      marco_quantidade: orcamento?.marco_quantidade || 0,
      marco_valor_unitario: orcamento?.marco_valor_unitario || 0,
      incluir_imposto: orcamento?.incluir_imposto || false,
      percentual_imposto: orcamento?.percentual_imposto || 0,
      orcamento_convertido: orcamento?.orcamento_convertido || false,
      situacao_do_pagamento: orcamento?.situacao_do_pagamento || "",
      forma_de_pagamento: orcamento?.forma_de_pagamento || "",
      data_do_faturamento: orcamento?.data_do_faturamento || "",
      anotacoes: orcamento?.anotacoes || ""
    }
  });

  const { fields, append, remove } = useFieldArray({ control, name: "itens" });
  const { fields: despesaFields, append: appendDespesa, remove: removeDespesa } = useFieldArray({ control, name: "despesas" });

  const watchedItens = watch("itens");
  const watchedDespesas = watch("despesas");
  const watchedClienteId = watch("id_cliente");
  const watchedDescontoGlobal = watch("desconto_global");
  const watchedIncluirMarco = watch("incluir_marco");
  const watchedMarcoQuantidade = watch("marco_quantidade");
  const watchedMarcoValorUnitario = watch("marco_valor_unitario");
  const watchedIncluirImposto = watch("incluir_imposto");
  const watchedPercentualImposto = watch("percentual_imposto");
  const watchedSituacao = watch("situacao_do_pagamento");

  useEffect(() => {
    if (open) {
      loadInitialData();
      // Reset to first step on open
      if (!orcamento) {
        setCurrentStep('cliente');
        setCreateNewCliente(false);
        setCreateNewPropriedade(false);
        setNewClienteId(null);
        setNewPropriedadeId(null);
      } else {
        // Skip to orcamento step for editing
        setCurrentStep('orcamento');
      }
    }
  }, [open]);

  useEffect(() => {
    const effectiveClienteId = newClienteId || watchedClienteId;
    if (effectiveClienteId) {
      fetchClienteData(effectiveClienteId);
    }
  }, [watchedClienteId, newClienteId]);

  const loadInitialData = async () => {
    const [clientesRes, servicosRes, tiposDespesaRes] = await Promise.all([
      supabase.from('dim_cliente').select('id_cliente, nome').order('nome'),
      supabase.from('dim_tiposervico').select('id_tiposervico, nome, valor_sugerido').eq('ativo', true).order('nome'),
      supabase.from('dim_tipodespesa').select('id_tipodespesa, categoria, subcategoria').order('categoria')
    ]);

    if (clientesRes.data) setClientes(clientesRes.data);
    if (servicosRes.data) setServicos(servicosRes.data);
    if (tiposDespesaRes.data) setTiposDespesa(tiposDespesaRes.data);

    // Load orcamento data if editing
    if (orcamento) {
      const [itensDb, despesasDb] = await Promise.all([
        supabase.from('fato_orcamento_itens').select('*').eq('id_orcamento', orcamento.id_orcamento),
        supabase.from('fato_despesas').select('*').eq('id_orcamento', orcamento.id_orcamento)
      ]);

        const itensFormatados = itensDb.data?.length 
        ? itensDb.data.map((item: any) => ({
            id_servico: item.id_servico || "",
            quantidade: item.quantidade || 1,
            valor_unitario: item.valor_unitario || 0
          }))
        : [{ id_servico: "", quantidade: 1, valor_unitario: 0 }];

      const despesasFormatadas = (despesasDb.data || []).map((d: any) => ({
        id_tipodespesa: d.id_tipodespesa || "",
        descricao: d.observacoes || "",
        valor: d.valor_da_despesa || 0
      }));

      reset({
        id_cliente: orcamento.id_cliente || "",
        id_propriedade: orcamento.id_propriedade || "",
        data_orcamento: orcamento.data_orcamento,
        codigo_orcamento: orcamento.codigo_orcamento || "",
        itens: itensFormatados,
        despesas: despesasFormatadas,
        desconto_global: orcamento.desconto || 0,
        incluir_marco: orcamento.incluir_marco || false,
        marco_quantidade: orcamento.marco_quantidade || 0,
        marco_valor_unitario: orcamento.marco_valor_unitario || 0,
        incluir_imposto: orcamento.incluir_imposto || false,
        percentual_imposto: orcamento.percentual_imposto || 0,
        orcamento_convertido: orcamento.orcamento_convertido || false,
        situacao_do_pagamento: orcamento.situacao_do_pagamento || "",
        forma_de_pagamento: orcamento.forma_de_pagamento || "",
        data_do_faturamento: orcamento.data_do_faturamento || "",
        anotacoes: orcamento.anotacoes || ""
      });
    }
  };

  const fetchClienteData = async (clienteId: string) => {
    const [clienteRes, propriedadesRes] = await Promise.all([
      supabase.from('dim_cliente').select('endereco, telefone, celular').eq('id_cliente', clienteId).maybeSingle(),
      supabase.from('dim_propriedade').select('id_propriedade, nome_da_propriedade, cidade, municipio').eq('id_cliente', clienteId).order('created_at', { ascending: false })
    ]);
    
    const propriedadesData = propriedadesRes.data || [];
    setPropriedades(propriedadesData);
    
    // Auto-select first property
    const currentProp = watch("id_propriedade");
    if (propriedadesData.length > 0 && !currentProp && !newPropriedadeId) {
      setValue("id_propriedade", propriedadesData[0].id_propriedade);
    }
    
    if (clienteRes.data) {
      setClienteData({
        ...clienteRes.data,
        cidade: propriedadesData[0]?.cidade || propriedadesData[0]?.municipio || ''
      });
    }
  };

  const calcularTotais = () => {
    const toNum = (val: any): number => {
      const parsed = parseFloat(val);
      return isNaN(parsed) ? 0 : parsed;
    };

    // Receita bruta (soma de todos os serviços sem desconto)
    const receitaBruta = (watchedItens || []).reduce((acc, item) => {
      return acc + Math.floor(toNum(item?.quantidade)) * Math.floor(toNum(item?.valor_unitario));
    }, 0);

    // Desconto global aplicado sobre o total
    const descontoGlobalPercent = toNum(watchedDescontoGlobal);
    const descontoTotal = receitaBruta * (descontoGlobalPercent / 100);
    const receitaEsperada = receitaBruta - descontoTotal;

    const totalDespesasOrcamento = (watchedDespesas || []).reduce((acc, d) => acc + toNum(d?.valor), 0);
    const marcoValorTotal = watchedIncluirMarco ? Math.floor(toNum(watchedMarcoQuantidade)) * toNum(watchedMarcoValorUnitario) : 0;
    const custoTotal = marcoValorTotal + totalDespesasOrcamento;
    const percentualImposto = watchedIncluirImposto ? toNum(watchedPercentualImposto) : 0;
    const totalImpostos = receitaEsperada * (percentualImposto / 100);
    const receitaComImposto = receitaEsperada + totalImpostos;
    const lucroEsperado = receitaEsperada - custoTotal - totalImpostos;
    const margemEsperada = receitaEsperada > 0 ? (lucroEsperado / receitaEsperada) * 100 : 0;

    return { custoTotal, totalDespesasOrcamento, receitaBruta, receitaEsperada, descontoTotal, marcoValorTotal, totalImpostos, percentualImposto, receitaComImposto, lucroEsperado, margemEsperada };
  };

  const { custoTotal, totalDespesasOrcamento, receitaBruta, receitaEsperada, descontoTotal, marcoValorTotal, totalImpostos, percentualImposto, receitaComImposto, lucroEsperado, margemEsperada } = calcularTotais();

  const formatCurrency = (value: number): string => value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Save new cliente
  const saveNewCliente = async () => {
    const data = clienteForm.getValues();
    if (!data.nome.trim()) {
      toast.error("Nome do cliente é obrigatório");
      return false;
    }

    try {
      const { data: newCliente, error } = await supabase
        .from('dim_cliente')
        .insert([{
          nome: data.nome,
          email: data.email || null,
          telefone: data.telefone || null,
          celular: data.celular || null,
          cpf: data.cpf || null,
          cnpj: data.cnpj || null,
          endereco: data.endereco || null,
          categoria: data.categoria?.join(', ') || null,
          origem: data.origem?.join(', ') || null,
          anotacoes: data.anotacoes || null
        }])
        .select()
        .single();

      if (error) throw error;
      
      setNewClienteId(newCliente.id_cliente);
      setValue("id_cliente", newCliente.id_cliente);
      setClientes(prev => [...prev, { id_cliente: newCliente.id_cliente, nome: newCliente.nome }]);
      toast.success("Cliente criado com sucesso!");
      return true;
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar cliente");
      return false;
    }
  };

  // Save new propriedade
  const saveNewPropriedade = async () => {
    const data = propriedadeForm.getValues();
    const clienteId = newClienteId || watchedClienteId;
    
    if (!data.nome_da_propriedade.trim()) {
      toast.error("Nome da propriedade é obrigatório");
      return false;
    }

    try {
      const { data: newProp, error } = await supabase
        .from('dim_propriedade')
        .insert([{
          nome_da_propriedade: data.nome_da_propriedade,
          id_cliente: clienteId || null,
          area_ha: data.area_ha ? Number(data.area_ha) : null,
          cidade: data.cidade || null,
          observacoes: data.observacoes || null
        }])
        .select()
        .single();

      if (error) throw error;
      
      setNewPropriedadeId(newProp.id_propriedade);
      setValue("id_propriedade", newProp.id_propriedade);
      setPropriedades(prev => [...prev, { id_propriedade: newProp.id_propriedade, nome_da_propriedade: newProp.nome_da_propriedade }]);
      toast.success("Propriedade criada com sucesso!");
      return true;
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar propriedade");
      return false;
    }
  };

  const handleNext = async () => {
    if (currentStep === 'cliente') {
      if (createNewCliente) {
        const success = await saveNewCliente();
        if (!success) return;
      } else if (!watchedClienteId && !newClienteId) {
        toast.error("Selecione ou crie um cliente");
        return;
      }
      setCurrentStep('propriedade');
    } else if (currentStep === 'propriedade') {
      if (createNewPropriedade) {
        const success = await saveNewPropriedade();
        if (!success) return;
      }
      setCurrentStep('orcamento');
    }
  };

  const handleBack = () => {
    if (currentStep === 'propriedade') setCurrentStep('cliente');
    else if (currentStep === 'orcamento') setCurrentStep('propriedade');
  };

  const onSubmit = async (data: any) => {
    try {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) {
        toast.error("Erro: Sessão inválida. Faça login novamente.");
        return;
      }

      const sanitizeUuid = (value: string | null | undefined): string | null => 
        value && value.trim() !== '' ? value : null;

      const effectiveClienteId = newClienteId || data.id_cliente;
      const effectivePropriedadeId = newPropriedadeId || data.id_propriedade;

      if (!effectiveClienteId) {
        toast.error("Por favor, selecione um cliente.");
        return;
      }

      const servicosValidos = data.itens.filter((item: any) => item.id_servico?.trim());

      if (servicosValidos.length === 0) {
        toast.error("Por favor, adicione pelo menos um serviço.");
        return;
      }

      // Generate budget code
      let codigoOrcamento = data.codigo_orcamento;
      if (!orcamento && !codigoOrcamento) {
        const clienteNome = clientes.find(c => c.id_cliente === effectiveClienteId)?.nome || '';
        const { data: codigoGerado } = await supabase.rpc('gerar_codigo_orcamento', {
          p_cliente_nome: clienteNome,
          p_tenant_id: tenantId
        });
        codigoOrcamento = codigoGerado;
      }

      const orcamentoData = {
        id_cliente: sanitizeUuid(effectiveClienteId),
        id_propriedade: sanitizeUuid(effectivePropriedadeId),
        data_orcamento: data.data_orcamento,
        codigo_orcamento: codigoOrcamento || null,
        quantidade: servicosValidos.reduce((acc: number, item: any) => acc + (item.quantidade || 0), 0),
        valor_unitario: servicosValidos.length > 0 ? receitaEsperada / servicosValidos.length : 0,
        desconto: data.desconto_global || 0, // Desconto global em %
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
        orcamento_convertido: data.orcamento_convertido || false,
        situacao_do_pagamento: data.situacao_do_pagamento || null,
        forma_de_pagamento: data.forma_de_pagamento || null,
        data_do_faturamento: data.data_do_faturamento || null,
        anotacoes: data.anotacoes || null,
        tenant_id: tenantId
      };

      let orcamentoId = orcamento?.id_orcamento;

      if (orcamento) {
        const { error } = await supabase.from('fato_orcamento').update(orcamentoData).eq('id_orcamento', orcamento.id_orcamento);
        if (error) throw error;
      } else {
        const { data: novoOrcamento, error } = await supabase.from('fato_orcamento').insert([orcamentoData]).select().single();
        if (error) throw error;
        orcamentoId = novoOrcamento.id_orcamento;
      }

      // Handle items
      if (orcamento) {
        await supabase.from('fato_orcamento_itens').delete().eq('id_orcamento', orcamentoId);
        await supabase.from('fato_despesas').delete().eq('id_orcamento', orcamentoId);
      }

      const itensData = servicosValidos.map((item: any) => ({
        id_orcamento: orcamentoId,
        id_servico: sanitizeUuid(item.id_servico),
        quantidade: item.quantidade || 1,
        valor_unitario: item.valor_unitario || 0,
        desconto: 0, // Desconto agora é global, não por item
        tenant_id: tenantId
      }));

      if (itensData.length > 0) {
        const { error: itensError } = await supabase.from('fato_orcamento_itens').insert(itensData);
        if (itensError) throw itensError;
      }

      // Handle expenses with validation
      const despesasValidas = (data.despesas || []).filter((d: any) => d.valor > 0);
      
      // Validate each expense
      for (let i = 0; i < despesasValidas.length; i++) {
        const despesa = despesasValidas[i];
        try {
          despesaOrcamentoSchema.parse(despesa);
        } catch (validationError) {
          if (validationError instanceof z.ZodError) {
            const errorMessage = validationError.errors.map(e => e.message).join(', ');
            toast.error(`Despesa #${i + 1}: ${errorMessage}`);
            return;
          }
        }
        
        // Check for negative values explicitly
        if (despesa.valor < 0) {
          toast.error(`Despesa #${i + 1}: Valor não pode ser negativo`);
          return;
        }
      }
      
      if (despesasValidas.length > 0) {
        const despesasData = despesasValidas.map((d: any) => ({
          id_orcamento: orcamentoId,
          id_tipodespesa: sanitizeUuid(d.id_tipodespesa),
          valor_da_despesa: d.valor,
          data_da_despesa: data.data_orcamento,
          observacoes: d.descricao || null,
          tenant_id: tenantId,
          status: 'pendente'
        }));
        const { error: despesasError } = await supabase.from('fato_despesas').insert(despesasData);
        if (despesasError) throw despesasError;
      }

      if (!orcamento) {
        await createNotification(
          'orcamento',
          'Novo Orçamento',
          `Orçamento ${codigoOrcamento} criado com sucesso`,
          '/servicos-orcamentos'
        );
      }

      toast.success(orcamento ? "Orçamento atualizado!" : "Orçamento criado!");
      reset();
      clienteForm.reset();
      propriedadeForm.reset();
      setNewClienteId(null);
      setNewPropriedadeId(null);
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Erro ao salvar orçamento:', error);
      toast.error(error.message || "Erro ao salvar orçamento");
    }
  };

  const getStepIndex = () => WIZARD_STEPS.findIndex(s => s.id === currentStep);

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {WIZARD_STEPS.map((step, index) => {
        const isActive = step.id === currentStep;
        const isPast = getStepIndex() > index;
        return (
          <div key={step.id} className="flex items-center">
            <div className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-full transition-colors",
              isActive && "bg-primary text-primary-foreground",
              isPast && "bg-primary/20 text-primary",
              !isActive && !isPast && "bg-muted text-muted-foreground"
            )}>
              {isPast ? <Check className="h-4 w-4" /> : step.icon}
              <span className="text-sm font-medium">{step.label}</span>
            </div>
            {index < WIZARD_STEPS.length - 1 && (
              <ChevronRight className="h-4 w-4 mx-2 text-muted-foreground" />
            )}
          </div>
        );
      })}
    </div>
  );

  const renderClienteStep = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/30">
        <Switch
          checked={createNewCliente}
          onCheckedChange={(checked) => {
            setCreateNewCliente(checked);
            if (!checked) clienteForm.reset();
          }}
        />
        <div>
          <p className="font-medium">Criar novo cliente</p>
          <p className="text-sm text-muted-foreground">Cadastre um novo cliente diretamente no wizard</p>
        </div>
      </div>

      {!createNewCliente ? (
        <div className="space-y-2">
          <Label>Selecionar Cliente Existente</Label>
          <Select 
            value={watchedClienteId || "_none"} 
            onValueChange={(v) => setValue("id_cliente", v === "_none" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um cliente..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">Selecione um cliente...</SelectItem>
              {clientes.map((c) => (
                <SelectItem key={c.id_cliente} value={c.id_cliente}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg">
          <div className="col-span-2 flex items-center gap-2 mb-2">
            <UserPlus className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Novo Cliente</h3>
          </div>
          
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input {...clienteForm.register("nome")} placeholder="Nome do cliente" />
          </div>
          
          <div className="space-y-2">
            <Label>Email</Label>
            <Input {...clienteForm.register("email")} type="email" placeholder="email@exemplo.com" />
          </div>
          
          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input 
              value={clienteForm.watch("telefone") || ''}
              onChange={(e) => clienteForm.setValue("telefone", formatPhoneNumber(e.target.value))}
              placeholder="(00) 00000-0000"
            />
          </div>
          
          <div className="space-y-2">
            <Label>Celular</Label>
            <Input 
              value={clienteForm.watch("celular") || ''}
              onChange={(e) => clienteForm.setValue("celular", formatPhoneNumber(e.target.value))}
              placeholder="(00) 00000-0000"
            />
          </div>
          
          <div className="space-y-2">
            <Label>CPF</Label>
            <Input 
              value={clienteForm.watch("cpf") || ''}
              onChange={(e) => clienteForm.setValue("cpf", formatCPF(e.target.value))}
              placeholder="000.000.000-00"
            />
          </div>
          
          <div className="space-y-2">
            <Label>CNPJ</Label>
            <Input 
              value={clienteForm.watch("cnpj") || ''}
              onChange={(e) => clienteForm.setValue("cnpj", formatCNPJ(e.target.value))}
              placeholder="00.000.000/0000-00"
            />
          </div>
          
          <div className="col-span-2 space-y-2">
            <Label>Endereço</Label>
            <Input {...clienteForm.register("endereco")} placeholder="Endereço completo" />
          </div>

          {/* Prospecção */}
          <div className="col-span-2 space-y-2">
            <Label>Prospecção (Origem)</Label>
            <div className="grid grid-cols-3 gap-2">
              {PROSPECCAO_OPCOES.map((opcao) => {
                const selectedOrigem = clienteForm.watch("origem") || [];
                const isChecked = selectedOrigem.includes(opcao);
                return (
                  <div key={opcao} className="flex items-center space-x-2">
                    <Checkbox
                      id={`origem-${opcao}`}
                      checked={isChecked}
                      onCheckedChange={(checked) => {
                        const current = clienteForm.getValues("origem") || [];
                        if (checked) {
                          clienteForm.setValue("origem", [...current, opcao]);
                        } else {
                          clienteForm.setValue("origem", current.filter((o: string) => o !== opcao));
                        }
                      }}
                    />
                    <Label htmlFor={`origem-${opcao}`} className="text-sm font-normal cursor-pointer">
                      {opcao}
                    </Label>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Categoria do Cliente */}
          <div className="col-span-2 space-y-2">
            <Label>Categoria do Cliente</Label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIA_CLIENTE_OPCOES.map((opcao) => {
                const selectedCategoria = clienteForm.watch("categoria") || [];
                const isChecked = selectedCategoria.includes(opcao);
                return (
                  <div key={opcao} className="flex items-center space-x-2">
                    <Checkbox
                      id={`categoria-${opcao}`}
                      checked={isChecked}
                      onCheckedChange={(checked) => {
                        const current = clienteForm.getValues("categoria") || [];
                        if (checked) {
                          clienteForm.setValue("categoria", [...current, opcao]);
                        } else {
                          clienteForm.setValue("categoria", current.filter((c: string) => c !== opcao));
                        }
                      }}
                    />
                    <Label htmlFor={`categoria-${opcao}`} className="text-sm font-normal cursor-pointer">
                      {opcao}
                    </Label>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderPropriedadeStep = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/30">
        <Switch
          checked={createNewPropriedade}
          onCheckedChange={(checked) => {
            setCreateNewPropriedade(checked);
            if (!checked) propriedadeForm.reset();
          }}
        />
        <div>
          <p className="font-medium">Criar nova propriedade</p>
          <p className="text-sm text-muted-foreground">Cadastre uma nova propriedade para o cliente</p>
        </div>
      </div>

      {!createNewPropriedade ? (
        <div className="space-y-2">
          <Label>Selecionar Propriedade Existente</Label>
          <Select 
            value={watch("id_propriedade") || "_none"} 
            onValueChange={(v) => setValue("id_propriedade", v === "_none" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma propriedade..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">Nenhuma propriedade</SelectItem>
              {propriedades.map((p) => (
                <SelectItem key={p.id_propriedade} value={p.id_propriedade}>{p.nome_da_propriedade}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {propriedades.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma propriedade encontrada para este cliente. Ative a opção acima para criar uma nova.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg">
          <div className="col-span-2 flex items-center gap-2 mb-2">
            <Building className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Nova Propriedade</h3>
          </div>
          
          <div className="col-span-2 space-y-2">
            <Label>Nome da Propriedade *</Label>
            <Input {...propriedadeForm.register("nome_da_propriedade")} placeholder="Nome da propriedade" />
          </div>
          
          <div className="space-y-2">
            <Label>Área (ha)</Label>
            <Input {...propriedadeForm.register("area_ha")} type="number" step="0.01" placeholder="0.00" />
          </div>
          
          <div className="space-y-2">
            <Label>Cidade</Label>
            <Input {...propriedadeForm.register("cidade")} placeholder="Cidade" />
          </div>
          
          <div className="col-span-2 space-y-2">
            <Label>Observações</Label>
            <Input {...propriedadeForm.register("observacoes")} placeholder="Observações" />
          </div>
        </div>
      )}
    </div>
  );

  const renderOrcamentoStep = () => (
    <div className="space-y-6">
      {/* I. Dados Básicos */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <User className="h-5 w-5 text-blue-500" />
          <h3 className="font-semibold text-lg">Dados Básicos</h3>
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Cliente</Label>
            <Input 
              value={clientes.find(c => c.id_cliente === (newClienteId || watchedClienteId))?.nome || ''} 
              readOnly 
              className="bg-muted"
            />
          </div>
          <div className="space-y-2">
            <Label>Propriedade</Label>
            <Input 
              value={propriedades.find(p => p.id_propriedade === (newPropriedadeId || watch("id_propriedade")))?.nome_da_propriedade || ''} 
              readOnly 
              className="bg-muted"
            />
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
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-orange-500" />
          <h3 className="font-semibold text-lg">Valores e Cálculos</h3>
          <span className="text-sm text-muted-foreground">
            ({fields.length} {fields.length === 1 ? 'serviço' : 'serviços'})
          </span>
        </div>

        {fields.map((field, index) => {
          const servicoSelecionado = servicos.find(s => s.id_tiposervico === watchedItens[index]?.id_servico);
          const tituloServico = servicoSelecionado 
            ? `#${index + 1} - ${servicoSelecionado.nome}`
            : `Serviço #${index + 1}`;
          
          return (
            <div key={field.id} className="p-4 border rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">{tituloServico}</span>
                {fields.length > 1 && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-4 gap-4">
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
                    value={watchedItens[index]?.id_servico || "_none"}
                    onValueChange={(v) => {
                      setValue(`itens.${index}.id_servico`, v === "_none" ? "" : v);
                      const srv = servicos.find(s => s.id_tiposervico === v);
                      if (srv?.valor_sugerido) setValue(`itens.${index}.valor_unitario`, Math.floor(srv.valor_sugerido));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Selecione...</SelectItem>
                      {servicos.map((s) => (
                        <SelectItem key={s.id_tiposervico} value={s.id_tiposervico}>{s.nome}</SelectItem>
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
              </div>
            </div>
          );
        })}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ id_servico: "", quantidade: 1, valor_unitario: 0 })}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Serviço
        </Button>

        {/* Desconto Global */}
        <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/30">
          <Percent className="h-5 w-5 text-orange-500" />
          <div className="flex-1">
            <Label>Desconto Global (%)</Label>
            <p className="text-xs text-muted-foreground">Aplicado sobre o valor total dos serviços</p>
          </div>
          <Input
            type="number"
            step="1"
            min="0"
            max="100"
            className="w-24"
            {...register("desconto_global", { valueAsNumber: true })}
          />
        </div>
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
            onClick={() => appendDespesa({ id_tipodespesa: "", descricao: "", valor: 0 })}
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Despesa
          </Button>
        </div>
        
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Info className="h-3 w-3" />
          Despesas adicionadas aqui serão contabilizadas como custos internos. No documento do cliente, aparecerão apenas como "Custo dos Serviços".
        </p>

        {despesaFields.map((field, index) => {
          const tituloDespesa = watchedDespesas[index]?.descricao 
            ? `#${index + 1} - ${watchedDespesas[index].descricao}`
            : `Despesa #${index + 1}`;
          
          return (
            <div key={field.id} className="p-4 border rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{tituloDespesa}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeDespesa(index)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Despesa</Label>
                  <Select
                    value={watchedDespesas[index]?.id_tipodespesa || "_none"}
                    onValueChange={(v) => setValue(`despesas.${index}.id_tipodespesa`, v === "_none" ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Selecione...</SelectItem>
                      {tiposDespesa.map((t) => (
                        <SelectItem key={t.id_tipodespesa} value={t.id_tipodespesa}>
                          {t.subcategoria || t.categoria}
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
          );
        })}
      </div>

      {/* IV. Situação e Faturamento */}
      <div className="space-y-4 p-4 border rounded-lg">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-blue-500" />
          <h3 className="font-semibold text-lg">Situação e Faturamento</h3>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Situação do Pagamento</Label>
            <Select
              value={watchedSituacao || "_none"}
              onValueChange={(value) => setValue("situacao_do_pagamento", value === "_none" ? "" : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a situação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Selecione a situação</SelectItem>
                <SelectItem value="Pendente">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[hsl(48,96%,53%)]" />
                    Pendente
                  </span>
                </SelectItem>
                <SelectItem value="Pago">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[hsl(142,76%,36%)]" />
                    Pago
                  </span>
                </SelectItem>
                <SelectItem value="Parcial">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[hsl(217,91%,60%)]" />
                    Parcial
                  </span>
                </SelectItem>
                <SelectItem value="Cancelado">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[hsl(0,100%,50%)]" />
                    Cancelado
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Forma de Pagamento</Label>
            <Select
              value={watch("forma_de_pagamento") || "_none"}
              onValueChange={(value) => setValue("forma_de_pagamento", value === "_none" ? "" : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a forma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Selecione a forma</SelectItem>
                <SelectItem value="PIX">
                  <span className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-[hsl(48,96%,53%)]" />
                    PIX
                  </span>
                </SelectItem>
                <SelectItem value="Dinheiro">
                  <span className="flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-[hsl(142,76%,36%)]" />
                    Dinheiro
                  </span>
                </SelectItem>
                <SelectItem value="Cartão">
                  <span className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-[hsl(217,91%,60%)]" />
                    Cartão
                  </span>
                </SelectItem>
                <SelectItem value="Transferência">
                  <span className="flex items-center gap-2">
                    <ArrowLeftRight className="h-4 w-4 text-[hsl(280,70%,50%)]" />
                    Transferência
                  </span>
                </SelectItem>
                <SelectItem value="Boleto">
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[hsl(25,95%,53%)]" />
                    Boleto
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Data do Faturamento</Label>
            <Input 
              type="date" 
              {...register("data_do_faturamento")}
            />
          </div>
          
          <div className="flex items-center gap-3 pt-6">
            <Switch
              checked={watch("orcamento_convertido") || false}
              onCheckedChange={(checked) => setValue("orcamento_convertido", checked)}
            />
            <Label className="cursor-pointer">Orçamento Convertido</Label>
          </div>
        </div>
      </div>

      {/* V. Resumo Financeiro */}
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

      {/* VI. Anotações */}
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
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{orcamento ? "Editar Orçamento" : "Novo Orçamento"}</DialogTitle>
        </DialogHeader>

        {renderStepIndicator()}

        <form onSubmit={handleSubmit(onSubmit)}>
          {currentStep === 'cliente' && renderClienteStep()}
          {currentStep === 'propriedade' && renderPropriedadeStep()}
          {currentStep === 'orcamento' && renderOrcamentoStep()}

          <DialogFooter className="mt-6 gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            
            {currentStep !== 'cliente' && !orcamento && (
              <Button type="button" variant="ghost" onClick={handleBack}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
            )}
            
            {currentStep !== 'orcamento' ? (
              <Button type="button" onClick={handleNext}>
                Próximo <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button type="submit">
                <Check className="h-4 w-4 mr-1" /> {orcamento ? "Salvar" : "Criar Orçamento"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
