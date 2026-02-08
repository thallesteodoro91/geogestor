

## Correcao de Notificacoes: Filtro de 30 dias e Limite Ideal

### Problema Identificado

Existem dois problemas distintos:

1. **Sem filtro de data na busca**: O hook `useNotifications.ts` busca as 10 notificacoes mais recentes sem nenhum filtro de idade. Notificacoes criadas ha mais de 30 dias continuam aparecendo no sino.
2. **Sem limpeza automatica**: Notificacoes antigas nunca sao removidas do banco de dados, acumulando indefinidamente.

### Solucao

#### 1. Filtrar notificacoes por 30 dias no hook (useNotifications.ts)

Adicionar um filtro na query para buscar apenas notificacoes dos ultimos 30 dias:

```text
.from('notificacoes')
.select('*')
.gte('created_at', dataLimite30dias)  // <-- novo filtro
.order('created_at', { ascending: false })
.limit(5)
```

- Mudar o limite de **10 para 5** notificacoes no menu, que e um numero mais adequado para um dropdown de notificacoes (evita scroll excessivo e foca no que e relevante).

#### 2. Filtrar tambem no Realtime (useNotifications.ts)

No handler de INSERT do Realtime, manter o `.slice(0, 5)` para consistencia com o novo limite.

#### 3. Criar migracao para limpeza automatica (SQL)

Criar uma funcao SQL `limpar_notificacoes_antigas()` que remove notificacoes com mais de 30 dias e seus dismissals associados. Isso evita acumulo no banco.

### Detalhes Tecnicos

**Arquivo: `src/hooks/useNotifications.ts`**
- Na funcao `fetchNotifications`: adicionar filtro `.gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())` e mudar `.limit(10)` para `.limit(5)`
- No handler Realtime de INSERT: mudar `.slice(0, 10)` para `.slice(0, 5)`

**Migracao SQL:**
- Criar funcao `limpar_notificacoes_antigas()` que deleta notificacoes com `created_at < NOW() - INTERVAL '30 days'`
- Executar a limpeza dentro de `verificar_pagamentos_pendentes()` para que rode automaticamente junto com a verificacao ja existente (1x por hora/sessao)

### Resumo das Mudancas

| Arquivo | Mudanca |
|---------|---------|
| `src/hooks/useNotifications.ts` | Filtro de 30 dias na query + limite de 5 notificacoes |
| Nova migracao SQL | Funcao de limpeza automatica + integracao com RPC existente |

