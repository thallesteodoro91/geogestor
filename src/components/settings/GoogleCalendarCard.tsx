import { useState, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Calendar,
  RefreshCw,
  Unlink,
  Link2,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import {
  getGoogleCalendarStatus,
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  fullSyncGoogleCalendar,
  listGoogleCalendars,
  updateGoogleCalendarPreferences,
  type GoogleCalendarSyncTypes,
} from "@/services/google-calendar.service";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ALL_CATEGORIES, EVENT_CATEGORIES } from "@/lib/calendar/eventCategories";

export function GoogleCalendarCard() {
  const queryClient = useQueryClient();
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gcResult = params.get("google-calendar");
    if (gcResult === "success") {
      toast.success("Google Calendar conectado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["google-calendar-status"] });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (gcResult === "error") {
      toast.error("Erro ao conectar Google Calendar");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [queryClient]);

  const { data: status, isLoading } = useQuery({
    queryKey: ["google-calendar-status"],
    queryFn: getGoogleCalendarStatus,
    refetchInterval: 30000,
  });

  const { data: calendars } = useQuery({
    queryKey: ["google-calendar-list"],
    queryFn: listGoogleCalendars,
    enabled: !!status?.connected && status?.connection_status === "active",
  });

  const prefsMutation = useMutation({
    mutationFn: updateGoogleCalendarPreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-calendar-status"] });
      toast.success("Preferências atualizadas");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar preferências"),
  });

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await connectGoogleCalendar();
    } catch (error: any) {
      toast.error(error.message || "Erro ao conectar Google Calendar");
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnectGoogleCalendar();
      queryClient.invalidateQueries({ queryKey: ["google-calendar-status"] });
      toast.success("Google Calendar desconectado");
    } catch (error: any) {
      toast.error(error.message || "Erro ao desconectar");
    } finally {
      setDisconnecting(false);
    }
  };

  const handleFullSync = async () => {
    setSyncing(true);
    try {
      const result = await fullSyncGoogleCalendar();
      queryClient.invalidateQueries({ queryKey: ["google-calendar-status"] });
      toast.success(
        `Sincronização concluída: ${result.synced} eventos${result.errors > 0 ? `, ${result.errors} erros` : ""}`,
      );
    } catch (error: any) {
      toast.error(error.message || "Erro na sincronização");
    } finally {
      setSyncing(false);
    }
  };

  const needsReconnect = status?.connection_status === "needs_reconnect";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <CardTitle>Google Calendar</CardTitle>
          </div>
          {status?.connected && !needsReconnect && (
            <Badge
              variant="outline"
              className="border-green-500/50 text-green-600 dark:text-green-400"
            >
              Conectado
            </Badge>
          )}
          {needsReconnect && (
            <Badge variant="outline" className="border-amber-500/50 text-amber-600">
              Reconectar
            </Badge>
          )}
        </div>
        <CardDescription>
          Sincronização bidirecional de orçamentos, serviços, visitas e compromissos com sua agenda Google.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Verificando conexão...
          </div>
        ) : status?.connected ? (
          <>
            {needsReconnect && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Sua sessão Google expirou. Reconecte para retomar a sincronização.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-1 text-sm">
              {status.last_synced_at && (
                <p className="text-muted-foreground">
                  Última sincronização:{" "}
                  <span className="font-medium text-foreground">
                    {formatDistanceToNow(new Date(status.last_synced_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </span>
                </p>
              )}
              {status.connected_at && (
                <p className="text-muted-foreground">
                  Conectado{" "}
                  {formatDistanceToNow(new Date(status.connected_at), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </p>
              )}
            </div>

            {/* Calendário-alvo */}
            <div className="space-y-2">
              <Label>Calendário sincronizado</Label>
              <Select
                value={status.selected_calendar_id || "primary"}
                onValueChange={(value) => {
                  const cal = calendars?.find((c) => c.id === value);
                  prefsMutation.mutate({
                    selected_calendar_id: value,
                    calendar_label: cal?.summary || "",
                  });
                }}
                disabled={prefsMutation.isPending || !calendars?.length}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar calendário" />
                </SelectTrigger>
                <SelectContent>
                  {(calendars || []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.summary}
                      {c.primary ? " (principal)" : ""}
                    </SelectItem>
                  ))}
                  {!calendars?.length && (
                    <SelectItem value="primary">Calendário principal</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Sync automático */}
            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="auto-sync">Sincronização automática</Label>
                <p className="text-xs text-muted-foreground">
                  Envia eventos para o Google ao criar ou editar.
                </p>
              </div>
              <Switch
                id="auto-sync"
                checked={status.auto_sync_enabled}
                onCheckedChange={(v) => prefsMutation.mutate({ auto_sync_enabled: v })}
                disabled={prefsMutation.isPending}
              />
            </div>

            {/* Tipos sincronizados */}
            <div className="space-y-2">
              <Label>Tipos de evento sincronizados</Label>
              <div className="grid grid-cols-2 gap-2">
                {ALL_CATEGORIES.map((cat) => {
                  const meta = EVENT_CATEGORIES[cat];
                  const enabled = status.sync_types?.[cat] !== false;
                  return (
                    <label
                      key={cat}
                      className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-accent"
                    >
                      <Checkbox
                        checked={enabled}
                        onCheckedChange={(v) => {
                          const next: GoogleCalendarSyncTypes = {
                            ...(status.sync_types || {}),
                            [cat]: !!v,
                          };
                          prefsMutation.mutate({ sync_types: next });
                        }}
                        disabled={prefsMutation.isPending}
                      />
                      <span
                        className={`inline-block h-2.5 w-2.5 rounded-full ${meta.badgeClass}`}
                      />
                      <span className="text-sm">{meta.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleFullSync}
                disabled={syncing || needsReconnect}
              >
                {syncing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                {syncing ? "Sincronizando..." : "Sincronizar tudo"}
              </Button>
              {needsReconnect && (
                <Button size="sm" onClick={handleConnect} disabled={connecting}>
                  <Link2 className="h-4 w-4 mr-2" />
                  Reconectar
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="text-destructive hover:text-destructive"
              >
                {disconnecting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Unlink className="h-4 w-4 mr-2" />
                )}
                Desconectar
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Conecte sua conta Google para sincronizar automaticamente orçamentos, serviços e visitas com sua agenda. Eventos
              criados no Google também aparecem aqui.
            </p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>Cores por tipo de evento</li>
              <li>Lembretes automáticos</li>
              <li>Notificações push no celular</li>
            </ul>
            <Button onClick={handleConnect} disabled={connecting}>
              {connecting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4 mr-2" />
              )}
              {connecting ? "Conectando..." : "Conectar Google Calendar"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
