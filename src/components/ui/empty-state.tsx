import { LucideIcon, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  tip?: string;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction, tip, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 px-6 text-center", className)}>
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-5">
        <Icon className="h-8 w-8 text-primary" />
      </div>
      <h3 className="text-lg font-heading font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-md mb-6 leading-relaxed">{description}</p>
      <Button onClick={onAction} size="lg">
        {actionLabel}
      </Button>
      {tip && (
        <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-4 py-2.5">
          <Lightbulb className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          <span>{tip}</span>
        </div>
      )}
    </div>
  );
}
