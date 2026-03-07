import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { formatarMoeda, formatarPercentual } from "@/core/finance";
import { Loader2, FileText, AlertTriangle } from "lucide-react";
import type { DadoSemanal, ReceitaCategoria, ClienteNovo, ServicoCusto, OrcamentoPendente } from "@/hooks/useRelatorioData";
import skyGeoLogo from "@/assets/skygeo-logo.png";

/* ===== Monochromatic SkyGeo Palette ===== */
const SKYGEO_BLUE = "#1e3a5f";
const SKYGEO_BLUE_80 = "rgba(30,58,95,0.80)";
const SKYGEO_BLUE_60 = "rgba(30,58,95,0.60)";
const SKYGEO_BLUE_40 = "rgba(30,58,95,0.40)";
const SKYGEO_BLUE_20 = "rgba(30,58,95,0.20)";
const SKYGEO_BLUE_10 = "rgba(30,58,95,0.10)";
const DONUT_PALETTE = [SKYGEO_BLUE, SKYGEO_BLUE_80, SKYGEO_BLUE_60, SKYGEO_BLUE_40, "#64748b", "#94a3b8", "#cbd5e1", "#e2e8f0"];

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
  receitaAnterior: number | null;
  despesaAnterior: number | null;
  lucroAnterior: number | null;
  dadosSemanais: DadoSemanal[];
  receitaCategorias: ReceitaCategoria[];
  clientes: ClienteNovo[];
  servicosCusto: ServicoCusto[];
  orcamentosPendentes: OrcamentoPendente[];
  aiSummary: { isLoading: boolean; data: any };
  isLoading: boolean;
}

function generateReportId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "";
  for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return `SG-${id}`;
}

