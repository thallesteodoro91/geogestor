import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { KPICard } from "@/components/dashboard/KPICard";
import { useKPIs } from "@/hooks/useKPIs";
import { SkeletonKPI } from "@/components/dashboard/SkeletonKPI";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  AlertCircle,
} from "lucide-react";

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

const DashboardFinanceiro = () => {
  const { data: kpis, isLoading: kpisLoading } = useKPIs();

  // Buscar dados de lucro por cliente
  const { data: lucroPorCliente = [], isLoading: clientesLoading } = useQuery({
    queryKey: ["lucro-por-cliente"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fato_orcamento")
        .select(`
          id_cliente,
          lucro_esperado,
          dim_cliente!inner(nome)
        `)
        .order("lucro_esperado", { ascending: false })
        .limit(10);

      if (error) throw error;

      // Agrupar por cliente
      const grouped = data.reduce((acc: any[], curr) => {
        const cliente = curr.dim_cliente.nome;
        const existing = acc.find((item) => item.cliente === cliente);
        if (existing) {
          existing.lucro += curr.lucro_esperado || 0;
        } else {
          acc.push({
            cliente: cliente.length > 20 ? cliente.substring(0, 17) + "..." : cliente,
            lucro: curr.lucro_esperado || 0,
          });
        }
        return acc;
      }, []);

      return grouped.slice(0, 8);
    },
  });

  // Buscar dados de margem por serviço
  const { data: margemPorServico = [], isLoading: servicosLoading } = useQuery({
    queryKey: ["margem-por-servico"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fato_servico")
        .select(`
          nome_do_servico,
          categoria,
          receita_servico,
          custo_servico
        `)
        .order("receita_servico", { ascending: false })
        .limit(10);

      if (error) throw error;

      return data.map((s) => ({
        servico: s.nome_do_servico.length > 25 ? s.nome_do_servico.substring(0, 22) + "..." : s.nome_do_servico,
        margem: s.receita_servico > 0 ? ((s.receita_servico - s.custo_servico) / s.receita_servico * 100) : 0,
      })).slice(0, 8);
    },
  });

  // Buscar dados de custos por categoria
  const { data: custosPorCategoria = [], isLoading: custosLoading } = useQuery({
    queryKey: ["custos-por-categoria"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fato_despesas")
        .select(`
          valor_da_despesa,
          dim_tipodespesa!inner(categoria)
        `);

      if (error) throw error;

      // Agrupar por categoria
      const grouped = data.reduce((acc: any[], curr) => {
        const categoria = curr.dim_tipodespesa.categoria;
        const existing = acc.find((item) => item.categoria === categoria);
        if (existing) {
          existing.valor += curr.valor_da_despesa;
        } else {
          acc.push({
            categoria,
            valor: curr.valor_da_despesa,
          });
        }
        return acc;
      }, []);

      return grouped.sort((a, b) => b.valor - a.valor);
    },
  });

  // Dados de Receita Esperada x Realizada
  const receitaComparacao = {
    esperada: kpis?.receita_total || 0,
    realizada: kpis?.receita_realizada_total || 0,
    faturada: kpis?.valor_faturado_total || 0,
  };

  const receitaData = [
    { tipo: "Esperada", valor: receitaComparacao.esperada },
    { tipo: "Realizada", valor: receitaComparacao.realizada },
    { tipo: "Faturada", valor: receitaComparacao.faturada },
  ];

  const formatCurrency = (value: number) => `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-heading font-bold text-foreground tracking-tight">
            Dashboard Financeiro
          </h1>
          <p className="text-base text-muted-foreground">
            Análise contábil detalhada e performance financeira
          </p>
        </div>

        {/* Indicadores Principais */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {kpisLoading ? (
            <>
              <SkeletonKPI />
              <SkeletonKPI />
              <SkeletonKPI />
              <SkeletonKPI />
            </>
          ) : (
            <>
              <KPICard
                title="Receita Total"
                value={formatCurrency(kpis?.receita_total || 0)}
                icon={DollarSign}
                subtitle={`${kpis?.total_orcamentos || 0} orçamentos emitidos`}
                changeType="neutral"
                description="Soma total de todas as receitas esperadas dos orçamentos"
                calculation="Σ (Receita Esperada de todos os Orçamentos)"
              />

              <KPICard
                title="Lucro Líquido"
                value={formatCurrency(kpis?.lucro_liquido || 0)}
                icon={TrendingUp}
                subtitle={`Margem: ${formatPercent(kpis?.margem_liquida_percent || 0)}`}
                changeType="positive"
                description="Lucro final após todas as deduções de custos e despesas"
                calculation="Receita Total - Custos Totais - Despesas Operacionais"
              />

              <KPICard
                title="Margem Contribuição"
                value={formatPercent(kpis?.margem_contribuicao_percent || 0)}
                icon={Target}
                subtitle="Receita - Custos Variáveis"
                changeType="positive"
                description="Percentual da receita disponível para cobrir custos fixos e gerar lucro"
                calculation="((Receita - Custos Variáveis) / Receita) × 100"
              />

              <KPICard
                title="Ponto de Equilíbrio"
                value={formatCurrency(kpis?.ponto_equilibrio_receita || 0)}
                icon={AlertCircle}
                subtitle="Receita mínima necessária"
                changeType="neutral"
                description="Receita necessária para cobrir todos os custos sem gerar lucro nem prejuízo"
                calculation="Custos Fixos / Margem de Contribuição (%)"
              />
            </>
          )}
        </div>

        {/* Análise Textual */}
        <Card className="bg-gradient-to-br from-card to-card/80">
          <CardHeader>
            <CardTitle>Resumo Executivo</CardTitle>
            <CardDescription>Análise automática do período</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-foreground leading-relaxed">
              A margem média da empresa neste período foi de{" "}
              <span className="font-bold text-accent">
                {formatPercent(kpis?.margem_contribuicao_percent || 0)}
              </span>
              , com lucro líquido de{" "}
              <span className="font-bold text-success">
                {formatCurrency(kpis?.lucro_liquido || 0)}
              </span>
              . O ponto de equilíbrio está em{" "}
              <span className="font-bold text-warning">
                {formatCurrency(kpis?.ponto_equilibrio_receita || 0)}
              </span>{" "}
              reais. A receita total do período{" "}
              {(kpis?.receita_total || 0) >= (kpis?.ponto_equilibrio_receita || 0) ? (
                <span className="font-bold text-success">superou o ponto de equilíbrio</span>
              ) : (
                <span className="font-bold text-destructive">está abaixo do ponto de equilíbrio</span>
              )}
              , demonstrando{" "}
              {(kpis?.receita_total || 0) >= (kpis?.ponto_equilibrio_receita || 0)
                ? "uma operação saudável e sustentável"
                : "necessidade de atenção aos custos ou aumento de receita"}.
            </p>
          </CardContent>
        </Card>

        {/* Gráficos */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Lucro por Cliente */}
          <Card>
            <CardHeader>
              <CardTitle>Lucro por Cliente</CardTitle>
              <CardDescription>Top clientes por lucratividade esperada</CardDescription>
            </CardHeader>
            <CardContent>
              {clientesLoading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <p className="text-muted-foreground">Carregando...</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={lucroPorCliente}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="cliente"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Bar dataKey="lucro" fill="hsl(var(--chart-1))" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Margem por Serviço */}
          <Card>
            <CardHeader>
              <CardTitle>Margem por Serviço</CardTitle>
              <CardDescription>Rentabilidade dos principais serviços (%)</CardDescription>
            </CardHeader>
            <CardContent>
              {servicosLoading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <p className="text-muted-foreground">Carregando...</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={margemPorServico}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="servico"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number) => formatPercent(value)}
                    />
                    <Bar dataKey="margem" fill="hsl(var(--chart-2))" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Custos por Categoria */}
          <Card>
            <CardHeader>
              <CardTitle>Custos por Categoria</CardTitle>
              <CardDescription>Distribuição das despesas operacionais</CardDescription>
            </CardHeader>
            <CardContent>
              {custosLoading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <p className="text-muted-foreground">Carregando...</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={custosPorCategoria}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ categoria, percent }) =>
                        `${categoria}: ${(percent * 100).toFixed(0)}%`
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="valor"
                    >
                      {custosPorCategoria.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Receita Esperada x Realizada */}
          <Card>
            <CardHeader>
              <CardTitle>Receita: Esperada x Realizada</CardTitle>
              <CardDescription>Comparativo de execução financeira</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={receitaData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="tipo" stroke="hsl(var(--muted-foreground))" />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Bar dataKey="valor" fill="hsl(var(--chart-3))" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default DashboardFinanceiro;