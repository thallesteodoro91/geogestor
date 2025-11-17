import { AppLayout } from "@/components/layout/AppLayout";
import { GeoBot } from "@/components/dashboard/GeoBot";
import { useKPIs } from "@/hooks/useKPIs";

const GeoBotPage = () => {
  const { data: kpis } = useKPIs();

  return (
    <AppLayout>
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">GeoBot - Consultor Financeiro</h1>
          <p className="text-muted-foreground">
            Seu assistente inteligente para análises financeiras e operacionais
          </p>
        </div>
        
        <div className="max-w-4xl mx-auto">
          <GeoBot kpis={kpis} />
        </div>
      </div>
    </AppLayout>
  );
};

export default GeoBotPage;
