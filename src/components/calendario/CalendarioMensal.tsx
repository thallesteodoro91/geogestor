import { useState } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SERVICE_STATUS, SERVICE_STATUS_COLORS } from "@/constants/serviceStatus";
import { BUDGET_SITUATION, BUDGET_SITUATION_COLORS } from "@/constants/budgetStatus";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "./calendario-custom.css";

const locales = { "pt-BR": ptBR };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { locale: ptBR }),
  getDay,
  locales,
});

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: {
    tipo: "orcamento" | "servico";
    status: string;
    cliente: string;
    categoria: string;
    propriedade?: string;
    municipio?: string;
  };
}

const LEGENDA_ITEMS = [
  { cor: "#246BCE", label: "🛠️ Serviço" },
  { cor: BUDGET_SITUATION_COLORS.APROVADO.bg, label: "✓ Aprovado" },
  { cor: BUDGET_SITUATION_COLORS.PENDENTE.bg, label: "⏱ Pendente", textDark: true },
  { cor: SERVICE_STATUS_COLORS.EM_ANDAMENTO.bg, label: "⟳ Em Andamento" },
  { cor: SERVICE_STATUS_COLORS.CANCELADO.bg, label: "✕ Cancelado" },
];

interface CalendarioMensalProps {
  busca?: string;
  filtroTipo?: string;
  filtroStatus?: string;
}

