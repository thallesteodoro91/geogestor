
# Importador Universal GeoGestor

Transformar o `SmartImporter` em um motor de ETL capaz de absorver qualquer planilha empresarial (cliente, propriedade, serviço, orçamento, financeiro) sem exigir adaptação do cliente. O GeoGestor passa a se adaptar à planilha — não o contrário.

> Observação: o produto é **GeoGestor** (não SkyGeo). O plano usa a nomenclatura interna correta.

---

## Visão geral da arquitetura

```text
Planilha (xlsx/csv)
   │
   ▼
[1] Sniffer de conteúdo  ──► tipo real de cada coluna
   │                          (status, forma_pag, monetário, data, doc, geo, etc.)
   ▼
[2] Dicionário de sinônimos ──► campo canônico (CLIENTE.nome, FIN.receita_realizada, ...)
   │
   ▼
[3] Matcher híbrido       ──► header + conteúdo + score de confiança
   │
   ▼
[4] Mapper universal      ──► entidades: Cliente, Endereço, Propriedade,
   │                          Serviço, Orçamento, Financeiro
   ▼
[5] Resolver de relações  ──► dedup + FK (Cliente↔Propriedade↔Serviço↔Orçamento)
   │
   ▼
[6] Custom fields         ──► colunas sem destino viram campo personalizado
   │
   ▼
[7] Tela de validação 360 ──► contadores, amostras, correção manual
   │
   ▼
[8] Persistência em lote + refresh KPIs/Dashboard
```

---

## Fase 1 — Expansão do modelo canônico

Criar `src/lib/etl/canonicalSchema.ts` com o catálogo completo de campos canônicos agrupados por entidade. Cada campo tem: `id`, `entity`, `label`, `tipo` (`text|number|monetary|date|doc|phone|email|geo|enum`), `required`, `aliases[]`, `valueValidators[]`.

Entidades e campos cobertos:

- **CLIENTE**: nome, razao_social, nome_fantasia, cpf, cnpj, email, telefone, celular, whatsapp, data_cadastro, categoria, origem, situacao
- **ENDEREÇO** (embutido em Cliente e Propriedade): logradouro, numero, complemento, bairro, cidade, municipio, estado, cep
- **PROPRIEDADE**: nome, tipo (`Fazenda|Chácara|Sítio|Imóvel|Urbano`), matricula, car, ccir, itr, area, area_total, hectares, latitude, longitude
- **SERVIÇO**: nome, tipo_servico, categoria, subcategoria, responsavel, status, data_inicio, data_fim, progresso
- **ORÇAMENTO**: codigo, valor_orcado, desconto, impostos, valor_final, forma_pagamento, situacao_pagamento, status, data_emissao, data_vencimento, data_faturamento
- **FINANCEIRO**: receita, receita_prevista, receita_realizada, faturamento, custos, custos_variaveis, custos_fixos, despesas, despesas_operacionais, impostos, lucro_bruto, lucro_liquido, margem

Mapeamento canônico → tabelas reais (`dim_cliente`, `dim_propriedade`, `fato_servico`, `fato_orcamento`, `fato_despesas`) fica em `src/lib/etl/canonicalToDb.ts`. Campos sem coluna física vão para `custom_fields` (JSONB — ver Fase 5).

## Fase 2 — Dicionário de sinônimos

Criar `src/lib/etl/synonymsDictionary.ts` consolidando todos os aliases. Estrutura:

```ts
{ field: "cliente.nome", aliases: ["cliente", "nome", "contratante", "razão social", ...] }
{ field: "fin.receita_realizada", aliases: ["receita realizada", "faturamento", "valor recebido", ...] }
```

Normalizador agressivo (lowercase, sem acento, sem `_-./`, plural→singular básico) já existe em `mappingProfiles.ts` — extrair para `src/lib/etl/textNormalize.ts` e reusar. Matching por:
- igualdade normalizada
- substring (`startsWith`/`includes`)
- Levenshtein ≤ 2 para typos curtos

Saída: `synonymMatch(header) → { fieldId, score 0..1 }`.

## Fase 3 — Detecção por conteúdo

Estender o `columnTypeInference.ts` atual para emitir, além do tipo bruto, **sugestão de campo canônico** com base no conteúdo. Regras:

- valores ∈ {Pago, Pendente, Cancelado, Em Aberto, Atrasado} → `orcamento.situacao_pagamento`
- valores ∈ {PIX, Boleto, Cartão, Transferência, Dinheiro} → `orcamento.forma_pagamento`
- valores ∈ {Aprovado, Recusado, Em Análise, Enviado} → `orcamento.status`
- valores monetários com `R$` ou padrão `0.000,00` → financeiro (escolha do campo decidida pelo header)
- 11/14 dígitos → cpf/cnpj
- formato data → campo de data (qual? header decide)
- pares numéricos lat/lng coerentes → propriedade.latitude/longitude

O matcher final é **híbrido**: `score = 0.6 * synonymHeaderScore + 0.4 * contentScore`. Empate vai para o de maior `score` global; abaixo de 0.45 fica "sem destino" (Fase 5).

## Fase 4 — Campos opcionais

Nenhum campo é obrigatório por padrão exceto chaves naturais mínimas para criar a entidade (ex.: Cliente exige `nome` OU `cpf` OU `cnpj`; Propriedade exige `nome` ou `matricula`). Demais ausências:

- não bloqueiam importação
- registram `null`
- aparecem como aviso amarelo (não erro) no painel de validação

## Fase 5 — Campos desconhecidos (custom fields)

