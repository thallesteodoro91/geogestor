import { Card, CardContent } from "@/components/ui/card";

/**
 * Skeleton Loader for KPI Cards
 * UX/UI Principle: "Benefits of Anticipation"
 * 
 * Proporciona feedback visual imediato enquanto dados carregam,
 * reduzindo ansiedade cognitiva do usuário.
 */
export const SkeletonKPI = () => {
  return (
    <Card className="transition-smooth">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-3 flex-1">
            {/* Title skeleton */}
            <div className="h-4 w-32 skeleton" />
            {/* Value skeleton */}
            <div className="h-8 w-40 skeleton" />
            {/* Subtitle skeleton */}
            <div className="h-3 w-24 skeleton" />
          </div>
          {/* Icon skeleton */}
          <div className="h-10 w-10 rounded-lg skeleton" />
        </div>
        {/* Change indicator skeleton */}
        <div className="h-3 w-16 skeleton" />
      </CardContent>
    </Card>
  );
};
