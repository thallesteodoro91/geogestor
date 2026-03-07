import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { formatarMoeda, formatarPercentual } from "@/core/finance";
import { Sparkles, Loader2 } from "lucide-react";
import type { DadoSemanal, ReceitaCategoria, ClienteNovo, ServicoCusto, OrcamentoPendente } from "@/hooks/useRelatorioData";

// Sober palette for print documents
const PRINT_BAR_RECEITA = "#1e3a5f";
const PRINT_BAR_DESPESA = "#9ca3af";
const PRINT_DONUT_COLORS = ["#1e3a5f", "#475569", "#0d9488", "#92400e", "#6366f1", "#64748b", "#0891b2", "#a16207"];

interface PrintableReportProps {
  empresa: { nome: string } | null | undefined;
  periodoLabel: string;
  receitaTotal: number;
  despesaTotal: number;
  lucroLiquido: number;
  margemLucro: number;
  taxaConversao: number;
  conversao: { convertidos: number; total: number; taxa: number } | null | undefined;
  variacaoReceita: number | null;
  dadosSemanais: DadoSemanal[];
  receitaCategorias: ReceitaCategoria[];
  clientes: ClienteNovo[];
  servicosCusto: ServicoCusto[];
  orcamentosPendentes: OrcamentoPendente[];
  aiSummary: { isLoading: boolean; data: any };
  isLoading: boolean;
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="py-4 text-center text-sm italic" style={{ color: "#6b7280" }}>
      {message}
    </p>
  );
}

