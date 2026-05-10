## Diagnóstico

Hoje o `SmartImporter` já tem um pipeline composto (clientes → propriedades → projetos → orçamentos → despesas) e duas peças novas (`financialColumnClassifier` + `financialNumberParser`), mas elas **não estão conectadas ao auto-mapeamento**. O auto-map ainda é feito só pelos sinônimos do `COMPLETO_SYNONYMS`, o que causa:

- Colunas como **"Receita Bruta", "Custo", "Despesa", "Lucro Líquido"** caírem todas no mesmo campo (`receita_esperada` ou `valor_unitario`), porque o sinônimo `"valor"` casa primeiro.
- **Lucro Líquido = Receita** no dashboard: não há custos/despesas persistidas, então `vw_kpis_financeiros` calcula lucro = receita.
- Categoria/SubCategoria, Imposto, Receita Realizada e Data da Despesa **não são lidos**.
- Sem evidência visual pós-import do que foi vinculado e calculado.

---

## Plano (4 fases, só frontend + ajuste leve de persistência)

### Fase 1 — Conectar o classificador ao auto-mapeamento (motor ETL)

Arquivo: `src/components/import/SmartImporter.tsx`

1. No passo `mapping`, antes de aplicar `COMPLETO_SYNONYMS`, rodar `classifyHeaders(headers)` e construir um **`roleToField` map**:
   - `receita_bruta` / `receita_liquida` → `receita_esperada`
   - `valor_orcado` → `valor_unitario`
   - `custo_obra` → `custo_servico`
   - `despesa_operacional` → `valor_despesa`
   - `imposto` → novo campo `valor_imposto`
   - `lucro_informado` / `margem_informada` → novo campo informativo `lucro_informado` (não grava, só serve para validação cruzada)
   - `categoria_despesa` → `categoria_despesa`
   - `data_despesa` → novo campo `data_despesa`
   - `data_orcamento` → `data_orcamento`
   - `cliente_nome`, `propriedade_nome`, `municipio`, `servico_nome` → respectivos
2. **Regra anti-colisão**: cada coluna fonte só pode ser atribuída a UM campo. O classificador (com weight ≥ 80) tem prioridade sobre sinônimos. Se sinônimo tentar reusar coluna já atribuída, o sinônimo é descartado.
3. Estender `COMPLETO_FIELDS` com:
   - `receita_realizada` (number)
   - `valor_imposto` (number)
   - `subcategoria_despesa` (text)
   - `data_despesa` (date)
   - `lucro_informado` (number, somente leitura/validação)

### Fase 2 — Persistência enriquecida

Mesmo arquivo, dentro do bloco `if (entityType === "completo")`:

- **Step 4 (orçamentos)**: gravar `receita_realizada` (cair pra `receita_esperada` se nulo), `valor_imposto`, `incluir_imposto = valor_imposto > 0`.
- **Step 5 (despesas)**:
  - usar `rec.data_despesa` quando existir; senão cair pra `data_orcamento`/hoje.
  - quando criar `dim_tipodespesa` automaticamente, passar também `subcategoria` (vinda de `rec.subcategoria_despesa`).
- **Validação cruzada**: se `lucro_informado` existir e divergir mais de 5% do `receita - custo - despesa` calculado, registrar warning na tela de resultado (não bloqueia).

### Fase 3 — Card de validação pós-import (Dashboard 360 mini)

Substituir o `compositeStatsResult` atual por um **bloco de validação visual** no step `result`:

- Totais persistidos: Receita, Custos, Despesas, **Lucro calculado** (sempre `receita − custo − despesa`, nunca igual à receita por design).
- Vinculações: X clientes ↔ Y propriedades ↔ Z projetos ↔ W orçamentos ↔ V despesas.
- Badge de saúde: verde/âmbar/vermelho conforme dados financeiros consistentes.
- CTA primário: **"Ver Dashboard Financeiro"** → `/financeiro`.

Arquivo novo: `src/components/import/ImportValidationCard.tsx`.

### Fase 4 — Garantir que o dashboard mostre os dados

`src/pages/DashboardFinanceiro.tsx` já tem auto-expansão (do turno anterior). Reforçar:

- Quando vindo do `?source=import` (push do importer), forçar `shouldAutoExpand = true` no primeiro load.
- Replicar o banner âmbar quando `total_despesas === 0` em `ChartCustosCategoria` / `RevenueChart` (vazio explicado, não tela em branco).

---

## Detalhes técnicos relevantes

- O backend (`get_financial_dashboard_metrics`, `vw_kpis_financeiros`) **já calcula corretamente** lucro = receita − impostos − custos variáveis − despesas fixas. O bug "Lucro = Receita" hoje é **falta de despesas persistidas**, não fórmula. Resolver no ETL elimina o sintoma.
- `parseFinancialNumber` já cobre `54.429,16`, `54429,16`, `54,429.16` — basta usá-lo (já está sendo usado via `parseNullableNumber`).
- Regra "nunca reusar mesmo valor para múltiplos KPIs" é garantida por (a) classificador one-shot e (b) anti-colisão na fase 1.

---

## Fora do escopo

- Mudanças em RPC/SQL (não necessárias).
- Novas tabelas (já existe coluna `subcategoria` em `dim_tipodespesa`, `valor_imposto`/`receita_realizada` em `fato_orcamento`).
- Modificações em outras páginas além de `DashboardFinanceiro`.