import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FilterEmptyStateProps {
  onClearFilters?: () => void;
  className?: string;
  message?: string;
}

export function FilterEmptyState({
  onClearFilters,
  className,
  message = "Nenhum resultado para os filtros aplicados",
}: FilterEmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 px-6 text-center", className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
        <Search className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground mb-1">{message}</p>
      <p className="text-xs text-muted-foreground mb-4">Tente termos diferentes ou limpe os filtros</p>
      {onClearFilters && (
        <Button variant="outline" size="sm" onClick={onClearFilters} className="gap-1.5">
          <X className="h-3.5 w-3.5" />
          Limpar filtros
        </Button>
      )}
    </div>
  );
}