export function PrintableReport({
  empresa, periodoLabel, receitaTotal, despesaTotal, lucroLiquido, margemLucro,
  taxaConversao, conversao, variacaoReceita, dadosSemanais, receitaCategorias,
  clientes, servicosCusto, orcamentosPendentes, aiSummary, isLoading,
}: PrintableReportProps) {
  const geradoEm = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  const kpis = [
    { label: "Total Faturado", value: formatarMoeda(receitaTotal), positive: true },
    { label: "Total Gasto", value: formatarMoeda(despesaTotal), positive: false },
    { label: "Lucro Líquido", value: formatarMoeda(lucroLiquido), positive: lucroLiquido >= 0 },
    { label: "Margem de Lucro", value: formatarPercentual(margemLucro), positive: margemLucro >= 0 },
    { label: "Taxa Conversão", value: formatarPercentual(taxaConversao), subtitle: conversao ? `${conversao.convertidos}/${conversao.total} orçam.` : undefined, positive: true },
  ];

  if (isLoading) {
    return (
      <div className="printable-report" style={{ background: "white", color: "#1a1a1a", padding: "2rem", fontFamily: "Inter, system-ui, sans-serif" }}>
        <p>Carregando dados do relatório...</p>
      </div>
    );
  }

  return (
    <div className="printable-report" style={{ background: "white", color: "#1a1a1a", fontFamily: "Inter, system-ui, sans-serif", lineHeight: 1.6 }}>
      {/* ===== HEADER ===== */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "2px solid #1e3a5f", paddingBottom: "12px", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#1e3a5f", margin: 0 }}>
            {empresa?.nome || "GeoGestor"}
          </h1>
          <p style={{ fontSize: "12px", color: "#6b7280", margin: "2px 0 0" }}>Gestão para Topografia</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: "14px", fontWeight: 600, color: "#1a1a1a", margin: 0 }}>Relatório Mensal de Gestão</p>
          <p style={{ fontSize: "13px", color: "#1e3a5f", fontWeight: 600, margin: 0, textTransform: "capitalize" }}>{periodoLabel}</p>
          <p style={{ fontSize: "10px", color: "#9ca3af", margin: "2px 0 0" }}>Gerado em {geradoEm}</p>
        </div>
      </div>

      {/* ===== KPIs ===== */}
      <div style={{ display: "flex", gap: 0, marginBottom: "24px" }}>
        {kpis.map((kpi, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              textAlign: "center",
              padding: "12px 8px",
              borderRight: i < kpis.length - 1 ? "1px solid #e5e7eb" : "none",
            }}
          >
            <p style={{ fontSize: "10px", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>{kpi.label}</p>
            <p style={{ fontSize: "18px", fontWeight: 700, color: kpi.positive ? "#1e3a5f" : "#dc2626", margin: "4px 0 0" }}>{kpi.value}</p>
            {kpi.subtitle && <p style={{ fontSize: "10px", color: "#9ca3af", margin: "2px 0 0" }}>{kpi.subtitle}</p>}
          </div>
        ))}
      </div>

      {/* Variação mensal */}
      {variacaoReceita !== null && (
        <p style={{ fontSize: "12px", color: "#4b5563", marginBottom: "20px", paddingLeft: "4px" }}>
          {variacaoReceita >= 0 ? "▲" : "▼"} Variação em relação ao mês anterior:{" "}
          <strong style={{ color: variacaoReceita >= 0 ? "#047857" : "#dc2626" }}>
            {variacaoReceita >= 0 ? "+" : ""}{variacaoReceita.toFixed(1)}%
          </strong>
        </p>
      )}

      {/* ===== AI EXECUTIVE SUMMARY ===== */}
      <section style={{ marginBottom: "28px" }} className="page-break-inside-avoid">
        <SectionTitle>Sumário Executivo</SectionTitle>
        <div style={{ borderLeft: "4px solid #1e3a5f", background: "#f9fafb", padding: "16px 20px", borderRadius: "0 4px 4px 0" }}>
          {aiSummary.isLoading ? (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#6b7280", fontSize: "13px" }}>
              <Loader2 className="h-4 w-4 animate-spin" /> Gerando análise...
            </div>
          ) : aiSummary.data?.insights?.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {variacaoReceita !== null && (
                <p style={{ fontSize: "13px", color: "#1a1a1a", margin: 0 }}>
                  Este mês houve {variacaoReceita >= 0 ? "um aumento" : "uma redução"} de{" "}
                  <strong>{Math.abs(variacaoReceita).toFixed(1)}%</strong> no faturamento em relação ao mês anterior.
                </p>
              )}
              {aiSummary.data.insights.map((insight: any, i: number) => (
                <div key={i}>
                  <p style={{ fontSize: "13px", fontWeight: 600, color: "#1a1a1a", margin: 0 }}>{insight.titulo}</p>
                  <p style={{ fontSize: "12px", color: "#4b5563", margin: "2px 0 0" }}>{insight.descricao}</p>
                  {insight.acao && <p style={{ fontSize: "11px", color: "#1e3a5f", margin: "4px 0 0" }}>→ {insight.acao}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: "13px", color: "#4b5563", margin: 0 }}>
              {variacaoReceita !== null
                ? `Este mês houve ${variacaoReceita >= 0 ? "um aumento" : "uma redução"} de ${Math.abs(variacaoReceita).toFixed(1)}% no faturamento.`
                : "Sem dados suficientes para gerar sumário."}
            </p>
          )}
        </div>
      </section>

      {/* ===== CHARTS ===== */}
      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "28px" }} className="page-break-inside-avoid">
        {/* Bar Chart */}
        <div>
          <SectionTitle>Entradas vs Saídas (Semanal)</SectionTitle>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosSemanais} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <XAxis dataKey="semana" fontSize={10} tick={{ fill: "#4b5563" }} axisLine={{ stroke: "#d1d5db" }} tickLine={false} />
                <YAxis fontSize={10} tick={{ fill: "#4b5563" }} axisLine={{ stroke: "#d1d5db" }} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatarMoeda(v)} contentStyle={{ fontSize: 11, border: "1px solid #e5e7eb" }} />
                <Bar dataKey="entradas" name="Entradas" fill={PRINT_BAR_RECEITA} radius={[3, 3, 0, 0]} />
                <Bar dataKey="saidas" name="Saídas" fill={PRINT_BAR_DESPESA} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: "16px", marginTop: "6px" }}>
            <LegendItem color={PRINT_BAR_RECEITA} label="Entradas" />
            <LegendItem color={PRINT_BAR_DESPESA} label="Saídas" />
          </div>
        </div>

        {/* Donut Chart */}
        <div>
          <SectionTitle>Receita por Tipo de Serviço</SectionTitle>
          {receitaCategorias.length > 0 ? (
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={receitaCategorias}
                    dataKey="valor"
                    nameKey="categoria"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={2}
                    label={({ categoria, percent }) => `${categoria} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                    fontSize={9}
                  >
                    {receitaCategorias.map((_, i) => (
                      <Cell key={i} fill={PRINT_DONUT_COLORS[i % PRINT_DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatarMoeda(v)} contentStyle={{ fontSize: 11, border: "1px solid #e5e7eb" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState message="Não houve movimentação nesta categoria no período." />
          )}
        </div>
      </section>

      {/* ===== TABLES ===== */}

      {/* Novos Clientes */}
      <section style={{ marginBottom: "24px" }} className="page-break-inside-avoid">
        <SectionTitle>Novos Clientes ({clientes.length})</SectionTitle>
        {clientes.length > 0 ? (
          <PrintTable
            headers={["Nome", "Data Cadastro", "Telefone", "E-mail"]}
            rows={clientes.map((c) => [
              c.nome,
              c.data_cadastro ? format(new Date(c.data_cadastro), "dd/MM/yyyy") : "—",
              c.telefone || "—",
              c.email || "—",
            ])}
          />
        ) : (
          <EmptyState message="Não houve movimentação nesta categoria no período." />
        )}
      </section>

      {/* Serviços com Maior Custo */}
      <section style={{ marginBottom: "24px" }} className="page-break-inside-avoid">
        <SectionTitle>Serviços com Maior Custo</SectionTitle>
        {servicosCusto.length > 0 ? (
          <PrintTable
            headers={["Serviço", "Receita", "Custo", "Margem"]}
            alignRight={[false, true, true, true]}
            rows={servicosCusto.map((s) => [
              s.nome,
              formatarMoeda(s.receita),
              formatarMoeda(s.custo),
              formatarPercentual(s.margem),
            ])}
            cellColors={servicosCusto.map((s) => ({
              2: "#dc2626",
              3: s.margem >= 0 ? "#047857" : "#dc2626",
            }))}
          />
        ) : (
          <EmptyState message="Não houve movimentação nesta categoria no período." />
        )}
      </section>

      {/* Orçamentos Pendentes */}
      <section style={{ marginBottom: "24px" }} className="page-break-inside-avoid">
        <SectionTitle>Orçamentos Pendentes ({orcamentosPendentes.length})</SectionTitle>
        {orcamentosPendentes.length > 0 ? (
          <PrintTable
            headers={["Código", "Cliente", "Valor", "Vencimento"]}
            alignRight={[false, false, true, false]}
            rows={orcamentosPendentes.map((o) => [
              o.codigo || "—",
              o.cliente,
              formatarMoeda(o.valor),
              o.data_faturamento ? format(new Date(o.data_faturamento), "dd/MM/yyyy") : "—",
            ])}
          />
        ) : (
          <EmptyState message="Não houve movimentação nesta categoria no período." />
        )}
      </section>

      {/* ===== FOOTER ===== */}
      <div style={{ borderTop: "1px solid #d1d5db", paddingTop: "12px", marginTop: "32px", textAlign: "center" }}>
        <p style={{ fontSize: "10px", color: "#9ca3af", margin: 0 }}>
          {empresa?.nome || "GeoGestor"} · Relatório gerado em {geradoEm} · Powered by GeoGestor
        </p>
      </div>
    </div>
  );
}

/* ===== Sub-components ===== */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontSize: "13px",
      fontWeight: 700,
      color: "#1e3a5f",
      textTransform: "uppercase",
      letterSpacing: "0.06em",
      borderBottom: "1px solid #e5e7eb",
      paddingBottom: "6px",
      marginBottom: "12px",
    }}>
      {children}
    </h2>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
      <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
      <span style={{ fontSize: "10px", color: "#4b5563" }}>{label}</span>
    </div>
  );
}

interface PrintTableProps {
  headers: string[];
  rows: string[][];
  alignRight?: boolean[];
  cellColors?: Record<number, string>[];
}

function PrintTable({ headers, rows, alignRight, cellColors }: PrintTableProps) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
      <thead>
        <tr>
          {headers.map((h, i) => (
            <th
              key={i}
              style={{
                background: "#f3f4f6",
                padding: "8px 10px",
                textAlign: alignRight?.[i] ? "right" : "left",
                fontWeight: 600,
                color: "#374151",
                borderBottom: "2px solid #d1d5db",
                fontSize: "11px",
              }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri} style={{ background: ri % 2 === 1 ? "#f9fafb" : "white" }}>
            {row.map((cell, ci) => (
              <td
                key={ci}
                style={{
                  padding: "7px 10px",
                  textAlign: alignRight?.[ci] ? "right" : "left",
                  borderBottom: "1px solid #e5e7eb",
                  color: cellColors?.[ri]?.[ci] || "#1a1a1a",
                  fontWeight: ci === 0 ? 500 : 400,
                }}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
