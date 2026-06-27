import { useState } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { createDespesa, updateDespesa, deleteDespesa } from "@/modules/finance/services/despesa.service";
import { logAuditEvent } from "@/services/audit.service";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContent } from "@/components/layout/PageContent";
import { FilterBar } from "@/components/layout/FilterBar";
import { ContextualKPIs } from "@/components/layout/ContextualKPIs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { Plus, Trash2, Edit, DollarSign, CalendarIcon, X } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterEmptyState } from "@/components/ui/filter-empty-state";
import { OnboardingPageBanner } from "@/components/onboarding/OnboardingPageBanner";
import { SmartImporter } from "@/components/import/SmartImporter";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TablePagination } from "@/components/ui/table-pagination";
import { useServerPagination } from "@/hooks/useServerPagination";
import { despesaSchema } from "@/lib/validations";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useStateDraft } from "@/hooks/useFormDraft";
import { usePersistentFilters } from "@/hooks/usePersistentFilters";

export default function Despesas() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = usePersistentFilters<string>("despesas:search", "");
  const [categoriaFilter, setCategoriaFilter] = usePersistentFilters<string>("despesas:categoria", "all");
  const [dataInicio, setDataInicio] = usePersistentFilters<Date | undefined>("despesas:dataInicio", undefined);
  const [dataFim, setDataFim] = usePersistentFilters<Date | undefined>("despesas:dataFim", undefined);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [formData, setFormData] = useState({
    valor_da_despesa: "",
    data_da_despesa: new Date().toISOString().split("T")[0],
    id_tipodespesa: "",
    id_servico: "",
    observacoes: "",
  });

  const [totalItems, setTotalItems] = useState(0);
  const pagination = useServerPagination({ totalItems, initialPageSize: 15 });

  const { clearDraft: clearDespesaDraft } = useStateDraft({
    key: 'despesa:new',
    value: formData as unknown as Record<string, unknown>,
    setValue: (v) => setFormData(v as typeof formData),
    enabled: isDialogOpen && !editingId,
  });

  const searchSanitized = searchTerm.trim().replace(/[%,()]/g, "");
  const dataInicioStr = dataInicio ? format(dataInicio, "yyyy-MM-dd") : null;
  const dataFimStr = dataFim ? format(dataFim, "yyyy-MM-dd") : null;

  // Tipos (lookup completo — pequena cardinalidade)
  const { data: tiposDespesa = [] } = useQuery({
    queryKey: ["tipos-despesa"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dim_tipodespesa")
        .select("id_tipodespesa, categoria, subcategoria, descricao, classificacao")
        .order("categoria");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Lookup leve de serviços (apenas id+nome para Select do form)
  const { data: servicos = [] } = useQuery({
    queryKey: ["servicos-lookup"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fato_servico")
        .select("id_servico, nome_do_servico")
        .order("nome_do_servico");
      if (error) throw error;
      return data ?? [];
    },
  });

  // KPI: total do mês corrente — query dedicada, ignora paginação/filtros da tabela
  const mesAtualInicio = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const mesAtualFim = format(endOfMonth(new Date()), "yyyy-MM-dd");
  const { data: totalMes = 0 } = useQuery({
    queryKey: ["despesas-total-mes", mesAtualInicio, mesAtualFim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fato_despesas")
        .select("valor_da_despesa")
        .or("status.eq.confirmada,status.is.null")
        .gte("data_da_despesa", mesAtualInicio)
        .lte("data_da_despesa", mesAtualFim);
      if (error) throw error;
      return (data ?? []).reduce((sum, d: any) => sum + parseFloat(String(d.valor_da_despesa || 0)), 0);
    },
  });

  // Lista paginada server-side
  const { data: pageData, isLoading } = useQuery({
    queryKey: [
      "despesas",
      { page: pagination.currentPage, pageSize: pagination.pageSize, search: searchSanitized, categoria: categoriaFilter, dataInicio: dataInicioStr, dataFim: dataFimStr },
    ],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let q = supabase
        .from("fato_despesas")
        .select(
          `id_despesas, valor_da_despesa, data_da_despesa, id_tipodespesa, id_servico, observacoes, status,
           dim_tipodespesa:dim_tipodespesa!fk_despesas_tipodespesa(categoria, subcategoria, descricao),
           fato_servico:fato_servico!fk_despesas_servico(nome_do_servico)`,
          { count: "exact" }
        )
        .or("status.eq.confirmada,status.is.null")
        .order("data_da_despesa", { ascending: false })
        .range(pagination.from, pagination.to);

      if (dataInicioStr) q = q.gte("data_da_despesa", dataInicioStr);
      if (dataFimStr) q = q.lte("data_da_despesa", dataFimStr);

      if (categoriaFilter !== "all") {
        // Filtra pelos id_tipodespesa cuja categoria bate (resolvido client-side em tiposDespesa).
        const ids = tiposDespesa.filter((t: any) => t.categoria === categoriaFilter).map((t: any) => t.id_tipodespesa);
        if (ids.length === 0) {
          return { rows: [], count: 0 };
        }
        q = q.in("id_tipodespesa", ids);
      }

      if (searchSanitized) {
        // Busca apenas em observacoes (texto livre da própria fato_despesas) — campos
        // de tipo/serviço viriam de joins e PostgREST não suporta ilike em embedded.
        q = q.ilike("observacoes", `%${searchSanitized}%`);
      }

      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: data ?? [], count: count ?? 0 };
    },
  });

  if (pageData && pageData.count !== totalItems) {
    setTotalItems(pageData.count);
  }

  const despesas = pageData?.rows ?? [];
  const hasFilters = searchTerm !== "" || categoriaFilter !== "all" || !!dataInicio || !!dataFim;

  const mutation = useMutation({
    mutationFn: async (data: typeof formData & { id_despesas?: string }) => {
      if (data.id_despesas) {
        const result = await updateDespesa(data.id_despesas, { valor_da_despesa: parseFloat(data.valor_da_despesa), data_da_despesa: data.data_da_despesa, id_tipodespesa: data.id_tipodespesa || null, id_servico: data.id_servico || null, observacoes: data.observacoes });
        if (result.error) throw result.error;
      } else {
        const result = await createDespesa({ valor_da_despesa: parseFloat(data.valor_da_despesa), data_da_despesa: data.data_da_despesa, id_tipodespesa: data.id_tipodespesa || null, id_servico: data.id_servico || null, observacoes: data.observacoes });
        if (result.error) throw result.error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["despesas"] });
      queryClient.invalidateQueries({ queryKey: ["despesas-total-mes"] });
      logAuditEvent({ action: editingId ? "UPDATE" : "INSERT", entity: "Despesa", entityId: editingId || undefined, newData: { ...formData } });
      toast.success(editingId ? "Despesa atualizada!" : "Despesa adicionada!");
      clearDespesaDraft();
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => toast.error(`Erro: ${error.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteDespesa(id);
      if (result.error) throw result.error;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["despesas"] });
      queryClient.invalidateQueries({ queryKey: ["despesas-total-mes"] });
      logAuditEvent({ action: "DELETE", entity: "Despesa", entityId: id });
      toast.success("Despesa excluída!");
    },
    onError: (error: any) => toast.error(`Erro ao excluir: ${error.message}`),
  });

  const resetForm = () => {
    setFormData({ valor_da_despesa: "", data_da_despesa: new Date().toISOString().split("T")[0], id_tipodespesa: "", id_servico: "", observacoes: "" });
    setEditingId(null);
  };

  const handleEdit = (despesa: any) => {
    setFormData({ valor_da_despesa: despesa.valor_da_despesa.toString(), data_da_despesa: despesa.data_da_despesa, id_tipodespesa: despesa.id_tipodespesa || "", id_servico: despesa.id_servico || "", observacoes: despesa.observacoes || "" });
    setEditingId(despesa.id_despesas);
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const validatedData = despesaSchema.parse({ valor_da_despesa: parseFloat(formData.valor_da_despesa), data_da_despesa: formData.data_da_despesa, id_tipodespesa: formData.id_tipodespesa || null, id_servico: formData.id_servico || null, observacoes: formData.observacoes || undefined });
      const dataToSubmit = { valor_da_despesa: validatedData.valor_da_despesa.toString(), data_da_despesa: validatedData.data_da_despesa, id_tipodespesa: validatedData.id_tipodespesa || "", id_servico: validatedData.id_servico || "", observacoes: validatedData.observacoes || "" };
      mutation.mutate(editingId ? { ...dataToSubmit, id_despesas: editingId } : dataToSubmit);
    } catch (error: any) {
      if (error.errors) error.errors.forEach((err: any) => toast.error(err.message));
      else toast.error("Erro na validação dos dados");
    }
  };

  const categorias = [...new Set(tiposDespesa.map((t: any) => t.categoria).filter(Boolean))];

  return (
    <AppLayout>
      <div className="space-y-6">
        <OnboardingPageBanner
          stepId="despesa"
          onImport={() => setImportOpen(true)}
          onCreate={() => { resetForm(); setIsDialogOpen(true); }}
        />
        <PageHeader title="Despesas" subtitle="Registre e controle os custos da empresa">
          <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Despesa
          </Button>
        </PageHeader>

        <ContextualKPIs
          columns={2}
          items={[
            { label: "Total do Mês", value: `R$ ${totalMes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: DollarSign, iconColor: "text-rose-500", iconBg: "bg-rose-500/10" },
          ]}
        />

        <PageContent title="Lista de Despesas">
          <FilterBar
            searchValue={searchTerm}
            onSearchChange={(v) => { setSearchTerm(v); pagination.resetPage(); }}
            searchPlaceholder="Buscar nas observações..."
          >
            <Select value={categoriaFilter} onValueChange={(v) => { setCategoriaFilter(v); pagination.resetPage(); }}>
              <SelectTrigger className="w-[160px] h-9 text-sm">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {categorias.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("h-9 w-[130px] justify-start text-left font-normal text-sm", !dataInicio && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {dataInicio ? format(dataInicio, "dd/MM/yy", { locale: ptBR }) : "Início"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dataInicio} onSelect={(d) => { setDataInicio(d); pagination.resetPage(); }} initialFocus locale={ptBR} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <span className="text-xs text-muted-foreground">até</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("h-9 w-[130px] justify-start text-left font-normal text-sm", !dataFim && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {dataFim ? format(dataFim, "dd/MM/yy", { locale: ptBR }) : "Fim"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dataFim} onSelect={(d) => { setDataFim(d); pagination.resetPage(); }} initialFocus locale={ptBR} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              {(dataInicio || dataFim) && (
                <Button variant="ghost" size="icon" onClick={() => { setDataInicio(undefined); setDataFim(undefined); pagination.resetPage(); }} className="h-8 w-8">
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </FilterBar>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : totalItems === 0 && !hasFilters ? (
            <EmptyState icon={DollarSign} title="Controle seus custos" description="Registre despesas para entender sua margem de lucro real e tomar decisões melhores." actionLabel="+ Registrar Despesa" onAction={() => { resetForm(); setIsDialogOpen(true); }} tip="Vincule a serviços para rastrear custos por projeto" />
          ) : totalItems === 0 ? (
            <FilterEmptyState onClearFilters={() => { setSearchTerm(""); setCategoriaFilter("all"); setDataInicio(undefined); setDataFim(undefined); pagination.resetPage(); }} />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Subcategoria</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Serviço</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {despesas.map((despesa: any) => (
                    <TableRow key={despesa.id_despesas}>
                      <TableCell>{new Date(despesa.data_da_despesa).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>{despesa.dim_tipodespesa?.categoria || "-"}</TableCell>
                      <TableCell>{despesa.dim_tipodespesa?.subcategoria || "-"}</TableCell>
                      <TableCell>R$ {parseFloat(String(despesa.valor_da_despesa)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell>{despesa.fato_servico?.nome_do_servico || "-"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(despesa)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => { setDeleteTargetId(despesa.id_despesas); setDeleteConfirmOpen(true); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination currentPage={pagination.currentPage} totalPages={pagination.totalPages} totalItems={pagination.totalItems} pageSize={pagination.pageSize} startIndex={pagination.startIndex} endIndex={pagination.endIndex} canGoNext={pagination.canGoNext} canGoPrevious={pagination.canGoPrevious} onPageChange={pagination.goToPage} onPageSizeChange={pagination.setPageSize} onFirstPage={pagination.goToFirstPage} onLastPage={pagination.goToLastPage} onNextPage={pagination.goToNextPage} onPreviousPage={pagination.goToPreviousPage} />
            </div>
          )}
        </PageContent>

        {/* Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar" : "Nova"} Despesa</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="valor">Valor *</Label>
                <Input id="valor" type="number" step="0.01" value={formData.valor_da_despesa} onChange={(e) => setFormData({ ...formData, valor_da_despesa: e.target.value })} required />
              </div>
              <div>
                <Label htmlFor="data">Data *</Label>
                <Input id="data" type="date" value={formData.data_da_despesa} onChange={(e) => setFormData({ ...formData, data_da_despesa: e.target.value })} required />
              </div>
              <div>
                <Label htmlFor="tipo">Tipo de Despesa</Label>
                <Select value={formData.id_tipodespesa} onValueChange={(v) => setFormData({ ...formData, id_tipodespesa: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {tiposDespesa.map((t: any) => (
                      <SelectItem key={t.id_tipodespesa} value={t.id_tipodespesa}>{t.categoria} - {t.subcategoria}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="servico">Serviço</Label>
                <Select value={formData.id_servico} onValueChange={(v) => setFormData({ ...formData, id_servico: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {servicos.map((s: any) => (
                      <SelectItem key={s.id_servico} value={s.id_servico}>{s.nome_do_servico}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="obs">Observações</Label>
                <Textarea id="obs" value={formData.observacoes} onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })} />
              </div>
              <Button type="submit" className="w-full" disabled={mutation.isPending}>{editingId ? "Atualizar" : "Adicionar"}</Button>
            </form>
          </DialogContent>
        </Dialog>

        <ConfirmDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen} title="Excluir despesa" description="Tem certeza que deseja excluir esta despesa?" confirmLabel="Excluir" onConfirm={() => { if (deleteTargetId) deleteMutation.mutate(deleteTargetId); setDeleteConfirmOpen(false); setDeleteTargetId(null); }} />

        <SmartImporter open={importOpen} onOpenChange={setImportOpen} entityType="despesas" onSuccess={() => { queryClient.invalidateQueries({ queryKey: ["despesas"] }); queryClient.invalidateQueries({ queryKey: ["despesas-total-mes"] }); }} />
      </div>
    </AppLayout>
  );
}
