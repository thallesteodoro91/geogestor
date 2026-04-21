

## Plano: Padronização de Design System (Padrão Dashboard 360)

### Diagnóstico do estado atual

Auditei o código e encontrei **4 categorias de inconsistência**:

**1. Cabeçalhos de página fragmentados** — Existe `PageHeader.tsx` mas só 8 páginas usam. **11 páginas** desenham `<h1>` manual com tamanhos/espaçamentos diferentes (`text-3xl`, `text-4xl`, com/sem subtítulo, ações em posições diferentes):
- Dashboard, DashboardFinanceiro, Financeiro, GestaoEmpresa, Operacional, RelatorioExecutivo, ServicoDetalhes, ClienteDetalhes, Configuracoes, Ajuda, Assinatura

**2. Cores hardcoded fora do design system** — **123 ocorrências** de `bg-{cor}-{n}` e **186 ocorrências** de `text-{cor}-{n}` ou hex `#`:
- KPICards usam hex inline: `iconColor="#6366f1"`, `"#10b981"`, etc. (Dashboard, GestaoEmpresa, Operacional)
- `ClienteInfoCompact` define paletas locais para categorias/origens com 13+ cores diferentes (`text-blue-600`, `text-violet-600`...) que **não respeitam dark mode** (sem variantes `dark:`)
- Componentes de calendário usam `bg-blue-500/15 text-blue-700` direto (não passa pelo `statusColors.ts`)
- `bg-yellow-200`, `bg-green-50`, `bg-red-500/10` espalhados — quebram em dark mode

**3. Status com sistemas paralelos**:
- Existe `src/lib/statusColors.ts` (categorias semânticas: success/warning/danger/info/neutral) ✅
- Existe `src/constants/serviceStatus.ts` com cores HSL próprias e classes diferentes ❌ duplicação
- Existe `src/constants/budgetStatus.ts` com mais um sistema de cores ❌ duplicação
- Componentes individuais ainda definem badges inline ignorando os 3 sistemas

**4. Microcomponentes inconsistentes**:
- `PageContent` envolve tudo num `Card` — algumas páginas usam, outras não
- `FilterBar` existe mas várias páginas montam filtros à mão
- KPI: convivem `KPICard` (com hex) e `ContextualKPIs` (com tokens) — visual diferente

### O que vou construir

**FASE 1 — Tokens & Design System (`src/index.css`, `tailwind.config.ts`)**
- Adicionar tokens semânticos faltantes para o **dark mode** (atualmente `--warning` não está definido em `.dark`)
- Criar tokens semânticos de **categoria** (substituem as 13 cores locais de ClienteInfoCompact):
  - `--cat-person`, `--cat-company`, `--cat-rural`, `--cat-gov`, `--cat-ngo`, `--cat-partner` — versões light/dark
- Garantir **contraste AA** em dark mode revisando `--muted-foreground`, `--success`, `--destructive`
- Documentar paleta no topo do `index.css`

**FASE 2 — `KPICard` sem hex (`src/components/dashboard/KPICard.tsx`)**
- Substituir prop `iconColor: string` (hex) por `iconTone: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'`
- Manter retrocompatibilidade: se `iconColor` ainda vier hex, mapeia para tom mais próximo
- Atualizar **Dashboard, DashboardFinanceiro, GestaoEmpresa, Operacional** para usar tons semânticos
- Resultado: cores reagem a tema e ficam consistentes

**FASE 3 — Unificar sistema de status**
- Estender `src/lib/statusColors.ts` para ser **a única fonte de verdade**
- Refatorar `serviceStatus.ts` e `budgetStatus.ts` para reexportar/delegar a `statusColors.ts` (sem quebrar imports existentes)
- Remover cores hex inline; manter apenas constantes de valores (`'Pendente'`, `'Aprovado'`, etc.)
- Substituir badges manuais (`bg-blue-500/15 text-blue-700`) em CalendarioDiario/Semanal/Tabela e ClienteCentralControle pelo helper `getStatusClasses()`

**FASE 4 — Padronizar `PageHeader` em todas as páginas**

