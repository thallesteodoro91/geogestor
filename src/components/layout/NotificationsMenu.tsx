import { Bell, DollarSign, FileText, CheckCircle, AlertTriangle, CreditCard, Trash2 } from "lucide-react";
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
import { useNotifications } from "@/hooks/useNotifications";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEffect } from "react";

const getIcon = (tipo: string) => {
  switch (tipo) {
    case "orcamento":
      return <FileText className="h-4 w-4 text-primary" />;
    case "despesa":
      return <DollarSign className="h-4 w-4 text-orange-500" />;
    case "servico":
      return <CheckCircle className="h-4 w-4 text-success" />;
    case "pagamento":
      return <CreditCard className="h-4 w-4 text-destructive" />;
    default:
      return <AlertTriangle className="h-4 w-4 text-muted-foreground" />;
  }
};

const getPriorityColor = (prioridade: string) => {
  switch (prioridade) {
    case "alta":
      return "text-destructive";
    case "normal":
      return "text-foreground";
    case "baixa":
      return "text-muted-foreground";
    default:
      return "text-foreground";
  }
};

export const NotificationsMenu = () => {
  const { notifications, loading, unreadCount, markAsRead, markAllAsRead, clearAllNotifications, checkPendingPayments } = useNotifications();
  const navigate = useNavigate();

  // Verificar pagamentos pendentes ao montar o componente
  useEffect(() => {
    checkPendingPayments();
    
    // Verificar a cada 1 hora
    const interval = setInterval(() => {
      checkPendingPayments();
    }, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const handleNotificationClick = async (notification: any) => {
    // Marcar como lida
    await markAsRead(notification.id_notificacao);
    
    // Redirecionar se tiver link
    if (notification.link) {
      navigate(notification.link);
    }
  };

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
      <DropdownMenuContent align="end" className="w-80 bg-popover z-50">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notificações</span>
          <div className="flex items-center gap-2">
            {notifications.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 text-xs text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.preventDefault();
                  clearAllNotifications();
                }}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Limpar
              </Button>
            )}
            {unreadCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 text-xs"
                onClick={markAllAsRead}
              >
                Marcar todas
              </Button>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[300px]">
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Carregando...
            </div>
          ) : notifications.length > 0 ? (
            notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id_notificacao}
                className="flex gap-3 p-3 cursor-pointer hover:bg-accent"
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="mt-1">{getIcon(notification.tipo)}</div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-medium leading-none ${getPriorityColor(notification.prioridade)}`}>
                      {notification.titulo}
                    </p>
                    {!notification.lida && (
                      <div className="h-2 w-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {notification.mensagem}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(notification.created_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
