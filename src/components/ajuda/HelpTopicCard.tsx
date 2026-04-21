import { Badge } from "@/components/ui/badge";
import { Lightbulb, AlertTriangle, XCircle } from "lucide-react";

interface HelpTopicCardProps {
  topic: {
    id: string;
    title: string;
    description: string;
    steps?: string[];
    tips?: string[];
    warnings?: string[];
    commonErrors?: string[];
  };
  searchQuery?: string;
}

function highlightText(text: string, query: string) {
  if (!query || query.length < 2) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-warning/30 text-foreground rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

function renderText(text: string, query: string) {
  // Handle **bold** markers
  const boldParts = text.split(/(\*\*[^*]+\*\*)/g);
  return boldParts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      const inner = part.slice(2, -2);
      return <strong key={i}>{highlightText(inner, query)}</strong>;
    }
    if (part.startsWith("*(") && part.includes(")*")) {
      return <em key={i} className="text-muted-foreground">{highlightText(part, query)}</em>;
    }
    return <span key={i}>{highlightText(part, query)}</span>;
  });
}

export function HelpTopicCard({ topic, searchQuery = "" }: HelpTopicCardProps) {
  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-4">
      <div>
        <h4 className="font-semibold text-sm">
          {highlightText(topic.title, searchQuery)}
        </h4>
        <p className="text-xs text-muted-foreground mt-0.5">
          {highlightText(topic.description, searchQuery)}
        </p>
      </div>

      {topic.steps && topic.steps.length > 0 && (
        <ol className="space-y-1.5 pl-1">
          {topic.steps.map((step, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <span className="shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold mt-0.5">
                {i + 1}
              </span>
              <span className="text-muted-foreground leading-relaxed">
                {renderText(step, searchQuery)}
              </span>
            </li>
          ))}
        </ol>
      )}

      {topic.tips && topic.tips.length > 0 && (
        <div className="space-y-1.5">
          {topic.tips.map((tip, i) => (
            <div key={i} className="flex items-start gap-2 rounded-md bg-success/10 border border-success/20 p-2.5">
              <Lightbulb className="h-4 w-4 text-success shrink-0 mt-0.5" />
              <span className="text-xs text-foreground/80">
                <strong>Dica:</strong> {renderText(tip, searchQuery)}
              </span>
            </div>
          ))}
        </div>
      )}

      {topic.warnings && topic.warnings.length > 0 && (
        <div className="space-y-1.5">
          {topic.warnings.map((warning, i) => (
            <div key={i} className="flex items-start gap-2 rounded-md bg-warning/15 border border-warning/30 p-2.5">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <span className="text-xs text-foreground/80">
                <strong>Atenção:</strong> {renderText(warning, searchQuery)}
              </span>
            </div>
          ))}
        </div>
      )}

      {topic.commonErrors && topic.commonErrors.length > 0 && (
        <div className="space-y-1.5">
          {topic.commonErrors.map((err, i) => (
            <div key={i} className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/20 p-2.5">
              <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <span className="text-xs text-destructive">
                <strong>Erro comum:</strong> {renderText(err, searchQuery)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
