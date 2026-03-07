import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Printer, ChevronLeft, ChevronRight, Sparkles, Loader2, CalendarIcon, RotateCcw, DollarSign, TrendingDown, BadgeDollarSign, Percent, Target, BarChart3, PieChart as PieChartIcon, UserPlus, Wrench, Clock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useRelatorioData } from "@/hooks/useRelatorioData";
import { formatarMoeda, formatarPercentual } from "@/core/finance";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

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
        <div className="report-content space-y-6 print:space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border pb-4 print:pb-2">
            <div>
              <h1 className="text-2xl font-heading font-bold text-foreground print:text-black">
                {data.empresa?.nome || "GeoGestor"}
              </h1>
              <p className="text-sm text-muted-foreground print:text-gray-600">Gestão para Topografia</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-foreground print:text-black">Relatório Executivo Mensal</p>
              <p className="text-lg font-bold capitalize text-primary print:text-purple-700">{periodoLabel}</p>
            </div>
          </div>

          {/* KPIs */}
          {data.isLoading ? (
            <div className="grid grid-cols-5 gap-4"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 print:grid-cols-5 print:gap-2">
              <KPIBox label="Total Faturado" value={formatarMoeda(receitaTotal)} color="text-primary" icon={<DollarSign className="h-4 w-4" />} />
              <KPIBox label="Total Gasto" value={formatarMoeda(despesaTotal)} color="text-destructive" icon={<TrendingDown className="h-4 w-4" />} />
              <KPIBox label="Lucro Líquido" value={formatarMoeda(lucroLiquido)} color={lucroLiquido >= 0 ? "text-emerald-600" : "text-destructive"} icon={<BadgeDollarSign className="h-4 w-4" />} />
              <KPIBox label="Margem de Lucro" value={formatarPercentual(margemLucro)} color={margemLucro >= 0 ? "text-emerald-600" : "text-destructive"} icon={<Percent className="h-4 w-4" />} />
              <KPIBox label="Taxa Conversão" value={formatarPercentual(taxaConversao)} color="text-accent" subtitle={data.conversao ? `${data.conversao.convertidos}/${data.conversao.total} orçam.` : undefined} icon={<Target className="h-4 w-4" />} />
            </div>
          )}

          {/* Variação mensal */}
          {data.variacaoReceita !== null && (
            <p className="text-sm text-muted-foreground print:text-gray-600">
              {data.variacaoReceita >= 0 ? "📈" : "📉"} Variação de faturamento em relação ao mês anterior:{" "}
              <span className={data.variacaoReceita >= 0 ? "text-emerald-600 font-semibold" : "text-destructive font-semibold"}>
                {data.variacaoReceita >= 0 ? "+" : ""}{data.variacaoReceita.toFixed(1)}%
              </span>
            </p>
          )}

          {/* Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2 print:gap-3 page-break-inside-avoid">
            {/* Bar Chart */}
            <Card className="print:shadow-none print:border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-emerald-500" /> Entradas vs Saídas (Semanal)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[220px] print:h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.dadosSemanais} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="semana" fontSize={11} />
                      <YAxis fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => formatarMoeda(v)} />
                      <Bar dataKey="entradas" name="Entradas" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="saidas" name="Saídas" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Donut Chart */}
            <Card className="print:shadow-none print:border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <PieChartIcon className="h-4 w-4 text-primary" /> Receita por Tipo de Serviço
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[220px] print:h-[180px]">
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
                        <Tooltip formatter={(v: number) => formatarMoeda(v)} />
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
          <div className="grid grid-cols-1 gap-4 print:gap-3 page-break-inside-avoid">
            {/* Novos Clientes */}
            <Card className="print:shadow-none print:border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-accent" /> Novos Clientes ({data.clientes.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.clientes.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Data Cadastro</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>E-mail</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.clientes.map((c, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{c.nome}</TableCell>
                          <TableCell>{c.data_cadastro ? format(new Date(c.data_cadastro), "dd/MM/yyyy") : "—"}</TableCell>
                          <TableCell>{c.telefone || "—"}</TableCell>
                          <TableCell>{c.email || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground py-3">Nenhum novo cliente no período.</p>
                )}
              </CardContent>
            </Card>

            {/* Serviços com Maior Custo */}
            <Card className="print:shadow-none print:border page-break-inside-avoid">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Serviços com Maior Custo</CardTitle>
              </CardHeader>
              <CardContent>
                {data.servicosCusto.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Serviço</TableHead>
                        <TableHead className="text-right">Receita</TableHead>
                        <TableHead className="text-right">Custo</TableHead>
                        <TableHead className="text-right">Margem</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.servicosCusto.map((s, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{s.nome}</TableCell>
                          <TableCell className="text-right">{formatarMoeda(s.receita)}</TableCell>
                          <TableCell className="text-right text-destructive">{formatarMoeda(s.custo)}</TableCell>
                          <TableCell className={`text-right font-semibold ${s.margem >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                            {formatarPercentual(s.margem)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground py-3">Nenhum serviço no período.</p>
                )}
              </CardContent>
            </Card>

            {/* Orçamentos Pendentes */}
            <Card className="print:shadow-none print:border page-break-inside-avoid">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Orçamentos Pendentes ({data.orcamentosPendentes.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {data.orcamentosPendentes.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Vencimento</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.orcamentosPendentes.map((o, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{o.codigo || "—"}</TableCell>
                          <TableCell>{o.cliente}</TableCell>
                          <TableCell className="text-right">{formatarMoeda(o.valor)}</TableCell>
                          <TableCell>{o.data_faturamento ? format(new Date(o.data_faturamento), "dd/MM/yyyy") : "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground py-3">Nenhum orçamento pendente no período.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* AI Executive Summary */}
          <Card className="print:shadow-none print:border page-break-inside-avoid">
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
                    <p className="text-sm font-medium text-foreground print:text-black">
                      Este mês houve {data.variacaoReceita >= 0 ? "um aumento" : "uma redução"} de{" "}
                      <strong>{Math.abs(data.variacaoReceita).toFixed(1)}%</strong> no faturamento em relação ao mês anterior.
                    </p>
                  )}
                  {aiSummary.data.insights.map((insight: any, i: number) => (
                    <div key={i} className="border-l-2 border-primary/40 pl-3">
                      <p className="text-sm font-semibold text-foreground print:text-black">{insight.titulo}</p>
                      <p className="text-sm text-muted-foreground print:text-gray-600">{insight.descricao}</p>
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
          <div className="text-center text-xs text-muted-foreground pt-4 border-t border-border print:text-gray-500">
            Relatório gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm")} · {data.empresa?.nome || "GeoGestor"} · Powered by GeoGestor
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

function KPIBox({ label, value, color, subtitle }: { label: string; value: string; color: string; subtitle?: string }) {
  return (
    <Card className="print:shadow-none print:border">
      <CardContent className="p-3 print:p-2">
        <p className="text-xs text-muted-foreground print:text-gray-500">{label}</p>
        <p className={`text-lg font-bold ${color} print:text-sm`}>{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

export default RelatorioExecutivo;
