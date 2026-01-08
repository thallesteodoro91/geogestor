import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  ArrowLeft, 
  Calendar, 
  MapPin, 
  User, 
  Edit,
  CheckCircle2,
  Clock,
  AlertCircle
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  TarefasList, 
  EquipeList, 
  AnexosList, 
  EventosTimeline,
  NovoServicoDialog 
} from "@/components/servicos";
import { fetchServicoById } from "@/modules/operations";
import { SERVICE_STATUS, getStatusBadgeVariant, isServiceInProgress } from "@/constants/serviceStatus";

const getStatusIcon = (status: string) => {
  switch (status) {
    case SERVICE_STATUS.CONCLUIDO:
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case SERVICE_STATUS.EM_ANDAMENTO:
    case SERVICE_STATUS.EM_REVISAO:
      return <Clock className="h-5 w-5 text-amber-500" />;
    case SERVICE_STATUS.PENDENTE:
    default:
      return <AlertCircle className="h-5 w-5 text-red-500" />;
  }
};

export default function ServicoDetalhes() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const { data: servico, isLoading, error } = useQuery({
    queryKey: ['servico', id],
    queryFn: async () => {
      if (!id) throw new Error("ID do serviço não informado");
      const { data, error } = await fetchServicoById(id);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return format(new Date(dateStr), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (error || !servico) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h2 className="text-xl font-semibold mb-2">Serviço não encontrado</h2>
          <p className="text-muted-foreground mb-4">O serviço solicitado não existe ou foi removido.</p>
          <Button onClick={() => navigate("/servicos")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Serviços
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/servicos")}
              className="mb-2"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div className="flex items-center gap-3">
              {getStatusIcon(servico.situacao_do_servico || "Pendente")}
              <h1 className="text-3xl font-heading font-bold text-foreground">
                {servico.nome_do_servico}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
              <Badge variant={getStatusBadgeVariant(servico.situacao_do_servico || "Pendente")}>
                {servico.situacao_do_servico || "Pendente"}
              </Badge>
              {servico.categoria && (
                <Badge variant="outline">{servico.categoria}</Badge>
              )}
            </div>
          </div>
          <Button onClick={() => setIsEditDialogOpen(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Editar Serviço
          </Button>
        </div>

        {/* Info Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <User className="h-4 w-4" />
                Cliente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">
                {servico.dim_cliente?.nome || "Não informado"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Propriedade
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">
                {servico.dim_propriedade?.nome_da_propriedade || "Não informada"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Período
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                <span className="font-medium">Início:</span> {formatDate(servico.data_do_servico_inicio)}
              </p>
              <p className="text-sm">
                <span className="font-medium">Prazo:</span> {formatDate(servico.data_do_servico_fim)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Progresso do Serviço</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Progress value={servico.progresso || 0} className="flex-1 h-3" />
              <span className="text-2xl font-bold text-primary">
                {servico.progresso || 0}%
              </span>
            </div>
            {servico.descricao && (
              <p className="mt-4 text-muted-foreground">{servico.descricao}</p>
            )}
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="tarefas" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="tarefas">Tarefas</TabsTrigger>
            <TabsTrigger value="equipe">Equipe</TabsTrigger>
            <TabsTrigger value="anexos">Anexos</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="tarefas" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Checklist de Tarefas</CardTitle>
              </CardHeader>
              <CardContent>
                <TarefasList servicoId={id!} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="equipe" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Equipe Designada</CardTitle>
              </CardHeader>
              <CardContent>
                <EquipeList servicoId={id!} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="anexos" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Anexos e Documentos</CardTitle>
              </CardHeader>
              <CardContent>
                <AnexosList servicoId={id!} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="historico" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Linha do Tempo</CardTitle>
              </CardHeader>
              <CardContent>
                <EventosTimeline servicoId={id!} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <NovoServicoDialog
          open={isEditDialogOpen}
          onOpenChange={() => setIsEditDialogOpen(false)}
          editingServico={servico}
        />
      </div>
    </AppLayout>
  );
}
