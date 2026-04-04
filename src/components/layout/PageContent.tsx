import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PageContentProps {
  title?: string;
  children: ReactNode;
}

export function PageContent({ title, children }: PageContentProps) {
  return (
    <Card>
      {title && (
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}
