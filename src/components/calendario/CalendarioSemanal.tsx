import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, MapPin, User, Briefcase } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { SERVICE_STATUS } from "@/constants/serviceStatus";
import { BUDGET_SITUATION } from "@/constants/budgetStatus";

export const CalendarioSemanal = () => {
  const navigate = useNavigate();
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroMunicipio, setFiltroMunicipio] = useState<string>("todos");
  const [buscaCliente, setBuscaCliente] = useState("");

  const { data: eventos = [], isLoading } = useQuery({
    queryKey: ["calendario-semanal"],
    queryFn: async () => {
      const hoje = new Date();
      const inicioSemana = startOfWeek(hoje, { locale: ptBR });
      const fimSemana = endOfWeek(hoje, { locale: ptBR });

      const { data: orcamentos } = await supabase
        .from("fato_orcamento")
        .select(`
          *,
          cliente:dim_cliente(nome, endereco),
          servico:fato_servico(nome_do_servico, categoria),
          propriedade:dim_propriedade(nome_da_propriedade, municipio)
        `)
        .gte("data_inicio", inicioSemana.toISOString())
        .lte("data_inicio", fimSemana.toISOString());

      const { data: servicos } = await supabase
        .from("fato_servico")
        .select(`
          *,
          cliente:dim_cliente(nome, endereco),
          propriedade:dim_propriedade(nome_da_propriedade, municipio)
        `)
        .gte("data_do_servico_inicio", inicioSemana.toISOString())
        .lte("data_do_servico_inicio", fimSemana.toISOString());

      const eventos = [
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
        ...(servicos || []).map((srv) => {
          const status = srv.situacao_do_servico === SERVICE_STATUS.PLANEJADO ? "Agendado" : (srv.situacao_do_servico || "Agendado");
          return {
            id: `srv-${srv.id_servico}`,
            tipo: "servico" as const,
            data: new Date(srv.data_do_servico_inicio!),
            titulo: srv.nome_do_servico,
            cliente: srv.cliente?.nome || "Cliente",
            propriedade: srv.propriedade?.nome_da_propriedade || "-",
            municipio: srv.propriedade?.municipio || "-",
            status,
            categoria: srv.categoria || "Geral",
          };
        }),
      ].sort((a, b) => a.data.getTime() - b.data.getTime());

      return eventos;
    },
  });

  const eventosFiltrados = eventos.filter((evento) => {
    const matchStatus = filtroStatus === "todos" || evento.status === filtroStatus;
    const matchMunicipio = filtroMunicipio === "todos" || evento.municipio === filtroMunicipio;
    const matchCliente = evento.cliente.toLowerCase().includes(buscaCliente.toLowerCase());
    return matchStatus && matchMunicipio && matchCliente;
  });

  const municipios = [...new Set(eventos.map((e) => e.municipio))].filter(Boolean);
  const statusOptions = [...new Set(eventos.map((e) => e.status))];

  const getStatusColor = (status: string) => {
    if (status === SERVICE_STATUS.CONCLUIDO || status === BUDGET_SITUATION.APROVADO) 
      return "bg-[hsl(142,76%,36%)] text-white hover:bg-[hsl(142,76%,30%)]";
    if (status === SERVICE_STATUS.CANCELADO || status === BUDGET_SITUATION.CANCELADO) 
      return "bg-[hsl(0,100%,50%)] text-white hover:bg-[hsl(0,100%,45%)]";
    if (status === SERVICE_STATUS.EM_ANDAMENTO) 
      return "bg-[hsl(217,91%,60%)] text-white hover:bg-[hsl(217,91%,55%)]";
    if (status === SERVICE_STATUS.EM_REVISAO)
      return "bg-[hsl(280,70%,50%)] text-white hover:bg-[hsl(280,70%,45%)]";
    return "bg-[hsl(48,96%,53%)] text-black hover:bg-[hsl(48,96%,45%)]";
  };

  const getTipoIcon = (tipo: string) => {
    return tipo === "orcamento" ? "💰" : "🛠️";
  };

  const getTipoColor = (tipo: string) => {
    return tipo === "servico" ? "bg-[#246BCE] text-white border-[#246BCE]" : "";
  };

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Cliente</Label>
            <Input
              placeholder="Buscar por cliente..."
              value={buscaCliente}
              onChange={(e) => setBuscaCliente(e.target.value)}
            />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {statusOptions.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Município</Label>
            <Select value={filtroMunicipio} onValueChange={setFiltroMunicipio}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {municipios.map((mun) => (
                  <SelectItem key={mun} value={mun}>
                    {mun}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
              const [tipo, id] = evento.id.split("-");
              navigate(`/calendario/${tipo}/${id}`);
            }}
            title={`${evento.cliente} • ${evento.propriedade} • ${evento.municipio}`}
          >
            <div className="flex items-start justify-between">
              <div className="space-y-3 flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <Badge className={evento.tipo === "servico" ? "bg-[#246BCE] text-white" : getStatusColor(evento.status)}>
                    {evento.status}
                  </Badge>
                  <Badge variant="outline" className={cn("gap-1", getTipoColor(evento.tipo))}>
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
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">Nenhum compromisso encontrado para esta semana</p>
          </Card>
        )}
      </div>
    </div>
  );
};
