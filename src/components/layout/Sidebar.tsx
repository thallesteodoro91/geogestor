import { LayoutDashboard, DollarSign, Target, Users, FileText, TrendingUp, Receipt, Briefcase, FileBarChart, LogOut, Eye, Zap, Database, Bot, CalendarDays } from "lucide-react";
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
    title: "Visão",
    icon: Eye,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    items: [
      { name: "Gestão da Empresa", href: "/", icon: LayoutDashboard },
      { name: "Dashboard Financeiro", href: "/dashboard-financeiro", icon: DollarSign },
      { name: "Operacional", href: "/operacional", icon: TrendingUp },
    ]
  },
  {
    title: "Inteligência",
    icon: Bot,
    color: "text-pink",
    bgColor: "bg-pink/10",
    items: [
      { name: "GeoBot", href: "/geobot", icon: Bot },
      { name: "Calendário", href: "/calendario", icon: CalendarDays },
    ]
  },
  {
    title: "Operações",
    icon: Zap,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    items: [
      { name: "Orçamento", href: "/servicos-orcamentos", icon: Briefcase },
      { name: "Despesas", href: "/despesas", icon: Receipt },
    ]
  },
  {
    title: "Base de Dados",
    icon: Database,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    items: [
      { name: "Clientes e Projetos", href: "/clientes", icon: Users },
      { name: "Cadastros", href: "/cadastros", icon: FileText },
    ]
  }
];

export const Sidebar = () => {
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

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-border bg-card px-6 pb-4">
          <div className="flex h-16 shrink-0 items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-secondary">
              <span className="text-lg font-heading font-bold text-primary-foreground">
                {tenant ? getInitials(tenant.name) : 'SG'}
              </span>
            </div>
            <div>
              <h1 className="text-xl font-heading font-bold text-foreground">{tenant?.name || 'SkyGeo'}</h1>
              <p className="text-xs text-muted-foreground">Performance & Insights</p>
            </div>
          </div>
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-6">
              {navigationSections.map((section, index) => (
                <li key={section.title} className="animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                  <div className="flex items-center gap-2 px-3 py-2 mb-2">
                    <section.icon className={cn("h-5 w-5", section.color)} />
                    <span className={cn(
                      "text-sm font-bold uppercase tracking-wide",
                      section.color
                    )}>
                      {section.title}
                    </span>
                  </div>
                  <ul role="list" className="-mx-2 space-y-1">
                    {section.items.map((item) => (
                      <li key={item.name}>
                        <NavLink
                          to={item.href}
                          className={cn(
                            "group flex gap-x-3 rounded-lg p-3 text-sm font-medium leading-6 transition-smooth hover-scale",
                            "text-muted-foreground hover:text-foreground hover:bg-muted",
                            "focus:outline-none focus-visible:outline-none focus-visible:ring-0"
                          )}
                          activeClassName="bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary"
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
    </>
  );
};
