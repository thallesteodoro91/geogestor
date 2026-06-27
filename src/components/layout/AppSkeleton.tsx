import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

/**
 * AppSkeleton — placeholder de carregamento global.
 *
 * Após 8s exibe aviso e botão de recarregar para o usuário não ficar travado
 * num skeleton infinito quando há problema de rede ou hidratação.
 */
export const AppSkeleton = () => {
  const [showWarn, setShowWarn] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setShowWarn(true), 8000);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div
      className="min-h-dvh bg-background flex"
      role="status"
      aria-live="polite"
      aria-label="Carregando aplicação"
    >
      {/* Sidebar Skeleton - visible only on md+ */}
      <div className="hidden md:flex w-64 flex-col border-r border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-8">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        <div className="space-y-6">
          {[1, 2, 3, 4].map((section) => (
            <div key={section} className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <div className="space-y-1">
                {[1, 2, 3].map((item) => (
                  <Skeleton key={item} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col">
        <div className="h-16 border-b border-border bg-card flex items-center px-6 gap-4">
          <Skeleton className="h-10 flex-1 max-w-md rounded-lg" />
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>

        <div className="flex-1 p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-card rounded-lg p-6 border border-border">
                <Skeleton className="h-4 w-24 mb-3" />
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
          <div className="bg-card rounded-lg p-6 border border-border">
            <Skeleton className="h-6 w-40 mb-4" />
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>

          {showWarn && (
            <div className="mx-auto max-w-md text-center space-y-3 pt-4">
              <p className="text-sm text-muted-foreground">
                Está demorando mais que o normal. Verifique sua conexão.
              </p>
              <Button
                size="sm"
                variant="default"
                onClick={() => window.location.reload()}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Recarregar
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
