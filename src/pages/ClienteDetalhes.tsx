import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Edit, Plus, FileText, Wrench } from "lucide-react";
import {
  useClienteDetalhes,
  useClientePropriedades,
  useClienteServicos,
  useClienteOrcamentos,
  useClienteKPIs,
} from "@/hooks/useClienteDetalhes";
import { ClienteInfoCard } from "@/components/cliente/ClienteInfoCard";
import { ClienteKPIs } from "@/components/cliente/ClienteKPIs";
import { ClientePropriedades } from "@/components/cliente/ClientePropriedades";
import { ClienteServicos } from "@/components/cliente/ClienteServicos";
import { ClienteOrcamentos } from "@/components/cliente/ClienteOrcamentos";
import { ClienteFinanceiro } from "@/components/cliente/ClienteFinanceiro";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export default function ClienteDetalhes() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: cliente, isLoading: loadingCliente } = useClienteDetalhes(id!);
  const { data: propriedades = [], isLoading: loadingPropriedades } = useClientePropriedades(id!);
  const { data: servicos = [], isLoading: loadingServicos } = useClienteServicos(id!);
  const { data: orcamentos = [], isLoading: loadingOrcamentos } = useClienteOrcamentos(id!);
  const { data: kpis, isLoading: loadingKPIs } = useClienteKPIs(id!);

  if (loadingCliente) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-64" />
        </div>
      </AppLayout>
    );
  }

  if (!cliente) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-4">Cliente não encontrado</h2>
          <Button onClick={() => navigate('/clientes')}>
            Voltar para lista de clientes
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/clientes">Base de Dados</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/clientes">Clientes</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{cliente.nome}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header with Actions */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/clientes')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Edit className="h-4 w-4 mr-2" />
              Editar Cliente
            </Button>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Nova Propriedade
            </Button>
            <Button variant="outline" size="sm">
              <Wrench className="h-4 w-4 mr-2" />
              Novo Serviço
            </Button>
            <Button size="sm">
              <FileText className="h-4 w-4 mr-2" />
              Novo Orçamento
            </Button>
          </div>
        </div>

        {/* Client Info */}
        <ClienteInfoCard cliente={cliente} />

        {/* KPIs */}
        <ClienteKPIs kpis={kpis || { totalPropriedades: 0, servicosRealizados: 0, totalServicos: 0, orcamentosEmitidos: 0, receitaTotal: 0 }} isLoading={loadingKPIs} />

        {/* Tabs */}
        <Tabs defaultValue="propriedades" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="propriedades">
              Propriedades ({propriedades.length})
            </TabsTrigger>
            <TabsTrigger value="servicos">
              Serviços ({servicos.length})
            </TabsTrigger>
            <TabsTrigger value="orcamentos">
              Orçamentos ({orcamentos.length})
            </TabsTrigger>
            <TabsTrigger value="financeiro">
              Resumo Financeiro
            </TabsTrigger>
          </TabsList>

          <TabsContent value="propriedades" className="mt-6">
            {loadingPropriedades ? (
              <Skeleton className="h-64" />
            ) : (
              <ClientePropriedades propriedades={propriedades} />
            )}
          </TabsContent>

          <TabsContent value="servicos" className="mt-6">
            {loadingServicos ? (
              <Skeleton className="h-64" />
            ) : (
              <ClienteServicos servicos={servicos} />
            )}
          </TabsContent>

          <TabsContent value="orcamentos" className="mt-6">
            {loadingOrcamentos ? (
              <Skeleton className="h-64" />
            ) : (
              <ClienteOrcamentos orcamentos={orcamentos} />
            )}
          </TabsContent>

          <TabsContent value="financeiro" className="mt-6">
            {loadingServicos || loadingOrcamentos ? (
              <Skeleton className="h-64" />
            ) : (
              <ClienteFinanceiro servicos={servicos} orcamentos={orcamentos} />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
