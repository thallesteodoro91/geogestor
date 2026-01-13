import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Eye, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { SERVICE_STATUS, getServiceStatusBadgeClasses } from "@/constants/serviceStatus";
import { BUDGET_SITUATION, getBudgetSituationBadgeClass } from "@/constants/budgetStatus";

export const CalendarioTabela = () => {
  const navigate = useNavigate();
  const [busca, setBusca] = useState("");

  const { data: eventos = [], isLoading } = useQuery({
    queryKey: ["calendario-tabela"],
    queryFn: async () => {
      const { data: orcamentos } = await supabase
        .from("fato_orcamento")
        .select(`
          *,
          cliente:dim_cliente!fk_orcamento_cliente(nome),
          servico:fato_servico!fk_orcamento_servico(nome_do_servico),
          propriedade:dim_propriedade!fk_orcamento_propriedade(nome_da_propriedade, municipio)
        `)
        .order("data_inicio", { ascending: false });

      const { data: servicos } = await supabase
        .from("fato_servico")
        .select(`
          *,
          cliente:dim_cliente!fk_servico_cliente(nome),
          propriedade:dim_propriedade!fk_servico_propriedade(nome_da_propriedade, municipio)
        `)
        .order("data_do_servico_inicio", { ascending: false });

      return [
        ...(orcamentos || []).map((orc) => ({
          id: `orc-${orc.id_orcamento}`,
          tipo: "orcamento" as const,
          data: orc.data_inicio ? new Date(orc.data_inicio) : null,
          cliente: orc.cliente?.nome || "Cliente",
          servico: orc.servico?.nome_do_servico || "Orçamento",
          propriedade: orc.propriedade?.nome_da_propriedade || "-",
          municipio: orc.propriedade?.municipio || "-",
          status: orc.situacao || SERVICE_STATUS.PENDENTE,
          pagamento: orc.forma_de_pagamento || "-",
          valor: orc.valor_unitario || 0,
        })),
        ...(servicos || []).map((srv) => {
          const status = srv.situacao_do_servico === SERVICE_STATUS.PLANEJADO ? "Agendado" : (srv.situacao_do_servico || "Agendado");
          return {
            id: `srv-${srv.id_servico}`,
            tipo: "servico" as const,
            data: srv.data_do_servico_inicio ? new Date(srv.data_do_servico_inicio) : null,
            cliente: srv.cliente?.nome || "Cliente",
            servico: srv.nome_do_servico,
            propriedade: srv.propriedade?.nome_da_propriedade || "-",
            municipio: srv.propriedade?.municipio || "-",
            status,
            pagamento: "-",
            valor: srv.receita_servico || 0,
          };
        }),
      ].sort((a, b) => {
        if (!a.data) return 1;
        if (!b.data) return -1;
        return b.data.getTime() - a.data.getTime();
      });
    },
  });

  const eventosFiltrados = eventos.filter((evento) =>
    Object.values(evento).some((val) =>
      String(val).toLowerCase().includes(busca.toLowerCase())
    )
  );

  // Helper centralizado para cores de status
  const getStatusColor = (status: string, tipo: string) => {
    if (tipo === "orcamento") {
      return getBudgetSituationBadgeClass(status);
    }
    return getServiceStatusBadgeClasses(status);
  };

  const getTipoIcon = (tipo: string) => {
    return tipo === "orcamento" ? "💰" : "🛠️";
  };

  const getRowColor = (tipo: string) => {
    return tipo === "servico" ? "bg-[#246BCE]/5" : "";
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar compromissos..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="max-w-sm"
          />
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Serviço</TableHead>
              <TableHead>Propriedade</TableHead>
              <TableHead>Município</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {eventosFiltrados.map((evento) => (
              <TableRow 
                key={evento.id} 
                className={cn("hover:bg-muted/50", getRowColor(evento.tipo))}
                title={evento.tipo === "servico" ? `${evento.cliente} • ${evento.propriedade} • ${evento.municipio}` : ""}
              >
                <TableCell>
                  {evento.data ? format(evento.data, "dd/MM/yyyy", { locale: ptBR }) : "-"}
                </TableCell>
                <TableCell className="font-medium">{evento.cliente}</TableCell>
                <TableCell>{evento.servico}</TableCell>
                <TableCell>{evento.propriedade}</TableCell>
                <TableCell>{evento.municipio}</TableCell>
                <TableCell>
                  <Badge className={evento.tipo === "servico" ? "bg-[#246BCE] text-white" : getStatusColor(evento.status, evento.tipo)}>
                    {getTipoIcon(evento.tipo)} {evento.status}
                  </Badge>
                </TableCell>
                <TableCell>{evento.pagamento}</TableCell>
                <TableCell>
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(evento.valor)}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const [tipo, id] = evento.id.split("-");
                      navigate(`/calendario/${tipo}/${id}`);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}

            {eventosFiltrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                  Nenhum compromisso encontrado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};
