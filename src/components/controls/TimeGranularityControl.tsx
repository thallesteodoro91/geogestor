/**
 * Time Granularity Control
 * Toggle between month, quarter, and year views for charts
 */

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useChartSettings } from "@/contexts/ChartSettingsContext";
import { Calendar, CalendarDays, CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimeGranularityControlProps {
  className?: string;
  size?: 'sm' | 'default';
}

export const TimeGranularityControl = ({ 
  className,
  size = 'default',
}: TimeGranularityControlProps) => {
  const { granularity, setGranularity } = useChartSettings();

  return (
    <ToggleGroup
      type="single"
      value={granularity}
      onValueChange={(value) => value && setGranularity(value as 'month' | 'quarter' | 'year')}
      className={cn("bg-muted/50 rounded-lg p-1", className)}
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
  );
};
