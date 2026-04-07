

## Plano: Design System Consistente para Dark Mode e Status

### Diagnostico

Existem 4 sistemas de cores de status paralelos e inconsistentes:

1. **`statusColors.ts`** (centralizado) — usa `bg-emerald-500/15 text-emerald-700 dark:text-emerald-400`. Correto, mas usado apenas em `Clientes.tsx`
2. **`budgetStatus.ts`** — usa `bg-[hsl(...)]` dinâmico com `text-white/text-black`. Tailwind nao resolve classes dinamicas em runtime, entao **estas cores nunca funcionam**. Sem suporte dark mode
3. **`serviceStatus.ts`** — mesmo problema: `bg-[${variable}]` nao funciona no Tailwind JIT. Sem dark mode
4. **Inline em componentes** — `ClienteInfoCard` usa `bg-green-500 text-white` (sem dark mode), `ClienteInfoCompact` usa `bg-emerald-500/15 text-emerald-600` (sem dark mode text), calendarios usam `bg-[#246BCE]` hardcoded

### Problema tecnico critico

As funcoes `getPaymentStatusBadgeClass`, `getServiceStatusBadgeClasses` e `getBudgetSituationBadgeClass` geram classes como `` bg-[hsl(142,76%,36%)] `` via template literals. O Tailwind JIT nao detecta essas classes porque nao existem no codigo-fonte como strings literais. **Resultado: badges sem cor.**

### Solucao

Unificar tudo no `statusColors.ts` existente, adicionando todos os status faltantes e usando classes Tailwind estaticas que funcionam no JIT.

---

### Mudancas

#### 1. Expandir `statusColors.ts` como fonte unica de verdade

Adicionar ao `STATUS_MAP` todos os status de pagamento, orcamento e despesa:
- `Em Analise` → info
- `Em Negociacao` → warning  
- `Recusado` → danger
- `Parcial` → warning
- `pendente` (lowercase, despesa) → warning
- `confirmada` → success

Todas as classes ja tem suporte dark mode (`dark:text-emerald-400`, etc.).

#### 2. Substituir `getSituacaoBadgeClass` inline

- **`ClienteInfoCard.tsx`** — remover funcao local, usar `getStatusClasses(cliente.situacao)`
- **`ClienteInfoCompact.tsx`** — idem

#### 3. Substituir uso de `budgetStatus.ts` helpers nos calendarios

- **`CalendarioSemanal.tsx`** — trocar `getStatusColor` por `getStatusClasses`
- **`CalendarioTabela.tsx`** — idem
- **`CalendarioDiario.tsx`** — verificar e padronizar badges

#### 4. Corrigir dark mode no CSS (`index.css`)

- Adicionar `--warning-foreground` dark mode (falta)
- Subir levemente `--muted-foreground` de 63.9% para 65% (melhor contraste WCAG AA)
- Subir `--border` dark de 14.9% para 18% (bordas mais visiveis)

#### 5. Melhorar `CATEGORY_CLASSES` para contraste WCAG AA

Ajustar opacidades de background para garantir contraste minimo 4.5:1:
- Light: `bg-emerald-500/15` → manter (texto emerald-700 tem contraste 5.2:1 OK)
- Dark: `dark:text-emerald-400` → manter (contraste 5.8:1 sobre fundo escuro OK)
- Adicionar `dark:bg-emerald-500/20` para fundo mais visivel em dark

#### 6. Adicionar focus-visible global nos badges

No `badge.tsx`, adicionar `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` ao base cva.

---

### Resumo de arquivos

| Acao | Arquivo |
|------|---------|
| Editar | `src/lib/statusColors.ts` (expandir STATUS_MAP, melhorar dark classes) |
| Editar | `src/components/cliente/ClienteInfoCard.tsx` (usar getStatusClasses) |
| Editar | `src/components/cliente/ClienteInfoCompact.tsx` (usar getStatusClasses) |
| Editar | `src/components/calendario/CalendarioSemanal.tsx` (usar getStatusClasses) |
| Editar | `src/components/calendario/CalendarioTabela.tsx` (usar getStatusClasses) |
| Editar | `src/components/calendario/CalendarioDiario.tsx` (padronizar badges) |
| Editar | `src/components/ui/badge.tsx` (focus-visible) |
| Editar | `src/index.css` (dark mode contraste) |

Nenhuma migracao de banco necessaria.