export const CalendarioMensal = ({ busca = "", filtroTipo = "todos", filtroStatus = "todos" }: CalendarioMensalProps) => {
  const navigate = useNavigate();
  const [date, setDate] = useState(new Date());

  const { data: eventos = [], isLoading } = useQuery({
    queryKey: ["calendario-eventos"],
    queryFn: async () => {
      const { data: orcamentos } = await supabase
        .from("fato_orcamento")
        .select(`*, cliente:dim_cliente!fk_orcamento_cliente(nome), servico:fato_servico!fk_orcamento_servico(nome_do_servico, categoria)`);

      const { data: servicos } = await supabase
        .from("fato_servico")
        .select(`*, cliente:dim_cliente!fk_servico_cliente(nome), propriedade:dim_propriedade!fk_servico_propriedade(nome_da_propriedade, municipio)`);

      const events: CalendarEvent[] = [];

      orcamentos?.forEach((orc) => {
        if (orc.data_inicio) {
          events.push({
            id: `orc-${orc.id_orcamento}`,
            title: `💰 ${orc.cliente?.nome || "Cliente"} - ${orc.servico?.nome_do_servico || "Orçamento"}`,
            start: new Date(orc.data_inicio),
            end: orc.data_termino ? new Date(orc.data_termino) : new Date(orc.data_inicio),
            resource: {
              tipo: "orcamento",
              status: orc.situacao || BUDGET_SITUATION.PENDENTE,
              cliente: orc.cliente?.nome || "Cliente",
              categoria: orc.servico?.categoria || "Geral",
            },
          });
        }
      });

      servicos?.forEach((srv) => {
        if (srv.data_do_servico_inicio) {
          const status = srv.situacao_do_servico === SERVICE_STATUS.PLANEJADO ? "Agendado" : (srv.situacao_do_servico || "Agendado");
          events.push({
            id: `srv-${srv.id_servico}`,
            title: `🛠️ ${srv.nome_do_servico}`,
            start: new Date(srv.data_do_servico_inicio),
            end: srv.data_do_servico_fim ? new Date(srv.data_do_servico_fim) : new Date(srv.data_do_servico_inicio),
            resource: {
              tipo: "servico",
              status,
              cliente: srv.cliente?.nome || "Cliente",
              categoria: srv.categoria || "Geral",
              propriedade: srv.propriedade?.nome_da_propriedade || "-",
              municipio: srv.propriedade?.municipio || "-",
            },
          });
        }
      });

      return events;
    },
  });

  // Apply filters
  const eventosFiltrados = eventos.filter((event) => {
    const matchBusca = !busca || event.title.toLowerCase().includes(busca.toLowerCase()) || event.resource.cliente.toLowerCase().includes(busca.toLowerCase());
    const matchTipo = filtroTipo === "todos" || event.resource.tipo === filtroTipo;
    const matchStatus = filtroStatus === "todos" || event.resource.status === filtroStatus;
    return matchBusca && matchTipo && matchStatus;
  });

  const eventStyleGetter = (event: CalendarEvent) => {
    const { status, tipo } = event.resource;
    
    if (tipo === "servico") {
      return {
        style: {
          background: "linear-gradient(135deg, #246BCE 0%, #1a5299 100%)",
          borderRadius: "6px", opacity: 0.95, color: "white", border: "0px",
          borderLeft: "4px solid #1e88e5", display: "block", padding: "4px 8px",
          fontWeight: "600", fontSize: "0.85rem", boxShadow: "0 2px 4px rgba(36, 107, 206, 0.3)",
        },
      };
    }
    
    let backgroundColor = "hsl(var(--primary))";
    
    if (status === BUDGET_SITUATION.CANCELADO || status === SERVICE_STATUS.CANCELADO) {
      backgroundColor = `linear-gradient(135deg, ${SERVICE_STATUS_COLORS.CANCELADO.bg} 0%, ${SERVICE_STATUS_COLORS.CANCELADO.bgHover} 100%)`;
    } else if (status === SERVICE_STATUS.CONCLUIDO || status === BUDGET_SITUATION.APROVADO) {
      backgroundColor = `linear-gradient(135deg, ${BUDGET_SITUATION_COLORS.APROVADO.bg} 0%, ${BUDGET_SITUATION_COLORS.APROVADO.bgHover} 100%)`;
    } else if (status === SERVICE_STATUS.EM_ANDAMENTO) {
      backgroundColor = `linear-gradient(135deg, ${SERVICE_STATUS_COLORS.EM_ANDAMENTO.bg} 0%, ${SERVICE_STATUS_COLORS.EM_ANDAMENTO.bgHover} 100%)`;
    } else if (status === SERVICE_STATUS.EM_REVISAO) {
      backgroundColor = `linear-gradient(135deg, ${SERVICE_STATUS_COLORS.EM_REVISAO.bg} 0%, ${SERVICE_STATUS_COLORS.EM_REVISAO.bgHover} 100%)`;
    }

    return {
      style: {
        background: backgroundColor, borderRadius: "6px", opacity: 0.95, color: "white",
        border: "0px", borderLeft: "4px solid #fbbf24", display: "block", padding: "4px 8px",
        fontWeight: "600", fontSize: "0.85rem", boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
      },
    };
  };

  const handleSelectEvent = (event: CalendarEvent) => {
    const separatorIndex = event.id.indexOf("-");
    const tipo = event.id.substring(0, separatorIndex);
    const id = event.id.substring(separatorIndex + 1);
    navigate(`/calendario/${tipo}/${id}`);
  };

  if (isLoading) {
    return <Card className="p-6"><Skeleton className="h-[600px] w-full" /></Card>;
  }

  const eventTooltip = (event: CalendarEvent) => {
    const { cliente, propriedade, municipio } = event.resource;
    return `${cliente} • ${propriedade} • ${municipio}`;
  };

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <Calendar
          localizer={localizer}
          events={eventos}
          startAccessor="start"
          endAccessor="end"
          style={{ height: 600 }}
          onSelectEvent={handleSelectEvent}
          eventPropGetter={eventStyleGetter}
          tooltipAccessor={eventTooltip}
          date={date}
          onNavigate={setDate}
          messages={{
            next: "Próximo", previous: "Anterior", today: "Hoje",
            month: "Mês", week: "Semana", day: "Dia", agenda: "Agenda",
            date: "Data", time: "Hora", event: "Evento",
            noEventsInRange: "Não há eventos neste período",
            showMore: (total) => `+ ${total} mais`,
          }}
          culture="pt-BR"
        />
      </Card>

      {/* Legenda de cores */}
      <div className="flex flex-wrap items-center gap-3 px-2">
        <span className="text-sm font-medium text-muted-foreground">Legenda:</span>
        {LEGENDA_ITEMS.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: item.cor }}
            />
            <span className="text-xs text-muted-foreground">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
