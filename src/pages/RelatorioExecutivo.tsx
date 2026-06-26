import { useState, useRef } from "react";
import { format, isSameMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Sparkles, Loader2, CalendarIcon, RotateCcw, DollarSign, TrendingDown, BadgeDollarSign, Percent, Target, BarChart3, PieChart as PieChartIcon, UserPlus, Wrench, Clock, ArrowLeftRight, FileQuestion, Trophy, Download } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useRelatorioData } from "@/hooks/useRelatorioData";
import { formatarMoeda, formatarPercentual } from "@/core/finance";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { RelatorioPaginatedTable } from "@/components/relatorio/RelatorioPaginatedTable";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

import { RichTooltip } from "@/components/charts/RichTooltip";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { captureReportAsPDF } from "@/lib/pdfReportGenerator";
import { PrintableReport } from "@/components/relatorio/PrintableReport";
import { toast } from "sonner";

const DONUT_COLORS = [
  "hsl(262, 83%, 58%)",
  "hsl(189, 94%, 43%)",
  "hsl(38, 92%, 50%)",
  "hsl(142, 76%, 36%)",
  "hsl(0, 84%, 60%)",
  "hsl(280, 60%, 50%)",
  "hsl(200, 80%, 50%)",
  "hsl(30, 80%, 55%)",
];

