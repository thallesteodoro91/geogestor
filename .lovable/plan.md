# Padronização global dos tooltips de informação

## Objetivo
Garantir que todo ícone de informação (`Info` / `HelpCircle`) do GeoGestor exiba um tooltip útil, padronizado, acessível (teclado + toque) e baseado em um catálogo central — eliminando ícones decorativos sem conteúdo e textos genéricos.

## Diagnóstico atual
Hoje existem tooltips funcionais em alguns lugares (`KPICard`, `ChartTitle`, `UniversalValidationPanel`) e ícones `Info` decorativos sem tooltip em outros (`OrcamentoDialog`, `OrcamentoWizard`, `ServicosOrcamentos`, `PropriedadeDetalhesDialog`, `AlertasFinanceiros`, etc.). Os textos quando existem ficam espalhados pelas páginas, sem padrão.

## Plano

### 1. Componente único: `InfoTooltip`
Criar `src/components/ui/InfoTooltip.tsx` — wrapper sobre Radix `Tooltip` da shadcn:
- Props: `content` (string ou ReactNode), `title?`, `calculation?`, `side?`, `size?` (`xs|sm|md`), `className?`, `iconClassName?`, `termKey?` (busca no catálogo).
- Renderiza um `<button type="button">` com `aria-label`, ícone `Info` (`cursor-help`), `focus-visible` token.
- Aceita `onClick` no mobile para alternar abertura via `open`/`onOpenChange` (Radix Tooltip já abre no focus; adicionar fallback de toque controlado).
- `delayDuration={150}`. Conteúdo com `max-w-xs`, título em negrito, descrição, e `Cálculo:` opcional.
- Se `content` vazio em dev → `console.warn` (evita tooltip vazio).

### 2. Catálogo centralizado
Criar `src/lib/tooltips/catalog.ts` exportando `TOOLTIPS: Record<string, { title?: string; description: string; calculation?: string }>` agrupado por domínio:
- `finance.receitaTotal`, `finance.lucroLiquido`, `finance.margemLiquida`, `finance.pipeline`, `finance.ticketMedio`, `finance.breakEven`, `finance.receitaBruta`, `finance.receitaLiquida`, `finance.lucroBruto`, `finance.margemBruta`, `finance.conversao`, `finance.despesasTotais`.
- `projeto.categoria`, `projeto.status`, `projeto.dataServico`, `projeto.responsavel`, `projeto.progresso`.
- `orcamento.status`, `orcamento.codigo`, `orcamento.impostos`, `orcamento.descontos`, `orcamento.marco`, `orcamento.margemInterna`.
- `despesa.categoria`, `despesa.pendente`, `despesa.confirmada`, `despesa.vinculoOrcamento`.
- `pagamento.forma`, `pagamento.situacao`, `pagamento.parcelamento`.
- `cliente.cpfCnpj`, `cliente.timeline`, `cliente.tags`.
- `propriedade.area`, `propriedade.geometria`, `propriedade.kml`, `propriedade.car`.
- `importacao.geral`, `importacao.colunaPlanilha`, `importacao.confianca`, `importacao.campoPersonalizado`.
- `config.empresa`, `config.notificacoes`, `config.integracoes`, `config.plano`, `config.equipe`, `config.roles`.
- `relatorio.executivo`, `relatorio.variacaoMoM`, `relatorio.periodo`.
- `dashboard.alertas`, `dashboard.proximasAcoes`, `dashboard.conflitos`.
- `filtros.periodo`, `filtros.tenant`, `filtros.densidade`, `filtros.daltonismo`.

Exemplo de entrada:
```ts
"finance.lucroLiquido": {
  title: "Lucro Líquido",
  description: "Receita menos custos, despesas e impostos no período.",
  calculation: "Receita Total − (Custos + Despesas + Impostos)"
}
```

Helper: `getTooltip(key)` retorna o objeto (warn se faltar).

### 3. Refatoração dos consumidores existentes
- `KPICard` e `ChartTitle`: aceitar `tooltipKey?` além do `description` atual (compat) e delegar a `InfoTooltip` internamente, mantendo a UI.
- `UniversalValidationPanel` `FieldInfoIcon`: trocar pela `InfoTooltip` mantendo a lógica de `getFieldHint` (já cobre tipos dinâmicos da importação).

