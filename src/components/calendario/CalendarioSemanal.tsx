import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, startOfWeek, endOfWeek, addWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, MapPin, User, Briefcase, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { SERVICE_STATUS, getServiceStatusBadgeClasses } from "@/constants/serviceStatus";
import { BUDGET_SITUATION, getBudgetSituationBadgeClass } from "@/constants/budgetStatus";

interface CalendarioSemanalProps {
  busca?: string;
  filtroTipo?: string;
  filtroStatus?: string;
}

export const CalendarioSemanal = ({ busca = "", filtroTipo = "todos", filtroStatus = "todos" }: CalendarioSemanalProps) => {
  const navigate = useNavigate();
  const [semanaOffset, setSemanaOffset] = useState(0);

  const semanaBase = addWeeks(new Date(), semanaOffset);
  const inicioSemana = startOfWeek(semanaBase, { locale: ptBR });
  const fimSemana = endOfWeek(semanaBase, { locale: ptBR });

  const { data: eventos = [], isLoading } = useQuery({
    queryKey: ["calendario-semanal", semanaOffset],
    queryFn: async () => {
      const inicioStr = format(inicioSemana, "yyyy-MM-dd");
      const fimStr = format(fimSemana, "yyyy-MM-dd");

      const { data: orcamentos } = await supabase
        .from("fato_orcamento")
        .select(`*, cliente:dim_cliente!fk_orcamento_cliente(nome, endereco), servico:fato_servico!fk_orcamento_servico(nome_do_servico, categoria), propriedade:dim_propriedade!fk_orcamento_propriedade(nome_da_propriedade, municipio)`)
        .gte("data_inicio", inicioStr)
        .lte("data_inicio", fimStr);

      const { data: servicos } = await supabase
        .from("fato_servico")
        .select(`*, cliente:dim_cliente!fk_servico_cliente(nome, endereco), propriedade:dim_propriedade!fk_servico_propriedade(nome_da_propriedade, municipio)`)
        .gte("data_do_servico_inicio", inicioStr)
        .lte("data_do_servico_inicio", fimStr);

      return [
        ...(orcamentos || []).map((orc) => ({
          id: `orc-${orc.id_orcamento}`,
          tipo: "orcamento" as const,
          data: new Date(orc.data_inicio!),
          titulo: orc.servico?.nome_do_servico || "Orçamento",
          cliente: orc.cliente?.nome || "Cliente",
          propriedade: orc.propriedade?.nome_da_propriedade || "-",
          municipio: orc.propriedade?.municipio || "-",
          status: orc.situacao || BUDGET_SITUATION.PENDENTE,
          categoria: orc.servico?.categoria || "Geral",
        })),
        ...(servicos || []).map((srv) => ({
          id: `srv-${srv.id_servico}`,
          tipo: "servico" as const,
          data: new Date(srv.data_do_servico_inicio!),
          titulo: srv.nome_do_servico,
          cliente: srv.cliente?.nome || "Cliente",
          propriedade: srv.propriedade?.nome_da_propriedade || "-",
          municipio: srv.propriedade?.municipio || "-",
          status: srv.situacao_do_servico === SERVICE_STATUS.PLANEJADO ? "Agendado" : (srv.situacao_do_servico || "Agendado"),
          categoria: srv.categoria || "Geral",
        })),
      ].sort((a, b) => a.data.getTime() - b.data.getTime());
    },
  });

  const eventosFiltrados = eventos.filter((evento) => {
    const matchBusca = !busca || Object.values(evento).some(v => String(v).toLowerCase().includes(busca.toLowerCase()));
    const matchTipo = filtroTipo === "todos" || evento.tipo === filtroTipo;
    const matchStatus = filtroStatus === "todos" || evento.status === filtroStatus;
    return matchBusca && matchTipo && matchStatus;
  });

  const getStatusColor = (status: string, tipo: string) => {
    return tipo === "orcamento" ? getBudgetSituationBadgeClass(status) : getServiceStatusBadgeClasses(status);
  };

  const getTipoIcon = (tipo: string) => tipo === "orcamento" ? "💰" : "🛠️";

  return (
    <div className="space-y-6">
      {/* Navegação de Semana */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <Button variant="outline" size="icon" onClick={() => setSemanaOffset(s => s - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">
              {format(inicioSemana, "dd/MM", { locale: ptBR })} — {format(fimSemana, "dd/MM/yyyy", { locale: ptBR })}
            </h2>
            {semanaOffset !== 0 && (
              <Button variant="outline" size="sm" onClick={() => setSemanaOffset(0)}>
                Esta semana
              </Button>
            )}
          </div>
          <Button variant="outline" size="icon" onClick={() => setSemanaOffset(s => s + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      {/* Lista de Eventos */}
      <div className="space-y-4">
        {eventosFiltrados.map((evento) => (
          <Card
            key={evento.id}
            className={cn(
              "p-6 hover:shadow-lg transition-shadow cursor-pointer",
              evento.tipo === "servico" && "border-l-4 border-l-[#246BCE]"
            )}
            onClick={() => {
              const separatorIndex = evento.id.indexOf("-");
              const tipo = evento.id.substring(0, separatorIndex);
              const id = evento.id.substring(separatorIndex + 1);
              navigate(`/calendario/${tipo}/${id}`);
            }}
            title={`${evento.cliente} • ${evento.propriedade} • ${evento.municipio}`}
          >
            <div className="flex items-start justify-between">
              <div className="space-y-3 flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <Badge className={evento.tipo === "servico" ? "bg-[#246BCE] text-white" : getStatusColor(evento.status, evento.tipo)}>
                    {evento.status}
                  </Badge>
                  <Badge variant="outline" className={cn("gap-1", evento.tipo === "servico" && "bg-[#246BCE]/10 text-[#246BCE] border-[#246BCE]")}>
                    {getTipoIcon(evento.tipo)} {evento.tipo === "orcamento" ? "Orçamento" : "Serviço"}
                  </Badge>
                  <Badge variant="secondary">{evento.categoria}</Badge>
                </div>

                <h3 className="text-xl font-semibold flex items-center gap-2">
                  {getTipoIcon(evento.tipo)} {evento.titulo}
                </h3>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {format(evento.data, "dd/MM/yyyy - HH:mm", { locale: ptBR })}
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {evento.cliente}
                  </div>
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    {evento.propriedade}
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {evento.municipio}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ))}

        {eventosFiltrados.length === 0 && (
          <EmptyState
            icon={Calendar}
            title="Sua agenda está livre"
            description="Crie serviços ou orçamentos com datas para vê-los aqui automaticamente."
            actionLabel="+ Novo Compromisso"
            onAction={() => navigate("/servicos")}
          />
        )}
      </div>
    </div>
  );
};