function calcVariation(current: number, previous: number | null): number | null {
  if (previous === null || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function PrintableReport({
  empresa, periodoLabel, receitaTotal, despesaTotal, lucroLiquido, margemLucro,
  taxaConversao, conversao, variacaoReceita, receitaAnterior, despesaAnterior, lucroAnterior,
  dadosSemanais, receitaCategorias, clientes, servicosCusto, orcamentosPendentes, aiSummary, isLoading,
}: PrintableReportProps) {
  const geradoEm = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  const dataEmissao = format(new Date(), "dd/MM/yyyy");
  const reportId = generateReportId();

  // Real margin calculation: Margem = Lucro / Faturamento
  const margemReal = receitaTotal > 0 ? (lucroLiquido / receitaTotal) * 100 : 0;

  const isSaudavel = lucroLiquido >= 0 && (variacaoReceita === null || variacaoReceita >= 0);

  // KPI variations vs previous month
  const varDespesa = calcVariation(despesaTotal, despesaAnterior);
  const varLucro = calcVariation(lucroLiquido, lucroAnterior);

  // Conditional: check if all categories are "Sem Categoria" or similar
  const allUncategorized = receitaCategorias.length > 0 &&
    receitaCategorias.every((c) => {
      const cat = c.categoria?.toLowerCase().trim();
      return !cat || cat === "sem categoria" || cat === "outros" || cat === "null";
    });

  // AI next steps for footer
  const nextSteps: string[] = [];
  if (aiSummary.data?.insights?.length > 0) {
    aiSummary.data.insights.forEach((insight: any) => {
      if (insight.acao) nextSteps.push(insight.acao);
    });
  }
  // Fallback next steps based on data
  if (nextSteps.length === 0) {
    if (lucroLiquido < 0) nextSteps.push("Revisar estrutura de custos para identificar fontes de prejuízo.");
    if (orcamentosPendentes.length > 0) nextSteps.push(`Retomar contato com ${orcamentosPendentes.length} orçamento(s) pendente(s).`);
    if (allUncategorized) nextSteps.push("Categorizar serviços para melhor visibilidade da distribuição de receita.");
  }

  if (isLoading) {
    return (
      <div style={{ background: "#fff", color: "#1a1a1a", padding: "3rem", fontFamily: "'Inter', system-ui, sans-serif" }}>
        <p style={{ color: "#6b7280" }}>Carregando dados do relatório...</p>
      </div>
    );
  }

  return (
    <div className="printable-report" style={{ background: "#fff", color: "#1a1a1a", fontFamily: "'Inter', system-ui, sans-serif", lineHeight: 1.7, fontSize: "12px" }}>

      {/* ═══════════ PAGE 1 ═══════════ */}

      {/* HEADER — Technical with Logo */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: `3px solid ${SKYGEO_BLUE}`, paddingBottom: "16px", marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <img src={skyGeoLogo} alt="SkyGeo" style={{ width: "48px", height: "48px", objectFit: "contain" }} />
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: 900, color: SKYGEO_BLUE, margin: 0, letterSpacing: "-0.03em", fontFamily: "'Inter', system-ui, sans-serif" }}>
              SkyGeo
            </h1>
            <p style={{ fontSize: "10px", color: "#94a3b8", margin: "2px 0 0", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Inteligência Geoespacial & Gestão
            </p>
          </div>
        </div>
        <div style={{ textAlign: "right", fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace", fontSize: "9px", color: "#64748b", lineHeight: 1.8 }}>
          <p style={{ margin: 0 }}>ID: <strong style={{ color: "#1a1a1a" }}>{reportId}</strong></p>
          <p style={{ margin: 0 }}>Emissão: <strong style={{ color: "#1a1a1a" }}>{dataEmissao}</strong></p>
          <p style={{ margin: 0 }}>Responsável: <strong style={{ color: "#1a1a1a" }}>{empresa?.nome || "GeoGestor"}</strong></p>
        </div>
      </header>

      {/* TITLE + PERIOD */}
      <div style={{ marginBottom: "20px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#1a1a1a", margin: "0 0 4px" }}>
          Relatório de Gestão Financeira
        </h2>
        <p style={{ fontSize: "13px", color: SKYGEO_BLUE, fontWeight: 600, margin: 0, textTransform: "capitalize" }}>
          {periodoLabel}
        </p>
      </div>

      {/* HEALTH STATUS */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "24px", padding: "10px 16px", background: isSaudavel ? "#f0fdf4" : "#fef3c7", borderRadius: "4px", borderLeft: `4px solid ${isSaudavel ? "#16a34a" : "#d97706"}` }}>
        <span style={{ fontSize: "11px", fontWeight: 700, color: isSaudavel ? "#16a34a" : "#d97706", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {isSaudavel ? "● Saudável" : "● Atenção"}
        </span>
        <span style={{ fontSize: "11px", color: "#4b5563" }}>
          Estado de Saúde Financeira
          {variacaoReceita !== null && (
            <> — <strong style={{ color: variacaoReceita >= 0 ? "#16a34a" : "#dc2626" }}>
              {variacaoReceita >= 0 ? "+" : ""}{variacaoReceita.toFixed(1)}%
            </strong> vs. mês anterior</>
          )}
        </span>
      </div>

      {/* KPI BAND — 3 core metrics with variations */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, margin: "0 0 32px", padding: "20px 0", borderTop: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb" }}>
        <KPIValue label="Faturamento" value={formatarMoeda(receitaTotal)} color={SKYGEO_BLUE} variation={variacaoReceita} />
        <div style={{ width: "1px", height: "48px", background: "#d1d5db", margin: "0 32px" }} />
        <KPIValue label="Total Gasto" value={formatarMoeda(despesaTotal)} color="#dc2626" variation={varDespesa} invertColor />
        <div style={{ width: "1px", height: "48px", background: "#d1d5db", margin: "0 32px" }} />
        <KPIValue label="Lucro Líquido" value={formatarMoeda(lucroLiquido)} color={lucroLiquido >= 0 ? "#16a34a" : "#dc2626"} variation={varLucro} />
      </div>

      {/* SECONDARY METRICS — small row */}
      <div style={{ display: "flex", gap: "24px", marginBottom: "28px", paddingLeft: "4px" }}>
        <span style={{ fontSize: "10px", color: "#6b7280" }}>
          Margem de Lucro: <strong style={{ color: margemReal >= 0 ? SKYGEO_BLUE : "#dc2626" }}>{margemReal < 0 ? "-" : ""}{formatarPercentual(Math.abs(margemReal))}</strong>
        </span>
        <span style={{ fontSize: "10px", color: "#6b7280" }}>
          Taxa de Conversão: <strong style={{ color: SKYGEO_BLUE }}>{formatarPercentual(taxaConversao)}</strong>
          {conversao && <> ({conversao.convertidos}/{conversao.total} orçam.)</>}
        </span>
      </div>

      {/* ═══════════ EXECUTIVE SUMMARY ═══════════ */}
      <section style={{ marginBottom: "32px" }} className="page-break-inside-avoid">
        <SectionTitle>Sumário Executivo</SectionTitle>

        {aiSummary.isLoading ? (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#6b7280", fontSize: "12px", padding: "16px 0" }}>
            <Loader2 className="h-4 w-4 animate-spin" /> Gerando análise...
          </div>
        ) : aiSummary.data?.insights?.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Narrative intro — uses only current period data */}
            <p style={{ fontSize: "12px", color: "#374151", margin: 0, lineHeight: 1.8 }}>
              No período de <strong>{periodoLabel}</strong>, a empresa registrou faturamento de{" "}
              <strong>{formatarMoeda(receitaTotal)}</strong> e despesas de{" "}
              <strong>{formatarMoeda(despesaTotal)}</strong>, resultando em{" "}
              {lucroLiquido >= 0 ? "lucro" : "prejuízo"} líquido de{" "}
              <strong style={{ color: lucroLiquido >= 0 ? "#16a34a" : "#dc2626" }}>{formatarMoeda(Math.abs(lucroLiquido))}</strong>
              {variacaoReceita !== null && (
                <>, com {variacaoReceita >= 0 ? "crescimento" : "retração"} de{" "}
                <strong>{Math.abs(variacaoReceita).toFixed(1)}%</strong> no faturamento em relação ao mês anterior</>
              )}.
            </p>

            {/* AI Insights */}
            {aiSummary.data.insights.map((insight: any, i: number) => (
              <div key={i} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "14px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                  <span style={{ fontSize: "8px", fontWeight: 700, color: SKYGEO_BLUE, textTransform: "uppercase", letterSpacing: "0.1em", background: SKYGEO_BLUE_10, padding: "2px 6px", borderRadius: "3px" }}>
                    Insight de Gestão
                  </span>
                </div>
                <p style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b", margin: "0 0 4px" }}>
                  {insight.titulo}
                </p>
                <p style={{ fontSize: "11px", color: "#475569", margin: 0, lineHeight: 1.7 }}>
                  {insight.descricao}
                </p>
                {insight.acao && (
                  <p style={{ fontSize: "10px", color: SKYGEO_BLUE, margin: "8px 0 0", fontWeight: 600 }}>
                    → Recomendação: {insight.acao}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: "12px", color: "#6b7280", margin: 0, fontStyle: "italic" }}>
            No período de <strong>{periodoLabel}</strong>, a empresa registrou faturamento de{" "}
            <strong>{formatarMoeda(receitaTotal)}</strong>.{" "}
            {variacaoReceita !== null
              ? `Houve ${variacaoReceita >= 0 ? "crescimento" : "retração"} de ${Math.abs(variacaoReceita).toFixed(1)}% em relação ao mês anterior.`
              : "Dados insuficientes para comparação com período anterior."}
          </p>
        )}
      </section>

      {/* ═══════════ PAGE 2 — CHARTS ═══════════ */}
      <div style={{ pageBreakBefore: "always" }} />

      <section style={{ display: "grid", gridTemplateColumns: allUncategorized ? "1fr" : "3fr 2fr", gap: "28px", marginBottom: "32px" }} className="page-break-inside-avoid">
        {/* Bar Chart — 60% (or 100% if donut hidden) */}
        <div>
          <SectionTitle>Entradas vs Saídas — Semanal</SectionTitle>
          {dadosSemanais.length > 0 ? (
            <>
              <div style={{ height: 210 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dadosSemanais} margin={{ top: 8, right: 12, left: 0, bottom: 5 }}>
                    <XAxis dataKey="semana" fontSize={9} tick={{ fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
                    <YAxis fontSize={9} tick={{ fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => formatarMoeda(v)} contentStyle={{ fontSize: 10, border: "1px solid #e2e8f0", borderRadius: 4 }} />
                    <Bar dataKey="entradas" name="Entradas" fill={SKYGEO_BLUE} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="saidas" name="Saídas" fill="#94a3b8" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: "flex", justifyContent: "center", gap: "20px", marginTop: "8px" }}>
                <LegendItem color={SKYGEO_BLUE} label="Entradas" />
                <LegendItem color="#94a3b8" label="Saídas" />
              </div>
            </>
          ) : (
            <EmptyState />
          )}
        </div>

        {/* Donut Chart — 40% (conditional) */}
        {allUncategorized ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px", background: "#fffbeb", borderRadius: "6px", border: "1px solid #fde68a" }}>
            <AlertTriangle style={{ width: 20, height: 20, color: "#d97706", marginBottom: "8px" }} />
            <p style={{ fontSize: "11px", color: "#92400e", margin: 0, textAlign: "center", fontWeight: 500 }}>
              Categorize seus serviços para visualizar a distribuição de receita.
            </p>
          </div>
        ) : receitaCategorias.length > 0 ? (
          <div>
            <SectionTitle>Receita por Tipo de Serviço</SectionTitle>
            <div style={{ height: 210 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={receitaCategorias}
                    dataKey="valor"
                    nameKey="categoria"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    label={({ categoria, percent }) => `${categoria} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                    fontSize={8}
                  >
                    {receitaCategorias.map((_, i) => (
                      <Cell key={i} fill={DONUT_PALETTE[i % DONUT_PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatarMoeda(v)} contentStyle={{ fontSize: 10, border: "1px solid #e2e8f0", borderRadius: 4 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div>
            <SectionTitle>Receita por Tipo de Serviço</SectionTitle>
            <EmptyState />
          </div>
        )}
      </section>

      {/* ═══════════ TABLES ═══════════ */}

      {/* Novos Clientes */}
      <section style={{ marginBottom: "28px" }} className="page-break-inside-avoid">
        <SectionTitle>Novos Clientes ({clientes.length})</SectionTitle>
        {clientes.length > 0 ? (
          <PrintTable
            headers={["Nome", "Data Cadastro", "Telefone", "E-mail"]}
            colWidths={["30%", "18%", "20%", "32%"]}
            rows={clientes.map((c) => [
              c.nome,
              c.data_cadastro ? format(new Date(c.data_cadastro), "dd/MM/yyyy") : "—",
              c.telefone || "—",
              c.email || "—",
            ])}
          />
        ) : (
          <EmptyState />
        )}
      </section>

      {/* Serviços com Maior Prejuízo / Custo */}
      <section style={{ marginBottom: "28px" }} className="page-break-inside-avoid">
        <SectionTitle>Serviços com Maior Custo</SectionTitle>
        {servicosCusto.length > 0 ? (
          <PrintTable
            headers={["Serviço", "Receita", "Custo", "Margem", "Margem Contrib."]}
            colWidths={["28%", "17%", "17%", "17%", "21%"]}
            alignRight={[false, true, true, true, true]}
            rows={servicosCusto.map((s) => {
              const margemContrib = s.receita - s.custo;
              return [
                s.nome,
                formatarMoeda(s.receita),
                formatarMoeda(s.custo),
                formatarPercentual(s.margem),
                formatarMoeda(margemContrib),
              ];
            })}
            cellColors={servicosCusto.map((s) => {
              const margemContrib = s.receita - s.custo;
              return {
                2: "#dc2626",
                3: s.margem >= 0 ? "#16a34a" : "#dc2626",
                4: margemContrib >= 0 ? "#16a34a" : "#dc2626",
              };
            })}
          />
        ) : (
          <EmptyState />
        )}
      </section>

      {/* Orçamentos Pendentes */}
      <section style={{ marginBottom: "28px" }} className="page-break-inside-avoid">
        <SectionTitle>Orçamentos Pendentes ({orcamentosPendentes.length})</SectionTitle>
        {orcamentosPendentes.length > 0 ? (
          <PrintTable
            headers={["Código", "Cliente", "Valor", "Vencimento"]}
            colWidths={["20%", "35%", "25%", "20%"]}
            alignRight={[false, false, true, false]}
            rows={orcamentosPendentes.map((o) => [
              o.codigo || "—",
              o.cliente,
              formatarMoeda(o.valor),
              o.data_faturamento ? format(new Date(o.data_faturamento), "dd/MM/yyyy") : "—",
            ])}
          />
        ) : (
          <EmptyState />
        )}
      </section>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer style={{ borderTop: `2px solid ${SKYGEO_BLUE}`, paddingTop: "16px", marginTop: "40px" }}>
        {/* Próximos Passos Sugeridos */}
        {nextSteps.length > 0 && (
          <div style={{ marginBottom: "16px", padding: "12px 16px", background: "#f8fafc", borderRadius: "4px", border: "1px solid #e2e8f0" }}>
            <p style={{ fontSize: "9px", fontWeight: 700, color: SKYGEO_BLUE, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>
              Próximos Passos Sugeridos
            </p>
            <ol style={{ margin: 0, paddingLeft: "16px", fontSize: "10px", color: "#374151", lineHeight: 1.8 }}>
              {nextSteps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: "8px", color: "#94a3b8", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Documento confidencial — SkyGeo
          </p>
          <p style={{ fontSize: "8px", color: "#cbd5e1", margin: 0 }}>
            Powered by GeoGestor · {geradoEm}
          </p>
        </div>
      </footer>
    </div>
  );
}

/* ═══════════ Sub-components ═══════════ */

function VariationBadge({ value, invert }: { value: number | null; invert?: boolean }) {
  if (value === null) return null;
  // For expenses, an increase is bad (red), decrease is good (green)
  const isPositive = invert ? value <= 0 : value >= 0;
  const color = isPositive ? "#16a34a" : "#dc2626";
  return (
    <span style={{ fontSize: "9px", color, fontWeight: 600, display: "block", marginTop: "2px" }}>
      {value >= 0 ? "▲" : "▼"} {Math.abs(value).toFixed(1)}% <span style={{ fontWeight: 400, color: "#94a3b8" }}>vs mês ant.</span>
    </span>
  );
}

function KPIValue({ label, value, color, variation, invertColor }: { label: string; value: string; color: string; variation?: number | null; invertColor?: boolean }) {
  return (
    <div style={{ textAlign: "center", minWidth: "120px" }}>
      <p style={{ fontSize: "9px", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px", fontWeight: 500 }}>{label}</p>
      <p style={{ fontSize: "20px", fontWeight: 800, color, margin: 0, letterSpacing: "-0.02em" }}>{value}</p>
      <VariationBadge value={variation ?? null} invert={invertColor} />
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{
      fontSize: "11px",
      fontWeight: 700,
      color: SKYGEO_BLUE,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      borderBottom: "1px solid #e2e8f0",
      paddingBottom: "6px",
      marginBottom: "14px",
    }}>
      {children}
    </h3>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
      <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
      <span style={{ fontSize: "9px", color: "#64748b" }}>{label}</span>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px", background: "#f8fafc", borderRadius: "6px", border: "1px dashed #e2e8f0" }}>
      <FileText style={{ width: 18, height: 18, color: "#cbd5e1", marginBottom: "8px" }} />
      <p style={{ fontSize: "10px", color: "#94a3b8", margin: 0, fontStyle: "italic" }}>
        Nenhuma movimentação registrada no período.
      </p>
    </div>
  );
}

interface PrintTableProps {
  headers: string[];
  rows: string[][];
  colWidths?: string[];
  alignRight?: boolean[];
  cellColors?: Record<number, string>[];
}

function PrintTable({ headers, rows, colWidths, alignRight, cellColors }: PrintTableProps) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", tableLayout: "fixed" }}>
      {colWidths && (
        <colgroup>
          {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
        </colgroup>
      )}
      <thead>
        <tr>
          {headers.map((h, i) => (
            <th
              key={i}
              style={{
                background: "#f1f5f9",
                padding: "8px 10px",
                textAlign: alignRight?.[i] ? "right" : "left",
                fontWeight: 600,
                color: "#334155",
                borderBottom: `2px solid ${SKYGEO_BLUE_20}`,
                fontSize: "10px",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri} style={{ background: ri % 2 === 1 ? "#fafbfc" : "#fff" }}>
            {row.map((cell, ci) => (
              <td
                key={ci}
                style={{
                  padding: "7px 10px",
                  textAlign: alignRight?.[ci] ? "right" : "left",
                  borderBottom: "1px solid #f1f5f9",
                  color: cellColors?.[ri]?.[ci] || "#1e293b",
                  fontWeight: ci === 0 ? 500 : 400,
                  wordBreak: "break-word",
                  overflow: "hidden",
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
