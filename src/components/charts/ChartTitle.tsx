import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ChartTitleProps {
  title: string;
  description: string;
  calculation?: string;
}

export const ChartTitle = ({ title, description, calculation }: ChartTitleProps) => {
  return (
    <div className="flex items-center gap-2">
      <span className="text-lg font-heading font-semibold text-foreground">{title}</span>
      <TooltipProvider>
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <Info className="h-4 w-4 text-muted-foreground cursor-help hover:text-primary transition-colors" />
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs">
            <div className="space-y-2">
              <p className="text-sm font-medium">{description}</p>
              {calculation && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold">Cálculo:</span> {calculation}
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};
