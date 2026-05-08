
# Importação Financeira Inteligente — GeoGestor

## Diagnóstico (causa raiz)

Inspecionei `SmartImporter.tsx`, a view `vw_kpis_financeiros`, a RPC `get_financial_dashboard_metrics` e os hooks `useDashboardMetrics`/`useKPIs`. Os sintomas vêm de 3 problemas combinados:

1. **Receita = Lucro Líquido** — A view calcula `lucro_liquido = receita_total - total_despesas`. Quando a importação cria orçamentos mas **nenhuma despesa** (porque a planilha do usuário usa um único campo "valor" que é mapeado só como `receita_esperada`), `total_despesas = 0` → o lucro fica idêntico à receita. Não é bug de fórmula, é falta de classificação de saídas.
2. **Gráficos zerados** — O dashboard usa `get_financial_dashboard_metrics` filtrado pelo ano corrente (`date_trunc('year', CURRENT_DATE)`). Linhas importadas com data antiga ou sem data caem fora do recorte. Além disso, despesas sem `id_tipodespesa` com classificação `VARIAVEL/FIXA` quebram a separação custo×despesa nos charts.
3. **Confusão semântica** — Os sinônimos atuais (`COMPLETO_SYNONYMS`) misturam "valor", "total", "preco", "receita", "faturamento" todos em `receita_esperada`, e "custo", "despesa", "gasto" em `custo_servico`. Não existe distinção entre **custo de obra** (variável, ligado ao serviço) e **despesa operacional** (fixa, lançada como `fato_despesas`). Também não há detecção de colunas de **lucro/margem informados** para validação cruzada.

## Solução

### 1. Engine de Classificação Financeira (`src/lib/financialColumnClassifier.ts` — novo)

Função pura que recebe os headers normalizados e devolve um mapa **com categoria semântica** (não apenas campo do banco):

```ts
type SemanticRole =
  | "receita_bruta"      // receita, faturamento, valor recebido
  | "receita_liquida"    // receita líquida
  | "valor_orcado"       // valor unitário, preço, proposta, valor orçado
  | "custo_obra"         // custo, custo operacional, custo do serviço
  | "despesa_operacional"// despesa, gasto, saída, pagamento
  | "imposto"            // imposto, ISS, taxa
  | "lucro_informado"    // lucro, lucro líquido, resultado
  | "margem_informada"   // margem, %
  | "pipeline"           // previsão, potencial, negociação
  | "ignorar";
```

Cada role tem sua lista de keywords/regex (separando "custo" de "despesa", "valor" de "receita") e um peso de confiança. O resultado é a base do mapeamento — o `SmartImporter` deixa de chutar entre `valor_unitario` vs `receita_esperada`.

### 2. Normalizador numérico robusto (`src/lib/financialNumberParser.ts` — novo, com testes vitest)

Aceita: `R$ 12.500,00`, `12500`, `12.500`, `12,500.00`, `1.2k`, `(1.500)` (negativo contábil), valores com espaço/NBSP. Detecta locale automaticamente (BR vs US) por heurística do último separador. Substitui `sanitizeCurrency` atual.

### 3. Pipeline de roteamento por linha (refator em `SmartImporter.tsx`, modo `completo`)

Para cada linha importada o motor decide para qual tabela vai cada valor:

```text
linha tem receita_bruta OU valor_orcado  → cria fato_orcamento
linha tem custo_obra                     → soma em fato_servico.custo_servico
linha tem despesa_operacional            → cria fato_despesas (separado)
linha tem imposto                        → preenche valor_imposto + incluir_imposto=true
linha tem lucro_informado                → usado APENAS para validação cruzada
```

Regra obrigatória embutida: nunca atribuir o mesmo valor a `receita_esperada`, `lucro_esperado` e `margem_esperada`. Se a planilha só traz "valor", o motor calcula `lucro_esperado = receita_esperada - custo_obra` (custo da mesma linha) ou deixa null (nunca duplica).

### 4. Auto-criação de tipos de despesa classificados

Hoje o fallback cria um único tipo "Sem classificação". Mudar para:
- Detectar palavras na coluna de despesa (`combustível`, `equipe`, `salário`, `documentação`, `imposto`) e criar/reusar `dim_tipodespesa` com `classificacao = VARIAVEL` ou `FIXA` apropriada. Isso destrava o Treemap de custos e a separação margem bruta vs líquida.

