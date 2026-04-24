import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { AppLayout } from "@/components/layout/AppLayout";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useStripeSubscription } from "@/hooks/useStripeSubscription";
import { toast } from "sonner";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Receipt,
  RefreshCw,
  Settings,
} from "lucide-react";

interface Invoice {
  id: string;
  number: string | null;
  status: "draft" | "open" | "paid" | "uncollectible" | "void" | null;
  amount_paid: number;
  amount_due: number;
  amount_remaining: number;
  total: number;
  currency: string;
  created: number;
  period_start: number;
  period_end: number;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  description: string | null;
  interval: "month" | "year" | null;
  paid: boolean;
}

const formatCurrency = (amountMinor: number, currency: string) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountMinor / 100);

const formatDate = (unix: number) =>
  new Date(unix * 1000).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const statusConfig: Record<
  NonNullable<Invoice["status"]>,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className: string }
> = {
  paid: { label: "Pago", variant: "default", className: "bg-success text-success-foreground hover:bg-success/90" },
  open: { label: "Aberto", variant: "secondary", className: "bg-warning/15 text-warning border-warning/30" },
  draft: { label: "Rascunho", variant: "outline", className: "" },
  uncollectible: { label: "Não pago", variant: "destructive", className: "" },
  void: { label: "Cancelado", variant: "outline", className: "text-muted-foreground" },
};

