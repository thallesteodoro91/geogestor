
# ETL Relacional Inteligente — Refatoração do Importador

## Diagnóstico

O importador atual classifica colunas só pelo **nome do header** (`financialColumnClassifier`) e força tudo num mapeamento flat de campos. Isso causa:

- "Situação do Pagamento" cair em `despesa_operacional` (match parcial em "pag*").
- "Data do Faturamento" virar receita (match em "faturamento").
- "SubCategoria" colapsar em `categoria_despesa`.
- Valores `Pendente`/`Pago` passarem por `parseFinancialNumber` → viram 0/NaN e somam como despesa.
- Não há deduplicação real de clientes (só por nome exato).
- Não há entidade `Status`; tudo é texto solto.

## Arquitetura proposta

Pipeline em 3 camadas, executado **antes** do mapping atual:

```text
Planilha → [1. TypeInference] → [2. ContextClassifier] → [3. RelationalBuilder] → Persistência
                  ↑ analisa AMOSTRA de valores (não só header)
                                    ↑ combina header + tipo + conteúdo
                                                          ↑ monta grafo Cliente→Propriedade→Orçamento→Serviço→Despesa
```

## Implementação

### 1. `src/lib/etl/columnTypeInference.ts` (novo)

Função `inferColumnType(header, sampleValues[])` retorna:

```ts
type ColumnType =
  | "monetario" | "percentual" | "data" | "status"
  | "documento" | "telefone" | "email" | "municipio"
  | "categoria" | "subcategoria" | "texto" | "numero" | "booleano";
```

Heurísticas baseadas em **conteúdo** (não só header):
- ≥70% de valores casam `/^(R\$|\d[\d.,]*)/` e parseFinancialNumber retorna número → `monetario`.
- ≥70% casam regex de data (`dd/mm/aaaa`, ISO, serial Excel) → `data`.
- ≥60% pertencem a vocabulário fechado `{pago, pendente, cancelado, aprovado, faturado, em aberto, atrasado, ...}` → `status`.
- Cardinalidade ≤ 15 e valores curtos repetidos → `categoria`.
- Regex CPF/CNPJ → `documento`.
- Lista de municípios brasileiros (top-N) ou padrão "Cidade/UF" → `municipio`.

### 2. `src/lib/etl/contextClassifier.ts` (refatorar `financialColumnClassifier`)

Combina `header role` + `inferred type` num **role final** com regras de bloqueio:

| Header sugere | Tipo inferido | Role final |
|---|---|---|
| receita_bruta | monetario | receita_bruta ✅ |
| receita_bruta | status | **status_pagamento** (override) |
| despesa | data | **data_despesa** (override) |
| categoria | texto curto | categoria_despesa |
| subcategoria | texto curto | **subcategoria_despesa** (entidade própria) |

Regra dura: **role financeiro só é aceito se `tipo == monetario`**.

### 3. `src/lib/etl/relationalBuilder.ts` (novo)

Para cada linha da planilha, monta um `RowGraph`:

```ts
{
  cliente: { nome, cpf?, cnpj?, telefone?, email? },
  propriedade: { nome, municipio?, area_ha? } | null,
  orcamento: { valor, data, status_pagamento, ... } | null,
  servico: { nome, categoria, subcategoria? } | null,
  despesa: { valor, data, categoria, subcategoria? } | null,
}
```

E persiste em ordem com **deduplicação por chave natural**:
- Cliente: `cpf || cnpj || normalize(nome)+telefone`. Cache em memória durante o batch + lookup no banco.
- Propriedade: `(id_cliente, normalize(nome))`.
- `dim_tipodespesa`: `(categoria, subcategoria)` — par, não só categoria.

### 4. Entidade Status

Persistir `status_pagamento` em `fato_orcamento.situacao_do_pagamento` (já existe). Adicionar normalização: dicionário `{paid, pago, quitado} → "Pago"` etc. Nunca passar pelo parser financeiro.

### 5. Datas

Datas alimentam apenas `data_orcamento`, `data_da_despesa`, `data_do_faturamento`. Nunca somar como valor.

### 6. Validação financeira pós-import

Em `ImportValidationCard`, adicionar invariante:
- `lucro_liquido !== receita_total` (se igual → flag crítico "despesas não foram reconhecidas").
- `total_despesas > 0` quando havia coluna inferida como `monetario` + role `despesa`.
- Detalhar quantos clientes deduplicados, quantas propriedades vinculadas, etc.

### 7. UI no passo de Mapping

Mostrar para cada coluna: **header → tipo inferido (badge) → role sugerido**. Permitir override manual. Bloquear (com aviso) mapear coluna `status` em campo monetário.

## Arquivos

**Novos:**
- `src/lib/etl/columnTypeInference.ts` + teste
- `src/lib/etl/contextClassifier.ts` + teste
- `src/lib/etl/relationalBuilder.ts` + teste
- `src/lib/etl/statusNormalizer.ts`
- `src/lib/etl/clientDedup.ts`

**Editar:**
- `src/components/import/SmartImporter.tsx` — substituir `classifyHeaders` direto pelo novo pipeline; usar `relationalBuilder` na fase de persistência; mostrar tipo inferido na UI de mapeamento.
- `src/components/import/ImportValidationCard.tsx` — adicionar invariantes (lucro≠receita, contagem de relacionamentos).
- `src/lib/financialColumnClassifier.ts` — manter como camada de "header hint", consumida pelo `contextClassifier`.

**Sem mudanças de schema:** todas as tabelas necessárias (`dim_cliente`, `dim_propriedade`, `dim_tipodespesa` com `subcategoria`, `fato_orcamento.situacao_do_pagamento`, `fato_despesas`) já existem.

## Validação

- Testes unitários por engine (inferência, contexto, dedup).
- Teste end-to-end com planilha-mock que reproduz os bugs reportados ("Situação do Pagamento", "Data do Faturamento", "SubCategoria", "Pendente").
- Após import, abrir `/financeiro?source=import` e conferir: receita > 0, despesas > 0, lucro ≠ receita, gráficos renderizados.
