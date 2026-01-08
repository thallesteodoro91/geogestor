import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { Plus, Trash2, Edit, Briefcase, CheckCircle2, Clock, AlertCircle, Eye, TrendingUp, CalendarIcon, X } from "lucide-react";
import { KPICard } from "@/components/dashboard/KPICard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { NovoServicoDialog } from "@/components/servicos";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TablePagination } from "@/components/ui/table-pagination";
import { usePagination } from "@/hooks/usePagination";
import { fetchServicos, deleteServico } from "@/modules/operations";
import { format, isAfter, isBefore, isEqual, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { 
  SERVICE_STATUS, 
  SERVICE_STATUS_FILTER_OPTIONS, 
  getStatusBadgeVariant,
  isServiceInProgress 
} from "@/constants/serviceStatus";

export default function Servicos() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingServico, setEditingServico] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dataInicio, setDataInicio] = useState<Date | undefined>(undefined);
  const [dataFim, setDataFim] = useState<Date | undefined>(undefined);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const { data: servicos = [], isLoading } = useQuery({
    queryKey: ['servicos'],
    queryFn: async () => {
      const { data, error } = await fetchServicos();
      if (error) throw error;
      return data || [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await deleteServico(id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      toast.success("Serviço excluído com sucesso!");
    },
    onError: (error: any) => {
      toast.error(`Erro ao excluir: ${error.message}`);
    },
  });

  const handleEdit = (servico: any) => {
    setEditingServico(servico);
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setDeleteTargetId(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (deleteTargetId) {
      deleteMutation.mutate(deleteTargetId);
    }
    setDeleteConfirmOpen(false);
    setDeleteTargetId(null);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingServico(null);
  };

  const clearDateFilters = () => {
    setDataInicio(undefined);
    setDataFim(undefined);
  };

  // Filtros
  const filteredServicos = servicos.filter((s: any) => {
    const matchesSearch =
      s.nome_do_servico?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.dim_cliente?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.dim_propriedade?.nome_da_propriedade?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || s.situacao_do_servico === statusFilter;

    // Filtro por período de datas
    let matchesDateRange = true;
    if (dataInicio || dataFim) {
      const servicoInicio = s.data_do_servico_inicio ? startOfDay(new Date(s.data_do_servico_inicio)) : null;
      const servicoFim = s.data_do_servico_fim ? startOfDay(new Date(s.data_do_servico_fim)) : null;
      
      if (dataInicio && servicoInicio) {
        matchesDateRange = matchesDateRange && (isAfter(servicoInicio, dataInicio) || isEqual(servicoInicio, dataInicio));
      }
      if (dataFim && servicoFim) {
        matchesDateRange = matchesDateRange && (isBefore(servicoFim, dataFim) || isEqual(servicoFim, dataFim));
      }
    }

    return matchesSearch && matchesStatus && matchesDateRange;
  });

  // Pagination
  const pagination = usePagination(filteredServicos, { initialPageSize: 10 });

  // KPIs
  const totalServicos = servicos.length;
  const servicosConcluidos = servicos.filter((s: any) => s.situacao_do_servico === SERVICE_STATUS.CONCLUIDO).length;
  const servicosPendentes = servicos.filter((s: any) => s.situacao_do_servico === SERVICE_STATUS.PENDENTE).length;
  const servicosEmAndamento = servicos.filter((s: any) => isServiceInProgress(s.situacao_do_servico)).length;
  const mediaProgresso = totalServicos > 0 
    ? Math.round(servicos.reduce((acc: number, s: any) => acc + (s.progresso || 0), 0) / totalServicos) 
    : 0;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return format(new Date(dateStr), "dd/MM/yyyy", { locale: ptBR });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold text-foreground">Serviços</h1>
            <p className="text-muted-foreground">Acompanhe o andamento de todos os serviços</p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Serviço
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-4">
          <KPICard
            title="Total de Serviços"
            value={totalServicos.toString()}
            icon={Briefcase}
          />
          <KPICard
            title="Concluídos"
            value={servicosConcluidos.toString()}
            icon={CheckCircle2}
            change={totalServicos > 0 ? `${Math.round((servicosConcluidos / totalServicos) * 100)}%` : "0%"}
            changeType="positive"
          />
          <KPICard
            title="Em Andamento"
            value={servicosEmAndamento.toString()}
            icon={Clock}
          />
          <KPICard
            title="Média de Progresso"
            value={`${mediaProgresso}%`}
            icon={TrendingUp}
          />
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Lista de Serviços</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Input
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px] h-9 text-sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_STATUS_FILTER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "h-9 w-[130px] justify-start text-left font-normal text-sm",
                        !dataInicio && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                      {dataInicio ? format(dataInicio, "dd/MM/yy", { locale: ptBR }) : "Início"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dataInicio}
                      onSelect={setDataInicio}
                      initialFocus
                      locale={ptBR}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>

                <span className="text-xs text-muted-foreground">até</span>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "h-9 w-[130px] justify-start text-left font-normal text-sm",
                        !dataFim && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                      {dataFim ? format(dataFim, "dd/MM/yy", { locale: ptBR }) : "Fim"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dataFim}
                      onSelect={setDataFim}
                      initialFocus
                      locale={ptBR}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>

                {(dataInicio || dataFim) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={clearDateFilters}
                    className="h-8 w-8"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : filteredServicos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                Nenhum serviço encontrado.
              </div>
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
                    {pagination.paginatedData.map((servico: any) => (
                      <TableRow 
                        key={servico.id_servico} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/servicos/${servico.id_servico}`)}
                      >
                        <TableCell className="font-medium">{servico.nome_do_servico}</TableCell>
                        <TableCell>{servico.dim_cliente?.nome || "-"}</TableCell>
                        <TableCell>{servico.dim_propriedade?.nome_da_propriedade || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(servico.situacao_do_servico)}>
                            {servico.situacao_do_servico || "Pendente"}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(servico.data_do_servico_inicio)}</TableCell>
                        <TableCell>{formatDate(servico.data_do_servico_fim)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-[100px]">
                            <Progress value={servico.progresso || 0} className="h-2 flex-1" />
                            <span className="text-xs text-muted-foreground w-8">
                              {servico.progresso || 0}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate(`/servicos/${servico.id_servico}`)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(servico)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(servico.id_servico)}
                            >
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
          </CardContent>
        </Card>

        <NovoServicoDialog
          open={isDialogOpen}
          onOpenChange={handleCloseDialog}
          editingServico={editingServico}
        />

        <ConfirmDialog
          open={deleteConfirmOpen}
          onOpenChange={setDeleteConfirmOpen}
          title="Excluir serviço"
          description="Tem certeza que deseja excluir este serviço? Esta ação não pode ser desfeita."
          confirmLabel="Excluir"
          onConfirm={confirmDelete}
        />
      </div>
    </AppLayout>
  );
}
