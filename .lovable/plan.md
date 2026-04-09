

## Plano: Elevar Todas as Telas ao Padrão do Design System

### Diagnóstico

Após auditoria de todas as páginas de execução, a maioria já segue o padrão: `PageHeader` + `ContextualKPIs` + `FilterBar` + `PageContent` + `EmptyState` + `TablePagination`. A exceção crítica é:

1. **`Orcamentos.tsx`** — Não usa nenhum componente do design system. Header manual (`h1`), KPIs com `KPICard` (componente de dashboard, não de execução), busca manual com `Input`, paginação manual com botões Anterior/Próxima, Dialog embutido no CardHeader, badges de status sem `getStatusClasses`.

2. **`Calendario.tsx`** — Problema menor: `container mx-auto p-6 max-w-7xl` duplica o padding do `AppLayout`, e FilterBar está dentro de um `Card` desnecessário.

### Mudanças

#### 1. Reescrever `Orcamentos.tsx` com design system

Substituir por padrão idêntico a Clientes/Projetos/Despesas:
- `PageHeader` com título "Orçamentos", subtítulo e botão "Novo Orçamento"
- `ContextualKPIs` com 3 items (Total, Receita Esperada, Conversão) — usando ícones e formatação compacta, não KPICard
- `PageContent` + `FilterBar` com busca e filtro de situação (Select)
- `TablePagination` reutilizável (substituir paginação manual)
- Badges com `getStatusClasses` (substituir lógica inline de variantes)
- Dialog movido para fora do Card (padrão dos outros módulos)
- `usePagination` hook (substituir cálculo manual)
- `OnboardingPageBanner` para orçamentos

#### 2. Corrigir `Calendario.tsx`

- Remover `container mx-auto p-6 max-w-7xl` (AppLayout já faz isso)
- Remover `Card` wrapper do FilterBar (outros módulos não usam)

### Padrão de referência (Clientes/Projetos/Despesas)

```text
AppLayout
  └─ div.space-y-6
       ├─ OnboardingPageBanner
       ├─ PageHeader (título + subtítulo + CTA)
       ├─ ContextualKPIs (2-3 métricas compactas)
       └─ PageContent (título da lista)
            ├─ FilterBar (busca + filtros)
            ├─ EmptyState / FilterEmptyState
            └─ Table + TablePagination
```

### Resumo de arquivos

| Ação | Arquivo |
|------|---------|
| Reescrever | `src/pages/Orcamentos.tsx` (design system completo) |
| Editar | `src/pages/Calendario.tsx` (remover padding e Card extra) |

Nenhuma migração de banco necessária.

