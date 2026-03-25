import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarioMensal } from "@/components/calendario/CalendarioMensal";
import { CalendarioSemanal } from "@/components/calendario/CalendarioSemanal";
import { CalendarioDiario } from "@/components/calendario/CalendarioDiario";
import { CalendarioTabela } from "@/components/calendario/CalendarioTabela";
import { CompromissoDialog } from "@/components/calendario/CompromissoDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Calendar, List, Table, CalendarDays, Plus, Search, FileText, Briefcase, DollarSign, ClipboardList } from "lucide-react";
import { SERVICE_STATUS } from "@/constants/serviceStatus";
import { BUDGET_SITUATION } from "@/constants/budgetStatus";

const Calendario = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");

  // KPIs query
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
      const valorTotal = (orcamentos || []).reduce((acc, o) => acc + (o.valor_unitario * o.quantidade), 0) +
        (servicos || []).reduce((acc, s) => acc + (s.receita_servico || 0), 0);

      return { totalOrcamentos, totalServicos, orcamentosPendentes, servicosEmAndamento, valorTotal };
    },
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  return (
    <AppLayout>
      <div className="container mx-auto p-6 max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold">Calendário de Atividades</h1>
            </div>
            <p className="text-muted-foreground">
              Gerencie orçamentos, serviços e compromissos em um só lugar
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Compromisso
          </Button>
        </div>

        {/* KPIs */}
        {kpis && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-lg">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Orçamentos</p>
                <p className="text-xl font-bold">{kpis.totalOrcamentos}</p>
                <p className="text-xs text-muted-foreground">{kpis.orcamentosPendentes} pendentes</p>
              </div>
            </Card>
            <Card className="p-4 flex items-center gap-3">
              <div className="bg-[#246BCE]/10 p-2 rounded-lg">
                <Briefcase className="h-5 w-5 text-[#246BCE]" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Serviços</p>
                <p className="text-xl font-bold">{kpis.totalServicos}</p>
                <p className="text-xs text-muted-foreground">{kpis.servicosEmAndamento} em andamento</p>
              </div>
            </Card>
            <Card className="p-4 flex items-center gap-3">
              <div className="bg-emerald-500/10 p-2 rounded-lg">
                <ClipboardList className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total de Eventos</p>
                <p className="text-xl font-bold">{kpis.totalOrcamentos + kpis.totalServicos}</p>
              </div>
            </Card>
            <Card className="p-4 flex items-center gap-3">
              <div className="bg-amber-500/10 p-2 rounded-lg">
                <DollarSign className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Valor Total</p>
                <p className="text-lg font-bold">{formatCurrency(kpis.valorTotal)}</p>
              </div>
            </Card>
          </div>
        )}

        {/* Filtros Unificados */}
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente, serviço..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Tipos</SelectItem>
                <SelectItem value="orcamento">💰 Orçamentos</SelectItem>
                <SelectItem value="servico">🛠️ Serviços</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
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
          </div>
        </Card>

        <Tabs defaultValue="mensal" className="w-full">
          <TabsList className="grid w-full max-w-2xl grid-cols-4">
            <TabsTrigger value="mensal" className="gap-2">
              <Calendar className="h-4 w-4" />
              Mensal
            </TabsTrigger>
            <TabsTrigger value="semanal" className="gap-2">
              <List className="h-4 w-4" />
              Semanal
            </TabsTrigger>
            <TabsTrigger value="diario" className="gap-2">
              <CalendarDays className="h-4 w-4" />
              Diário
            </TabsTrigger>
            <TabsTrigger value="tabela" className="gap-2">
              <Table className="h-4 w-4" />
              Tabela
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mensal" className="mt-6">
            <CalendarioMensal busca={busca} filtroTipo={filtroTipo} filtroStatus={filtroStatus} />
          </TabsContent>

          <TabsContent value="semanal" className="mt-6">
            <CalendarioSemanal busca={busca} filtroTipo={filtroTipo} filtroStatus={filtroStatus} />
          </TabsContent>

          <TabsContent value="diario" className="mt-6">
            <CalendarioDiario />
          </TabsContent>

          <TabsContent value="tabela" className="mt-6">
            <CalendarioTabela busca={busca} filtroTipo={filtroTipo} filtroStatus={filtroStatus} />
          </TabsContent>
        </Tabs>

        <CompromissoDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      </div>
    </AppLayout>
  );
};

export default Calendario;
