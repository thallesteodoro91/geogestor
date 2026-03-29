import { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface HelpFeedbackProps {
  sectionId: string;
}

export function HelpFeedback({ sectionId }: HelpFeedbackProps) {
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  const handleFeedback = (type: "up" | "down") => {
    setFeedback(type);
    // Could persist to DB in the future
  };

  if (feedback) {
    return (
      <p className="text-xs text-muted-foreground text-center py-2">
        {feedback === "up" ? "😊 Obrigado pelo feedback!" : "😔 Vamos melhorar esta seção. Obrigado!"}
      </p>
    );
  }

  return (
    <div className="flex items-center justify-center gap-3 pt-3 border-t border-border/40">
      <span className="text-xs text-muted-foreground">Isso ajudou?</span>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs gap-1 hover:text-emerald-600 hover:bg-emerald-500/10"
        onClick={() => handleFeedback("up")}
      >
        <ThumbsUp className="h-3.5 w-3.5" /> Sim
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs gap-1 hover:text-destructive hover:bg-destructive/10"
        onClick={() => handleFeedback("down")}
      >
        <ThumbsDown className="h-3.5 w-3.5" /> Não
      </Button>
    </div>
  );
}
