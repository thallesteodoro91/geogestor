import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, RefreshCw, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import { useTenant } from "@/contexts/TenantContext";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { retryCalendarSyncJob, retryAllFailedCalendarSyncJobs } from "@/services/google-calendar.service";
import { logAuditEvent } from "@/services/audit.service";

type Job = {
  id: string;
  operation: string;
  entity_type: string | null;
  entity_id: string | null;
  status: string;
  attempts: number;
  last_error: string | null;
  scheduled_at: string;
  updated_at: string;
};

export function CalendarSyncQueueCard() {
  const { isAdmin } = useUserRole();
  const { tenant } = useTenant();
  const queryClient = useQueryClient();

  const { data: jobs, isLoading } = useQuery({
    queryKey: ["calendar-sync-queue", tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calendar_sync_queue")
        .select("id, operation, entity_type, entity_id, status, attempts, last_error, scheduled_at, updated_at")
        .eq("tenant_id", tenant!.id)
        .in("status", ["pending", "processing", "failed"])
        .order("updated_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as Job[];
    },
    enabled: isAdmin && !!tenant?.id,
    refetchInterval: 15_000,
  });

  const retryOne = useMutation({
    mutationFn: async (job: Job) => {
      const res = await retryCalendarSyncJob(job.id);
      await logAuditEvent({
        action: "UPDATE",
        entity: "calendar_sync_queue",
        entityId: job.id,
        oldData: { status: job.status, attempts: job.attempts, last_error: job.last_error },
        newData: { action: "retry-job", operation: job.operation, entity_type: job.entity_type, result: "success" },
      });
      return res;
    },
    onSuccess: () => {
      toast.success("Job reagendado");
      queryClient.invalidateQueries({ queryKey: ["calendar-sync-queue"] });
    },
    onError: async (e: any, job) => {
      await logAuditEvent({
        action: "UPDATE",
        entity: "calendar_sync_queue",
        entityId: job?.id,
        newData: { action: "retry-job", result: "error", error: e?.message || String(e) },
      });
      toast.error(e.message || "Erro ao reagendar");
    },
  });

  const retryAll = useMutation({
    mutationFn: async () => {
      const failedIds = (jobs || []).filter((j) => j.status === "failed").map((j) => j.id);
      const res = await retryAllFailedCalendarSyncJobs();
      await logAuditEvent({
        action: "UPDATE",
        entity: "calendar_sync_queue",
        newData: {
          action: "retry-all-failed",
          result: "success",
          count: res?.count ?? failedIds.length,
          job_ids: failedIds,
        },
      });
      return res;
    },
    onSuccess: (res) => {
      toast.success(`${res.count} jobs reagendados`);
      queryClient.invalidateQueries({ queryKey: ["calendar-sync-queue"] });
    },
    onError: async (e: any) => {
      await logAuditEvent({
        action: "UPDATE",
        entity: "calendar_sync_queue",
        newData: { action: "retry-all-failed", result: "error", error: e?.message || String(e) },
      });
      toast.error(e.message || "Erro ao reagendar");
    },
  });

  if (!isAdmin) return null;

  const failedCount = jobs?.filter((j) => j.status === "failed").length || 0;
  const pendingCount = jobs?.filter((j) => j.status === "pending").length || 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Fila de sincronização do Google Calendar</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {failedCount > 0 && (
              <Badge variant="outline" className="border-rose-500/50 text-rose-600">
                {failedCount} falhas
              </Badge>
            )}
            {pendingCount > 0 && (
              <Badge variant="outline" className="border-amber-500/50 text-amber-600">
                {pendingCount} pendentes
              </Badge>
            )}
            {failedCount > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => retryAll.mutate()}
                disabled={retryAll.isPending}
              >
                {retryAll.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                )}
                Reagendar falhas
              </Button>
            )}
          </div>
        </div>
        <CardDescription>Monitoramento de jobs de sincronização (admins)</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando...
          </div>
        ) : !jobs?.length ? (
          <p className="text-sm text-muted-foreground py-4">Nenhum job na fila — tudo sincronizado.</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="flex items-center gap-3 rounded-md border p-2.5 text-sm"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{job.operation}</span>
                    <span className="text-xs text-muted-foreground">
                      {job.entity_type || "—"}
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        job.status === "failed"
                          ? "border-rose-500/50 text-rose-600"
                          : job.status === "processing"
                            ? "border-blue-500/50 text-blue-600"
                            : "border-amber-500/50 text-amber-600"
                      }
                    >
                      {job.status}
                    </Badge>
                    {job.attempts > 0 && (
                      <span className="text-xs text-muted-foreground">{job.attempts} tentativas</span>
                    )}
                  </div>
                  {job.last_error && (
                    <p className="text-xs text-rose-600 truncate flex items-center gap-1 mt-0.5">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      {job.last_error}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Próx. tentativa{" "}
                    {formatDistanceToNow(new Date(job.scheduled_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </p>
                </div>
                {job.status === "failed" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => retryOne.mutate(job.id)}
                    disabled={retryOne.isPending}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
