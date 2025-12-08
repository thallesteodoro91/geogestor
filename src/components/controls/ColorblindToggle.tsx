/**
 * Colorblind Mode Toggle
 * Switch between standard and colorblind-safe color palettes
 */

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useChartSettings } from "@/contexts/ChartSettingsContext";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface ColorblindToggleProps {
  className?: string;
}

export const ColorblindToggle = ({ className }: ColorblindToggleProps) => {
  const { colorblindMode, toggleColorblindMode } = useChartSettings();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={toggleColorblindMode}
            className={cn(
              "h-9 w-9 border-border/50",
              colorblindMode && "bg-primary/10 border-primary/50",
              className
            )}
            aria-label={`${colorblindMode ? 'Desativar' : 'Ativar'} modo de cores acessíveis`}
            aria-pressed={colorblindMode}
          >
            {colorblindMode ? (
              <Eye className="h-4 w-4 text-primary" />
            ) : (
              <EyeOff className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {colorblindMode ? 'Cores padrão' : 'Cores acessíveis (daltonismo)'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
