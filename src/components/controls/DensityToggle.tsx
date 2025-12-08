/**
 * Density Toggle Component
 * Switch between compact and comfortable display modes
 */

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useChartSettings } from "@/contexts/ChartSettingsContext";
import { LayoutGrid, LayoutList } from "lucide-react";
import { cn } from "@/lib/utils";

interface DensityToggleProps {
  className?: string;
}

export const DensityToggle = ({ className }: DensityToggleProps) => {
  const { density, toggleDensity } = useChartSettings();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={toggleDensity}
            className={cn(
              "h-9 w-9 border-border/50",
              className
            )}
            aria-label={`Alternar para modo ${density === 'compact' ? 'confortável' : 'compacto'}`}
          >
            {density === 'compact' ? (
              <LayoutGrid className="h-4 w-4" />
            ) : (
              <LayoutList className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {density === 'compact' ? 'Modo Confortável' : 'Modo Compacto'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