### 4. Adicionar tooltips onde faltam (ícones existentes hoje)
Substituir os `<Info />` decorativos por `<InfoTooltip termKey="…" />` em:
- `src/components/cadastros/OrcamentoDialog.tsx` (linhas 506, 827) — explicar Marco e Impostos.
- `src/components/orcamento/OrcamentoWizard.tsx` (1049) — explicar campo do passo atual.
- `src/components/map/PropriedadeDetalhesDialog.tsx` (203) — explicar área/geometria.
- `src/pages/ServicosOrcamentos.tsx` (200) — explicar visão consolidada.
- `src/pages/Faturas.tsx` (680, `HelpCircle`) — explicar status da fatura.

### 5. Adicionar tooltips faltantes em telas-chave
Inserir `InfoTooltip` ao lado dos rótulos de:
- **Dashboard 360** (`Dashboard.tsx`): card "Alertas Financeiros", "Próximas ações", "Pipeline".
- **DashboardFinanceiro / Financeiro**: legendas de Waterfall, Treemap, Scatter (via `ChartTitle` quando ainda não há).
- **Orçamentos**: cabeçalhos "Impostos", "Descontos", "Marco", "Código do orçamento".
- **Despesas**: filtros "Pendente vs Confirmada", coluna "Vínculo".
- **Projetos/Serviços**: KanbanBoard headers (status), ProjectProgressCard, coluna "Categoria".
- **Clientes**: card de Timeline e CPF/CNPJ.
- **Propriedades**: área calculada, status do CAR.
- **Configurações** (Account/Company/Integrations/Notifications tabs): tooltip por seção.
- **Importação**: card de entrada na `ImportacaoDados.tsx` ("Importação universal").
- **Relatórios**: filtros de período e variação MoM.
- **Pagamentos/Faturas/Assinatura**: status da assinatura, plano.
- **GlobalFilters / FilterBar**: explicar cada filtro (período, tenant).
- **Controls** (`DensityToggle`, `ColorblindToggle`, `TimeGranularityControl`): tooltip explicativo.

### 6. Acessibilidade e mobile
- `InfoTooltip` usa `<button>` com `aria-label="Mais informações sobre {title}"` → teclado nativo.
- Radix Tooltip já abre em `focus`. Em toque (mobile): adicionar handler `onClick` que alterna estado controlado; fecha em blur / clique fora.
- Tamanho mínimo do alvo de toque: aplicar `min-h-9 min-w-9` em viewports `sm:` para baixo (sem alterar ícone visualmente — área transparente expandida).

### 7. Garantias
- Lint regra simples via `scripts/check-forbidden-terms.sh`: bloquear strings como "mais informações", "saiba mais", em props `description`/`content` de `InfoTooltip`.
- Teste unitário em `src/lib/tooltips/catalog.test.ts`: nenhum valor vazio, todas as chaves seguem padrão `dominio.campo`.
- Teste de componente para `InfoTooltip` (render, `aria-label`, abre no focus).

### 8. Documentação curta
Adicionar `src/lib/tooltips/README.md` com regra: "Todo ícone Info usa `<InfoTooltip termKey=...>`. Textos vão no catálogo. Não criar tooltips inline."

## Arquivos novos
- `src/components/ui/InfoTooltip.tsx`
- `src/lib/tooltips/catalog.ts`
- `src/lib/tooltips/catalog.test.ts`
- `src/lib/tooltips/README.md`

## Arquivos alterados (principais)
- `src/components/dashboard/KPICard.tsx`
- `src/components/charts/ChartTitle.tsx`
- `src/components/import/UniversalValidationPanel.tsx`
- `src/components/cadastros/OrcamentoDialog.tsx`
- `src/components/orcamento/OrcamentoWizard.tsx`
- `src/components/map/PropriedadeDetalhesDialog.tsx`
- `src/pages/{Dashboard,DashboardFinanceiro,Financeiro,Orcamentos,Despesas,Servicos,Operacional,Clientes,ClienteDetalhes,Configuracoes,Faturas,Assinatura,RelatorioExecutivo,ImportacaoDados,ServicosOrcamentos}.tsx`
- `src/components/filters/GlobalFilters.tsx`, `src/components/layout/FilterBar.tsx`
- `src/components/controls/*`

## Fora do escopo
- Tradução i18n (textos diretamente em pt-BR).
- Mudanças visuais de layout além de inserir o ícone.
- Lógica de negócio dos KPIs/gráficos.
