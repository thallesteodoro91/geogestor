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
import { ClienteInfoCompact } from "@/components/cliente/ClienteInfoCompact";
import { ClienteKPIsCompact } from "@/components/cliente/ClienteKPIsCompact";
import { ClienteMapSection } from "@/components/cliente/ClienteMapSection";
import { ClientePropriedades } from "@/components/cliente/ClientePropriedades";
import { ClienteServicos } from "@/components/cliente/ClienteServicos";
import { ClienteOrcamentos } from "@/components/cliente/ClienteOrcamentos";
import { ClienteFinanceiro } from "@/components/cliente/ClienteFinanceiro";
import { ClienteCentralControle } from "@/components/cliente/ClienteCentralControle";
import { Skeleton } from "@/components/ui/skeleton";
import { ClienteDialog } from "@/components/cadastros/ClienteDialog";
import { PropriedadeDialog } from "@/components/cadastros/PropriedadeDialog";
import { ServicoDialog } from "@/components/cadastros/ServicoDialog";
import { OrcamentoDialog } from "@/components/cadastros/OrcamentoDialog";
import { useState, useRef } from "react";
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

  const [clienteDialogOpen, setClienteDialogOpen] = useState(false);
  const [propriedadeDialogOpen, setPropriedadeDialogOpen] = useState(false);
  const [servicoDialogOpen, setServicoDialogOpen] = useState(false);
  const [orcamentoDialogOpen, setOrcamentoDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("propriedades");

  const { data: cliente, isLoading: loadingCliente, refetch: refetchCliente } = useClienteDetalhes(id!);
  const { data: propriedades = [], isLoading: loadingPropriedades, refetch: refetchPropriedades } = useClientePropriedades(id!);
  const { data: servicos = [], isLoading: loadingServicos, refetch: refetchServicos } = useClienteServicos(id!);
  const { data: orcamentos = [], isLoading: loadingOrcamentos, refetch: refetchOrcamentos } = useClienteOrcamentos(id!);
  const { data: kpis, isLoading: loadingKPIs, refetch: refetchKPIs } = useClienteKPIs(id!);

  if (loadingCliente) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Skeleton className="h-[500px]" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-64" />
              <Skeleton className="h-32" />
            </div>
          </div>
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
      <div className="space-y-4">
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
          <Button variant="ghost" size="sm" onClick={() => navigate('/clientes')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setClienteDialogOpen(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPropriedadeDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Propriedade
            </Button>
            <Button variant="outline" size="sm" onClick={() => setServicoDialogOpen(true)}>
              <Wrench className="h-4 w-4 mr-2" />
              Serviço
            </Button>
            <Button size="sm" onClick={() => setOrcamentoDialogOpen(true)}>
              <FileText className="h-4 w-4 mr-2" />
              Orçamento
            </Button>
          </div>
        </div>

        {/* Main Layout: Map + Client Info */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Mapa - 2/3 da tela */}
          <div className="lg:col-span-2">
            <ClienteMapSection 
              propriedades={propriedades} 
              isLoading={loadingPropriedades} 
            />
          </div>

          {/* Info do Cliente + KPIs - 1/3 da tela */}
          <div className="flex flex-col gap-4">
            <ClienteInfoCompact 
              cliente={cliente} 
              onOpenCentralControle={() => setActiveTab("central")}
            />
            <ClienteKPIsCompact 
              kpis={kpis || { totalPropriedades: 0, servicosRealizados: 0, totalServicos: 0, orcamentosEmitidos: 0, receitaTotal: 0 }} 
              isLoading={loadingKPIs} 
            />
          </div>
        </div>

        {/* Tabs com detalhes */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
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

          <TabsContent value="propriedades" className="mt-4">
            {loadingPropriedades ? (
              <Skeleton className="h-64" />
            ) : (
              <ClientePropriedades propriedades={propriedades} />
            )}
          </TabsContent>

          <TabsContent value="servicos" className="mt-4">
            {loadingServicos ? (
              <Skeleton className="h-64" />
            ) : (
              <ClienteServicos servicos={servicos} />
            )}
          </TabsContent>

          <TabsContent value="orcamentos" className="mt-4">
            {loadingOrcamentos ? (
              <Skeleton className="h-64" />
            ) : (
              <ClienteOrcamentos orcamentos={orcamentos} />
            )}
          </TabsContent>

          {/* Central de Controle - acessível via botão no card */}
          <TabsContent value="central" className="mt-4">
            <ClienteCentralControle 
              clienteId={id!} 
              servicos={servicos}
              propriedades={propriedades}
            />
          </TabsContent>

          <TabsContent value="financeiro" className="mt-4">
            {loadingServicos || loadingOrcamentos ? (
              <Skeleton className="h-64" />
            ) : (
              <ClienteFinanceiro servicos={servicos} orcamentos={orcamentos} />
            )}
          </TabsContent>
        </Tabs>

        {/* Dialogs */}
        <ClienteDialog 
          open={clienteDialogOpen}
          onOpenChange={setClienteDialogOpen}
          cliente={cliente}
          onSuccess={() => {
            refetchCliente();
            refetchKPIs();
          }}
        />

        <PropriedadeDialog
          open={propriedadeDialogOpen}
          onOpenChange={setPropriedadeDialogOpen}
          onSuccess={() => {
            refetchPropriedades();
            refetchKPIs();
          }}
        />

        <ServicoDialog
          open={servicoDialogOpen}
          onOpenChange={setServicoDialogOpen}
          clienteId={id}
          onSuccess={() => {
            refetchServicos();
            refetchKPIs();
          }}
        />

        <OrcamentoDialog
          open={orcamentoDialogOpen}
          onOpenChange={setOrcamentoDialogOpen}
          clienteId={id}
          onSuccess={() => {
            refetchOrcamentos();
            refetchKPIs();
          }}
        />
      </div>
    </AppLayout>
  );
}
