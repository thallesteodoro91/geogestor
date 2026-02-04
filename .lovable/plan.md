

# Plano: Corrigir Constraint de Status de Pagamento no Gerador de Dados Demo

## Problema Identificado

O gerador de dados demo está usando valores inválidos para `situacao_do_pagamento`:

| Usado no Código | Válido no Banco |
|-----------------|-----------------|
| `Pendente` | `Pendente` |
| `Pago` | `Pago` |
| `Parcial` | **Atrasado** |
| - | `Cancelado` |

**Constraint do banco**: `CHECK ((situacao_do_pagamento = ANY (ARRAY['Pendente', 'Pago', 'Atrasado', 'Cancelado'])))`

O valor `"Parcial"` não existe na constraint do banco de dados.

## Inconsistência Detectada

Existe uma divergência entre:
1. **Constantes centralizadas** (`src/constants/budgetStatus.ts`): usa `"Parcial"`
2. **Constraint do banco**: usa `"Atrasado"`

Isso indica que a constraint do banco ou as constantes estão desatualizadas.

## Solução Proposta

### Opção Escolhida: Alinhar o gerador com a constraint do banco

Atualizar `src/services/demo-data-generator.service.ts` para usar apenas valores aceitos pela constraint:

```typescript
// Valores válidos conforme constraint fato_orcamento_situacao_do_pagamento_check
const STATUS_PAGAMENTO = ["Pendente", "Pago", "Atrasado", "Cancelado"];
```

## Arquivo a Modificar

| Arquivo | Acao |
|---------|------|
| `src/services/demo-data-generator.service.ts` | **Modificar** - Corrigir STATUS_PAGAMENTO |

## Alteracao

**Linha 64** - Antes:
```typescript
const STATUS_PAGAMENTO = ["Pendente", "Pago", "Parcial"];
```

**Linha 64** - Depois:
```typescript
// Valores válidos conforme constraint fato_orcamento_situacao_do_pagamento_check
const STATUS_PAGAMENTO = ["Pendente", "Pago", "Atrasado", "Cancelado"];
```

## Observacao

Apos esta correcao, recomendo verificar se ha necessidade de sincronizar as constantes centralizadas (`budgetStatus.ts`) com a constraint do banco. O valor `"Parcial"` existe no codigo mas nao no banco, e `"Atrasado"` existe no banco mas nao nas constantes.

