import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { FilterBar } from "@/components/layout/FilterBar";
import { ContextualKPIs } from "@/components/layout/ContextualKPIs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarioMensal } from "@/components/calendario/CalendarioMensal";
import { CalendarioSemanal } from "@/components/calendario/CalendarioSemanal";
import { CalendarioDiario } from "@/components/calendario/CalendarioDiario";
import { CalendarioTabela } from "@/components/calendario/CalendarioTabela";
import { CompromissoDialog } from "@/components/calendario/CompromissoDialog";
import { UpcomingSyncedCard } from "@/components/calendario/UpcomingSyncedCard";
import { ConflictsCard } from "@/components/calendario/ConflictsCard";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, List, Table, CalendarDays, Plus, Briefcase, FileText } from "lucide-react";
import { SERVICE_STATUS } from "@/constants/serviceStatus";
import { BUDGET_SITUATION } from "@/constants/budgetStatus";

const Calendario = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");

  const { data: kpis } = useQuery({
    queryKey: ["calendario-kpis"],
    queryFn: async () => {
      const { data: orcamentos } = await supabase
        .from("fato_orcamento")
        .select("id_orcamento, situacao, valor_unitario, quantidade");
      const { data: servicos } = await supabase
        .from("fato_servico")
        .select("id_servico, situacao_do_servico, receita_servico");

      const totalOrcamentos = orcamentos?.length || 0;
      const totalServicos = servicos?.length || 0;
      const orcamentosPendentes = orcamentos?.filter(o =>
        o.situacao === BUDGET_SITUATION.PENDENTE ||
        o.situacao === BUDGET_SITUATION.EM_ANALISE ||
        o.situacao === BUDGET_SITUATION.EM_NEGOCIACAO
      ).length || 0;
      const servicosEmAndamento = servicos?.filter(s =>
        s.situacao_do_servico === SERVICE_STATUS.EM_ANDAMENTO
      ).length || 0;

      return { totalOrcamentos, totalServicos, orcamentosPendentes, servicosEmAndamento };
    },
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader title="Calendário de Atividades" subtitle="Gerencie orçamentos, serviços e compromissos em um só lugar">
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Compromisso
          </Button>
        </PageHeader>

        {kpis && (
          <ContextualKPIs
            items={[
              { label: "Total de Eventos", value: kpis.totalOrcamentos + kpis.totalServicos, icon: CalendarDays },
              { label: "Em Andamento", value: kpis.servicosEmAndamento, icon: Briefcase, iconColor: "text-amber-600", iconBg: "bg-amber-500/10" },
              { label: "Pendentes", value: kpis.orcamentosPendentes, icon: FileText, iconColor: "text-blue-600", iconBg: "bg-blue-500/10" },
            ]}
          />
        )}

        <FilterBar searchValue={busca} onSearchChange={setBusca} searchPlaceholder="Buscar por cliente, serviço...">
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Tipos</SelectItem>
              <SelectItem value="orcamento">💰 Orçamentos</SelectItem>
              <SelectItem value="servico">🛠️ Serviços</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Status</SelectItem>
              <SelectItem value="Pendente">Pendente</SelectItem>
              <SelectItem value="Aprovado">Aprovado</SelectItem>
              <SelectItem value="Em Andamento">Em Andamento</SelectItem>
              <SelectItem value="Concluído">Concluído</SelectItem>
              <SelectItem value="Cancelado">Cancelado</SelectItem>
              <SelectItem value="Agendado">Agendado</SelectItem>
            </SelectContent>
          </Select>
        </FilterBar>

        <div className="grid gap-4 md:grid-cols-2">
          <UpcomingSyncedCard />
          <ConflictsCard />
        </div>

        <Tabs defaultValue="mensal" className="w-full">
          <TabsList className="grid w-full max-w-2xl grid-cols-4">
            <TabsTrigger value="mensal" className="gap-2"><Calendar className="h-4 w-4" />Mensal</TabsTrigger>
            <TabsTrigger value="semanal" className="gap-2"><List className="h-4 w-4" />Semanal</TabsTrigger>
            <TabsTrigger value="diario" className="gap-2"><CalendarDays className="h-4 w-4" />Diário</TabsTrigger>
            <TabsTrigger value="tabela" className="gap-2"><Table className="h-4 w-4" />Tabela</TabsTrigger>
          </TabsList>
          <TabsContent value="mensal" className="mt-6"><CalendarioMensal busca={busca} filtroTipo={filtroTipo} filtroStatus={filtroStatus} /></TabsContent>
          <TabsContent value="semanal" className="mt-6"><CalendarioSemanal busca={busca} filtroTipo={filtroTipo} filtroStatus={filtroStatus} /></TabsContent>
          <TabsContent value="diario" className="mt-6"><CalendarioDiario busca={busca} filtroTipo={filtroTipo} filtroStatus={filtroStatus} /></TabsContent>
          <TabsContent value="tabela" className="mt-6"><CalendarioTabela busca={busca} filtroTipo={filtroTipo} filtroStatus={filtroStatus} /></TabsContent>
        </Tabs>

        <CompromissoDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      </div>
    </AppLayout>
  );
};

export default Calendario;
