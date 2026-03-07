import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Printer, ChevronLeft, ChevronRight, CalendarIcon, RotateCcw } from "lucide-react";
import { useRelatorioData } from "@/hooks/useRelatorioData";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { PrintableReport } from "@/components/relatorio/PrintableReport";

const RelatorioExecutivo = () => {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth());
  const [ano, setAno] = useState(now.getFullYear());
  const [modoCustom, setModoCustom] = useState(false);
  const [customInicio, setCustomInicio] = useState<Date | undefined>();
  const [customFim, setCustomFim] = useState<Date | undefined>();

  const customInicioStr = modoCustom && customInicio ? format(customInicio, "yyyy-MM-dd") : undefined;
  const customFimStr = modoCustom && customFim ? format(customFim, "yyyy-MM-dd") : undefined;

  const data = useRelatorioData({ mes, ano, customInicio: customInicioStr, customFim: customFimStr });

  const periodoLabel = modoCustom && customInicio && customFim
    ? `${format(customInicio, "dd/MM/yyyy")} — ${format(customFim, "dd/MM/yyyy")}`
    : format(new Date(ano, mes), "MMMM 'de' yyyy", { locale: ptBR });

  const handlePrev = () => {
    if (mes === 0) { setMes(11); setAno(ano - 1); }
    else setMes(mes - 1);
  };
  const handleNext = () => {
    if (mes === 11) { setMes(0); setAno(ano + 1); }
    else setMes(mes + 1);
  };
  const handleResetCustom = () => {
    setModoCustom(false);
    setCustomInicio(undefined);
    setCustomFim(undefined);
    setMes(now.getMonth());
    setAno(now.getFullYear());
  };

  const aiSummary = useQuery({
    queryKey: ["relatorio-ai-summary", mes, ano, customInicioStr, customFimStr],
    queryFn: async () => {
      const { data: result, error } = await supabase.functions.invoke("ai-insights");
      if (error) throw error;
      return result;
    },
    staleTime: 1800000,
    enabled: !data.isLoading && !!data.metrics,
  });

  const receitaTotal = data.metrics?.receita_total || 0;
  const despesaTotal = data.metrics?.total_despesas || 0;
  const lucroLiquido = data.derivedKPIs?.lucro_liquido || 0;
  const margemLucro = receitaTotal > 0 ? (lucroLiquido / receitaTotal) * 100 : 0;
  const taxaConversao = data.conversao?.taxa || 0;

  return (
    <AppLayout>
      <div className="relatorio-executivo-container">
        {/* Controls - hidden on print */}
        <div className="flex flex-col gap-3 mb-6 print:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {!modoCustom && (
                <>
                  <Button variant="outline" size="icon" onClick={handlePrev}><ChevronLeft className="h-4 w-4" /></Button>
                  <h2 className="text-lg font-bold capitalize">{periodoLabel}</h2>
                  <Button variant="outline" size="icon" onClick={handleNext}><ChevronRight className="h-4 w-4" /></Button>
                </>
              )}
              {modoCustom && (
                <h2 className="text-lg font-bold">{periodoLabel}</h2>
              )}
            </div>
            <Button onClick={() => window.print()} className="gap-2">
              <Printer className="h-4 w-4" /> Exportar PDF
            </Button>
          </div>

          {/* Date range filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("gap-2 text-sm", modoCustom && customInicio && "border-primary text-primary")}>
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {customInicio ? format(customInicio, "dd/MM/yyyy") : "Data início"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={customInicio}
                  onSelect={(d) => { setCustomInicio(d); setModoCustom(true); }}
                  disabled={(d) => customFim ? d > customFim : false}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>

            <span className="text-sm text-muted-foreground">até</span>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("gap-2 text-sm", modoCustom && customFim && "border-primary text-primary")}>
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {customFim ? format(customFim, "dd/MM/yyyy") : "Data fim"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={customFim}
                  onSelect={(d) => { setCustomFim(d); setModoCustom(true); }}
                  disabled={(d) => customInicio ? d < customInicio : false}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>

            {modoCustom && (
              <Button variant="ghost" size="sm" onClick={handleResetCustom} className="gap-1 text-sm text-muted-foreground">
                <RotateCcw className="h-3.5 w-3.5" /> Voltar ao mensal
              </Button>
            )}
          </div>
        </div>

        {/* ===== PRINTABLE REPORT ===== */}
        <div className="report-content">
          <PrintableReport
            empresa={data.empresa}
            periodoLabel={periodoLabel}
            receitaTotal={receitaTotal}
            despesaTotal={despesaTotal}
            lucroLiquido={lucroLiquido}
            margemLucro={margemLucro}
            taxaConversao={taxaConversao}
            conversao={data.conversao}
            variacaoReceita={data.variacaoReceita}
            dadosSemanais={data.dadosSemanais}
            receitaCategorias={data.receitaCategorias}
            clientes={data.clientes}
            servicosCusto={data.servicosCusto}
            orcamentosPendentes={data.orcamentosPendentes}
            aiSummary={aiSummary}
            isLoading={data.isLoading}
          />
        </div>
      </div>
    </AppLayout>
  );
};

export default RelatorioExecutivo;