export default function Faturas() {
  const navigate = useNavigate();
  const stripe = useStripeSubscription();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dataInicio, setDataInicio] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("date_desc");

  const filteredInvoices = useMemo(() => {
    const filtered = invoices.filter((inv) => {
      if (statusFilter !== "all") {
        if (statusFilter === "paid" && inv.status !== "paid") return false;
        if (statusFilter === "open" && inv.status !== "open") return false;
        if (statusFilter === "void" && inv.status !== "void") return false;
      }
      if (dataInicio) {
        const inicioTs = new Date(dataInicio + "T00:00:00").getTime() / 1000;
        if (inv.created < inicioTs) return false;
      }
      if (dataFim) {
        const fimTs = new Date(dataFim + "T23:59:59").getTime() / 1000;
        if (inv.created > fimTs) return false;
      }
      return true;
    });

    const sorted = [...filtered];
    switch (sortBy) {
      case "date_asc":
        sorted.sort((a, b) => a.created - b.created);
        break;
      case "amount_desc":
        sorted.sort((a, b) => b.total - a.total);
        break;
      case "amount_asc":
        sorted.sort((a, b) => a.total - b.total);
        break;
      case "date_desc":
      default:
        sorted.sort((a, b) => b.created - a.created);
        break;
    }
    return sorted;
  }, [invoices, statusFilter, dataInicio, dataFim, sortBy]);

  const activeFilters =
    (statusFilter !== "all" ? 1 : 0) + (dataInicio ? 1 : 0) + (dataFim ? 1 : 0);

  const clearFilters = () => {
    setStatusFilter("all");
    setDataInicio("");
    setDataFim("");
  };

  const loadInvoices = async () => {
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      const { data, error: fnError } = await supabase.functions.invoke("list-invoices", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      setInvoices((data?.invoices ?? []) as Invoice[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao carregar faturas";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadInvoices();
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      const { data, error: fnError } = await supabase.functions.invoke("customer-portal", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (fnError) throw fnError;
      if (data?.url) {
        window.open(data.url, "_blank");
      } else {
        throw new Error("URL do portal não retornada");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao abrir portal de gerenciamento";
      toast.error(message);
    } finally {
      setPortalLoading(false);
    }
  };

  const totalPago = invoices
    .filter((inv) => inv.status === "paid")
    .reduce((sum, inv) => sum + inv.amount_paid, 0);

  const proximaCobranca = stripe.subscription_end
    ? new Date(stripe.subscription_end).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/configuracoes")} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="gap-2">
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Atualizar
            </Button>
            <Button variant="outline" size="sm" onClick={handleManageSubscription} disabled={portalLoading} className="gap-2">
              {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />}
              Gerenciar assinatura
            </Button>
          </div>
        </div>

        <PageHeader
          title="Faturas e pagamentos"
          subtitle="Acompanhe o histórico completo das suas cobranças, baixe recibos e visualize o status de cada fatura."
        />

        {/* Resumo */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <Receipt className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Faturas emitidas</p>
                  <p className="text-2xl font-semibold text-foreground">{invoices.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-success/10 p-2 text-success">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total pago</p>
                  <p className="text-2xl font-semibold text-foreground">
                    {invoices.length > 0
                      ? formatCurrency(totalPago, invoices[0].currency)
                      : "—"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-info/10 p-2 text-info">
                  <RefreshCw className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Próxima cobrança</p>
                  <p className="text-base font-semibold text-foreground">
                    {proximaCobranca ?? "Sem assinatura ativa"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="p-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="filtro-status" className="text-xs">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger id="filtro-status" className="h-9">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="paid">Pago</SelectItem>
                    <SelectItem value="open">Aberto</SelectItem>
                    <SelectItem value="void">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="filtro-inicio" className="text-xs">Data início</Label>
                <Input
                  id="filtro-inicio"
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="filtro-fim" className="text-xs">Data fim</Label>
                <Input
                  id="filtro-fim"
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="h-9"
                />
              </div>
              {activeFilters > 0 && (
                <Button variant="outline" size="sm" onClick={clearFilters} className="gap-1.5 h-9">
                  <X className="h-3.5 w-3.5" />
                  Limpar
                </Button>
              )}
            </div>
            {activeFilters > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                Mostrando {filteredInvoices.length} de {invoices.length} faturas
              </p>
            )}
          </CardContent>
        </Card>

        {/* Lista */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-3 p-6">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : error ? (
              <div className="p-6">
                <EmptyState
                  icon={Receipt}
                  title="Não foi possível carregar as faturas"
                  description={error}
                  actionLabel="Tentar novamente"
                  onAction={handleRefresh}
                />
              </div>
            ) : invoices.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={Receipt}
                  title="Nenhuma fatura encontrada"
                  description="Quando você assinar um plano, suas faturas aparecerão aqui automaticamente."
                  actionLabel="Ver planos"
                  onAction={() => navigate("/assinatura")}
                />
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={Receipt}
                  title="Nenhuma fatura para os filtros aplicados"
                  description="Tente ajustar o status ou o intervalo de datas."
                  actionLabel="Limpar filtros"
                  onAction={clearFilters}
                />
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {filteredInvoices.map((inv) => {
                  const status = inv.status ?? "draft";
                  const cfg = statusConfig[status];
                  return (
                    <li key={inv.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 flex-1 items-start gap-4">
                        <div className="rounded-lg bg-muted p-2 text-muted-foreground">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-foreground">
                              {inv.number ?? `Fatura ${inv.id.slice(-8)}`}
                            </p>
                            <Badge variant={cfg.variant} className={cfg.className}>
                              {cfg.label}
                            </Badge>
                          </div>
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            {inv.description ?? (inv.interval === "year" ? "Plano Anual" : inv.interval === "month" ? "Plano Mensal" : "Cobrança recorrente")}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Emitida em {formatDate(inv.created)}
                            {inv.period_start && inv.period_end ? (
                              <> · Período {formatDate(inv.period_start)} – {formatDate(inv.period_end)}</>
                            ) : null}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 sm:gap-6">
                        <div className="text-right">
                          <p className="text-base font-semibold text-foreground">
                            {formatCurrency(inv.total, inv.currency)}
                          </p>
                          {!inv.paid && inv.amount_remaining > 0 && (
                            <p className="text-xs text-warning">
                              {formatCurrency(inv.amount_remaining, inv.currency)} em aberto
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          {inv.invoice_pdf && (
                            <Button
                              variant="ghost"
                              size="icon"
                              asChild
                              title="Baixar PDF"
                            >
                              <a href={inv.invoice_pdf} target="_blank" rel="noopener noreferrer">
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          {inv.hosted_invoice_url && (
                            <Button
                              variant="ghost"
                              size="icon"
                              asChild
                              title="Abrir fatura"
                            >
                              <a href={inv.hosted_invoice_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
