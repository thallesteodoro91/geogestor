import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Crown,
  FileText,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useStripeSubscription } from "@/hooks/useStripeSubscription";

type PlanId = "mensal" | "anual";

interface SubscriptionDetails {
  id: string;
  status: string;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  price_id: string;
  plan: PlanId | null;
  item_id: string;
  amount: number | null;
  currency: string | null;
  interval: string | null;
}

const formatDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "—";

const formatAmount = (sub: SubscriptionDetails) => {
  if (sub.amount == null || !sub.currency) return "—";
  const value = (sub.amount / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: sub.currency.toUpperCase(),
  });
  const intervalLabel =
    sub.interval === "year" ? "/ano" : sub.interval === "month" ? "/mês" : "";
  return `${value}${intervalLabel}`;
};

const statusLabels: Record<string, { label: string; tone: "success" | "warning" | "destructive" }> = {
  active: { label: "Ativa", tone: "success" },
  trialing: { label: "Em teste", tone: "warning" },
  past_due: { label: "Pagamento em atraso", tone: "destructive" },
  canceled: { label: "Cancelada", tone: "destructive" },
  unpaid: { label: "Não paga", tone: "destructive" },
  incomplete: { label: "Incompleta", tone: "warning" },
};

const toneClasses: Record<"success" | "warning" | "destructive", string> = {
  success: "bg-success/10 text-success border-success/30",
  warning: "bg-warning/10 text-warning border-warning/30",
  destructive: "bg-destructive/10 text-destructive border-destructive/30",
};

