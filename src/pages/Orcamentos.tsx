import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { ContextualKPIs } from "@/components/layout/ContextualKPIs";
import { FilterBar } from "@/components/layout/FilterBar";
import { PageContent } from "@/components/layout/PageContent";
import { OnboardingPageBanner } from "@/components/onboarding/OnboardingPageBanner";
import { TablePagination } from "@/components/ui/table-pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Edit, FileText, TrendingUp, Target, Download, AlertCircle, UserPlus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { orcamentoSchema } from "@/lib/validations";
import { generateOrcamentoPDF } from "@/lib/pdfTemplateGenerator";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterEmptyState } from "@/components/ui/filter-empty-state";
import { PAYMENT_STATUS, PAYMENT_STATUS_OPTIONS, PAYMENT_METHOD_OPTIONS, BUDGET_SITUATION_OPTIONS } from "@/constants/budgetStatus";
import { ClienteDialog } from "@/components/cadastros/ClienteDialog";
import { getStatusClasses } from "@/lib/statusColors";
import { usePagination } from "@/hooks/usePagination";

export default function Orcamentos() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [generatingPDF, setGeneratingPDF] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    id_cliente: "",
    id_servico: "",
    data_orcamento: new Date().toISOString().split('T')[0],
    valor_unitario: "",
    quantidade: "1",
    desconto: "0",
    situacao_do_pagamento: PAYMENT_STATUS.PENDENTE as string,
    forma_de_pagamento: "",
  });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroSituacao, setFiltroSituacao] = useState("todos");
  const [filtroForma, setFiltroForma] = useState("todos");
  const [filtroStatusOrc, setFiltroStatusOrc] = useState("todos");
  const [clienteDialogOpen, setClienteDialogOpen] = useState(false);

  const { data: orcamentos = [], isLoading } = useQuery({
    queryKey: ['orcamentos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fato_orcamento')
        .select(`
          *,
          dim_cliente:dim_cliente!fk_orcamento_cliente(nome, email, telefone),
          fato_servico:fato_servico!fk_orcamento_servico(nome_do_servico)
        `)
        .order('data_orcamento', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dim_cliente')
        .select('id_cliente, nome')
        .order('nome');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: servicos = [] } = useQuery({
    queryKey: ['servicos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fato_servico')
        .select('id_servico, nome_do_servico')
        .order('nome_do_servico');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: empresa } = useQuery({
    queryKey: ['empresa-pdf'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dim_empresa')
        .select('nome, template_orcamento_url, template_config')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: typeof formData & { id_orcamento?: string }) => {
      const valorTotal = parseFloat(data.valor_unitario) * parseInt(data.quantidade) - parseFloat(data.desconto);
      const valorImposto = valorTotal * 0.12;
      const receitaEsperada = valorTotal - valorImposto;

      const { requireTenantId } = await import('@/services/supabase.service');
      const tenantId = await requireTenantId();

      const payload = {
        id_cliente: data.id_cliente,
        id_servico: data.id_servico || null,
        data_orcamento: data.data_orcamento,
        valor_unitario: parseFloat(data.valor_unitario),
        quantidade: parseInt(data.quantidade),
        desconto: parseFloat(data.desconto),
        valor_imposto: valorImposto,
        receita_esperada: receitaEsperada,
        receita_esperada_imposto: receitaEsperada,
        situacao_do_pagamento: data.situacao_do_pagamento,
        forma_de_pagamento: data.forma_de_pagamento || null,
        tenant_id: tenantId,
      };

      if (data.id_orcamento) {
        const { error } = await supabase
          .from('fato_orcamento')
          .update(payload)
          .eq('id_orcamento', data.id_orcamento);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('fato_orcamento').insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
      toast.success(editingId ? "Orçamento atualizado!" : "Orçamento criado!");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fato_orcamento').delete().eq('id_orcamento', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
      toast.success("Orçamento excluído!");
    },
  });

  const resetForm = () => {
    setFormData({
      id_cliente: "",
      id_servico: "",
      data_orcamento: new Date().toISOString().split('T')[0],
      valor_unitario: "",
      quantidade: "1",
      desconto: "0",
      situacao_do_pagamento: PAYMENT_STATUS.PENDENTE,
      forma_de_pagamento: "",
    });
    setEditingId(null);
  };

  const handleEdit = (orc: any) => {
    setFormData({
      id_cliente: orc.id_cliente || "",
      id_servico: orc.id_servico || "",
      data_orcamento: orc.data_orcamento,
      valor_unitario: orc.valor_unitario.toString(),
      quantidade: orc.quantidade.toString(),
      desconto: orc.desconto?.toString() || "0",
      situacao_do_pagamento: orc.situacao_do_pagamento || PAYMENT_STATUS.PENDENTE,
      forma_de_pagamento: orc.forma_de_pagamento || "",
    });
    setEditingId(orc.id_orcamento);
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id_cliente) {
      toast.error("Selecione um cliente para o orçamento");
      return;
    }
    try {
      const validatedData = orcamentoSchema.parse({
        id_cliente: formData.id_cliente,
        id_servico: formData.id_servico || null,
        data_orcamento: formData.data_orcamento,
        valor_unitario: parseFloat(formData.valor_unitario),
        quantidade: parseInt(formData.quantidade),
        situacao_do_pagamento: formData.situacao_do_pagamento || null,
        forma_de_pagamento: formData.forma_de_pagamento || null,
      });
      const dataToSubmit = {
        id_cliente: validatedData.id_cliente || "",
        id_servico: validatedData.id_servico || "",
        data_orcamento: validatedData.data_orcamento,
        valor_unitario: validatedData.valor_unitario.toString(),
        quantidade: validatedData.quantidade.toString(),
        desconto: formData.desconto || "0",
        situacao_do_pagamento: validatedData.situacao_do_pagamento || PAYMENT_STATUS.PENDENTE,
        forma_de_pagamento: validatedData.forma_de_pagamento || "",
      };
      mutation.mutate(editingId ? { ...dataToSubmit, id_orcamento: editingId } : dataToSubmit);
    } catch (error: any) {
      if (error.errors) {
        error.errors.forEach((err: any) => toast.error(err.message));
      } else {
        toast.error("Erro na validação dos dados");
      }
    }
  };

  const handleExportPDF = async (orcamento: any) => {
    setGeneratingPDF(orcamento.id_orcamento);
    try {
      const cliente = orcamento.dim_cliente || null;
      const servico = orcamento.fato_servico || null;
      const templateUrl = empresa?.template_orcamento_url || null;
      const config = (empresa?.template_config || null) as any;
      const empresaData = empresa ? { nome: empresa.nome } : null;
      await generateOrcamentoPDF(orcamento, cliente, servico, templateUrl, config, empresaData);
      toast.success('PDF gerado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar PDF. Tente novamente.');
    } finally {
      setGeneratingPDF(null);
    }
  };

  // Filter
  const filteredOrcamentos = orcamentos.filter(orc => {
    const matchSearch = !searchTerm || [
      orc.dim_cliente?.nome,
      orc.fato_servico?.nome_do_servico,
      orc.codigo_orcamento,
      orc.situacao_do_pagamento,
      orc.forma_de_pagamento,
    ].some(f => f?.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchSituacao = filtroSituacao === "todos" || orc.situacao_do_pagamento === filtroSituacao;
    const matchForma = filtroForma === "todos" || orc.forma_de_pagamento === filtroForma;
    const matchStatusOrc = filtroStatusOrc === "todos" || orc.situacao === filtroStatusOrc;

    return matchSearch && matchSituacao && matchForma && matchStatusOrc;
  });

  // Pagination
  const pagination = usePagination(filteredOrcamentos);
  const paginatedOrcamentos = pagination.paginatedData;

  // KPIs
  const receitaEsperadaTotal = orcamentos.reduce((sum, o) => sum + (parseFloat(String(o.receita_esperada || 0))), 0);
  const orcamentosConvertidos = orcamentos.filter(o => o.orcamento_convertido).length;
  const taxaConversao = orcamentos.length > 0 ? (orcamentosConvertidos / orcamentos.length * 100) : 0;

  const handleClearFilters = () => {
    setSearchTerm("");
    setFiltroSituacao("todos");
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <OnboardingPageBanner stepId="orcamento" />

        <PageHeader title="Orçamentos" subtitle="Gerencie propostas comerciais e acompanhe aprovações">
          <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Orçamento
          </Button>
        </PageHeader>

        <ContextualKPIs
          items={[
            { label: "Total de Orçamentos", value: orcamentos.length, icon: FileText },
            {
              label: "Receita Esperada",
              value: `R$ ${receitaEsperadaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
              icon: TrendingUp,
              iconColor: "text-emerald-600",
              iconBg: "bg-emerald-500/10",
            },
            {
              label: "Taxa de Conversão",
              value: `${taxaConversao.toFixed(0)}%`,
              icon: Target,
              iconColor: "text-amber-600",
              iconBg: "bg-amber-500/10",
            },
          ]}
        />

        <PageContent title="Lista de Orçamentos">
          <FilterBar
            searchValue={searchTerm}
            onSearchChange={(v) => { setSearchTerm(v); pagination.goToPage(1); }}
            searchPlaceholder="Buscar por cliente, serviço ou código..."
          >
            <Select value={filtroSituacao} onValueChange={(v) => { setFiltroSituacao(v); pagination.goToPage(1); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Situação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as Situações</SelectItem>
                {PAYMENT_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterBar>

          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Carregando...</div>
          ) : filteredOrcamentos.length === 0 && !searchTerm && filtroSituacao === "todos" ? (
            <EmptyState
              icon={FileText}
              title="Envie sua primeira proposta"
              description="Crie orçamentos profissionais e acompanhe aprovações e pagamentos dos clientes."
              actionLabel="+ Criar Orçamento"
              onAction={() => { resetForm(); setIsDialogOpen(true); }}
            />
          ) : filteredOrcamentos.length === 0 ? (
            <FilterEmptyState onClearFilters={handleClearFilters} />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Receita Esperada</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedOrcamentos.map((orc) => (
                    <TableRow key={orc.id_orcamento}>
                      <TableCell>{new Date(orc.data_orcamento).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell className="font-medium">{orc.dim_cliente?.nome || '-'}</TableCell>
                      <TableCell>{orc.fato_servico?.nome_do_servico || '-'}</TableCell>
                      <TableCell>
                        R$ {(parseFloat(String(orc.receita_esperada)) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusClasses(orc.situacao_do_pagamento)}>
                          {orc.situacao_do_pagamento || 'Indefinido'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleExportPDF(orc)}
                          disabled={generatingPDF === orc.id_orcamento}
                          title="Exportar PDF"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(orc)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDeleteTargetId(orc.id_orcamento);
                            setDeleteConfirmOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <TablePagination
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                totalItems={filteredOrcamentos.length}
                pageSize={pagination.pageSize}
                startIndex={pagination.startIndex}
                endIndex={pagination.endIndex}
                canGoNext={pagination.canGoNext}
                canGoPrevious={pagination.canGoPrevious}
                onPageChange={pagination.goToPage}
                onPageSizeChange={pagination.setPageSize}
                onFirstPage={pagination.goToFirstPage}
                onLastPage={pagination.goToLastPage}
                onNextPage={pagination.goToNextPage}
                onPreviousPage={pagination.goToPreviousPage}
              />
            </>
          )}
        </PageContent>

        {/* Dialog fora do card — padrão do design system */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar" : "Novo"} Orçamento</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {clientes.length === 0 && (
                <Alert className="col-span-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between">
                    <span>Cadastre um cliente antes de criar orçamentos.</span>
                    <Button size="sm" variant="outline" type="button" onClick={() => setClienteDialogOpen(true)}>
                      <UserPlus className="h-4 w-4 mr-1" />
                      Criar cliente
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cliente">Cliente *</Label>
                  <Select value={formData.id_cliente} onValueChange={(v) => setFormData({ ...formData, id_cliente: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {clientes.map((c) => (
                        <SelectItem key={c.id_cliente} value={c.id_cliente}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="servico">Serviço</Label>
                  <Select value={formData.id_servico} onValueChange={(v) => setFormData({ ...formData, id_servico: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {servicos.map((s) => (
                        <SelectItem key={s.id_servico} value={s.id_servico}>{s.nome_do_servico}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="data">Data *</Label>
                  <Input id="data" type="date" value={formData.data_orcamento} onChange={(e) => setFormData({ ...formData, data_orcamento: e.target.value })} required />
                </div>
                <div>
                  <Label htmlFor="valor">Valor Unitário *</Label>
                  <Input id="valor" type="number" step="0.01" value={formData.valor_unitario} onChange={(e) => setFormData({ ...formData, valor_unitario: e.target.value })} required />
                </div>
                <div>
                  <Label htmlFor="qtd">Quantidade *</Label>
                  <Input id="qtd" type="number" value={formData.quantidade} onChange={(e) => setFormData({ ...formData, quantidade: e.target.value })} required />
                </div>
                <div>
                  <Label htmlFor="desconto">Desconto</Label>
                  <Input id="desconto" type="number" step="0.01" value={formData.desconto} onChange={(e) => setFormData({ ...formData, desconto: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="situacao">Situação</Label>
                  <Select value={formData.situacao_do_pagamento} onValueChange={(v) => setFormData({ ...formData, situacao_do_pagamento: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="forma">Forma de Pagamento</Label>
                  <Input id="forma" value={formData.forma_de_pagamento} onChange={(e) => setFormData({ ...formData, forma_de_pagamento: e.target.value })} placeholder="Ex: PIX, Boleto, Cartão" />
                </div>
              </div>
              <div className="bg-muted/20 p-4 rounded-lg space-y-2">
                <p className="text-sm"><strong>Valor Total:</strong> R$ {((parseFloat(formData.valor_unitario) || 0) * (parseInt(formData.quantidade) || 1) - (parseFloat(formData.desconto) || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                <p className="text-sm"><strong>Imposto (12%):</strong> R$ {(((parseFloat(formData.valor_unitario) || 0) * (parseInt(formData.quantidade) || 1) - (parseFloat(formData.desconto) || 0)) * 0.12).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                <p className="text-sm font-semibold"><strong>Receita Esperada:</strong> R$ {(((parseFloat(formData.valor_unitario) || 0) * (parseInt(formData.quantidade) || 1) - (parseFloat(formData.desconto) || 0)) * 0.88).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <Button type="submit" className="w-full" disabled={mutation.isPending}>
                {mutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={deleteConfirmOpen}
          onOpenChange={setDeleteConfirmOpen}
          title="Excluir orçamento"
          description="Tem certeza que deseja excluir este orçamento? Esta ação não pode ser desfeita."
          confirmLabel="Excluir"
          onConfirm={() => {
            if (deleteTargetId) deleteMutation.mutate(deleteTargetId);
            setDeleteConfirmOpen(false);
            setDeleteTargetId(null);
          }}
        />
        <ClienteDialog
          open={clienteDialogOpen}
          onOpenChange={setClienteDialogOpen}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['clientes'] });
            setClienteDialogOpen(false);
          }}
        />
      </div>
    </AppLayout>
  );
}
