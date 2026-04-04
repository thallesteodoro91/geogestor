import { LayoutDashboard, DollarSign, Users, FileText, Receipt, Briefcase, LogOut, Bot, CalendarDays, Shield, ClipboardList, HelpCircle, Settings, TrendingUp, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { useTenant } from "@/contexts/TenantContext";

const navigationSections = [
  {
    title: "Visão Geral",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    items: [
      { name: "Dashboard 360", href: "/", icon: LayoutDashboard },
      { name: "Dashboard Financeiro", href: "/dashboard-financeiro", icon: DollarSign },
    ]
  },
  {
    title: "Operação",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    items: [
      { name: "Projetos", href: "/projetos", icon: Briefcase },
      { name: "Orçamentos", href: "/orcamentos", icon: FileText },
      { name: "Despesas", href: "/despesas", icon: Receipt },
      { name: "Calendário", href: "/calendario", icon: CalendarDays },
    ]
  },
  {
    title: "Relacionamento",
    color: "text-violet-500",
    bgColor: "bg-violet-500/10",
    items: [
      { name: "Clientes", href: "/clientes", icon: Users },
    ]
  },
  {
    title: "Inteligência",
    color: "text-pink-500",
    bgColor: "bg-pink-500/10",
    items: [
      { name: "GeoBot", href: "/geobot", icon: Bot },
      { name: "Relatório Executivo", href: "/relatorio-executivo", icon: ClipboardList },
      { name: "Operacional", href: "/operacional", icon: TrendingUp },
    ]
  },
  {
    title: "Configurações",
    color: "text-gray-500",
    bgColor: "bg-gray-500/10",
    items: [
      { name: "Cadastros", href: "/cadastros", icon: Settings },
      { name: "Importação de Dados", href: "/importacao", icon: Upload },
      { name: "Configurações", href: "/configuracoes", icon: Settings },
      { name: "Central de Ajuda", href: "/ajuda", icon: HelpCircle },
      { name: "Logs de Auditoria", href: "/audit-logs", icon: Shield },
    ]
  }
];

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export const Sidebar = ({ className, onNavigate }: SidebarProps) => {
  const navigate = useNavigate();
  const { tenant } = useTenant();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .slice(0, 2)
      .map(word => word[0])
      .join('')
      .toUpperCase();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logout realizado com sucesso!");
    navigate("/auth");
  };

  const handleNavClick = () => {
    onNavigate?.();
  };

  return (
    <div className={cn(
      "fixed inset-y-0 z-50 w-64 flex-col",
      className
    )}>
      <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-border bg-card px-6 pb-4">
          <div className="flex h-16 shrink-0 items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-secondary">
              <span className="text-lg font-heading font-bold text-primary-foreground">
                {tenant ? getInitials(tenant.name) : 'SG'}
              </span>
            </div>
            <div>
              <h1 className="text-xl font-heading font-bold text-foreground">{tenant?.name || 'SkyGeo'}</h1>
              <p className="text-xs text-muted-foreground">Gestão para Topografia</p>
            </div>
          </div>
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-5">
              {navigationSections.map((section, index) => (
                <li key={section.title} className="animate-fade-in" style={{ animationDelay: `${index * 0.05}s` }}>
                  <div className="flex items-center gap-2 px-3 py-1.5 mb-1">
                    <span className={cn(
                      "text-xs font-bold uppercase tracking-wider",
                      section.color
                    )}>
                      {section.title}
                    </span>
                  </div>
                  <ul role="list" className="-mx-2 space-y-0.5">
                    {section.items.map((item) => (
                      <li key={item.name}>
                        <NavLink
                          to={item.href}
                          className={cn(
                            "group flex gap-x-3 rounded-lg p-2.5 text-sm font-medium leading-6 transition-smooth hover-scale",
                            "text-muted-foreground hover:text-foreground hover:bg-muted",
                            "focus:outline-none focus-visible:outline-none focus-visible:ring-0"
                          )}
                          activeClassName="bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary"
                          onClick={handleNavClick}
                        >
                          <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                          {item.name}
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
              <li className="mt-auto">
                <Separator className="mb-4" />
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-x-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  onClick={handleLogout}
                >
                  <LogOut className="h-5 w-5 shrink-0" />
                  Sair
                </Button>
              </li>
            </ul>
          </nav>
      </div>
    </div>
  );
};