const RelatorioExecutivo = () => {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth());
  const [ano, setAno] = useState(now.getFullYear());
  const [modoCustom, setModoCustom] = useState(false);
  const [customInicio, setCustomInicio] = useState<Date | undefined>();
  const [customFim, setCustomFim] = useState<Date | undefined>();
  const [showComparison, setShowComparison] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

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

  // AI Summary
  const aiSummary = useQuery({
    queryKey: ["relatorio-ai-summary", mes, ano, customInicioStr, customFimStr],
    queryFn: async () => {
      const { data: result, error } = await supabase.functions.invoke("ai-insights");
      if (error) throw error;
      // O edge function devolve { error: 'PAYMENT_REQUIRED' | 'RATE_LIMITED' | ... }
      // em vez de lançar — tratamos aqui para a UI saber.
      if (result?.error) {
        const err = new Error(result.error);
        (err as Error & { code?: string }).code = result.error;
        throw err;
      }
      return result;
    },
    staleTime: 1800000,
    retry: (failureCount, err) => {
      const code = (err as Error & { code?: string })?.code;
      if (code === "PAYMENT_REQUIRED" || code === "RATE_LIMITED") return false;
      return failureCount < 1;
    },
    enabled: !data.isLoading && !!data.metrics,
  });

  const receitaTotal = data.metrics?.receita_total || 0;
  const despesaTotal = data.metrics?.total_despesas || 0;
  const lucroLiquido = data.derivedKPIs?.lucro_liquido || 0;
  const margemLucro = receitaTotal > 0 ? (lucroLiquido / receitaTotal) * 100 : 0;
  const taxaConversao = data.conversao?.taxa || 0;

  // Check if period is current month (for draft watermark)
  const isDraft = !modoCustom && isSameMonth(new Date(ano, mes), now);

  // Previous period values for comparison
  const receitaAnterior = data.metricsAnterior?.receita_total || 0;
  const despesaAnterior = data.metricsAnterior?.total_despesas || 0;
  const lucroAnterior = data.derivedKPIsAnterior?.lucro_liquido || 0;

  // Check if there's any data
  const hasData = receitaTotal > 0 || despesaTotal > 0 || data.clientes.length > 0 || data.servicosCusto.length > 0;

  // Calculate variation
  const variacaoReceita = receitaAnterior > 0 ? ((receitaTotal - receitaAnterior) / receitaAnterior) * 100 : null;

  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadPDF = async () => {
    if (!reportRef.current) {
      toast.error("Erro ao preparar relatório");
      return;
    }
    setIsDownloading(true);
    try {
      await captureReportAsPDF(
        reportRef.current,
        `relatorio-${periodoLabel.replace(/\s/g, "-").toLowerCase()}.pdf`
      );
      toast.success("PDF baixado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Erro ao gerar PDF");
    } finally {
      setIsDownloading(false);
    }
  };

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
                  <h2 className="text-lg font-bold">{periodoLabel.charAt(0).toUpperCase() + periodoLabel.slice(1)}</h2>
                  <Button variant="outline" size="icon" onClick={handleNext}><ChevronRight className="h-4 w-4" /></Button>
                </>
              )}
              {modoCustom && (
                <h2 className="text-lg font-bold">{periodoLabel}</h2>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button 
                onClick={handleDownloadPDF} 
                disabled={isDownloading || data.isLoading} 
                className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg px-6"
                size="lg"
              >
                {isDownloading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
                Baixar PDF
              </Button>
            </div>
          </div>

          <PageHeader
            title="Relatório Executivo"
            subtitle="Resumo financeiro, comercial e operacional do período selecionado."
          />

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

        {/* ===== SCREEN VIEW (hidden on print) ===== */}
        <div className="report-content space-y-6 print:hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h1 className="text-2xl font-heading font-bold text-foreground">
                {data.empresa?.nome || "GeoGestor"}
              </h1>
              <p className="text-sm text-muted-foreground">Gestão para Topografia</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">Relatório Executivo Mensal</p>
              <p className="text-lg font-bold text-primary">{periodoLabel.charAt(0).toUpperCase() + periodoLabel.slice(1)}</p>
            </div>
          </div>

          {/* Empty State */}
          {!data.isLoading && !hasData && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <FileQuestion className="h-16 w-16 text-muted-foreground/40 mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum dado no período</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Não há movimentações financeiras registradas para {periodoLabel}. 
                  Cadastre serviços, orçamentos ou despesas para visualizar o relatório.
                </p>
              </CardContent>
            </Card>
          )}

          {/* KPIs with comparison toggle */}
          {(data.isLoading || hasData) && (
            <>
              {/* Comparison Toggle */}
              <div className="flex items-center justify-end gap-2">
                <Switch id="comparison-toggle" checked={showComparison} onCheckedChange={setShowComparison} />
                <Label htmlFor="comparison-toggle" className="text-sm text-muted-foreground cursor-pointer">
                  <ArrowLeftRight className="h-3.5 w-3.5 inline mr-1" />
                  Comparar com mês anterior
                </Label>
              </div>

              {data.isLoading ? (
                <div className="grid grid-cols-5 gap-4"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
              ) : showComparison ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <ComparisonKPI 
                    label="Faturamento" 
                    current={receitaTotal} 
                    previous={receitaAnterior} 
                    format="currency" 
                    icon={<DollarSign className="h-4 w-4" />}
                  />
                  <ComparisonKPI 
                    label="Despesas" 
                    current={despesaTotal} 
                    previous={despesaAnterior} 
                    format="currency" 
                    invertColors 
                    icon={<TrendingDown className="h-4 w-4" />}
                  />
                  <ComparisonKPI 
                    label="Lucro Líquido" 
                    current={lucroLiquido} 
                    previous={lucroAnterior} 
                    format="currency" 
                    icon={<BadgeDollarSign className="h-4 w-4" />}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <KPIBox label="Total Faturado" value={formatarMoeda(receitaTotal)} color="text-primary" icon={<DollarSign className="h-4 w-4" />} />
                  <KPIBox label="Total Gasto" value={formatarMoeda(despesaTotal)} color="text-destructive" icon={<TrendingDown className="h-4 w-4" />} />
                  <KPIBox label="Lucro Líquido" value={formatarMoeda(lucroLiquido)} color={lucroLiquido >= 0 ? "text-chart-positive" : "text-destructive"} icon={<BadgeDollarSign className="h-4 w-4" />} />
                  <KPIBox label="Margem de Lucro" value={formatarPercentual(margemLucro)} color={margemLucro >= 0 ? "text-chart-positive" : "text-destructive"} icon={<Percent className="h-4 w-4" />} />
                  <KPIBox label="Taxa Conversão" value={formatarPercentual(taxaConversao)} color="text-accent" subtitle={data.conversao ? `${data.conversao.convertidos}/${data.conversao.total} orçam.` : undefined} icon={<Target className="h-4 w-4" />} />
                </div>
              )}

              {/* Variação mensal */}
              {!showComparison && data.variacaoReceita !== null && (
                <p className="text-sm text-muted-foreground">
                  {data.variacaoReceita >= 0 ? "📈" : "📉"} Variação de faturamento em relação ao mês anterior:{" "}
                  <span className={data.variacaoReceita >= 0 ? "text-chart-positive font-semibold" : "text-destructive font-semibold"}>
                    {data.variacaoReceita >= 0 ? "+" : ""}{data.variacaoReceita.toFixed(1)}%
                  </span>
                </p>
              )}

              {/* Top 3 Clientes */}
              {data.topClientes.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-accent" /> Top Clientes por Faturamento
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {data.topClientes.map((cliente, i) => (
                        <div key={i} className={cn(
                          "p-4 rounded-lg border text-center",
                          i === 0 ? "bg-primary/5 border-primary" : "bg-muted/30 border-border"
                        )}>
                          <div className="flex items-center justify-center gap-1.5 mb-2">
                            <Trophy className={cn("h-4 w-4", i === 0 ? "text-primary" : "text-muted-foreground")} />
                            <span className={cn("text-xs font-semibold", i === 0 ? "text-primary" : "text-muted-foreground")}>
                              {i + 1}º lugar
                            </span>
                          </div>
                          <p className="font-semibold text-foreground truncate" title={cliente.nome}>
                            {cliente.nome}
                          </p>
                          <p className="text-lg font-bold text-primary">{formatarMoeda(cliente.receita)}</p>
                          <p className="text-xs text-muted-foreground">{cliente.percentual.toFixed(1)}% do total</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-chart-positive" /> Entradas vs Saídas (Semanal)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.dadosSemanais} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
                      <XAxis 
                        dataKey="semana" 
                        fontSize={11} 
                        stroke="hsl(var(--muted-foreground))"
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis 
                        fontSize={11} 
                        tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                        stroke="hsl(var(--muted-foreground))"
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip 
                        content={<RichTooltip format="currency" />}
                        cursor={{ fill: 'hsl(var(--primary) / 0.08)', radius: 4 }}
                      />
                      <Bar dataKey="entradas" name="Entradas" fill="hsl(var(--chart-positive))" radius={[4, 4, 0, 0]} activeBar={false} />
                      <Bar dataKey="saidas" name="Saídas" fill="hsl(var(--chart-negative))" radius={[4, 4, 0, 0]} activeBar={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <PieChartIcon className="h-4 w-4 text-primary" /> Receita por Tipo de Serviço
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[220px]">
                  {data.receitaCategorias.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.receitaCategorias}
                          dataKey="valor"
                          nameKey="categoria"
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={2}
                          label={({ categoria, percent }) => `${categoria} (${(percent * 100).toFixed(0)}%)`}
                          labelLine={false}
                          fontSize={10}
                        >
                          {data.receitaCategorias.map((_, i) => (
                            <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<RichTooltip format="currency" />} cursor={false} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center pt-16">Sem dados de serviços no período</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tables */}
          <div className="grid grid-cols-1 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-accent" /> Novos Clientes ({data.clientes.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RelatorioPaginatedTable
                  data={data.clientes}
                  emptyMessage="Nenhum novo cliente no período."
                  columns={[
                    { header: "Nome", render: (c) => <span className="font-medium">{c.nome}</span> },
                    { header: "Data Cadastro", render: (c) => c.data_cadastro ? format(new Date(c.data_cadastro), "dd/MM/yyyy") : "—" },
                    { header: "Telefone", render: (c) => c.telefone || "—" },
                    { header: "E-mail", render: (c) => c.email || "—" },
                  ]}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-accent" /> Serviços com Maior Custo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RelatorioPaginatedTable
                  data={data.servicosCusto}
                  emptyMessage="Nenhum serviço no período."
                  columns={[
                    { header: "Serviço", render: (s) => <span className="font-medium">{s.nome}</span> },
                    { header: "Receita", headerClassName: "text-right", cellClassName: "text-right", render: (s) => formatarMoeda(s.receita) },
                    { header: "Custo", headerClassName: "text-right", cellClassName: "text-right text-destructive", render: (s) => formatarMoeda(s.custo) },
                    { header: "Margem", headerClassName: "text-right", cellClassName: "text-right font-semibold", render: (s) => (
                      <span className={s.margem >= 0 ? "text-emerald-600" : "text-destructive"}>{formatarPercentual(s.margem)}</span>
                    )},
                  ]}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-chart-negative" /> Orçamentos Pendentes ({data.orcamentosPendentes.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RelatorioPaginatedTable
                  data={data.orcamentosPendentes}
                  emptyMessage="Nenhum orçamento pendente no período."
                  columns={[
                    { header: "Código", render: (o) => <span className="font-medium">{o.codigo || "—"}</span> },
                    { header: "Cliente", render: (o) => o.cliente },
                    { header: "Valor", headerClassName: "text-right", cellClassName: "text-right", render: (o) => formatarMoeda(o.valor) },
                    { header: "Vencimento", render: (o) => o.data_faturamento ? format(new Date(o.data_faturamento), "dd/MM/yyyy") : "—" },
                  ]}
                />
              </CardContent>
            </Card>
          </div>

          {/* AI Executive Summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Sumário Executivo (IA)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {aiSummary.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Gerando análise...
                </div>
              ) : aiSummary.data?.insights?.length > 0 ? (
                <div className="space-y-3">
                  {data.variacaoReceita !== null && (
                    <p className="text-sm font-medium text-foreground">
                      Este mês houve {data.variacaoReceita >= 0 ? "um aumento" : "uma redução"} de{" "}
                      <strong>{Math.abs(data.variacaoReceita).toFixed(1)}%</strong> no faturamento em relação ao mês anterior.
                    </p>
                  )}
                  {aiSummary.data.insights.map((insight: any, i: number) => (
                    <div key={i} className="border-l-2 border-primary/40 pl-3">
                      <p className="text-sm font-semibold text-foreground">{insight.titulo}</p>
                      <p className="text-sm text-muted-foreground">{insight.descricao}</p>
                      {insight.acao && <p className="text-xs text-primary mt-1">💡 {insight.acao}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {data.variacaoReceita !== null
                    ? `Este mês houve ${data.variacaoReceita >= 0 ? "um aumento" : "uma redução"} de ${Math.abs(data.variacaoReceita).toFixed(1)}% no faturamento em relação ao mês anterior.`
                    : "Sem dados suficientes para gerar sumário."}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="text-center text-xs text-muted-foreground pt-4 border-t border-border">
            Relatório gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm")} · {data.empresa?.nome || "GeoGestor"} · Powered by GeoGestor
          </div>
        </div>

        {/* ===== HIDDEN PRINTABLE REPORT (captured by html2canvas) ===== */}
        <div ref={reportRef} style={{ display: "none" }}>
          <PrintableReport
            empresa={data.empresa}
            periodoLabel={periodoLabel}
            receitaTotal={receitaTotal}
            despesaTotal={despesaTotal}
            lucroLiquido={lucroLiquido}
            margemLucro={margemLucro}
            taxaConversao={taxaConversao}
            conversao={data.conversao}
            variacaoReceita={variacaoReceita}
            receitaAnterior={receitaAnterior}
            despesaAnterior={despesaAnterior}
            lucroAnterior={lucroAnterior}
            dadosSemanais={data.dadosSemanais}
            receitaCategorias={data.receitaCategorias}
            clientes={data.clientes}
            servicosCusto={data.servicosCusto}
            orcamentosPendentes={data.orcamentosPendentes}
            topClientes={data.topClientes}
            historico12Meses={data.historico12Meses}
            aiSummary={aiSummary}
            isLoading={data.isLoading}
            isDraft={isDraft}
          />
        </div>

      </div>
    </AppLayout>
  );
};

function KPIBox({ label, value, color, subtitle, icon }: { label: string; value: string; color: string; subtitle?: string; icon?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 mb-1">
          {icon && <span className={color}>{icon}</span>}
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
        <p className={`text-lg font-bold ${color}`}>{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

function ComparisonKPI({ label, current, previous, format: fmt, invertColors, icon }: { 
  label: string; 
  current: number; 
  previous: number; 
  format: "currency" | "percent"; 
  invertColors?: boolean;
  icon?: React.ReactNode;
}) {
  const variation = previous > 0 ? ((current - previous) / previous) * 100 : null;
  const isPositive = invertColors ? (variation !== null && variation <= 0) : (variation !== null && variation >= 0);
  
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-1.5 mb-3">
          {icon && <span className="text-muted-foreground">{icon}</span>}
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Atual</p>
            <p className="text-lg font-bold text-primary">
              {fmt === "currency" ? formatarMoeda(current) : formatarPercentual(current)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Anterior</p>
            <p className="text-lg font-semibold text-muted-foreground">
              {fmt === "currency" ? formatarMoeda(previous) : formatarPercentual(previous)}
            </p>
          </div>
        </div>
        {variation !== null && (
          <div className={cn(
            "mt-3 pt-3 border-t text-center text-sm font-semibold",
            isPositive ? "text-chart-positive" : "text-destructive"
          )}>
            {variation >= 0 ? "▲" : "▼"} {Math.abs(variation).toFixed(1)}%
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default RelatorioExecutivo;
