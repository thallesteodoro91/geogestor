import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { TablePagination } from "@/components/ui/table-pagination";
import { usePagination } from "@/hooks/usePagination";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Eye, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { SERVICE_STATUS } from "@/constants/serviceStatus";
import { getStatusClasses } from "@/lib/statusColors";

interface CalendarioTabelaProps {
  busca?: string;
  filtroTipo?: string;
  filtroStatus?: string;
}

export const CalendarioTabela = ({ busca = "", filtroTipo = "todos", filtroStatus = "todos" }: CalendarioTabelaProps) => {
  const navigate = useNavigate();

  const { data: eventos = [], isLoading } = useQuery({
    queryKey: ["calendario-tabela"],
    queryFn: async () => {
      const { data: orcamentos } = await supabase
        .from("fato_orcamento")
        .select(`*, cliente:dim_cliente!fk_orcamento_cliente(nome), servico:fato_servico!fk_orcamento_servico(nome_do_servico), propriedade:dim_propriedade!fk_orcamento_propriedade(nome_da_propriedade, municipio)`)
        .order("data_inicio", { ascending: false });

      const { data: servicos } = await supabase
        .from("fato_servico")
        .select(`*, cliente:dim_cliente!fk_servico_cliente(nome), propriedade:dim_propriedade!fk_servico_propriedade(nome_da_propriedade, municipio)`)
        .order("data_do_servico_inicio", { ascending: false });

      return [
        ...(orcamentos || []).map((orc) => ({
          id: `orc-${orc.id_orcamento}`, tipo: "orcamento" as const,
          data: orc.data_inicio ? new Date(orc.data_inicio) : null,
          cliente: orc.cliente?.nome || "Cliente",
          servico: orc.servico?.nome_do_servico || "Orçamento",
          propriedade: orc.propriedade?.nome_da_propriedade || "-",
          municipio: orc.propriedade?.municipio || "-",
          status: orc.situacao || SERVICE_STATUS.PENDENTE,
          pagamento: orc.forma_de_pagamento || "-",
          valor: orc.valor_unitario || 0,
        })),
        ...(servicos || []).map((srv) => ({
          id: `srv-${srv.id_servico}`, tipo: "servico" as const,
          data: srv.data_do_servico_inicio ? new Date(srv.data_do_servico_inicio) : null,
          cliente: srv.cliente?.nome || "Cliente",
          servico: srv.nome_do_servico,
          propriedade: srv.propriedade?.nome_da_propriedade || "-",
          municipio: srv.propriedade?.municipio || "-",
          status: srv.situacao_do_servico === SERVICE_STATUS.PLANEJADO ? "Agendado" : (srv.situacao_do_servico || "Agendado"),
          pagamento: "-",
          valor: srv.receita_servico || 0,
        })),
      ].sort((a, b) => {
        if (!a.data) return 1;
        if (!b.data) return -1;
        return b.data.getTime() - a.data.getTime();
      });
    },
  });

  const eventosFiltrados = eventos.filter((evento) => {
    const matchBusca = !busca || Object.values(evento).some((val) =>
      String(val).toLowerCase().includes(busca.toLowerCase())
    );
    const matchTipo = filtroTipo === "todos" || evento.tipo === filtroTipo;
    const matchStatus = filtroStatus === "todos" || evento.status === filtroStatus;
    return matchBusca && matchTipo && matchStatus;
  });

  const pagination = usePagination(eventosFiltrados, { initialPageSize: 20 });

  const getTipoIcon = (tipo: string) => tipo === "orcamento" ? "💰" : "🛠️";

  const exportCSV = () => {
    const headers = ["Data", "Tipo", "Cliente", "Serviço", "Propriedade", "Município", "Status", "Pagamento", "Valor"];
    const rows = eventosFiltrados.map((e) => [
      e.data ? format(e.data, "dd/MM/yyyy") : "-",
      e.tipo === "orcamento" ? "Orçamento" : "Serviço",
      e.cliente, e.servico, e.propriedade, e.municipio, e.status, e.pagamento,
      e.valor.toFixed(2).replace(".", ","),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `calendario-eventos-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="gap-2" onClick={exportCSV}>
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

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
            {pagination.paginatedData.map((evento) => (
              <TableRow
                key={evento.id}
                className={cn("hover:bg-muted/50", evento.tipo === "servico" && "bg-blue-500/5 dark:bg-blue-500/10")}
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
                  <Badge className={getStatusClasses(evento.status)}>
                    {getTipoIcon(evento.tipo)} {evento.status}
                  </Badge>
                </TableCell>
                <TableCell>{evento.pagamento}</TableCell>
                <TableCell>
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(evento.valor)}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const separatorIndex = evento.id.indexOf("-");
                      const tipo = evento.id.substring(0, separatorIndex);
                      const id = evento.id.substring(separatorIndex + 1);
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
                <TableCell colSpan={9}>
                  <EmptyState
                    icon={Eye}
                    title="Sua agenda está livre"
                    description="Crie serviços ou orçamentos com datas para vê-los aqui automaticamente."
                    actionLabel="+ Novo Compromisso"
                    onAction={() => navigate("/servicos")}
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <div className="px-4">
          <TablePagination
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
            pageSize={pagination.pageSize}
            startIndex={pagination.startIndex}
            endIndex={pagination.endIndex}
            canGoNext={pagination.canGoNext}
            canGoPrevious={pagination.canGoPrevious}
            onPageChange={pagination.goToPage}
            onPageSizeChange={pagination.setPageSize}
            onFirstPage={pagination.goToFirstPage}
            onLastPage={pagination.goToLastPage}
            onNextPage={pagination.goToNextPage}
            onPreviousPage={pagination.goToPreviousPage}
          />
        </div>
      </Card>
    </div>
  );
};
