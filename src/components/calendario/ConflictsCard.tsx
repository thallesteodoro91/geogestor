import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCalendarConflicts } from "@/hooks/useCalendarConflicts";
import { Skeleton } from "@/components/ui/skeleton";

export function ConflictsCard() {
  const { conflitos, isLoading } = useCalendarConflicts();
  const ativos = conflitos.filter(c => c.overlapEnd >= new Date()).slice(0, 5);

  return (
    <Card className={ativos.length > 0 ? "border-amber-500/40" : undefined}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className={`h-4 w-4 ${ativos.length > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
            Conflitos detectados
          </CardTitle>
          <Badge variant={ativos.length > 0 ? "destructive" : "outline"} className="text-xs">
            {ativos.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <Skeleton className="h-20 w-full" />}
        {!isLoading && ativos.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum conflito de agenda detectado.</p>
        )}
        {ativos.map((c) => (
          <div key={c.id} className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 space-y-1">
            <p className="text-xs text-muted-foreground">
              Sobreposição em {format(c.overlapStart, "dd/MM HH:mm", { locale: ptBR })} – {format(c.overlapEnd, "HH:mm", { locale: ptBR })}
            </p>
            <p className="text-sm font-medium truncate">{c.a.titulo}</p>
            <p className="text-sm font-medium truncate">{c.b.titulo}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