### 5. Painel de Validação Pré-Import (UI)

Substitui a aba de preview atual por um card "Resumo Financeiro Detectado" com:
- Linhas válidas / inválidas / com aviso
- **Receita total reconhecida** (R$)
- **Despesas reconhecidas** (R$)
- **Lucro calculado** (R$) — destacado se ≠ receita
- Distribuição: nº clientes, propriedades, projetos, orçamentos, despesas que serão criados
- Lista das colunas interpretadas com a role semântica atribuída e confiança
- Aviso explícito quando o motor detectar `receita == lucro` ou ausência de despesas (sugere mapear coluna de custo)

### 6. Log de Processamento Pós-Import

Tela final passa a mostrar (já temos `compositeStatsResult` parcial — ampliar):
- N clientes / propriedades / projetos / orçamentos / despesas criados
- Total receita / despesa / lucro reconhecidos
- Colunas interpretadas (com a role)
- Linhas descartadas + motivo agrupado
- Botão "Ver Dashboard Financeiro" já com filtro de período cobrindo as datas importadas

### 7. Correções de KPI/Gráfico

- `useDashboardMetrics` / `DashboardFinanceiro`: ao detectar primeira visita pós-import, ampliar período padrão para abranger MIN/MAX das datas importadas (em vez de só ano corrente). Persistir em `localStorage` por tenant.
- `KPIData`: garantir que o card "Lucro Líquido" mostre badge de aviso quando `lucro_liquido === receita_total` (indica zero despesas — provável import incompleto).

### 8. Validação tolerante (corrige falsos positivos)

- CPF/CNPJ formatado com máscara já passa hoje, mas validador de **telefone** ainda marca aviso para 8-9 dígitos sem DDD — rebaixar para info, não warning.
- Datas seriais Excel: o `formatDate` atual converte, mas falha com strings tipo `"jan/24"`, `"01-2024"` — adicionar parsing `MMM/yy` e `MM-yyyy`.
- Moeda com NBSP (`R$\u00a0`) não é tratada — corrigir no normalizador novo.

### 9. Testes

- `financialNumberParser.test.ts` — 20+ casos de format BR/US/contábil
- `financialColumnClassifier.test.ts` — headers reais de planilhas (combinações ambíguas como "valor total", "valor recebido", "valor pago")
- Atualizar `aiBatchApply.test.ts` se afetado (não deve)

## Arquivos tocados

| Arquivo | Mudança |
|---|---|
| `src/lib/financialColumnClassifier.ts` | NOVO — engine semântica |
| `src/lib/financialNumberParser.ts` | NOVO — parser robusto |
| `src/lib/financialColumnClassifier.test.ts` | NOVO |
| `src/lib/financialNumberParser.test.ts` | NOVO |
| `src/components/import/SmartImporter.tsx` | refator do pipeline `completo`, novo painel de resumo, uso dos engines |
| `src/components/import/FinancialPreviewCard.tsx` | NOVO — card de resumo financeiro pré-import |
| `src/components/import/ImportResultCard.tsx` | NOVO (extrair tela de resultado com log detalhado) |
| `src/hooks/useDashboardMetrics.ts` | aceitar período auto-expandido |
| `src/pages/DashboardFinanceiro.tsx` | aplicar período auto + badge de aviso lucro=receita |
| `src/components/dashboard/KPICard.tsx` | suportar slot de aviso |

Sem migrações de schema (a estrutura `fato_orcamento` / `fato_despesas` / `dim_tipodespesa` já cobre o modelo). Apenas inserts de tipos de despesa via service existente.

## Detalhe técnico — fluxo do "completo" após refator

```text
upload → parse → classifyColumns(headers) → mapping sugerido com roles
  → preview com FinancialPreviewCard (totais reconciliados)
  → import:
       1. clientes (dedupe por nome)
       2. propriedades (dedupe por cliente+nome)
       3. para cada linha: route(receita?, custo?, despesa?)
            - receita_bruta/valor_orcado → fato_orcamento (com lucro derivado)
            - custo_obra → fato_servico.custo_servico
            - despesa_operacional → fato_despesas (com tipo classificado)
       4. recalcular KPIs (RPC) e mostrar log
```

## Fora do escopo

- Não implementa LTV real (precisa série temporal por cliente — tarefa separada)
- Não toca em PDF, calendário, Stripe
- Não cria novas tabelas (modelo atual já suporta)
