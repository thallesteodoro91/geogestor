import { Card } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface StoryCardProps {
  title: string;
  insight: string;
  category?: "financial" | "operational" | "strategic";
}

export const StoryCard = ({ title, insight, category = "financial" }: StoryCardProps) => {
  const categoryColors = {
    financial: "bg-primary/10 text-primary border-primary/30",
    operational: "bg-accent/10 text-accent border-accent/30",
    strategic: "bg-chart-3/10 text-chart-3 border-chart-3/30",
  };

  return (
    <Card className="p-6 transition-smooth hover:shadow-lg bg-gradient-to-br from-card via-card to-muted/10 border-border/50">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 shadow-sm">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div className="space-y-2.5 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-heading font-semibold text-foreground text-base">{title}</h4>
            <Badge variant="outline" className={`${categoryColors[category]} text-xs`}>
              AI Insight
            </Badge>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground/90">{insight}</p>
        </div>
      </div>
    </Card>
  );
};
