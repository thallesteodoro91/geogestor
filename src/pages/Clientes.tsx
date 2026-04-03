import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TablePagination } from "@/components/ui/table-pagination";
import { usePagination } from "@/hooks/usePagination";
import { ClientePropriedadeUnificadoDialog } from "@/components/cadastros/ClientePropriedadeUnificadoDialog";
import { toast } from "sonner";
import { Plus, Users, Eye, Edit, Trash2, MapPin, Search, Briefcase } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function Clientes() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [situacaoFilter, setSituacaoFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState<{ open: boolean; data?: any }>({ open: false });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ["clientes-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dim_cliente")
        .select(`
          *,
          dim_propriedade(id_propriedade, nome_da_propriedade),
          fato_servico(id_servico, situacao_do_servico)
        `)
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dim_cliente").delete().eq("id_cliente", id);
      if (error) {
        if (error.code === "23503") throw new Error("Este cliente possui serviços ou propriedades vinculados. Remova as dependências antes.");
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes-list"] });
      toast.success("Cliente excluído com sucesso!");
    },
    onError: (error: any) => toast.error(error.message),
  });

  const filtered = clientes.filter((c: any) => {
    const matchesSearch =
      c.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.cpf?.includes(searchTerm) ||
      c.cnpj?.includes(searchTerm);
    const matchesSituacao = situacaoFilter === "all" || c.situacao === situacaoFilter;
    return matchesSearch && matchesSituacao;
  });

  const pagination = usePagination(filtered, { initialPageSize: 15 });

  const getServicosAtivos = (cliente: any) =>
    (cliente.fato_servico || []).filter((s: any) => s.situacao_do_servico === "Em Andamento" || s.situacao_do_servico === "Planejado").length;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold text-foreground">Clientes e Projetos</h1>
            <p className="text-muted-foreground">Gerencie seus clientes e acompanhe projetos</p>
          </div>
          <Button onClick={() => setDialogOpen({ open: true })}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Cliente
          </Button>
        </div>

        {/* Content */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Lista de Clientes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, CPF, e-mail..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
              <Select value={situacaoFilter} onValueChange={setSituacaoFilter}>
                <SelectTrigger className="w-[140px] h-9 text-sm">
                  <SelectValue placeholder="Situação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="Ativo">Ativo</SelectItem>
                  <SelectItem value="Inativo">Inativo</SelectItem>
                  <SelectItem value="Prospecto">Prospecto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : filtered.length === 0 && !searchTerm && situacaoFilter === "all" ? (
              <EmptyState
                icon={Users}
                title="Nenhum cliente cadastrado"
                description="Cadastre seus clientes para organizar projetos, orçamentos e acompanhar o relacionamento."
                actionLabel="+ Novo Cliente"
                onAction={() => setDialogOpen({ open: true })}
                tip="Você pode importar clientes via CSV em Configurações"
              />
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Nenhum cliente encontrado para os filtros aplicados.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF/CNPJ</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Propriedades</TableHead>
                      <TableHead>Serviços Ativos</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagination.paginatedData.map((cliente: any) => {
                      const propCount = (cliente.dim_propriedade || []).length;
                      const servicosAtivos = getServicosAtivos(cliente);
                      return (
                        <TableRow
                          key={cliente.id_cliente}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/clientes/${cliente.id_cliente}`)}
                        >
                          <TableCell className="font-medium">{cliente.nome}</TableCell>
                          <TableCell className="text-sm">{cliente.cpf || cliente.cnpj || "-"}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {cliente.email && <div>{cliente.email}</div>}
                              {cliente.telefone && <div className="text-muted-foreground">{cliente.telefone}</div>}
                              {!cliente.email && !cliente.telefone && "-"}
                            </div>
                          </TableCell>
                          <TableCell>
                            {propCount > 0 ? (
                              <Badge variant="secondary" className="gap-1">
                                <MapPin className="h-3 w-3" />
                                {propCount}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {servicosAtivos > 0 ? (
                              <Badge variant="default" className="gap-1">
                                <Briefcase className="h-3 w-3" />
                                {servicosAtivos}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {cliente.situacao ? (
                              <Badge
                                variant={cliente.situacao === "Ativo" ? "default" : "secondary"}
                                className={
                                  cliente.situacao === "Ativo"
                                    ? "bg-green-500/20 text-green-700 dark:text-green-400 hover:bg-green-500/30"
                                    : cliente.situacao === "Inativo"
                                    ? "bg-red-500/20 text-red-700 dark:text-red-400 hover:bg-red-500/30"
                                    : ""
                                }
                              >
                                {cliente.situacao}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" onClick={() => navigate(`/clientes/${cliente.id_cliente}`)} title="Ver detalhes">
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => setDialogOpen({ open: true, data: cliente })} title="Editar">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setDeleteTargetId(cliente.id_cliente);
                                  setDeleteConfirmOpen(true);
                                }}
                                title="Excluir"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
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

        {/* Dialogs */}
        <ClientePropriedadeUnificadoDialog
          open={dialogOpen.open}
          onOpenChange={(open) => setDialogOpen({ open })}
          cliente={dialogOpen.data}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["clientes-list"] });
            setDialogOpen({ open: false });
          }}
        />

        <ConfirmDialog
          open={deleteConfirmOpen}
          onOpenChange={setDeleteConfirmOpen}
          title="Excluir cliente"
          description="Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita."
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
