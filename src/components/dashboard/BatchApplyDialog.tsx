import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Loader2, RotateCcw, Wand2 } from "lucide-react";
import { useAiSuggestions } from "@/hooks/useAiSuggestions";
import {
  orderSuggestions,
  enforceBatchLimit,
  BATCH_LIMIT,
} from "@/lib/aiBatchApply";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

interface DiffEntry {
  suggestion_id: string;
  table: string;
  op: "insert" | "update" | "noop";
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

interface ApplyResult {
  applied: string[];
  failed: Array<{ id: string; error: string }>;
  skipped: Array<{ id: string; reason: string }>;
  diff: DiffEntry[];
  rolled_back?: string[];
  invariant_errors?: string[];
}

export function BatchApplyDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const { data: suggestions = [], isLoading } = useAiSuggestions("pending");
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [preview, setPreview] = useState<ApplyResult | null>(null);
  const [result, setResult] = useState<ApplyResult | null>(null);

  const plan = useMemo(() => {
    const filtered = suggestions.filter((s) => !excluded.has(s.id));
    const { ordered, skipped } = orderSuggestions(filtered);
    const { execute, deferred } = enforceBatchLimit(ordered);
    return { execute, deferred, skipped };
  }, [suggestions, excluded]);

  const toggle = (id: string) => {
    setExcluded((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
    setPreview(null);
    setResult(null);
  };

  const runPreview = async () => {
    setPreviewing(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        "apply-ai-suggestions",
        {
          body: {
            dry_run: true,
            suggestion_ids: plan.execute.map((s) => s.id),
          },
        },
      );
      if (error) throw error;
      setPreview(data as ApplyResult);
    } catch (e) {
      toast({
        title: "Falha ao gerar pré-visualização",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setPreviewing(false);
    }
  };

  const runApply = async () => {
    setApplying(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "apply-ai-suggestions",
        {
          body: {
            dry_run: false,
            suggestion_ids: plan.execute.map((s) => s.id),
          },
        },
      );
      if (error) throw error;
      const r = data as ApplyResult;
      setResult(r);
      qc.invalidateQueries({ queryKey: ["ai-suggestions"] });
      qc.invalidateQueries({ queryKey: ["ai-insights"] });
      if (r.invariant_errors?.length) {
        toast({
          title: "Lote revertido",
          description: `Invariantes quebrados: ${r.invariant_errors.join(", ")}`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Lote aplicado",
          description: `${r.applied.length} aplicada(s), ${r.failed.length} falhou, ${r.skipped.length} ignorada(s).`,
        });
      }
    } catch (e) {
      toast({
        title: "Falha ao aplicar lote",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setApplying(false);
    }
  };

  const runRollback = async () => {
    if (!result?.applied.length) return;
    setRolling(true);
    try {
      const { error } = await supabase.functions.invoke(
        "rollback-ai-suggestions",
        { body: { suggestion_ids: result.applied } },
      );
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["ai-suggestions"] });
      toast({ title: "Reversão concluída" });
      onOpenChange(false);
    } catch (e) {
      toast({
        title: "Falha ao reverter",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setRolling(false);
    }
  };

  const grouped = useMemo(() => {
    const map = new Map<string, typeof plan.execute>();
    for (const s of plan.execute) {
      const arr = map.get(s.category) ?? [];
      arr.push(s);
      map.set(s.category, arr);
    }
    return Array.from(map.entries());
  }, [plan.execute]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Aplicar sugestões da IA em lote
          </DialogTitle>
          <DialogDescription>
            Revise o plano ordenado por dependência. Limite de {BATCH_LIMIT}{" "}
            sugestões por execução. A pré-visualização é obrigatória antes de
            aplicar.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Carregando sugestões…
            </div>
          ) : suggestions.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma sugestão pendente.
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {plan.deferred.length > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Lote dividido</AlertTitle>
                  <AlertDescription>
                    {plan.deferred.length} sugestão(ões) ficarão para a próxima
                    execução.
                  </AlertDescription>
                </Alert>
              )}
              {plan.skipped.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Sugestões ignoradas</AlertTitle>
                  <AlertDescription>
                    {plan.skipped.length} ignoradas por dependência inválida ou
                    ciclo.
                  </AlertDescription>
                </Alert>
              )}

              {grouped.map(([cat, items]) => (
                <div key={cat} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{cat}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {items.length} sugestão(ões)
                    </span>
                  </div>
                  {items.map((s) => {
                    const sFull = suggestions.find((x) => x.id === s.id);
                    return (
                      <div
                        key={s.id}
                        className="flex items-start gap-2 rounded border p-2"
                      >
                        <Checkbox
                          checked={!excluded.has(s.id)}
                          onCheckedChange={() => toggle(s.id)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {sFull?.title ?? s.id}
                          </div>
                          {sFull?.description && (
                            <div className="text-xs text-muted-foreground line-clamp-2">
                              {sFull.description}
                            </div>
                          )}
                          <div className="text-[10px] text-muted-foreground mt-1">
                            ação: {s.action_type} • prioridade: {s.priority}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              {preview && (
                <div className="rounded border bg-muted/30 p-3 space-y-2">
                  <div className="text-xs font-semibold">
                    Diff consolidado ({preview.diff.length} mudança(s))
                  </div>
                  <div className="space-y-1 text-xs font-mono max-h-48 overflow-y-auto">
                    {preview.diff.map((d, i) => (
                      <div key={i}>
                        <span className="text-primary">{d.op}</span>{" "}
                        <span className="text-muted-foreground">{d.table}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result && (
                <Alert
                  variant={
                    result.invariant_errors?.length ? "destructive" : "default"
                  }
                >
                  <AlertTitle>Resultado</AlertTitle>
                  <AlertDescription className="text-xs space-y-1">
                    <div>Aplicadas: {result.applied.length}</div>
                    <div>Falharam: {result.failed.length}</div>
                    <div>Ignoradas: {result.skipped.length}</div>
                    {result.rolled_back && (
                      <div>Revertidas automaticamente: {result.rolled_back.length}</div>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="flex-wrap gap-2">
          {result && result.applied.length > 0 && (
            <Button
              variant="outline"
              onClick={runRollback}
              disabled={rolling}
              className="mr-auto"
            >
              {rolling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              Reverter aplicadas
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button
            variant="secondary"
            onClick={runPreview}
            disabled={previewing || plan.execute.length === 0}
          >
            {previewing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Pré-visualizar diff
          </Button>
          <Button
            onClick={runApply}
            disabled={applying || !preview || plan.execute.length === 0}
          >
            {applying && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Aplicar em lote ({plan.execute.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
