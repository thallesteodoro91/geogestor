import { InfoTooltip } from "@/components/ui/InfoTooltip";

interface ChartTitleProps {
  title: string;
  description?: string;
  calculation?: string;
  /** Chave do catálogo central de tooltips (preferida). */
  tooltipKey?: string;
}

export const ChartTitle = ({ title, description, calculation, tooltipKey }: ChartTitleProps) => {
  return (
    <div className="flex items-center gap-2">
      <span className="text-lg font-heading font-semibold text-foreground">{title}</span>
      <InfoTooltip
        termKey={tooltipKey}
        title={title}
        content={description}
        calculation={calculation}
        side="right"
        size="md"
      />
    </div>
  );
};
