import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, ExternalLink, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCalendarEventos } from "@/hooks/useCalendarEventos";
import { Skeleton } from "@/components/ui/skeleton";

export function UpcomingSyncedCard() {
  const now = new Date();
  const in14d = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const { data: eventos = [], isLoading } = useCalendarEventos(now, in14d);

  const proximos = eventos
    .filter(e => e.end >= now)
    .slice(0, 6);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <RefreshCw className="h-4 w-4 text-primary" />
            Próximos compromissos sincronizados
          </CardTitle>
          <Badge variant="outline" className="text-xs">{proximos.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <Skeleton className="h-24 w-full" />}
        {!isLoading && proximos.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum compromisso nos próximos 14 dias.</p>
        )}
        {proximos.map((evt) => (
          <div key={evt.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{evt.titulo}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <CalendarIcon className="h-3 w-3" />
                {format(evt.start, "dd/MM HH:mm", { locale: ptBR })}
                {evt.cliente && <> • {evt.cliente}</>}
              </p>
            </div>
            <Badge variant={evt.origem === "google" ? "secondary" : "default"} className="text-[10px] shrink-0">
              {evt.origem === "google" ? "Google" : "SkyGeo"}
            </Badge>
            {evt.htmlLink && (
              <Button asChild size="icon" variant="ghost" className="h-6 w-6 shrink-0">
                <a href={evt.htmlLink} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
