import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  ListChecks,
  Calendar,
  Lightbulb,
} from "lucide-react";
import { format, differenceInDays, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { fetchTarefasByServico } from "@/modules/operations/services/servico-tarefas.service";

type DeadlineStatus = "on_track" | "attention" | "overdue" | "completed" | "no_deadline";

interface ProjectProgressCardProps {
  servicoId: string;
  dataInicio: string | null;
  dataFim: string | null;
  descricao?: string | null;
}

function getDeadlineStatus(
  progress: number,
  dataInicio: string | null,
  dataFim: string | null
): { status: DeadlineStatus; daysLeft: number; timeElapsedPct: number } {
  if (progress >= 100) return { status: "completed", daysLeft: 0, timeElapsedPct: 100 };
  if (!dataFim) return { status: "no_deadline", daysLeft: 0, timeElapsedPct: 0 };

  const today = new Date();
  const end = new Date(dataFim);
  const daysLeft = differenceInDays(end, today);

  if (daysLeft < 0) return { status: "overdue", daysLeft: Math.abs(daysLeft), timeElapsedPct: 100 };

  if (!dataInicio) return { status: "on_track", daysLeft, timeElapsedPct: 0 };

  const start = new Date(dataInicio);
  const totalDuration = differenceInDays(end, start);
  const elapsed = differenceInDays(today, start);
  const timeElapsedPct = totalDuration > 0 ? Math.round((elapsed / totalDuration) * 100) : 0;

  if (timeElapsedPct > progress + 20) return { status: "attention", daysLeft, timeElapsedPct };
  return { status: "on_track", daysLeft, timeElapsedPct };
}

const STATUS_CONFIG: Record<DeadlineStatus, { color: string; progressClass: string; icon: typeof CheckCircle2 }> = {
  completed: { color: "text-emerald-600 dark:text-emerald-400", progressClass: "[&>div]:bg-emerald-500", icon: CheckCircle2 },
  on_track: { color: "text-emerald-600 dark:text-emerald-400", progressClass: "[&>div]:bg-emerald-500", icon: TrendingUp },
  attention: { color: "text-amber-600 dark:text-amber-400", progressClass: "[&>div]:bg-amber-500", icon: Clock },
  overdue: { color: "text-rose-600 dark:text-rose-400", progressClass: "[&>div]:bg-rose-500", icon: AlertTriangle },
  no_deadline: { color: "text-blue-600 dark:text-blue-400", progressClass: "[&>div]:bg-blue-500", icon: Calendar },
};

export function ProjectProgressCard({ servicoId, dataInicio, dataFim, descricao }: ProjectProgressCardProps) {
  const { data: tarefas = [] } = useQuery({
    queryKey: ["servico-tarefas", servicoId],
    queryFn: async () => {
      const { data } = await fetchTarefasByServico(servicoId);
      return data || [];
    },
  });

  const totalTarefas = tarefas.length;
  const concluidas = tarefas.filter((t: any) => t.concluida).length;
  const progress = totalTarefas > 0 ? Math.round((concluidas / totalTarefas) * 100) : 0;

  const deadline = useMemo(
    () => getDeadlineStatus(progress, dataInicio, dataFim),
    [progress, dataInicio, dataFim]
  );

  const config = STATUS_CONFIG[deadline.status];
  const Icon = config.icon;

  const forecast = useMemo(() => {
    if (progress >= 100 || !dataInicio || totalTarefas === 0 || concluidas === 0)
      return null;
    const start = new Date(dataInicio);
    const elapsed = differenceInDays(new Date(), start);
    if (elapsed <= 0) return null;
    const velocity = concluidas / elapsed;
    const remaining = totalTarefas - concluidas;
    const daysNeeded = Math.ceil(remaining / velocity);
    return addDays(new Date(), daysNeeded);
  }, [dataInicio, totalTarefas, concluidas, progress]);

  const suggestion = useMemo(() => {
    if (totalTarefas === 0) return "Adicione tarefas para acompanhar o progresso do projeto";
    if (progress >= 100) return "Projeto finalizado! Atualize o status para Concluído";
    if (deadline.status === "overdue") return "Priorize as tarefas pendentes para recuperar o prazo";
    if (deadline.status === "attention") return "O ritmo atual está abaixo do necessário — revise as prioridades";
    return `Continue no ritmo atual — ${totalTarefas - concluidas} tarefa(s) pendente(s)`;
  }, [totalTarefas, concluidas, progress, deadline.status]);

  const deadlineLabel = useMemo(() => {
    switch (deadline.status) {
      case "completed": return "Concluído";
      case "overdue": return `Atrasado — prazo venceu há ${deadline.daysLeft} dia(s)`;
      case "attention": return `Atenção — ${deadline.timeElapsedPct}% do prazo usado, ${progress}% concluído`;
      case "on_track": return dataFim ? `No prazo — faltam ${deadline.daysLeft} dia(s)` : "No prazo";
      case "no_deadline": return "Sem prazo definido";
    }
  }, [deadline, progress, dataFim]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-muted-foreground" />
          Progresso do Projeto
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar + percentage */}
        <div className="flex items-center gap-4">
          <Progress value={progress} className={`flex-1 h-3 ${config.progressClass}`} />
          <span className="text-2xl font-bold text-foreground">{progress}%</span>
        </div>

        {/* Task count */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {totalTarefas > 0
              ? `${concluidas} de ${totalTarefas} tarefas concluídas`
              : "Nenhuma tarefa cadastrada"}
          </span>
          <Badge variant="outline" className={`${config.color} border-current/20 gap-1`}>
            <Icon className="h-3 w-3" />
            {deadlineLabel}
          </Badge>
        </div>

        {/* Forecast */}
        {forecast && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            <span>
              Previsão de conclusão:{" "}
              <span className="font-medium text-foreground">
                {format(forecast, "dd 'de' MMMM", { locale: ptBR })}
              </span>
            </span>
          </div>
        )}

        {/* Suggestion */}
        <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm">
          <Lightbulb className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
          <span className="text-muted-foreground">{suggestion}</span>
        </div>

        {descricao && (
          <p className="text-sm text-muted-foreground pt-2 border-t border-border">
            {descricao}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** Utility for external use (e.g. KanbanBoard) */
export function getProgressColor(
  progress: number,
  dataFim: string | null
): string {
  if (progress >= 100) return "bg-emerald-500";
  if (!dataFim) return "bg-primary";
  const daysLeft = differenceInDays(new Date(dataFim), new Date());
  if (daysLeft < 0) return "bg-rose-500";
  if (daysLeft < 7 && progress < 80) return "bg-amber-500";
  return "bg-emerald-500";
}
