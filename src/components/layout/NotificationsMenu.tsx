import { Bell, DollarSign, FileText, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Notification {
  id: string;
  type: "budget" | "expense" | "service";
  title: string;
  description: string;
  time: string;
  unread: boolean;
}

// Mock data - em produção viria do banco de dados
const mockNotifications: Notification[] = [
  {
    id: "1",
    type: "budget",
    title: "Novo Orçamento",
    description: "Orçamento #1234 aguarda aprovação",
    time: "5 min atrás",
    unread: true,
  },
  {
    id: "2",
    type: "service",
    title: "Serviço Concluído",
    description: "Levantamento topográfico finalizado",
    time: "1 hora atrás",
    unread: true,
  },
  {
    id: "3",
    type: "expense",
    title: "Despesa Vencendo",
    description: "Pagamento vence em 3 dias",
    time: "2 horas atrás",
    unread: false,
  },
];

const getIcon = (type: Notification["type"]) => {
  switch (type) {
    case "budget":
      return <FileText className="h-4 w-4 text-primary" />;
    case "expense":
      return <DollarSign className="h-4 w-4 text-destructive" />;
    case "service":
      return <CheckCircle className="h-4 w-4 text-success" />;
  }
};

export const NotificationsMenu = () => {
  const unreadCount = mockNotifications.filter((n) => n.unread).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -right-1 -top-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 bg-popover">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notificações</span>
          {unreadCount > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {unreadCount} nova{unreadCount > 1 ? "s" : ""}
            </Badge>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[300px]">
          {mockNotifications.length > 0 ? (
            mockNotifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className="flex gap-3 p-3 cursor-pointer"
              >
                <div className="mt-1">{getIcon(notification.type)}</div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium leading-none">
                      {notification.title}
                    </p>
                    {notification.unread && (
                      <div className="h-2 w-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {notification.description}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {notification.time}
                  </p>
                </div>
              </DropdownMenuItem>
            ))
          ) : (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Nenhuma notificação
            </div>
          )}
        </ScrollArea>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="justify-center text-sm text-primary cursor-pointer">
          Ver todas as notificações
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
