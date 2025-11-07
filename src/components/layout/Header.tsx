import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NotificationsMenu } from "./NotificationsMenu";
import { UserMenu } from "./UserMenu";

export const Header = () => {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="flex h-16 items-center gap-4 px-6 lg:px-8">
        <div className="flex-1">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar clientes, serviços, propriedades..."
              className="pl-9 bg-muted/50 border-0"
            />
          </div>
        </div>
        <NotificationsMenu />
        <UserMenu />
      </div>
    </header>
  );
};
