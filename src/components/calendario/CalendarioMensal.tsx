import { useState } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "./calendario-custom.css";

const locales = {
  "pt-BR": ptBR,
};

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
  };
}

export const CalendarioMensal = () => {
  const navigate = useNavigate();
  const [date, setDate] = useState(new Date());

  const { data: eventos = [], isLoading } = useQuery({
    queryKey: ["calendario-eventos"],
    queryFn: async () => {
      // Buscar orçamentos
      const { data: orcamentos } = await supabase
        .from("fato_orcamento")
        .select(`
          *,
          cliente:dim_cliente(nome),
          servico:fato_servico(nome_do_servico, categoria)
        `);

      // Buscar serviços
      const { data: servicos } = await supabase
        .from("fato_servico")
        .select(`
          *,
          cliente:dim_cliente(nome)
        `);

      const events: CalendarEvent[] = [];

      // Adicionar orçamentos ao calendário
      orcamentos?.forEach((orc) => {
        if (orc.data_inicio) {
          events.push({
            id: `orc-${orc.id_orcamento}`,
            title: `💰 ${orc.cliente?.nome || "Cliente"} - ${orc.servico?.nome_do_servico || "Orçamento"}`,
            start: new Date(orc.data_inicio),
            end: orc.data_termino ? new Date(orc.data_termino) : new Date(orc.data_inicio),
            resource: {
              tipo: "orcamento",
              status: orc.situacao || "Pendente",
              cliente: orc.cliente?.nome || "Cliente",
              categoria: orc.servico?.categoria || "Geral",
            },
          });
        }
      });

      // Adicionar serviços ao calendário
      servicos?.forEach((srv) => {
        if (srv.data_do_servico_inicio) {
          events.push({
            id: `srv-${srv.id_servico}`,
            title: `🔧 ${srv.cliente?.nome || "Cliente"} - ${srv.nome_do_servico}`,
            start: new Date(srv.data_do_servico_inicio),
            end: srv.data_do_servico_fim ? new Date(srv.data_do_servico_fim) : new Date(srv.data_do_servico_inicio),
            resource: {
              tipo: "servico",
              status: srv.situacao_do_servico || "Em andamento",
              cliente: srv.cliente?.nome || "Cliente",
              categoria: srv.categoria || "Geral",
            },
          });
        }
      });

      return events;
    },
  });

  const eventStyleGetter = (event: CalendarEvent) => {
    const { status, categoria } = event.resource;
    
    let backgroundColor = "hsl(var(--primary))";
    
    // Cores por categoria
    if (categoria?.toLowerCase().includes("topografia")) {
      backgroundColor = "hsl(217, 91%, 60%)"; // Azul
    } else if (categoria?.toLowerCase().includes("georreferenciamento")) {
      backgroundColor = "hsl(142, 71%, 45%)"; // Verde
    } else if (categoria?.toLowerCase().includes("projeto")) {
      backgroundColor = "hsl(280, 65%, 60%)"; // Roxo
    }

    // Status cancelado
    if (status?.toLowerCase().includes("cancelado")) {
      backgroundColor = "hsl(0, 72%, 51%)";
    }

    return {
      style: {
        backgroundColor,
        borderRadius: "4px",
        opacity: 0.9,
        color: "white",
        border: "0px",
        display: "block",
      },
    };
  };

  const handleSelectEvent = (event: CalendarEvent) => {
    const [tipo, id] = event.id.split("-");
    navigate(`/calendario/${tipo}/${id}`);
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-[600px] w-full" />
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <Calendar
        localizer={localizer}
        events={eventos}
        startAccessor="start"
        endAccessor="end"
        style={{ height: 600 }}
        onSelectEvent={handleSelectEvent}
        eventPropGetter={eventStyleGetter}
        date={date}
        onNavigate={setDate}
        messages={{
          next: "Próximo",
          previous: "Anterior",
          today: "Hoje",
          month: "Mês",
          week: "Semana",
          day: "Dia",
          agenda: "Agenda",
          date: "Data",
          time: "Hora",
          event: "Evento",
          noEventsInRange: "Não há eventos neste período",
          showMore: (total) => `+ ${total} mais`,
        }}
        culture="pt-BR"
      />
    </Card>
  );
};
