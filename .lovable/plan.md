## Problema

Ao importar planilhas pelo SmartImporter, três campos não chegam ao banco no formato esperado pela UI:

- `forma_de_pagamento` — nenhum normalizador existe; o valor cru ("pix", "à vista", "cartão de crédito") é salvo como texto livre e não coincide com as opções do dropdown (`PIX`, `Dinheiro`, `Cartão`, `Transferência`, `Boleto`), por isso o badge mostra vazio / "Não definido".
- `situacao_do_pagamento` — `normalizeStatusPagamento` existe e cobre vários sinônimos, mas só é acionado quando o campo foi mapeado; quando a coluna não tem cabeçalho óbvio (ex.: só "Status") a detecção por conteúdo já joga em `situacao_do_pagamento`, porém valores como "Faturado"/"Atrasado" não fazem parte do enum aceito pela UI (`Pendente | Pago | Parcial | Cancelado`) e ficam órfãos.
- `situacao` (status do orçamento) — normalizado via `normalizeStatusServico`, que devolve "Aprovado/Pendente/Concluído/Cancelado/Rejeitado". A UI do orçamento usa `BUDGET_SITUATION` (`Em Analise | Em Negociacao | Aprovado | Recusado | …`), então "enviado", "em análise", "concluído" caem fora.

Resultado: nas telas de Orçamentos, KPIs, filtros e dashboards os registros aparecem como "Não definido" / "Indefinido".

## Objetivo

Garantir que uma planilha empresarial qualquer entre no sistema com **forma de pagamento, situação financeira e status do orçamento já alinhados aos enums oficiais**, mais um preview de importação que comprove a detecção.

## Plano

### 1. Vocabulário canônico unificado
- Em `src/constants/budgetStatus.ts`, adicionar opções faltantes para casar com a realidade do importador:
  - `PAYMENT_STATUS`: incluir `ATRASADO` e `FATURADO` (já existem no normalizador).
  - `PAYMENT_METHOD`: incluir `CARTAO_CREDITO`, `CARTAO_DEBITO`, `PARCELADO`, `OUTRO` (mantendo `CARTAO` como alias retrocompatível).
- Expandir `BUDGET_SITUATION_OPTIONS` para cobrir `Enviado`, `Em Analise`, `Recusado`, `Concluido`, `Cancelado` como valores canônicos.

### 2. Novo normalizador `formaPagamento`
- Em `src/lib/etl/statusNormalizer.ts` (ou novo `paymentMethodNormalizer.ts`), adicionar:
  - `normalizeFormaPagamento(value)` → mapeia "pix", "boleto", "cartão", "cartao de credito", "débito", "transferência", "ted", "doc", "dinheiro/espécie", "à vista", "parcelado", "crédito" para os valores canônicos do enum.
  - `normalizeStatusOrcamento(value)` → mapeia "aprovado", "enviado", "recusado/rejeitado", "em análise", "cancelado", "concluído/finalizado" para `BUDGET_SITUATION`.
  - `isFormaPagamentoToken` e `isStatusOrcamentoToken` para inferência de conteúdo.

### 3. Inferência por conteúdo (columnTypeInference)
- Adicionar dois novos `ColumnType`: `forma_pagamento` e `status_orcamento`.
- Estender vocabulários (`PAYMENT_METHOD_VOCAB`, `ORCAMENTO_STATUS_VOCAB`) e a função `inferColumnType` para detectar essas colunas mesmo quando o cabeçalho é genérico (ex.: "Pagamento" cuja maioria dos valores é "PIX/Boleto/Cartão" → `forma_pagamento`).
- Atualizar `isMonetaryCompatible` para continuar bloqueando essas colunas de virar receita.

### 4. Roteamento automático no SmartImporter
- Em `SmartImporter.tsx` (`pre-map` por inferência, linhas ~805–845):
  - Quando `inf.type === "forma_pagamento"` e ainda não houver mapeamento, atribuir a `forma_de_pagamento`.
  - Quando `inf.type === "status_orcamento"`, atribuir a `situacao`.
  - Manter o roteamento atual de `status` → `situacao_do_pagamento`.
- Acrescentar sinônimos em `ORCAMENTO_SYNONYMS` e `COMPLETO_SYNONYMS`:
  - `forma_de_pagamento`: `["formapagamento", "meiodepagamento", "tipopagamento", "metodopagamento", "pagamento", "modalidadepagamento"]`.
  - `situacao_do_pagamento`: `["statusfinanceiro", "situacaofinanceira", "pagamento", "statusfinance"]`.
  - `situacao`: `["statusorcamento", "statusproposta", "estadoorcamento"]`.

