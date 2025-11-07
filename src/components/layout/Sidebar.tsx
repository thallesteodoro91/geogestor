import { LayoutDashboard, DollarSign, Target, Users, Settings, FileText, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { NavLink } from "@/components/NavLink";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Gestão Financeira", href: "/financeiro", icon: DollarSign },
  { name: "Planejamento", href: "/planejamento", icon: Target },
  { name: "Operacional", href: "/operacional", icon: TrendingUp },
  { name: "Clientes", href: "/clientes", icon: Users },
  { name: "Cadastros", href: "/cadastros", icon: FileText },
  { name: "Configurações", href: "/configuracoes", icon: Settings },
];

export const Sidebar = () => {
  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-border bg-card px-6 pb-4">
          <div className="flex h-16 shrink-0 items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-secondary">
              <span className="text-lg font-heading font-bold text-primary-foreground">TV</span>
            </div>
            <div>
              <h1 className="text-xl font-heading font-bold text-foreground">TopoVision</h1>
              <p className="text-xs text-muted-foreground">Performance & Insights</p>
            </div>
          </div>
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  {navigation.map((item) => (
                    <li key={item.name}>
                      <NavLink
                        to={item.href}
                        className={cn(
                          "group flex gap-x-3 rounded-lg p-3 text-sm font-medium leading-6 transition-smooth",
                          "text-muted-foreground hover:text-foreground hover:bg-muted"
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
            </ul>
          </nav>
        </div>
      </div>
    </>
  );
};