export function ManageSubscriptionPanel() {
  const navigate = useNavigate();
  const stripeStatus = useStripeSubscription();
  const [sub, setSub] = useState<SubscriptionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<
    null | "change" | "cancel" | "reactivate" | "refresh"
  >(null);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [confirmChangeOpen, setConfirmChangeOpen] = useState<PlanId | null>(null);

  const load = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-subscription", {
        body: { action: "get_details" },
      });
      if (error) throw new Error(error.message);
      setSub(data?.subscription ?? null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar assinatura";
      toast.error("Não foi possível carregar sua assinatura", { description: msg });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const callAction = async (
    action: "change_plan" | "cancel" | "reactivate",
    extras?: Record<string, unknown>,
  ) => {
    try {
      const { data, error } = await supabase.functions.invoke("manage-subscription", {
        body: { action, ...extras },
      });
      if (error) throw new Error(error.message);
      setSub(data?.subscription ?? null);
      stripeStatus.refetch();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro inesperado";
      toast.error("Ação não concluída", { description: msg });
      return false;
    }
  };

  const handleChangePlan = async (plan: PlanId) => {
    setConfirmChangeOpen(null);
    setActionLoading("change");
    const ok = await callAction("change_plan", { plan });
    if (ok) {
      toast.success(
        plan === "anual"
          ? "Plano alterado para Anual"
          : "Plano alterado para Mensal",
        { description: "A próxima cobrança refletirá o novo plano." },
      );
    }
    setActionLoading(null);
  };

  const handleCancel = async () => {
    setConfirmCancelOpen(false);
    setActionLoading("cancel");
    const ok = await callAction("cancel");
    if (ok) {
      toast.success("Cancelamento agendado", {
        description: "Você continua com acesso até o fim do período pago.",
      });
    }
    setActionLoading(null);
  };

  const handleReactivate = async () => {
    setActionLoading("reactivate");
    const ok = await callAction("reactivate");
    if (ok) {
      toast.success("Assinatura reativada", {
        description: "A renovação automática voltou a ficar ativa.",
      });
    }
    setActionLoading(null);
  };

  const handleRefresh = async () => {
    setActionLoading("refresh");
    await load(false);
    stripeStatus.refetch();
    setActionLoading(null);
  };

  if (loading) {
    return (
      <Card className="border-border/80 bg-card/70">
        <CardContent className="flex items-center justify-center gap-3 p-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Carregando sua assinatura…
        </CardContent>
      </Card>
    );
  }

  if (!sub) return null;

  const status = statusLabels[sub.status] ?? { label: sub.status, tone: "warning" as const };
  const scheduledCancel = sub.cancel_at_period_end;
  const otherPlan: PlanId = sub.plan === "anual" ? "mensal" : "anual";

  return (
    <>
      <Card className="border-success/30 bg-success/5">
        <CardContent className="space-y-6 p-6">
          {/* Cabeçalho */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-success/10">
                <Crown className="h-6 w-6 text-success" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-lg font-semibold text-foreground">
                    {sub.plan === "anual" ? "Plano Anual" : sub.plan === "mensal" ? "Plano Mensal" : "Assinatura"}
                  </p>
                  <Badge variant="outline" className={toneClasses[status.tone]}>
                    {status.label}
                  </Badge>
                  {scheduledCancel && (
                    <Badge variant="outline" className={toneClasses.warning}>
                      Cancelamento agendado
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatAmount(sub)} ·{" "}
                  {scheduledCancel
                    ? `Acesso até ${formatDate(sub.current_period_end)}`
                    : `Próxima renovação em ${formatDate(sub.current_period_end)}`}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={actionLoading !== null}
              >
                {actionLoading === "refresh" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Atualizar status
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("/faturas")}>
                <FileText className="h-4 w-4" />
                Ver faturas
              </Button>
            </div>
          </div>

          {/* Aviso de cancelamento agendado */}
          {scheduledCancel && (
            <div className="rounded-md border border-warning/30 bg-warning/10 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    Sua assinatura será cancelada em {formatDate(sub.current_period_end)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Você continua com acesso completo até essa data. Reative quando quiser.
                  </p>
                </div>
                <Button
                  onClick={handleReactivate}
                  disabled={actionLoading !== null}
                  size="sm"
                >
                  {actionLoading === "reactivate" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                  Reativar assinatura
                </Button>
              </div>
            </div>
          )}

          {/* Ações */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-border/70 bg-background/70 p-4">
              <div className="mb-3 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">Trocar de plano</p>
              </div>
              <p className="mb-3 text-sm text-muted-foreground">
                {sub.plan === "anual"
                  ? "Prefere flexibilidade? Mude para o mensal a qualquer momento."
                  : "Migre para o anual e economize R$ 194 por ano."}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmChangeOpen(otherPlan)}
                disabled={actionLoading !== null || !sub.plan}
                className="w-full"
              >
                {actionLoading === "change" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Mudar para {otherPlan === "anual" ? "Anual" : "Mensal"}
              </Button>
            </div>

            <div className="rounded-md border border-border/70 bg-background/70 p-4">
              <div className="mb-3 flex items-center gap-2">
                <XCircle className="h-4 w-4 text-destructive" />
                <p className="text-sm font-semibold text-foreground">Cancelar assinatura</p>
              </div>
              <p className="mb-3 text-sm text-muted-foreground">
                {scheduledCancel
                  ? "Já está agendada para cancelar no fim do período."
                  : "Sem multa. Você mantém o acesso até o fim do período pago."}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmCancelOpen(true)}
                disabled={actionLoading !== null || scheduledCancel}
                className="w-full"
              >
                {actionLoading === "cancel" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                {scheduledCancel ? "Cancelamento agendado" : "Cancelar assinatura"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirmação cancelamento */}
      <AlertDialog open={confirmCancelOpen} onOpenChange={setConfirmCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar cancelamento</AlertDialogTitle>
            <AlertDialogDescription>
              Sua assinatura será cancelada em{" "}
              <strong>{formatDate(sub.current_period_end)}</strong>. Até lá, você
              continua com acesso completo. Você pode reativar a qualquer momento
              antes dessa data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel}>
              Confirmar cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação troca de plano */}
      <AlertDialog
        open={confirmChangeOpen !== null}
        onOpenChange={(open) => !open && setConfirmChangeOpen(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Mudar para o plano{" "}
              {confirmChangeOpen === "anual" ? "Anual" : "Mensal"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmChangeOpen === "anual"
                ? "A mudança é imediata. O valor proporcional do plano atual é creditado e a cobrança anual entra em vigor agora."
                : "A mudança é imediata. O crédito proporcional do anual é aplicado e a cobrança passa a ser mensal."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmChangeOpen && handleChangePlan(confirmChangeOpen)}
            >
              Confirmar troca
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
