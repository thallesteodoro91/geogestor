import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, AlertTriangle, X } from "lucide-react";
import { useState } from "react";
import { getGoogleCalendarStatus } from "@/services/google-calendar.service";

const DISMISS_KEY = "calendar-connect-banner-dismissed";

export function CalendarConnectBanner() {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState<boolean>(
    () => typeof window !== "undefined" && sessionStorage.getItem(DISMISS_KEY) === "1",
  );

  const { data: status } = useQuery({
    queryKey: ["google-calendar-status"],
    queryFn: getGoogleCalendarStatus,
    staleTime: 30_000,
  });

  if (!status || dismissed) return null;

  const needsReconnect = status.connection_status === "needs_reconnect";
  if (status.connected && !needsReconnect) return null;

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-transparent p-4 flex items-center gap-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 shrink-0">
        {needsReconnect ? (
          <AlertTriangle className="h-5 w-5 text-amber-600" />
        ) : (
          <Calendar className="h-5 w-5 text-primary" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          {needsReconnect
            ? "Sua conexão Google Calendar expirou"
            : "Conecte sua agenda Google e receba lembretes no celular"}
        </p>
        <p className="text-xs text-muted-foreground">
          {needsReconnect
            ? "Reconecte para retomar a sincronização automática de eventos."
            : "Sincronize orçamentos, serviços e visitas com cores por tipo e notificações nativas."}
        </p>
      </div>
      <Button size="sm" onClick={() => navigate("/configuracoes?tab=integracoes")}>
        {needsReconnect ? "Reconectar" : "Conectar"}
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleDismiss}>
        <X className="h-4 w-4" />
      </Button>
    </Card>
  );
}
