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
    financial: "bg-primary/10 text-primary border-primary/20",
    operational: "bg-secondary/10 text-secondary border-secondary/20",
    strategic: "bg-accent/10 text-accent-foreground border-accent/20",
  };

  return (
    <Card className="p-6 transition-smooth hover:shadow-md bg-gradient-to-br from-card to-muted/20">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/20">
          <Sparkles className="h-5 w-5 text-accent" />
        </div>
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-heading font-semibold text-foreground">{title}</h4>
            <Badge variant="outline" className={categoryColors[category]}>
              AI Insight
            </Badge>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{insight}</p>
        </div>
      </div>
    </Card>
  );
};