Migração nova: adicionar coluna `custom_fields jsonb DEFAULT '{}'` em `dim_cliente`, `dim_propriedade`, `fato_servico`, `fato_orcamento`. Toda coluna da planilha sem destino canônico (score < 0.45) é gravada em `custom_fields` da entidade-alvo da linha (inferido pela presença de chaves da entidade).

UI: nas telas de detalhe das entidades já existentes, mostrar um card "Campos personalizados" listando pares chave/valor.

## Fase 6 — Relacionamentos

Resolver de FKs em ordem topológica, em memória, antes do INSERT:

1. **Cliente** — dedup por `clientNaturalKey` (já existe em `clientDedup.ts`); insere novos e indexa `id_cliente`.
2. **Propriedade** — chave natural: `(nome_propriedade + id_cliente)` ou `matricula`. Vincula `id_cliente`.
3. **Orçamento** — vincula `id_cliente` (obrigatório, já existe constraint) e `id_propriedade` quando presente.
4. **Serviço** — vincula `id_cliente`, `id_propriedade`, `id_orcamento` quando inferível pelo código do orçamento na mesma linha.
5. **Despesa** — vincula `id_orcamento` ou `id_servico` quando a linha trouxer código relacionável.
6. **Município** — fica como atributo de Endereço (não cria tabela); agregações por município no dashboard usam o campo direto.

Para linhas "wide" (uma linha = cliente + propriedade + orçamento + financeiro), o importador faz **explosão em múltiplas entidades** dentro da mesma transação.

## Fase 7 — Dashboard 360 e KPIs

Após confirmar a importação:

- invalidar todos os `react-query` keys de KPIs/dashboard (`useKPIs`, `useDashboardMetrics`, `useChartData`, `useSalesFunnel`, `useClientesAnalytics`)
- chamar `calcular_kpis_v2` e `get_financial_dashboard_metrics` para repovoar a `vw_kpis_financeiros`
- toast "Importação concluída — Dashboard atualizado" com link para `/`

Métricas garantidamente repopuladas: Receita Total, Despesas Totais, Lucro Líquido, Ticket Médio, Receita por Cliente, Receita por Município, Receita por Serviço, Fluxo Financeiro, Custos por Categoria, Lucro por Cliente.

## Fase 8 — Tela de validação universal

Reescrever a etapa de revisão do `SmartImporter` em um painel único com:

- **Resumo detectado**: nº de Clientes novos / existentes, Propriedades, Orçamentos, Serviços, Receitas, Despesas, Formas de pagamento (top 5), Status (top 5).
- **Tabela de colunas**: header original → campo canônico sugerido → score → ação (aceitar / trocar / ignorar / marcar como custom field).
- **Inconsistências** (reaproveita `consistencyChecks.ts` e `consistencyRulesConfig.ts` já existentes) com auto-fix por linha já implementado.
- **Pré-visualização**: 10 primeiras linhas já normalizadas.
- Botões: `Voltar`, `Importar` (habilitado mesmo com warnings, desabilitado só com erro bloqueante).

---

## Arquivos a criar / alterar

**Criar**
- `src/lib/etl/canonicalSchema.ts` — catálogo de campos canônicos
- `src/lib/etl/canonicalToDb.ts` — mapeamento canônico → colunas reais
- `src/lib/etl/synonymsDictionary.ts` — sinônimos
- `src/lib/etl/textNormalize.ts` — normalizador compartilhado
- `src/lib/etl/contentClassifier.ts` — extensão do inference que sugere campo canônico
- `src/lib/etl/hybridMatcher.ts` — score header + conteúdo
- `src/lib/etl/relationResolver.ts` — dedup + FK em memória
- `src/lib/etl/rowExploder.ts` — linha wide → várias entidades
- `src/components/import/UniversalValidationPanel.tsx` — nova tela de validação
- testes vitest correspondentes (`*.test.ts`)

**Alterar**
- `src/components/import/SmartImporter.tsx` — usar o pipeline novo, substituir a etapa de mapeamento e revisão
- `src/lib/etl/columnTypeInference.ts` — expor mais sinais (lat/lng, doc, etc.)
- `src/lib/etl/clientDedup.ts` — reusado como está; talvez expor para propriedade/orçamento
- serviços de batch insert em `src/modules/{crm,operations,finance}/services/*` — aceitar `custom_fields`

**Migração de banco**
- Adicionar `custom_fields jsonb DEFAULT '{}' NOT NULL` em `dim_cliente`, `dim_propriedade`, `fato_servico`, `fato_orcamento`. Sem alterar RLS/GRANTs existentes.

---

## Rollout sugerido (PRs separados)

1. Migração `custom_fields` + tipos
2. `canonicalSchema` + `synonymsDictionary` + `textNormalize` (puro, com testes)
3. `contentClassifier` + `hybridMatcher` (com testes em fixtures de planilha real)
4. `rowExploder` + `relationResolver` (com testes)
5. `UniversalValidationPanel` + integração no `SmartImporter`
6. Refresh de KPIs/Dashboard pós-import

Cada PR ≤ ~600 LOC, testável de forma independente.

---

## Pontos abertos (confirmar antes de PR 2)

- Confirma que **uma única linha pode representar Cliente + Propriedade + Orçamento + Financeiro simultaneamente** (linha "wide" típica de planilha empresarial)?
- Os custom fields devem aparecer em **todas as telas de detalhe** ou apenas em Cliente/Propriedade nesta primeira iteração?
- Manter o fluxo atual de "perfil de mapeamento por planilha" (`mappingProfiles.ts`) reaproveitando a nova UI? (recomendo sim).
