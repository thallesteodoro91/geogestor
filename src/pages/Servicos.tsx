import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Edit, Briefcase, CheckCircle2, Clock, AlertCircle, Eye, TrendingUp } from "lucide-react";
import { KPICard } from "@/components/dashboard/KPICard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { NovoServicoDialog, ServicoFormData } from "@/components/servicos";
import { fetchServicos, deleteServico } from "@/modules/operations";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const statusOptions = [
  { value: "all", label: "Todos os Status" },
  { value: "Pendente", label: "Pendente" },
  { value: "Em andamento", label: "Em andamento" },
  { value: "Em revisão", label: "Em revisão" },
  { value: "Concluído", label: "Concluído" },
];

const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case "Concluído":
      return "default";
    case "Em andamento":
      return "secondary";
    case "Em revisão":
      return "outline";
    case "Pendente":
    default:
      return "destructive";
  }
};

export default function Servicos() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingServico, setEditingServico] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

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
    if (confirm("Tem certeza que deseja excluir este serviço?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingServico(null);
  };

  // Filtros
  const filteredServicos = servicos.filter((s: any) => {
    const matchesSearch =
      s.nome_do_servico?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.dim_cliente?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.dim_propriedade?.nome_da_propriedade?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || s.situacao_do_servico === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // KPIs
  const totalServicos = servicos.length;
  const servicosConcluidos = servicos.filter((s: any) => s.situacao_do_servico === "Concluído").length;
  const servicosPendentes = servicos.filter((s: any) => s.situacao_do_servico === "Pendente").length;
  const servicosEmAndamento = servicos.filter((s: any) => 
    s.situacao_do_servico === "Em andamento" || s.situacao_do_servico === "Em revisão"
  ).length;
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
          <CardHeader>
            <CardTitle>Lista de Serviços</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <Input
                placeholder="Buscar por nome, cliente ou propriedade..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                    {filteredServicos.map((servico: any) => (
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
              </div>
            )}
          </CardContent>
        </Card>

        <NovoServicoDialog
          open={isDialogOpen}
          onOpenChange={handleCloseDialog}
          editingServico={editingServico}
        />
      </div>
    </AppLayout>
  );
}
