import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Database, ArrowRight } from "lucide-react";
import { GoogleCalendarCard } from "@/components/settings/GoogleCalendarCard";

export function IntegrationsTab() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <GoogleCalendarCard />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <CardTitle>Importação de Dados</CardTitle>
          </div>
          <CardDescription>Importe planilhas (CSV, XLS, XLSX) com detecção automática de clientes, propriedades, orçamentos, projetos e despesas</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => navigate("/importacao")}>
            Abrir Importador
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