### 5. Aplicar normalizadores no pipeline
- Em `SmartImporter.tsx`, ao montar a linha de orçamento (linhas ~1633–1652):
  - `situacao` ← `normalizeStatusOrcamento(rec.situacao) ?? "Em Analise"`.
  - `situacao_do_pagamento` ← `normalizeStatusPagamento(rec.situacao_do_pagamento) ?? PAYMENT_STATUS.PENDENTE` (padrão "Pendente" em vez de `null`, evita "Não definido").
  - `forma_de_pagamento` ← `normalizeFormaPagamento(rec.forma_de_pagamento)` (mantém `null` se não houver match, mas registra contagem).
- Repetir o mesmo tratamento nos caminhos não-compostos (`orcamentos` puro) — auditar `processBatch` e `mapRow` para garantir consistência.

### 6. Fallback de confirmação manual
- Em `MappingValidationPanel`, exibir um alerta âmbar para cada coluna inferida com confiança < 0.8:
  - "Possível coluna de status detectada em **<header>** — confirme se é Situação do Pagamento ou Status do Orçamento."
- O usuário pode aceitar/rejeitar via os selects existentes; nada é forçado.

### 7. Preview de importação
- Em `FinancialPreviewCard` (ou novo `PaymentDetectionCard` próximo dele), exibir antes da confirmação:
  - ✓ Forma de pagamento detectada em **<coluna>** (N variações: PIX 12, Boleto 5…)
  - ✓ Status financeiro detectado em **<coluna>** (Pendente 8, Pago 4, Atrasado 1)
  - ✓ Status de orçamento detectado em **<coluna>** (Aprovado 9, Em Análise 2)
  - ✓ X orçamentos vinculados a cliente | X pendentes | X pagos | X cancelados
- Esses contadores são calculados em memória sobre `dataRows` aplicando os normalizadores; nada vai ao banco antes da confirmação.

### 8. Filtros na tela de Orçamentos
- Em `src/pages/Orcamentos.tsx`, ao lado do filtro existente de `situacao_do_pagamento`, adicionar:
  - Filtro por `forma_de_pagamento` (usa `PAYMENT_METHOD_OPTIONS`).
  - Filtro por `situacao` (status do orçamento, usa `BUDGET_SITUATION_OPTIONS`).
- Aplicar lógica de filtro idêntica ao padrão atual (`filtroForma === "todos" || orc.forma_de_pagamento === filtroForma`).

### 9. Tela e badges
- No badge da tabela de Orçamentos, quando `forma_de_pagamento` for nulo, mostrar `—` (não "Não definido"); para `situacao_do_pagamento` nulo, exibir `Pendente` (já é o default no banco após o passo 5, isso só protege registros legados).

### 10. Testes
- Atualizar/criar testes unitários em `src/lib/etl/`:
  - `statusNormalizer.test.ts`: cobrir os novos casos de `forma_pagamento`, status do orçamento, novos sinônimos de pagamento.
  - `columnTypeInference.test.ts`: garantir que colunas com valores predominantes em PIX/Boleto/etc são detectadas como `forma_pagamento` e não como `monetario`.
  - Teste de regressão importando uma planilha exemplo com cabeçalho "Pagamento" contendo apenas valores monetários (continua `monetario`) vs "Pagamento" contendo "PIX/Boleto" (vira `forma_pagamento`).

## Arquivos afetados (resumo técnico)

- `src/constants/budgetStatus.ts` — novos enums/opções.
- `src/lib/etl/statusNormalizer.ts` — `normalizeFormaPagamento`, `normalizeStatusOrcamento`, novos sinônimos.
- `src/lib/etl/columnTypeInference.ts` — tipos `forma_pagamento`, `status_orcamento` e detecção.
- `src/components/import/SmartImporter.tsx` — sinônimos, roteamento, aplicação dos normalizadores, contadores.
- `src/components/import/MappingValidationPanel.tsx` — fallback "Possível coluna detectada".
- `src/components/import/FinancialPreviewCard.tsx` (ou novo `PaymentDetectionCard.tsx`) — bloco de preview de detecções.
- `src/pages/Orcamentos.tsx` — novos filtros + tratamento dos badges.
- `src/lib/etl/statusNormalizer.test.ts` (novo) e `src/lib/etl/columnTypeInference.test.ts` — cobertura.

## Fora de escopo

- Migração para enum nativo Postgres (mantemos `text` para não quebrar dados existentes; a normalização garante o domínio).
- KPIs/dashboards específicos por forma de pagamento (a infraestrutura passa a ter dados consistentes; novos gráficos podem ser tarefa separada).
- Edge function para reprocessar orçamentos importados anteriormente (pode ser um botão "Renormalizar pagamento" em iteração posterior).