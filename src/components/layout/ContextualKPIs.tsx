import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export interface KPIItem {
  label: string;
  value: string | number;
  icon: LucideIcon;
  /** Tailwind color class for the icon, e.g. "text-primary" */
  iconColor?: string;
  /** Tailwind bg class for the icon container, e.g. "bg-primary/10" */
  iconBg?: string;
}

interface ContextualKPIsProps {
  items: KPIItem[];
  columns?: 2 | 3 | 4;
}

export function ContextualKPIs({ items, columns = 3 }: ContextualKPIsProps) {
  const gridCols = {
    2: "grid-cols-2",
    3: "grid-cols-2 md:grid-cols-3",
    4: "grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div className={`grid gap-3 ${gridCols[columns]}`}>
      {items.map((item, i) => (
        <Card key={i} className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${item.iconBg || "bg-primary/10"}`}>
              <item.icon className={`h-5 w-5 ${item.iconColor || "text-primary"}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="text-xl font-bold text-foreground">{item.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
