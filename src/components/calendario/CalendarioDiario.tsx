import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, ChevronLeft, ChevronRight, Clock, MapPin, User, Briefcase, DollarSign, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

export const CalendarioDiario = () => {
  const navigate = useNavigate();
  const [dataSelecionada, setDataSelecionada] = useState(new Date());

  const { data: eventos = [], isLoading } = useQuery({
    queryKey: ["calendario-diario", dataSelecionada],
    queryFn: async () => {
      const inicioDia = startOfDay(dataSelecionada);
      const fimDia = endOfDay(dataSelecionada);

      const { data: orcamentos } = await supabase
        .from("fato_orcamento")
        .select(`
          *,
          cliente:dim_cliente(nome, celular, email),
          servico:fato_servico(nome_do_servico, categoria),
          propriedade:dim_propriedade(nome_da_propriedade, municipio)
        `)
        .gte("data_inicio", inicioDia.toISOString())
        .lte("data_inicio", fimDia.toISOString());

      const { data: servicos } = await supabase
        .from("fato_servico")
        .select(`
          *,
          cliente:dim_cliente(nome, celular, email),
          propriedade:dim_propriedade(nome_da_propriedade, municipio)
        `)
        .gte("data_do_servico_inicio", inicioDia.toISOString())
        .lte("data_do_servico_inicio", fimDia.toISOString());

      const eventos = [
        ...(orcamentos || []).map((orc) => ({
          id: `orc-${orc.id_orcamento}`,
          tipo: "orcamento" as const,
          hora: new Date(orc.data_inicio!),
          titulo: orc.servico?.nome_do_servico || "Orçamento",
          cliente: orc.cliente?.nome || "Cliente",
          clienteContato: orc.cliente?.celular || orc.cliente?.email || "-",
          propriedade: orc.propriedade?.nome_da_propriedade || "-",
          municipio: orc.propriedade?.municipio || "-",
          status: orc.situacao || "Pendente",
          categoria: orc.servico?.categoria || "Geral",
          valor: orc.valor_unitario || 0,
          descricao: `Orçamento para ${orc.servico?.nome_do_servico || "serviço"}`,
        })),
        ...(servicos || []).map((srv) => {
          const status = srv.situacao_do_servico === "Planejado" ? "Agendado" : (srv.situacao_do_servico || "Agendado");
          return {
            id: `srv-${srv.id_servico}`,
            tipo: "servico" as const,
            hora: new Date(srv.data_do_servico_inicio!),
            titulo: srv.nome_do_servico,
            cliente: srv.cliente?.nome || "Cliente",
            clienteContato: srv.cliente?.celular || srv.cliente?.email || "-",
            propriedade: srv.propriedade?.nome_da_propriedade || "-",
            municipio: srv.propriedade?.municipio || "-",
            status,
            categoria: srv.categoria || "Geral",
            valor: srv.receita_servico || 0,
            descricao: srv.nome_do_servico,
          };
        }),
      ].sort((a, b) => a.hora.getTime() - b.hora.getTime());

      return eventos;
    },
  });

  const getStatusConfig = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes("concluído") || statusLower.includes("aprovado")) {
      return { color: "bg-emerald-500 text-white", icon: "✓" };
    }
    if (statusLower.includes("cancelado")) {
      return { color: "bg-red-500 text-white", icon: "✕" };
    }
    if (statusLower.includes("andamento")) {
      return { color: "bg-blue-500 text-white", icon: "⟳" };
    }
    return { color: "bg-amber-500 text-white", icon: "⏱" };
  };

  const getCategoriaColor = (categoria: string, tipo: string) => {
    // Serviços sempre têm cor azul #246BCE
    if (tipo === "servico") return "border-l-[#246BCE]";
    
    const catLower = categoria.toLowerCase();
    if (catLower.includes("topografia")) return "border-l-blue-500";
    if (catLower.includes("georreferenciamento")) return "border-l-emerald-500";
    if (catLower.includes("projeto")) return "border-l-purple-500";
    return "border-l-slate-500";
  };

  const proximoDia = () => {
    const novaData = new Date(dataSelecionada);
    novaData.setDate(novaData.getDate() + 1);
    setDataSelecionada(novaData);
  };

  const diaAnterior = () => {
    const novaData = new Date(dataSelecionada);
    novaData.setDate(novaData.getDate() - 1);
    setDataSelecionada(novaData);
  };

  const hoje = () => {
    setDataSelecionada(new Date());
  };

  return (
    <div className="space-y-6">
      {/* Navegação de Data */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <Button variant="outline" size="icon" onClick={diaAnterior}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center gap-4">
            <Calendar className="h-5 w-5 text-primary" />
            <h2 className="text-2xl font-bold">
              {format(dataSelecionada, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </h2>
            <Button variant="outline" size="sm" onClick={hoje}>
              Hoje
            </Button>
          </div>

          <Button variant="outline" size="icon" onClick={proximoDia}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      {/* Timeline de Eventos */}
      <div className="space-y-4">
        {eventos.length === 0 ? (
          <Card className="p-12 text-center">
            <Calendar className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-lg font-medium text-muted-foreground">
              Nenhum compromisso agendado para este dia
            </p>
          </Card>
        ) : (
          eventos.map((evento) => {
            const statusConfig = getStatusConfig(evento.status);
            return (
              <Card
                key={evento.id}
                className={cn(
                  "border-l-4 hover:shadow-lg transition-all cursor-pointer",
                  getCategoriaColor(evento.categoria, evento.tipo)
                )}
                onClick={() => {
                  const [tipo, id] = evento.id.split("-");
                  navigate(`/calendario/${tipo}/${id}`);
                }}
                title={`${evento.cliente} • ${evento.propriedade} • ${evento.municipio}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <Badge className={evento.tipo === "servico" ? "bg-[#246BCE] text-white" : statusConfig.color}>
                          {statusConfig.icon} {evento.status}
                        </Badge>
                        <Badge variant="outline" className={cn("gap-1", evento.tipo === "servico" && "bg-[#246BCE]/10 text-[#246BCE] border-[#246BCE]")}>
                          {evento.tipo === "orcamento" ? (
                            <>
                              <FileText className="h-3 w-3" />
                              Orçamento
                            </>
                          ) : (
                            <>
                              🛠️ Serviço
                            </>
                          )}
                        </Badge>
                        <Badge variant="secondary" className="gap-1">
                          <Clock className="h-3 w-3" />
                          {format(evento.hora, "HH:mm")}
                        </Badge>
                      </div>
                      <CardTitle className="text-xl">
                        {evento.tipo === "servico" && "🛠️ "}{evento.titulo}
                      </CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="flex items-start gap-3">
                      <div className="bg-primary/10 p-2 rounded-lg">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Cliente</p>
                        <p className="font-medium">{evento.cliente}</p>
                        <p className="text-xs text-muted-foreground">{evento.clienteContato}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="bg-emerald-500/10 p-2 rounded-lg">
                        <Briefcase className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Propriedade</p>
                        <p className="font-medium">{evento.propriedade}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="bg-blue-500/10 p-2 rounded-lg">
                        <MapPin className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Município</p>
                        <p className="font-medium">{evento.municipio}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="bg-amber-500/10 p-2 rounded-lg">
                        <DollarSign className="h-4 w-4 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Valor</p>
                        <p className="font-medium">
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(evento.valor)}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};
