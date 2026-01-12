import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  Calendar,
  User,
  MapPin,
  Briefcase,
  DollarSign,
  FileText,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { SERVICE_STATUS, getServiceStatusBadgeClasses } from "@/constants/serviceStatus";
import { 
  BUDGET_SITUATION, 
  getBudgetSituationBadgeClass,
  getPaymentStatusBadgeClass 
} from "@/constants/budgetStatus";

const CalendarioDetalhes = () => {
  const { tipo, id } = useParams<{ tipo: string; id: string }>();
  const navigate = useNavigate();

  const { data: detalhes, isLoading } = useQuery({
    queryKey: ["calendario-detalhes", tipo, id],
    queryFn: async () => {
      if (tipo === "orc") {
        const { data } = await supabase
          .from("fato_orcamento")
          .select(`
            *,
            cliente:dim_cliente(*),
            servico:fato_servico(*),
            propriedade:dim_propriedade(*)
          `)
          .eq("id_orcamento", id!)
          .single();
        return { tipo: "orcamento", ...data };
      } else {
        const { data } = await supabase
          .from("fato_servico")
          .select(`
            *,
            cliente:dim_cliente(*),
            propriedade:dim_propriedade(*)
          `)
          .eq("id_servico", id!)
          .single();
        return { tipo: "servico", ...data };
      }
    },
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="container mx-auto p-6 max-w-5xl space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!detalhes) {
    return (
      <AppLayout>
        <div className="container mx-auto p-6 max-w-5xl text-center">
          <p className="text-muted-foreground">Compromisso não encontrado</p>
        </div>
      </AppLayout>
    );
  }

  const isOrcamento = detalhes.tipo === "orcamento";
  const status = isOrcamento 
    ? (detalhes as any).situacao 
    : (detalhes as any).situacao_do_servico;

  // Use helpers centralizados para obter classes de badge
  const getStatusBadgeClass = () => {
    if (isOrcamento) {
      return getBudgetSituationBadgeClass(status);
    }
    return getServiceStatusBadgeClasses(status);
  };

  return (
    <AppLayout>
      <div className="container mx-auto p-6 max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/calendario")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Calendário
          </Button>
          <Badge className={getStatusBadgeClass()}>
            {status || BUDGET_SITUATION.PENDENTE}
          </Badge>
        </div>

        {/* Título */}
        <div>
          <h1 className="text-3xl font-bold mb-2">
            {isOrcamento 
              ? (detalhes as any).servico?.nome_do_servico 
              : (detalhes as any).nome_do_servico}
          </h1>
          <p className="text-muted-foreground">
            {isOrcamento ? "Orçamento" : "Serviço"} #{id?.slice(0, 8)}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Informações Principais */}
          <div className="lg:col-span-2 space-y-6">
            {/* Datas */}
            <Card className="p-6">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Período
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Data de Início</p>
                  <p className="font-medium">
                    {(() => {
                      const data = isOrcamento 
                        ? (detalhes as any).data_inicio 
                        : (detalhes as any).data_do_servico_inicio;
                      return data ? format(new Date(data), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : "-";
                    })()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Data de Término</p>
                  <p className="font-medium">
                    {(() => {
                      const data = isOrcamento 
                        ? (detalhes as any).data_termino 
                        : (detalhes as any).data_do_servico_fim;
                      return data ? format(new Date(data), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : "-";
                    })()}
                  </p>
                </div>
              </div>
            </Card>

            {/* Cliente */}
            <Card className="p-6">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <User className="h-5 w-5" />
                Cliente
              </h3>
              <div className="space-y-2">
                <p className="text-xl font-medium">{(detalhes as any).cliente?.nome || "-"}</p>
                <p className="text-sm text-muted-foreground">{(detalhes as any).cliente?.email || "-"}</p>
                <p className="text-sm text-muted-foreground">
                  {(detalhes as any).cliente?.telefone || (detalhes as any).cliente?.celular || "-"}
                </p>
              </div>
            </Card>

            {/* Propriedade */}
            <Card className="p-6">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Propriedade
              </h3>
              <div className="space-y-2">
                <p className="text-xl font-medium">
                  {(detalhes as any).propriedade?.nome_da_propriedade || "-"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {(detalhes as any).propriedade?.municipio || "-"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Área: {(detalhes as any).propriedade?.area_ha || "-"} ha
                </p>
              </div>
            </Card>

            {/* Valores */}
            {isOrcamento && (
              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Valores
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Valor Unitário</p>
                    <p className="text-2xl font-bold">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format((detalhes as any).valor_unitario || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Quantidade</p>
                    <p className="text-2xl font-bold">{(detalhes as any).quantidade || 1}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Receita Esperada</p>
                    <p className="text-xl font-semibold text-green-600">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format((detalhes as any).receita_esperada || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Forma de Pagamento</p>
                    <p className="font-medium">{(detalhes as any).forma_de_pagamento || "-"}</p>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Sidebar - Informações Adicionais */}
          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Categoria
              </h3>
              <Badge variant="outline" className="text-base px-4 py-2">
                {isOrcamento 
                  ? (detalhes as any).servico?.categoria 
                  : (detalhes as any).categoria || "Geral"}
              </Badge>
            </Card>

            {isOrcamento && (
              <>
                <Card className="p-6">
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5" />
                    Conversão
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {(detalhes as any).orcamento_convertido ? "✅ Convertido" : "⏳ Pendente"}
                  </p>
                </Card>

                <Card className="p-6">
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Faturamento
                  </h3>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Status: {(detalhes as any).situacao_do_pagamento || "-"}
                    </p>
                    {(detalhes as any).valor_faturado && (
                      <p className="text-lg font-semibold text-green-600">
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format((detalhes as any).valor_faturado)}
                      </p>
                    )}
                  </div>
                </Card>
              </>
            )}

            <Card className="p-6">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Registro
              </h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Criado em:{" "}
                  {(detalhes as any).created_at 
                    ? format(new Date((detalhes as any).created_at), "dd/MM/yyyy", { locale: ptBR })
                    : "-"}
                </p>
                <p>
                  Atualizado em:{" "}
                  {(detalhes as any).updated_at 
                    ? format(new Date((detalhes as any).updated_at), "dd/MM/yyyy", { locale: ptBR })
                    : "-"}
                </p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default CalendarioDetalhes;
