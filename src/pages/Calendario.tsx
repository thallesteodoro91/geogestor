import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarioMensal } from "@/components/calendario/CalendarioMensal";
import { CalendarioSemanal } from "@/components/calendario/CalendarioSemanal";
import { CalendarioDiario } from "@/components/calendario/CalendarioDiario";
import { CalendarioTabela } from "@/components/calendario/CalendarioTabela";
import { CompromissoDialog } from "@/components/calendario/CompromissoDialog";
import { Button } from "@/components/ui/button";
import { Calendar, List, Table, CalendarDays, Plus, Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const Calendario = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notificacoesAtivas, setNotificacoesAtivas] = useState(false);

  return (
    <AppLayout>
      <div className="container mx-auto p-6 max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold">Calendário de Atividades</h1>
            </div>
            <p className="text-muted-foreground">
              Gerencie orçamentos, serviços e compromissos em um só lugar
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={notificacoesAtivas ? "default" : "outline"}
              size="sm"
              onClick={() => setNotificacoesAtivas(!notificacoesAtivas)}
              className="gap-2"
            >
              <Bell className="h-4 w-4" />
              Lembretes
              {notificacoesAtivas && (
                <Badge variant="secondary" className="ml-1">
                  Ativo
                </Badge>
              )}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="mensal" className="w-full">
          <TabsList className="grid w-full max-w-2xl grid-cols-4">
            <TabsTrigger value="mensal" className="gap-2">
              <Calendar className="h-4 w-4" />
              Mensal
            </TabsTrigger>
            <TabsTrigger value="semanal" className="gap-2">
              <List className="h-4 w-4" />
              Semanal
            </TabsTrigger>
            <TabsTrigger value="diario" className="gap-2">
              <CalendarDays className="h-4 w-4" />
              Diário
            </TabsTrigger>
            <TabsTrigger value="tabela" className="gap-2">
              <Table className="h-4 w-4" />
              Tabela
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mensal" className="mt-6">
            <CalendarioMensal />
          </TabsContent>

          <TabsContent value="semanal" className="mt-6">
            <CalendarioSemanal />
          </TabsContent>

          <TabsContent value="diario" className="mt-6">
            <CalendarioDiario />
          </TabsContent>

          <TabsContent value="tabela" className="mt-6">
            <CalendarioTabela />
          </TabsContent>
        </Tabs>

        <CompromissoDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      </div>
    </AppLayout>
  );
};

export default Calendario;
