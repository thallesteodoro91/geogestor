import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, RefreshCw, Unlink, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  getGoogleCalendarStatus,
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  fullSyncGoogleCalendar,
} from "@/services/google-calendar.service";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function GoogleCalendarCard() {
  const queryClient = useQueryClient();
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const { data: status, isLoading } = useQuery({
    queryKey: ["google-calendar-status"],
    queryFn: getGoogleCalendarStatus,
    refetchInterval: 30000,
  });

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await connectGoogleCalendar();
      queryClient.invalidateQueries({ queryKey: ["google-calendar-status"] });
      toast.success("Google Calendar conectado com sucesso!");
    } catch (error: any) {
      if (error.message !== "Tempo limite de autorização excedido") {
        toast.error(error.message || "Erro ao conectar Google Calendar");
      }
    } finally {
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
        `Sincronização concluída: ${result.synced} eventos sincronizados${result.errors > 0 ? `, ${result.errors} erros` : ""}`
      );
    } catch (error: any) {
      toast.error(error.message || "Erro na sincronização");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <CardTitle>Google Calendar</CardTitle>
          </div>
          {status?.connected && (
            <Badge variant="outline" className="border-green-500/50 text-green-600 dark:text-green-400">
              Conectado
            </Badge>
          )}
        </div>
        <CardDescription>
          Sincronize orçamentos e serviços com o Google Calendar
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Verificando conexão...
          </div>
        ) : status?.connected ? (
          <>
            <div className="space-y-2 text-sm">
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

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleFullSync}
                disabled={syncing}
              >
                {syncing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                {syncing ? "Sincronizando..." : "Sincronizar Tudo"}
              </Button>
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
              Conecte sua conta Google para sincronizar automaticamente orçamentos e serviços com seu calendário.
            </p>
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
