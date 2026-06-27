import { useState } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/services/supabase.service";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContent } from "@/components/layout/PageContent";
import { FilterBar } from "@/components/layout/FilterBar";
import { ContextualKPIs } from "@/components/layout/ContextualKPIs";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { Plus, Trash2, Edit, Briefcase, CheckCircle2, Clock, AlertCircle, Eye, CalendarIcon, X, LayoutGrid, List } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KanbanBoard } from "@/components/servicos/KanbanBoard";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { NovoServicoDialog } from "@/components/servicos";
import { OnboardingPageBanner } from "@/components/onboarding/OnboardingPageBanner";
import { SmartImporter } from "@/components/import/SmartImporter";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterEmptyState } from "@/components/ui/filter-empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TablePagination } from "@/components/ui/table-pagination";
import { useServerPagination } from "@/hooks/useServerPagination";
import { fetchServicos, deleteServico } from "@/modules/operations";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  SERVICE_STATUS,
  SERVICE_STATUS_FILTER_OPTIONS,
  getServiceStatusBadgeClasses,
  isServiceInProgress,
} from "@/constants/serviceStatus";

export default function Servicos() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingServico, setEditingServico] = useState<any>(null);
  const [searchTerm, setSearchTerm] = usePersistentFilters<string>("servicos:search", "");
  const [viewMode, setViewMode] = usePersistentFilters<"table" | "kanban">("servicos:viewMode", "table");
  const [statusFilter, setStatusFilter] = usePersistentFilters<string>("servicos:status", "all");
  const [dataInicio, setDataInicio] = usePersistentFilters<Date | undefined>("servicos:dataInicio", undefined);
  const [dataFim, setDataFim] = usePersistentFilters<Date | undefined>("servicos:dataFim", undefined);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const [totalItems, setTotalItems] = useState(0);
  const pagination = useServerPagination({ totalItems, initialPageSize: 15 });

  const searchSanitized = searchTerm.trim().replace(/[%,()]/g, "");
  const dataInicioStr = dataInicio ? format(dataInicio, "yyyy-MM-dd") : null;
  const dataFimStr = dataFim ? format(dataFim, "yyyy-MM-dd") : null;

  // KPIs leves — sempre carregados, mas só com as colunas necessárias.
  const { data: kpiData = [] } = useQuery({
    queryKey: ["servicos-kpis"],
    queryFn: async () => {
      const tenantId = await getCurrentTenantId();
      let q = supabase.from("fato_servico").select("id_servico, situacao_do_servico, data_do_servico_fim");
      if (tenantId) q = q.eq("tenant_id", tenantId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const servicosEmAndamento = kpiData.filter((s: any) => isServiceInProgress(s.situacao_do_servico)).length;
  const servicosConcluidos = kpiData.filter((s: any) => s.situacao_do_servico === SERVICE_STATUS.CONCLUIDO).length;
  const atrasados = kpiData.filter((s: any) => {
    if (s.situacao_do_servico === "Concluído" || s.situacao_do_servico === "Cancelado") return false;
    if (!s.data_do_servico_fim) return false;
    return new Date(s.data_do_servico_fim) < new Date();
  }).length;
  const totalServicos = kpiData.length;

  // Kanban: dataset completo, só busca quando estiver visível.
  const { data: kanbanData = [], isLoading: kanbanLoading } = useQuery({
    queryKey: ["servicos-kanban"],
    enabled: viewMode === "kanban",
    queryFn: async () => {
      const { data, error } = await fetchServicos();
      if (error) throw error;
      return data ?? [];
    },
  });

  // Filtro client-side do kanban (kanban precisa do dataset completo)
  const filteredKanban = kanbanData.filter((s: any) => {
    if (statusFilter !== "all" && s.situacao_do_servico !== statusFilter) return false;
    if (searchSanitized) {
      const t = searchSanitized.toLowerCase();
      const hay = [s.nome_do_servico, s.dim_cliente?.nome, s.dim_propriedade?.nome_da_propriedade].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(t)) return false;
    }
    if (dataInicioStr && s.data_do_servico_inicio && s.data_do_servico_inicio < dataInicioStr) return false;
    if (dataFimStr && s.data_do_servico_fim && s.data_do_servico_fim > dataFimStr) return false;
    return true;
  });

  // Tabela: query paginada server-side, só quando aba tabela ativa.
  const { data: pageData, isLoading: tableLoading } = useQuery({
    queryKey: [
      "servicos-page",
      { page: pagination.currentPage, pageSize: pagination.pageSize, search: searchSanitized, status: statusFilter, dataInicio: dataInicioStr, dataFim: dataFimStr },
    ],
    enabled: viewMode === "table",
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const tenantId = await getCurrentTenantId();
      let q = supabase
        .from("fato_servico")
        .select(
          `id_servico, nome_do_servico, situacao_do_servico, data_do_servico_inicio, data_do_servico_fim, progresso,
           dim_cliente:dim_cliente!fk_servico_cliente(nome),
           dim_propriedade:dim_propriedade!fk_servico_propriedade(nome_da_propriedade)`,
          { count: "exact" }
        )
        .order("created_at", { ascending: false })
        .range(pagination.from, pagination.to);

      if (tenantId) q = q.eq("tenant_id", tenantId);
      if (statusFilter !== "all") q = q.eq("situacao_do_servico", statusFilter);
      if (dataInicioStr) q = q.gte("data_do_servico_inicio", dataInicioStr);
      if (dataFimStr) q = q.lte("data_do_servico_fim", dataFimStr);
      if (searchSanitized) q = q.ilike("nome_do_servico", `%${searchSanitized}%`);

      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: data ?? [], count: count ?? 0 };
    },
  });

  if (pageData && pageData.count !== totalItems) {
    setTotalItems(pageData.count);
  }

  const servicos = pageData?.rows ?? [];
  const hasFilters = searchTerm !== "" || statusFilter !== "all" || !!dataInicio || !!dataFim;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["servicos-page"] });
    queryClient.invalidateQueries({ queryKey: ["servicos-kanban"] });
    queryClient.invalidateQueries({ queryKey: ["servicos-kpis"] });
    queryClient.invalidateQueries({ queryKey: ["servicos"] });
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await deleteServico(id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success("Projeto excluído com sucesso!");
    },
    onError: (error: any) => toast.error(`Erro ao excluir: ${error.message}`),
  });

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingServico(null);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return format(new Date(dateStr), "dd/MM/yyyy", { locale: ptBR });
  };

  const isLoading = viewMode === "table" ? tableLoading : kanbanLoading;

  return (
    <AppLayout>
      <div className="space-y-6">
        <OnboardingPageBanner stepId="servico" onCreate={() => setIsDialogOpen(true)} />
        <PageHeader title="Projetos" subtitle="Gerencie a execução dos seus projetos">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "table" | "kanban")}>
            <TabsList className="h-9">
              <TabsTrigger value="table" className="px-3">
                <List className="h-4 w-4 mr-1.5" />
                Lista
              </TabsTrigger>
              <TabsTrigger value="kanban" className="px-3">
                <LayoutGrid className="h-4 w-4 mr-1.5" />
                Kanban
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Projeto
          </Button>
        </PageHeader>

        <ContextualKPIs
          items={[
            { label: "Em Andamento", value: servicosEmAndamento, icon: Clock, iconColor: "text-amber-500", iconBg: "bg-amber-500/10" },
            { label: "Atrasados", value: atrasados, icon: AlertCircle, iconColor: "text-destructive", iconBg: "bg-destructive/10" },
            { label: "Concluídos", value: `${servicosConcluidos} (${totalServicos > 0 ? Math.round((servicosConcluidos / totalServicos) * 100) : 0}%)`, icon: CheckCircle2, iconColor: "text-emerald-500", iconBg: "bg-emerald-500/10" },
          ]}
        />

        {viewMode === "kanban" ? (
          <KanbanBoard servicos={filteredKanban} />
        ) : (
          <PageContent title="Lista de Projetos">
            <FilterBar
              searchValue={searchTerm}
              onSearchChange={(v) => { setSearchTerm(v); pagination.resetPage(); }}
              searchPlaceholder="Buscar pelo nome do projeto..."
            >
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); pagination.resetPage(); }}>
                <SelectTrigger className="w-[160px] h-9 text-sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_STATUS_FILTER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
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
              <EmptyState
                icon={Briefcase}
                title="Crie seu primeiro projeto"
                description="Registre projetos para acompanhar prazos, equipe e progresso de cada execução."
                actionLabel="+ Criar Projeto"
                onAction={() => setIsDialogOpen(true)}
                tip="Vincule a clientes e orçamentos para gestão completa"
              />
            ) : totalItems === 0 ? (
              <FilterEmptyState onClearFilters={() => { setSearchTerm(""); setStatusFilter("all"); setDataInicio(undefined); setDataFim(undefined); pagination.resetPage(); }} />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Título</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Propriedade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Início</TableHead>
                      <TableHead>Prazo</TableHead>
                      <TableHead>Progresso</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {servicos.map((servico: any) => (
                      <TableRow key={servico.id_servico} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/projetos/${servico.id_servico}`)}>
                        <TableCell className="font-medium">{servico.nome_do_servico}</TableCell>
                        <TableCell>{servico.dim_cliente?.nome || "-"}</TableCell>
                        <TableCell>{servico.dim_propriedade?.nome_da_propriedade || "-"}</TableCell>
                        <TableCell>
                          <Badge className={getServiceStatusBadgeClasses(servico.situacao_do_servico)}>{servico.situacao_do_servico || "Pendente"}</Badge>
                        </TableCell>
                        <TableCell>{formatDate(servico.data_do_servico_inicio)}</TableCell>
                        <TableCell>{formatDate(servico.data_do_servico_fim)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-[100px]">
                            <Progress value={servico.progresso || 0} className="h-2 flex-1" />
                            <span className="text-xs text-muted-foreground w-8">{servico.progresso || 0}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" onClick={() => navigate(`/projetos/${servico.id_servico}`)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => { setEditingServico(servico); setIsDialogOpen(true); }}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => { setDeleteTargetId(servico.id_servico); setDeleteConfirmOpen(true); }}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <TablePagination
                  currentPage={pagination.currentPage}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.totalItems}
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
              </div>
            )}
          </PageContent>
        )}

        <NovoServicoDialog open={isDialogOpen} onOpenChange={handleCloseDialog} editingServico={editingServico} />

        <SmartImporter open={importOpen} onOpenChange={setImportOpen} entityType="servicos" onSuccess={invalidateAll} />

        <ConfirmDialog
          open={deleteConfirmOpen}
          onOpenChange={setDeleteConfirmOpen}
          title="Excluir projeto"
          description="Tem certeza que deseja excluir este projeto? Esta ação não pode ser desfeita."
          confirmLabel="Excluir"
          onConfirm={() => {
            if (deleteTargetId) deleteMutation.mutate(deleteTargetId);
            setDeleteConfirmOpen(false);
            setDeleteTargetId(null);
          }}
        />
      </div>
    </AppLayout>
  );
}
