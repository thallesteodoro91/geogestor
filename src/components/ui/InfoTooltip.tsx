import { ReactNode, useState } from "react";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getTooltip, type TooltipEntry } from "@/lib/tooltips/catalog";

export interface InfoTooltipProps {
  /** Chave do catálogo central (`src/lib/tooltips/catalog.ts`). Preferido. */
  termKey?: string;
  /** Conteúdo livre quando a informação é dinâmica (ex.: importação por tipo de campo). */
  content?: ReactNode;
  /** Título exibido em negrito (sobrescreve o do catálogo). */
  title?: string;
  /** Linha "Cálculo:" extra (sobrescreve o do catálogo). */
  calculation?: string;
  side?: "top" | "right" | "bottom" | "left";
  size?: "xs" | "sm" | "md";
  className?: string;
  iconClassName?: string;
}

const SIZE_CLASS: Record<NonNullable<InfoTooltipProps["size"]>, string> = {
  xs: "h-3 w-3",
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
};

/**
 * Ícone de ajuda padronizado do SaaS.
 *
 * - Use sempre que precisar de um ícone Info com tooltip.
 * - Prefira passar `termKey` apontando para o catálogo central.
 * - Em mobile, o toque alterna a abertura (Radix abre no focus por padrão).
 */
export function InfoTooltip({
  termKey,
  content,
  title,
  calculation,
  side = "top",
  size = "sm",
  className,
  iconClassName,
}: InfoTooltipProps) {
  const [open, setOpen] = useState<boolean | undefined>(undefined);

  const entry: TooltipEntry | undefined = termKey ? getTooltip(termKey) : undefined;
  const resolvedTitle = title ?? entry?.title;
  const resolvedCalc = calculation ?? entry?.calculation;
  const resolvedContent: ReactNode = content ?? entry?.description ?? null;

  if (!resolvedContent) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn(
        `[InfoTooltip] sem conteúdo (termKey="${termKey ?? "—"}"). Use uma chave do catálogo ou prop content.`,
      );
    }
    return null;
  }

  const ariaLabel = resolvedTitle
    ? `Mais informações sobre ${resolvedTitle}`
    : "Mais informações";

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={ariaLabel}
            onClick={(e) => {
              // Em touch screens, alterna a abertura.
              e.preventDefault();
              setOpen((v) => (v === undefined ? true : !v));
            }}
            className={cn(
              "inline-flex items-center justify-center rounded-full text-muted-foreground/70",
              "hover:text-primary focus-visible:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              "transition-colors cursor-help",
              className,
            )}
          >
            <Info className={cn(SIZE_CLASS[size], "shrink-0", iconClassName)} />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs text-xs p-3 space-y-1.5">
          {resolvedTitle && (
            <p className="text-sm font-semibold leading-tight">{resolvedTitle}</p>
          )}
          <div className="text-popover-foreground/90 leading-relaxed">
            {typeof resolvedContent === "string" ? <p>{resolvedContent}</p> : resolvedContent}
          </div>
          {resolvedCalc && (
            <p className="text-[11px] text-muted-foreground pt-1 border-t border-border/50">
              <span className="font-semibold">Cálculo:</span> {resolvedCalc}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
