import { ReactNode, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop & Tablet Sidebar - visible from md breakpoint (768px) */}
      <Sidebar className="hidden md:flex" />
      
      {/* Mobile Menu Button - only visible below md */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="fixed top-4 left-4 z-50 md:hidden"
            aria-label="Abrir menu de navegação"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64">
          <Sidebar className="flex border-none" onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main content - padding adjusts for md and lg breakpoints */}
      <div className="md:pl-64">
        <Header />
        <main 
          className="p-4 md:p-6 lg:p-8"
          role="main"
          aria-label="Conteúdo principal"
        >
          {children}
        </main>
      </div>
    </div>
  );
};