Aplicar `<PageHeader title subtitle>{actions}</PageHeader>` nas 11 páginas que ainda usam `<h1>` manual. Padrão único:
- **Título**: `text-3xl font-heading font-bold` (já no PageHeader)
- **Subtítulo**: opcional, `text-muted-foreground`
- **Ações**: à direita (sm+) / abaixo (mobile)

GestaoEmpresa mantém o cabeçalho personalizado ("Bom dia, Fulano! 👋") mas **usando os mesmos tamanhos** do PageHeader para harmonia.

**FASE 5 — Refatorar `ClienteInfoCompact` (caso mais grave)**
- Trocar paletas locais de categoria/origem por tokens semânticos via mapping helper
- Ícones mantidos; cores passam por `text-{semantic}` com variantes `dark:`
- Mesma técnica para `ClienteCentralControle` e `ClienteKPIs`

**FASE 6 — Auditoria de dark mode**
Varrer e corrigir os padrões problemáticos:
- `bg-{cor}-50` → `bg-{cor}-500/10` (funciona em ambos os modos)
- `text-{cor}-600` sem `dark:` → adicionar `dark:text-{cor}-400`
- Backgrounds `bg-yellow-200` (HelpTopicCard) → `bg-warning/15`

**FASE 7 — Documentação viva**
Criar `mem://style/design-system-v2` registrando:
- Tokens disponíveis e seu propósito semântico
- Componentes "blessed" (PageHeader, FilterBar, KPICard, statusColors)
- Regra: **proibido** novos `bg-{cor}-{n}` — sempre usar tokens

### Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/index.css` | Tokens dark mode completos, novos tokens de categoria, comentários de uso |
| `src/lib/statusColors.ts` | Estendido para categorias e mais status; única fonte de verdade |
| `src/constants/serviceStatus.ts` | Delegar para statusColors; remover cores duplicadas |
| `src/constants/budgetStatus.ts` | Delegar para statusColors; remover cores duplicadas |
| `src/components/dashboard/KPICard.tsx` | Nova prop `iconTone` semântico; deprecar `iconColor` hex |
| `src/components/layout/PageHeader.tsx` | Pequenos ajustes (suporte a breadcrumb opcional) |
| `src/pages/Dashboard.tsx` | PageHeader + iconTone |
| `src/pages/DashboardFinanceiro.tsx` | PageHeader + iconTone |
| `src/pages/Financeiro.tsx` | PageHeader |
| `src/pages/GestaoEmpresa.tsx` | iconTone (mantém saudação custom) |
| `src/pages/Operacional.tsx` | PageHeader + iconTone |
| `src/pages/RelatorioExecutivo.tsx` | PageHeader |
| `src/pages/ServicoDetalhes.tsx` | PageHeader (com breadcrumb) |
| `src/pages/ClienteDetalhes.tsx` | PageHeader (com breadcrumb) |
| `src/pages/Configuracoes.tsx` | PageHeader |
| `src/pages/Ajuda.tsx` | PageHeader |
| `src/pages/Assinatura.tsx` | PageHeader |
| `src/components/cliente/ClienteInfoCompact.tsx` | Tokens semânticos com dark mode |
| `src/components/cliente/ClienteCentralControle.tsx` | Tokens via statusColors |
| `src/components/cliente/ClienteKPIs.tsx` | Tokens semânticos |
| `src/components/calendario/CalendarioDiario.tsx` | getStatusClasses |
| `src/components/calendario/CalendarioSemanal.tsx` | getStatusClasses |
| `src/components/calendario/CalendarioTabela.tsx` | getStatusClasses |
| `src/components/ajuda/HelpTopicCard.tsx` | Tokens warning/success |

Sem migrações. Sem mudança de schema. Sem novos pacotes.

### Princípio
- **Uma única paleta** = `index.css` define, todos consomem via tokens
- **Um único PageHeader** = mesma altura, mesmo lugar para CTAs
- **Um único sistema de status** = `statusColors.ts` é a fonte
- **Dark mode obrigatório** = toda cor tem variante testada
- Nenhuma tela deve "parecer inferior" ao Dashboard 360 — todas usam os mesmos blocos de construção

