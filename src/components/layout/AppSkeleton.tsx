import { Skeleton } from "@/components/ui/skeleton";

export const AppSkeleton = () => {
  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar Skeleton - visible only on md+ */}
      <div className="hidden md:flex w-64 flex-col border-r border-border bg-card p-6">
        {/* Logo skeleton */}
        <div className="flex items-center gap-2 mb-8">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        
        {/* Nav items skeleton */}
        <div className="space-y-6">
          {[1, 2, 3, 4].map((section) => (
            <div key={section} className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <div className="space-y-1">
                {[1, 2, 3].map((item) => (
                  <Skeleton key={item} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col">
        {/* Header skeleton */}
        <div className="h-16 border-b border-border bg-card flex items-center px-6 gap-4">
          <Skeleton className="h-10 flex-1 max-w-md rounded-lg" />
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>

        {/* Content skeleton */}
        <div className="flex-1 p-6 space-y-6">
          {/* Page title */}
          <Skeleton className="h-8 w-48" />
          
          {/* KPI cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-card rounded-lg p-6 border border-border">
                <Skeleton className="h-4 w-24 mb-3" />
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
          
          {/* Chart placeholder */}
          <div className="bg-card rounded-lg p-6 border border-border">
            <Skeleton className="h-6 w-40 mb-4" />
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
};
