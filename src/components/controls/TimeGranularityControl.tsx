/**
 * Time Granularity Control
 * Toggle between month, quarter, and year views for charts
 * Includes navigation arrows to move between periods
 */

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { useChartSettings, TimeGranularity } from "@/contexts/ChartSettingsContext";
import { Calendar, CalendarDays, CalendarRange, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, addMonths, addQuarters, addYears, startOfMonth, startOfQuarter, startOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface TimeGranularityControlProps {
  className?: string;
  size?: 'sm' | 'default';
  showNavigation?: boolean;
}

const getPeriodLabel = (granularity: TimeGranularity, offset: number): string => {
  const now = new Date();
  
  switch (granularity) {
    case 'month': {
      const date = addMonths(startOfMonth(now), offset);
      return format(date, "MMMM 'de' yyyy", { locale: ptBR });
    }
    case 'quarter': {
      const date = addQuarters(startOfQuarter(now), offset);
      const quarter = Math.ceil((date.getMonth() + 1) / 3);
      return `${quarter}º Trimestre de ${format(date, 'yyyy')}`;
    }
    case 'year': {
      const date = addYears(startOfYear(now), offset);
      return format(date, 'yyyy');
    }
  }
};

export const TimeGranularityControl = ({ 
  className,
  size = 'default',
  showNavigation = true,
}: TimeGranularityControlProps) => {
  const { 
    granularity, 
    setGranularity, 
    periodOffset,
    goToPreviousPeriod,
    goToNextPeriod,
    goToCurrentPeriod,
  } = useChartSettings();

  const periodLabel = getPeriodLabel(granularity, periodOffset);
  const isCurrentPeriod = periodOffset === 0;

  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3", className)}>
      {/* Granularity Toggle */}
      <ToggleGroup
        type="single"
        value={granularity}
        onValueChange={(value) => value && setGranularity(value as TimeGranularity)}
        className="bg-muted/50 rounded-lg p-1"
        aria-label="Selecionar período de visualização"
      >
        <ToggleGroupItem
          value="month"
          aria-label="Visualizar por mês"
          className={cn(
            "gap-1.5 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground",
            size === 'sm' && "text-xs px-2 py-1"
          )}
        >
          <Calendar className={cn("h-4 w-4", size === 'sm' && "h-3 w-3")} />
          <span className={size === 'sm' ? 'sr-only sm:not-sr-only' : ''}>Mês</span>
        </ToggleGroupItem>
        <ToggleGroupItem
          value="quarter"
          aria-label="Visualizar por trimestre"
          className={cn(
            "gap-1.5 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground",
            size === 'sm' && "text-xs px-2 py-1"
          )}
        >
          <CalendarDays className={cn("h-4 w-4", size === 'sm' && "h-3 w-3")} />
          <span className={size === 'sm' ? 'sr-only sm:not-sr-only' : ''}>Trimestre</span>
        </ToggleGroupItem>
        <ToggleGroupItem
          value="year"
          aria-label="Visualizar por ano"
          className={cn(
            "gap-1.5 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground",
            size === 'sm' && "text-xs px-2 py-1"
          )}
        >
          <CalendarRange className={cn("h-4 w-4", size === 'sm' && "h-3 w-3")} />
          <span className={size === 'sm' ? 'sr-only sm:not-sr-only' : ''}>Ano</span>
        </ToggleGroupItem>
      </ToggleGroup>

      {/* Period Navigation */}
      {showNavigation && (
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-background"
                  onClick={goToPreviousPeriod}
                  aria-label="Período anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Período anterior</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <span className="text-sm font-medium px-2 min-w-[140px] text-center capitalize">
            {periodLabel}
          </span>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-background"
                  onClick={goToNextPeriod}
                  aria-label="Próximo período"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Próximo período</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {!isCurrentPeriod && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-background text-primary"
                    onClick={goToCurrentPeriod}
                    aria-label="Voltar ao período atual"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Voltar ao período atual</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )}
    </div>
  );
};
