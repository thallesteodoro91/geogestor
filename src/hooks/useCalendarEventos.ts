import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SERVICE_STATUS } from "@/constants/serviceStatus";
import { BUDGET_SITUATION } from "@/constants/budgetStatus";

export type EventoUnificado = {
  id: string;
  tipo: "orcamento" | "servico" | "externo";
  titulo: string;
  start: Date;
  end: Date;
  cliente?: string;
  propriedade?: string;
  municipio?: string;
  status?: string;
  categoria?: string;
  origem: "skygeo" | "google";
  htmlLink?: string;
};

export function useCalendarEventos(rangeStart?: Date, rangeEnd?: Date) {
  return useQuery({
    queryKey: ["calendario-eventos-unified", rangeStart?.toISOString(), rangeEnd?.toISOString()],
    queryFn: async (): Promise<EventoUnificado[]> => {
      const [{ data: orcamentos }, { data: servicos }, { data: externos }] = await Promise.all([
        supabase
          .from("fato_orcamento")
          .select(`*, cliente:dim_cliente!fk_orcamento_cliente(nome), servico:fato_servico!fk_orcamento_servico(nome_do_servico, categoria), propriedade:dim_propriedade!fk_orcamento_propriedade(nome_da_propriedade, municipio)`),
        supabase
          .from("fato_servico")
          .select(`*, cliente:dim_cliente!fk_servico_cliente(nome), propriedade:dim_propriedade!fk_servico_propriedade(nome_da_propriedade, municipio)`),
        supabase
          .from("calendar_eventos_externos")
          .select("*")
          .order("start_at", { ascending: true }),
      ]);

      const eventos: EventoUnificado[] = [];

      orcamentos?.forEach((orc: any) => {
        const inicio = orc.data_inicio || orc.data_orcamento;
        if (!inicio) return;
        eventos.push({
          id: `orc-${orc.id_orcamento}`,
          tipo: "orcamento",
          titulo: `💰 ${orc.cliente?.nome || "Cliente"} - ${orc.servico?.nome_do_servico || "Orçamento"}`,
          start: new Date(inicio),
          end: orc.data_termino ? new Date(orc.data_termino) : new Date(inicio),
          cliente: orc.cliente?.nome,
          propriedade: orc.propriedade?.nome_da_propriedade,
          municipio: orc.propriedade?.municipio,
          status: orc.situacao || BUDGET_SITUATION.PENDENTE,
          categoria: orc.servico?.categoria || "orcamento",
          origem: "skygeo",
        });
      });

      servicos?.forEach((srv: any) => {
        if (!srv.data_do_servico_inicio) return;
        eventos.push({
          id: `srv-${srv.id_servico}`,
          tipo: "servico",
          titulo: `🛠️ ${srv.nome_do_servico}`,
          start: new Date(srv.data_do_servico_inicio),
          end: srv.data_do_servico_fim ? new Date(srv.data_do_servico_fim) : new Date(srv.data_do_servico_inicio),
          cliente: srv.cliente?.nome,
          propriedade: srv.propriedade?.nome_da_propriedade,
          municipio: srv.propriedade?.municipio,
          status: srv.situacao_do_servico === SERVICE_STATUS.PLANEJADO ? "Agendado" : (srv.situacao_do_servico || "Agendado"),
          categoria: srv.categoria || "servico",
          origem: "skygeo",
        });
      });

      externos?.forEach((evt: any) => {
        if (!evt.start_at) return;
        eventos.push({
          id: `ext-${evt.id}`,
          tipo: "externo",
          titulo: `📅 ${evt.summary || "(sem título)"}`,
          start: new Date(evt.start_at),
          end: evt.end_at ? new Date(evt.end_at) : new Date(evt.start_at),
          categoria: "externo",
          origem: "google",
          htmlLink: evt.html_link || undefined,
        });
      });

      const filtered = (rangeStart && rangeEnd)
        ? eventos.filter(e => e.end >= rangeStart && e.start <= rangeEnd)
        : eventos;

      return filtered.sort((a, b) => a.start.getTime() - b.start.getTime());
    },
  });
}
