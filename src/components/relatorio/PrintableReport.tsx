import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LabelList } from "recharts";
import { formatarMoeda, formatarPercentual } from "@/core/finance";
import { Loader2, FileText, AlertTriangle } from "lucide-react";
import type { DadoSemanal, ReceitaCategoria, ClienteNovo, ServicoCusto, OrcamentoPendente } from "@/hooks/useRelatorioData";
import skyGeoLogo from "@/assets/skygeo-logo.png";

/* ===== Monochromatic SkyGeo Palette ===== */
const SKYGEO_BLUE = "#1e3a5f";
const SKYGEO_BLUE_10 = "rgba(30,58,95,0.10)";
const SKYGEO_BLUE_20 = "rgba(30,58,95,0.20)";
const ALERT_RED = "#dc2626";
const SUCCESS_GREEN = "#16a34a";
const BAR_PALETTE = [SKYGEO_BLUE, "rgba(30,58,95,0.80)", "rgba(30,58,95,0.60)", "rgba(30,58,95,0.45)", "rgba(30,58,95,0.30)", "#64748b", "#94a3b8", "#cbd5e1"];

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

  const margemReal = receitaTotal !== 0 ? (lucroLiquido / receitaTotal) * 100 : 0;
  const isSaudavel = lucroLiquido >= 0 && (variacaoReceita === null || variacaoReceita >= 0);

  const varDespesa = calcVariation(despesaTotal, despesaAnterior);
  const varLucro = calcVariation(lucroLiquido, lucroAnterior);

  const allUncategorized = receitaCategorias.length > 0 &&
    receitaCategorias.every((c) => {
      const cat = c.categoria?.toLowerCase().trim();
      return !cat || cat === "sem categoria" || cat === "outros" || cat === "null";
    });

  // Sorted categories for horizontal bar chart
  const sortedCategorias = [...receitaCategorias]
    .filter(c => {
      const cat = c.categoria?.toLowerCase().trim();
      return cat && cat !== "sem categoria" && cat !== "outros" && cat !== "null";
    })
    .sort((a, b) => b.valor - a.valor);

  // Build "Destaques do Período" narrative bullets
  const destaques: string[] = [];
  if (variacaoReceita !== null) {
    destaques.push(
      variacaoReceita >= 0
        ? `Faturamento cresceu ${Math.abs(variacaoReceita).toFixed(1)}% em relação ao mês anterior.`
        : `Faturamento retraiu ${Math.abs(variacaoReceita).toFixed(1)}% em relação ao mês anterior.`
    );
  }
  if (varDespesa !== null) {
    destaques.push(
      varDespesa > 0
        ? `Despesas aumentaram ${Math.abs(varDespesa).toFixed(1)}%, exigindo atenção.`
        : `Despesas reduziram ${Math.abs(varDespesa).toFixed(1)}%, contribuindo para a lucratividade.`
    );
  }
  if (lucroLiquido < 0) {
    destaques.push(`O período fechou com prejuízo de ${formatarMoeda(Math.abs(lucroLiquido))}.`);
  } else if (margemReal > 0) {
    destaques.push(`Margem de lucro de ${formatarPercentual(margemReal)} indica operação sustentável.`);
  }
  if (orcamentosPendentes.length > 0) {
    destaques.push(`${orcamentosPendentes.length} orçamento(s) pendente(s) totalizam ${formatarMoeda(orcamentosPendentes.reduce((s, o) => s + o.valor, 0))}.`);
  }

  // Insights do Gestor — promoted section
  const insightsGestor: string[] = [];
  if (aiSummary.data?.insights?.length > 0) {
    aiSummary.data.insights.forEach((insight: any) => {
      if (insight.acao && insightsGestor.length < 4) insightsGestor.push(insight.acao);
    });
  }
  if (lucroLiquido < 0 && insightsGestor.length < 4) insightsGestor.push("Revisar custos fixos e variáveis para identificar oportunidades de redução.");
  if (orcamentosPendentes.length > 0 && insightsGestor.length < 4) insightsGestor.push(`Retomar contato com ${orcamentosPendentes.length} orçamento(s) pendente(s) para conversão.`);
  if (allUncategorized && insightsGestor.length < 4) insightsGestor.push("Categorizar serviços para melhor visibilidade da distribuição de receita.");
  if (despesaTotal > receitaTotal && insightsGestor.length < 4) insightsGestor.push("Analisar despesas que excedem o faturamento e priorizar cortes.");
  if (insightsGestor.length < 3) insightsGestor.push("Acompanhar evolução mensal dos KPIs para identificar tendências.");

  // Cost table summary
  const totalReceita = servicosCusto.reduce((s, x) => s + x.receita, 0);
  const totalCusto = servicosCusto.reduce((s, x) => s + x.custo, 0);
  const avgMargem = servicosCusto.length > 0 ? servicosCusto.reduce((s, x) => s + x.margem, 0) / servicosCusto.length : 0;

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

      {/* HEADER */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: `3px solid ${SKYGEO_BLUE}`, paddingBottom: "16px", marginBottom: "36px" }}>
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
        <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#1a1a1a", margin: "0 0 4px" }}>
          Relatório de Gestão Financeira
        </h2>
        <p style={{ fontSize: "13px", color: SKYGEO_BLUE, fontWeight: 600, margin: 0 }}>
          {periodoLabel.charAt(0).toUpperCase() + periodoLabel.slice(1)}
        </p>
      </div>

      {/* HEALTH STATUS */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "28px", padding: "10px 16px", background: isSaudavel ? "#f0fdf4" : "#fef3c7", borderRadius: "4px", borderLeft: `4px solid ${isSaudavel ? SUCCESS_GREEN : "#d97706"}` }}>
        <span style={{ fontSize: "11px", fontWeight: 700, color: isSaudavel ? SUCCESS_GREEN : "#d97706", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {isSaudavel ? "● Saudável" : "● Atenção"}
        </span>
        <span style={{ fontSize: "11px", color: "#4b5563" }}>
          Estado de Saúde Financeira
          {variacaoReceita !== null && (
            <> — <strong style={{ color: variacaoReceita >= 0 ? SUCCESS_GREEN : ALERT_RED }}>
              {variacaoReceita >= 0 ? "+" : ""}{variacaoReceita.toFixed(1)}%
            </strong> vs. mês anterior</>
          )}
        </span>
      </div>

      {/* KPI BAND — larger values (24px) */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, margin: "0 0 36px", padding: "22px 0", borderTop: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb" }}>
        <KPIValue label="Faturamento" value={formatarMoeda(receitaTotal)} color={SKYGEO_BLUE} variation={variacaoReceita} />
        <div style={{ width: "1px", height: "52px", background: "#d1d5db", margin: "0 36px" }} />
        <KPIValue label="Total Gasto" value={formatarMoeda(despesaTotal)} color={ALERT_RED} variation={varDespesa} invertColor />
        <div style={{ width: "1px", height: "52px", background: "#d1d5db", margin: "0 36px" }} />
        <KPIValue label="Lucro Líquido" value={formatarMoeda(lucroLiquido)} color={lucroLiquido >= 0 ? SUCCESS_GREEN : ALERT_RED} variation={varLucro} />
      </div>

      {/* SECONDARY METRICS */}
      <div style={{ display: "flex", gap: "24px", marginBottom: "36px", paddingLeft: "4px" }}>
        <span style={{ fontSize: "10px", color: "#6b7280" }}>
          Margem de Lucro: <strong style={{ color: margemReal >= 0 ? SKYGEO_BLUE : ALERT_RED }}>{formatarPercentual(margemReal)}</strong>
        </span>
        <span style={{ fontSize: "10px", color: "#6b7280" }}>
          Taxa de Conversão: <strong style={{ color: SKYGEO_BLUE }}>{formatarPercentual(taxaConversao)}</strong>
          {conversao && <> ({conversao.convertidos}/{conversao.total} orçam.)</>}
        </span>
      </div>

      {/* ═══════════ DESTAQUES DO PERÍODO (Narrative Bridge) ═══════════ */}
      {destaques.length > 0 && (
        <div style={{ marginBottom: "36px", padding: "14px 18px", background: "#f8fafc", borderLeft: `4px solid ${SKYGEO_BLUE}`, borderRadius: "0 6px 6px 0" }}>
          <p style={{ fontSize: "10px", fontWeight: 700, color: SKYGEO_BLUE, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>
            Destaques do Período
          </p>
          <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "11px", color: "#374151", lineHeight: 1.9 }}>
            {destaques.slice(0, 4).map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ═══════════ EXECUTIVE SUMMARY ═══════════ */}
      <section style={{ marginBottom: "36px" }} className="page-break-inside-avoid">
        <SectionTitle subtitle="Análise consolidada do período com recomendações estratégicas.">Sumário Executivo</SectionTitle>

        {aiSummary.isLoading ? (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#6b7280", fontSize: "12px", padding: "16px 0" }}>
            <Loader2 className="h-4 w-4 animate-spin" /> Gerando análise...
          </div>
        ) : aiSummary.data?.insights?.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <p style={{ fontSize: "12px", color: "#374151", margin: 0, lineHeight: 1.8 }}>
              No período de <strong>{periodoLabel}</strong>, a empresa registrou faturamento de{" "}
              <strong>{formatarMoeda(receitaTotal)}</strong> e despesas de{" "}
              <strong>{formatarMoeda(despesaTotal)}</strong>, resultando em{" "}
              {lucroLiquido >= 0 ? "lucro" : "prejuízo"} líquido de{" "}
              <strong style={{ color: lucroLiquido >= 0 ? SUCCESS_GREEN : ALERT_RED }}>{formatarMoeda(Math.abs(lucroLiquido))}</strong>
              {variacaoReceita !== null && (
                <>, com {variacaoReceita >= 0 ? "crescimento" : "retração"} de{" "}
                <strong>{Math.abs(variacaoReceita).toFixed(1)}%</strong> no faturamento em relação ao mês anterior</>
              )}.
            </p>

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

      {/* WEEKLY BAR CHART — with direct data labels, no Y-axis grid */}
      <section style={{ marginBottom: "36px" }} className="page-break-inside-avoid">
        <SectionTitle subtitle="Compare entradas e saídas semanais para identificar padrões de fluxo de caixa.">Entradas vs Saídas — Semanal</SectionTitle>
        {dadosSemanais.length > 0 ? (
          <>
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosSemanais} margin={{ top: 20, right: 12, left: 0, bottom: 5 }}>
                  <XAxis dataKey="semana" fontSize={9} tick={{ fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
                  <YAxis hide />
                  <Bar dataKey="entradas" name="Entradas" fill={SKYGEO_BLUE} radius={[3, 3, 0, 0]}>
                    <LabelList dataKey="entradas" position="top" formatter={(v: number) => v > 0 ? `${(v / 1000).toFixed(0)}k` : ""} style={{ fontSize: 8, fill: SKYGEO_BLUE, fontWeight: 600 }} />
                  </Bar>
                  <Bar dataKey="saidas" name="Saídas" fill="#94a3b8" radius={[3, 3, 0, 0]}>
                    <LabelList dataKey="saidas" position="top" formatter={(v: number) => v > 0 ? `${(v / 1000).toFixed(0)}k` : ""} style={{ fontSize: 8, fill: "#64748b", fontWeight: 600 }} />
                  </Bar>
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
      </section>

      {/* HORIZONTAL BAR CHART — Receita por Tipo de Serviço (replaces Donut) */}
      {allUncategorized ? (
        <section style={{ marginBottom: "36px" }} className="page-break-inside-avoid">
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "28px 20px", background: "#fffbeb", borderRadius: "6px", border: "1px solid #fde68a" }}>
            <AlertTriangle style={{ width: 22, height: 22, color: "#d97706", marginBottom: "10px" }} />
            <p style={{ fontSize: "10px", fontWeight: 700, color: "#92400e", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Pendência</p>
            <p style={{ fontSize: "11px", color: "#92400e", margin: 0, textAlign: "center", lineHeight: 1.6 }}>
              Categorize seus serviços para habilitar a análise de lucratividade por tipo de serviço.
            </p>
          </div>
        </section>
      ) : sortedCategorias.length > 0 ? (
        <section style={{ marginBottom: "36px" }} className="page-break-inside-avoid">
          <SectionTitle subtitle="Identifique quais categorias de serviço geram mais receita.">Receita por Tipo de Serviço</SectionTitle>
          <div style={{ height: Math.max(140, sortedCategorias.length * 36 + 20) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sortedCategorias} layout="vertical" margin={{ top: 4, right: 80, left: 4, bottom: 4 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="categoria"
                  width={120}
                  fontSize={10}
                  tick={{ fill: "#374151" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Bar dataKey="valor" fill={SKYGEO_BLUE} radius={[0, 4, 4, 0]} barSize={20}>
                  <LabelList
                    dataKey="valor"
                    position="right"
                    formatter={(v: number) => formatarMoeda(v)}
                    style={{ fontSize: 9, fill: "#374151", fontWeight: 600 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      ) : null}

      {/* ═══════════ TABLES ═══════════ */}

      {/* Novos Clientes */}
      <section style={{ marginBottom: "36px" }} className="page-break-inside-avoid">
        {clientes.length > 0 ? (
          <>
            <SectionTitle subtitle="Clientes adicionados à base durante o período.">Novos Clientes ({clientes.length})</SectionTitle>
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
          </>
        ) : (
          <EmptyState message="Não houve novos clientes cadastrados neste período." />
        )}
      </section>

      {/* Serviços com Maior Custo — enhanced with summary row & row highlighting */}
      <section style={{ marginBottom: "36px" }} className="page-break-inside-avoid">
        {servicosCusto.length > 0 ? (
          <>
            <SectionTitle subtitle="Serviços ordenados pelo custo total, com destaque para margens negativas.">Serviços com Maior Custo</SectionTitle>
            <PrintTable
              headers={["Serviço", "Receita", "Custo", "Margem", "Margem Contrib."]}
              colWidths={["28%", "17%", "17%", "17%", "21%"]}
              alignRight={[false, true, true, true, true]}
              boldColumns={[3, 4]}
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
              rowHighlight={servicosCusto.map((s) => s.margem < 0)}
              cellColors={servicosCusto.map((s) => {
                const margemContrib = s.receita - s.custo;
                return {
                  2: ALERT_RED,
                  3: s.margem >= 0 ? SUCCESS_GREEN : ALERT_RED,
                  4: margemContrib >= 0 ? SUCCESS_GREEN : ALERT_RED,
                };
              })}
              summaryRow={[
                "Total / Média",
                formatarMoeda(totalReceita),
                formatarMoeda(totalCusto),
                formatarPercentual(avgMargem),
                formatarMoeda(totalReceita - totalCusto),
              ]}
              summaryColors={{
                3: avgMargem >= 0 ? SUCCESS_GREEN : ALERT_RED,
                4: (totalReceita - totalCusto) >= 0 ? SUCCESS_GREEN : ALERT_RED,
              }}
            />
          </>
        ) : (
          <EmptyState message="Nenhum serviço com custo registrado neste período." />
        )}
      </section>

      {/* Orçamentos Pendentes */}
      <section style={{ marginBottom: "36px" }} className="page-break-inside-avoid">
        {orcamentosPendentes.length > 0 ? (
          <>
            <SectionTitle subtitle="Orçamentos aguardando aprovação ou pagamento.">Orçamentos Pendentes ({orcamentosPendentes.length})</SectionTitle>
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
          </>
        ) : (
          <EmptyState message="Não há orçamentos pendentes para este período." />
        )}
      </section>

      {/* ═══════════ INSIGHTS DO GESTOR — Promoted Section (Now What?) ═══════════ */}
      {insightsGestor.length > 0 && (
        <section style={{ marginBottom: "36px", pageBreakInside: "avoid" }}>
          <SectionTitle subtitle="Ações recomendadas com base na análise dos dados do período.">Plano de Ação</SectionTitle>
          <div style={{ padding: "16px 20px", background: SKYGEO_BLUE_10, borderRadius: "6px", border: `1px solid ${SKYGEO_BLUE_20}` }}>
            <ol style={{ margin: 0, paddingLeft: "18px", fontSize: "11px", color: "#1e293b", lineHeight: 2.0 }}>
              {insightsGestor.slice(0, 4).map((step, i) => (
                <li key={i} style={{ paddingLeft: "4px" }}>
                  <span style={{ fontWeight: 600, color: SKYGEO_BLUE }}>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {/* ═══════════ FOOTER ═══════════ */}
      <footer style={{ borderTop: `2px solid ${SKYGEO_BLUE}`, paddingTop: "16px", marginTop: "40px" }}>
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
  const isPositive = invert ? value <= 0 : value >= 0;
  const color = isPositive ? SUCCESS_GREEN : ALERT_RED;
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
      <p style={{ fontSize: "24px", fontWeight: 800, color, margin: 0, letterSpacing: "-0.02em" }}>{value}</p>
      <VariationBadge value={variation ?? null} invert={invertColor} />
    </div>
  );
}

function SectionTitle({ children, subtitle }: { children: React.ReactNode; subtitle?: string }) {
  return (
    <div style={{ marginBottom: "14px" }}>
      <h3 style={{
        fontSize: "11px",
        fontWeight: 700,
        color: SKYGEO_BLUE,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        borderBottom: "1px solid #e2e8f0",
        paddingBottom: "6px",
        marginBottom: subtitle ? "4px" : 0,
      }}>
        {children}
      </h3>
      {subtitle && (
        <p style={{ fontSize: "9px", color: "#94a3b8", margin: 0, fontStyle: "italic", lineHeight: 1.5 }}>
          {subtitle}
        </p>
      )}
    </div>
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

function EmptyState({ message }: { message?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "16px 20px", background: "#f8fafc", borderRadius: "6px", border: "1px dashed #e2e8f0" }}>
      <FileText style={{ width: 16, height: 16, color: "#cbd5e1", flexShrink: 0 }} />
      <p style={{ fontSize: "11px", color: "#94a3b8", margin: 0, fontStyle: "italic" }}>
        {message || "Nenhuma movimentação registrada no período."}
      </p>
    </div>
  );
}

interface PrintTableProps {
  headers: string[];
  rows: string[][];
  colWidths?: string[];
  alignRight?: boolean[];
  boldColumns?: number[];
  cellColors?: Record<number, string>[];
  rowHighlight?: boolean[];
  summaryRow?: string[];
  summaryColors?: Record<number, string>;
}

function PrintTable({ headers, rows, colWidths, alignRight, boldColumns, cellColors, rowHighlight, summaryRow, summaryColors }: PrintTableProps) {
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
        {rows.map((row, ri) => {
          const isHighlighted = rowHighlight?.[ri];
          return (
            <tr key={ri} style={{ background: isHighlighted ? "#fef2f2" : (ri % 2 === 1 ? "#fafbfc" : "#fff") }}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  style={{
                    padding: "7px 10px",
                    textAlign: alignRight?.[ci] ? "right" : "left",
                    borderBottom: "1px solid #f1f5f9",
                    color: cellColors?.[ri]?.[ci] || "#1e293b",
                    fontWeight: (ci === 0 || boldColumns?.includes(ci)) ? 600 : 400,
                    wordBreak: "break-word",
                    overflow: "hidden",
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          );
        })}
        {summaryRow && (
          <tr style={{ borderTop: `2px solid ${SKYGEO_BLUE_20}`, background: "#f1f5f9" }}>
            {summaryRow.map((cell, ci) => (
              <td
                key={ci}
                style={{
                  padding: "8px 10px",
                  textAlign: alignRight?.[ci] ? "right" : "left",
                  fontWeight: 700,
                  fontSize: "10px",
                  color: summaryColors?.[ci] || SKYGEO_BLUE,
                }}
              >
                {cell}
              </td>
            ))}
          </tr>
        )}
      </tbody>
    </table>
  );
}
