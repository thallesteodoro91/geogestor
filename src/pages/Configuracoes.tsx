import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Building2, Bell, Plug } from "lucide-react";
import { AccountTab } from "@/components/settings/AccountTab";
import { CompanyTab } from "@/components/settings/CompanyTab";
import { NotificationsTab } from "@/components/settings/NotificationsTab";
import { IntegrationsTab } from "@/components/settings/IntegrationsTab";
import { useIsMobile } from "@/hooks/use-mobile";

const TABS = [
  { value: "conta", label: "Conta", icon: User, description: "Seus dados pessoais e preferências" },
  { value: "empresa", label: "Empresa", icon: Building2, description: "Dados da empresa, plano e equipe" },
  { value: "notificacoes", label: "Notificações", icon: Bell, description: "Alertas e canais de entrega" },
  { value: "integracoes", label: "Integrações", icon: Plug, description: "Google Calendar e importação" },
] as const;

type TabValue = typeof TABS[number]["value"];

export default function Configuracoes() {
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const tabParam = searchParams.get("tab") as TabValue | null;
  const activeTab: TabValue = TABS.some((t) => t.value === tabParam) ? (tabParam as TabValue) : "conta";

  const setActiveTab = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  const currentTabMeta = TABS.find((t) => t.value === activeTab)!;

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Configurações"
          subtitle="Gerencie sua conta, empresa, notificações e integrações"
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {isMobile ? (
            <div className="space-y-2">
              <Select value={activeTab} onValueChange={setActiveTab}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TABS.map((tab) => (
                    <SelectItem key={tab.value} value={tab.value}>
                      <div className="flex items-center gap-2">
                        <tab.icon className="h-4 w-4" />
                        <span>{tab.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground px-1">{currentTabMeta.description}</p>
            </div>
          ) : (
            <div className="grid grid-cols-[240px_1fr] gap-6 items-start">
              <TabsList className="flex flex-col h-auto bg-card border p-1.5 gap-1 sticky top-4">
                {TABS.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="w-full justify-start gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <div>
                <TabsContent value="conta" className="mt-0"><AccountTab /></TabsContent>
                <TabsContent value="empresa" className="mt-0"><CompanyTab /></TabsContent>
                <TabsContent value="notificacoes" className="mt-0"><NotificationsTab /></TabsContent>
                <TabsContent value="integracoes" className="mt-0"><IntegrationsTab /></TabsContent>
              </div>
            </div>
          )}

          {isMobile && (
            <div className="mt-4">
              <TabsContent value="conta" className="mt-0"><AccountTab /></TabsContent>
              <TabsContent value="empresa" className="mt-0"><CompanyTab /></TabsContent>
              <TabsContent value="notificacoes" className="mt-0"><NotificationsTab /></TabsContent>
              <TabsContent value="integracoes" className="mt-0"><IntegrationsTab /></TabsContent>
            </div>
          )}
        </Tabs>
      </div>
    </AppLayout>
  );
}
