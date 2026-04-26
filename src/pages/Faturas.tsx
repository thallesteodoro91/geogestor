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
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Receipt,
  RefreshCw,
  Settings,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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
  const [apenasEmAberto, setApenasEmAberto] = useState<boolean>(false);
  const [limiteEmAberto, setLimiteEmAberto] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    const stored = window.localStorage.getItem("faturas:limiteEmAberto");
    const parsed = stored ? Number(stored) : 0;
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  });
  const [limiteInput, setLimiteInput] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    const stored = window.localStorage.getItem("faturas:limiteEmAberto");
    return stored && Number(stored) > 0 ? stored : "";
  });
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  const salvarLimite = () => {
    const valor = Number(limiteInput);
    if (!Number.isFinite(valor) || valor < 0) {
      toast.error("Informe um valor válido em reais (ex: 500)");
      return;
    }
    setLimiteEmAberto(valor);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("faturas:limiteEmAberto", String(valor));
    }
    toast.success(valor > 0 ? "Limite salvo" : "Limite desativado");
  };

  const redefinirLimite = () => {
    setLimiteEmAberto(0);
    setLimiteInput("");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("faturas:limiteEmAberto");
    }
    toast.success("Limite redefinido");
  };

  const filteredInvoices = useMemo(() => {
    const filtered = invoices.filter((inv) => {
      if (apenasEmAberto) {
        if (inv.paid || inv.amount_remaining <= 0 || inv.status === "void") return false;
      }
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
  }, [invoices, statusFilter, dataInicio, dataFim, sortBy, apenasEmAberto]);

  const activeFilters =
    (statusFilter !== "all" ? 1 : 0) + (dataInicio ? 1 : 0) + (dataFim ? 1 : 0) + (apenasEmAberto ? 1 : 0);

  const clearFilters = () => {
    setStatusFilter("all");
    setDataInicio("");
    setDataFim("");
    setApenasEmAberto(false);
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

  const topOpenInvoiceId = useMemo(() => {
    const openInvoices = filteredInvoices.filter(
      (inv) => !inv.paid && inv.amount_remaining > 0 && inv.status !== "void",
    );
    if (openInvoices.length === 0) return null;
    return openInvoices.reduce((top, inv) =>
      inv.amount_remaining > top.amount_remaining ? inv : top,
    ).id;
  }, [filteredInvoices]);

  const filteredSummary = useMemo(() => {
    const openInvoices = filteredInvoices.filter(
      (inv) => !inv.paid && inv.amount_remaining > 0 && inv.status !== "void",
    );
    return {
      totalPago: filteredInvoices.reduce((sum, inv) => sum + inv.amount_paid, 0),
      totalEmAberto: openInvoices.reduce((sum, inv) => sum + inv.amount_remaining, 0),
      quantidadeEmAberto: openInvoices.length,
      currency: filteredInvoices[0]?.currency ?? invoices[0]?.currency ?? "brl",
    };
  }, [filteredInvoices, invoices]);

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
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] sm:items-end">
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
              <div className="space-y-1.5">
                <Label htmlFor="filtro-ordem" className="text-xs">Ordenar por</Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger id="filtro-ordem" className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date_desc">Data (mais recentes)</SelectItem>
                    <SelectItem value="date_asc">Data (mais antigas)</SelectItem>
                    <SelectItem value="amount_desc">Valor (maior)</SelectItem>
                    <SelectItem value="amount_asc">Valor (menor)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {activeFilters > 0 && (
                <Button variant="outline" size="sm" onClick={clearFilters} className="gap-1.5 h-9">
                  <X className="h-3.5 w-3.5" />
                  Limpar
                </Button>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={apenasEmAberto ? "default" : "outline"}
                size="sm"
                onClick={() => setApenasEmAberto((v) => !v)}
                className="gap-1.5 h-8"
              >
                <AlertCircle className="h-3.5 w-3.5" />
                Apenas em aberto
              </Button>
            </div>
            {activeFilters > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                Mostrando {filteredInvoices.length} de {invoices.length} faturas
              </p>
            )}
          </CardContent>
        </Card>

        {/* Resumo filtrado */}
        {!loading && !error && filteredInvoices.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Total pago {activeFilters > 0 ? "(filtrado)" : ""}</p>
                <p className="mt-1 text-xl font-semibold text-success">
                  {formatCurrency(filteredSummary.totalPago, filteredSummary.currency)}
                </p>
              </CardContent>
            </Card>
            {(() => {
              const limiteMinor = limiteEmAberto * 100;
              const excedeu = limiteEmAberto > 0 && filteredSummary.totalEmAberto > limiteMinor;
              return (
                <Card className={cn(excedeu && "border-destructive bg-destructive/5")}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        Total em aberto {activeFilters > 0 ? "(filtrado)" : ""}
                      </p>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            title="Configurar limite de alerta"
                            aria-label="Configurar limite de alerta"
                          >
                            <Settings className="h-3.5 w-3.5" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-72">
                          <div className="space-y-3">
                            <div>
                              <p className="text-sm font-medium">Limite de alerta</p>
                              <p className="text-xs text-muted-foreground">
                                Quando o total em aberto ultrapassar esse valor (R$), o card ficará destacado em vermelho.
                              </p>
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor="limite-aberto" className="text-xs">Valor em R$ (0 desativa)</Label>
                              <Input
                                id="limite-aberto"
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Ex: 500"
                                value={limiteInput}
                                onChange={(e) => setLimiteInput(e.target.value)}
                                className="h-9"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={salvarLimite} className="flex-1">
                                Salvar
                              </Button>
                              <Button size="sm" variant="outline" onClick={redefinirLimite} className="flex-1">
                                Redefinir
                              </Button>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <p className={cn("mt-1 text-xl font-semibold", excedeu ? "text-destructive" : "text-warning")}>
                      {formatCurrency(filteredSummary.totalEmAberto, filteredSummary.currency)}
                    </p>
                    {excedeu && (
                      <p className="mt-1 flex items-center gap-1 text-xs font-medium text-destructive">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Acima do limite de {formatCurrency(limiteMinor, filteredSummary.currency)}
                      </p>
                    )}
                    {!excedeu && limiteEmAberto > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Limite: {formatCurrency(limiteMinor, filteredSummary.currency)}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })()}
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Faturas em aberto</p>
                <p className="mt-1 text-xl font-semibold text-foreground">
                  {filteredSummary.quantidadeEmAberto}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

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
              <TooltipProvider delayDuration={200}>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[220px]">Fatura</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Emissão</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Valor pago</TableHead>
                        <TableHead className="text-right">Valor em aberto</TableHead>
                        <TableHead className="w-[100px] text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInvoices.map((inv) => {
                        const status = inv.status ?? "draft";
                        const cfg = statusConfig[status];
                        const isHighlighted = inv.id === topOpenInvoiceId;
                        const hasOpenAmount = !inv.paid && inv.amount_remaining > 0;
                        return (
                          <TableRow
                            key={inv.id}
                            className={cn(
                              isHighlighted && "bg-warning/5 hover:bg-warning/10 border-l-4 border-l-warning",
                            )}
                          >
                            <TableCell>
                              <div className="flex items-start gap-3">
                                <div className="rounded-md bg-muted p-1.5 text-muted-foreground">
                                  <FileText className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-foreground">
                                    {inv.number ?? `Fatura ${inv.id.slice(-8)}`}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {inv.description ?? (inv.interval === "year" ? "Plano Anual" : inv.interval === "month" ? "Plano Mensal" : "Cobrança recorrente")}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <Badge variant={cfg.variant} className={cfg.className}>
                                  {cfg.label}
                                </Badge>
                                {isHighlighted && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <AlertCircle className="h-3.5 w-3.5 text-warning" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      Maior fatura em aberto — priorize o pagamento
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {formatDate(inv.created)}
                            </TableCell>
                            <TableCell className="text-right font-semibold whitespace-nowrap">
                              {formatCurrency(inv.total, inv.currency)}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              {inv.amount_paid > 0 ? (
                                <span className="text-success font-medium">
                                  {formatCurrency(inv.amount_paid, inv.currency)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              {hasOpenAmount ? (
                                <span className={cn("font-medium", isHighlighted ? "text-warning font-semibold" : "text-warning")}>
                                  {formatCurrency(inv.amount_remaining, inv.currency)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-1">
                                {inv.invoice_pdf && (
                                  <Button variant="ghost" size="icon" asChild title="Baixar PDF">
                                    <a href={inv.invoice_pdf} target="_blank" rel="noopener noreferrer">
                                      <Download className="h-4 w-4" />
                                    </a>
                                  </Button>
                                )}
                                {inv.hosted_invoice_url && (
                                  <Button variant="ghost" size="icon" asChild title="Abrir fatura">
                                    <a href={inv.hosted_invoice_url} target="_blank" rel="noopener noreferrer">
                                      <ExternalLink className="h-4 w-4" />
                                    </a>
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </TooltipProvider>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
