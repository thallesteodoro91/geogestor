import { ReactNode } from "react";
import { InfoTooltip } from "@/components/ui/InfoTooltip";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Chave do catálogo central de tooltips a exibir ao lado do título. */
  tooltipKey?: string;
  children?: ReactNode; // CTA buttons / extra controls on the right
}

export function PageHeader({ title, subtitle, tooltipKey, children }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-heading font-bold text-foreground">{title}</h1>
          {tooltipKey && <InfoTooltip termKey={tooltipKey} size="md" />}
        </div>
        {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-3 shrink-0">{children}</div>}
    </div>
  );
}

