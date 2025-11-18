import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarioMensal } from "@/components/calendario/CalendarioMensal";
import { CalendarioSemanal } from "@/components/calendario/CalendarioSemanal";
import { CalendarioTabela } from "@/components/calendario/CalendarioTabela";
import { Calendar, List, Table } from "lucide-react";

const Calendario = () => {
  return (
    <AppLayout>
      <div className="container mx-auto p-6 max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Calendário de Atividades</h1>
            <p className="text-muted-foreground">
              Gerencie orçamentos, serviços e compromissos em um só lugar
            </p>
          </div>
        </div>

        <Tabs defaultValue="mensal" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="mensal" className="gap-2">
              <Calendar className="h-4 w-4" />
              Mensal
            </TabsTrigger>
            <TabsTrigger value="semanal" className="gap-2">
              <List className="h-4 w-4" />
              Semanal
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

          <TabsContent value="tabela" className="mt-6">
            <CalendarioTabela />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Calendario;
