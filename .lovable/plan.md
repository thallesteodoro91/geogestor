# Correções de Bugs — Lote 1

Foco em problemas concretos detectados durante a auditoria, sem misturar features novas. Tudo no frontend e em queries/invalidações.

## Bugs a corrigir

### 1. CompromissoDialog — queries sem `tenant_id` (multi-tenancy quebrada)
**Arquivo:** `src/components/calendario/CompromissoDialog.tsx`

As queries `clientes`, `servicos` e `propriedades` fazem `select` direto sem `.eq('tenant_id', tenant.id)` e a `queryKey` não inclui o tenant. Isso:
- Pode vazar dados entre tenants quando RLS permite múltiplos vínculos (owner em mais de um tenant).
- Causa cache compartilhado errado ao trocar de tenant.

**Correção:** adicionar `tenant?.id` na queryKey, filtrar por `tenant_id`, e habilitar a query só com `enabled: !!tenant?.id`.

### 2. CompromissoDialog — perda de rascunho
Mesmo arquivo já usa `useState`. Vou aplicar `useStateDraft` (chave `compromisso:new`) com TTL 24h, alinhado ao padrão dos outros formulários.

### 3. Invalidações faltando após criar compromisso
Após criar orçamento/serviço no calendário, só invalidamos chaves `calendario-*`. Páginas `/orcamentos`, `/servicos` e `/dashboard` continuam exibindo dados velhos. Adicionar `invalidateQueries` para `["orcamentos"]`, `["servicos"]`, `["kpis"]`, `["dashboard-metrics"]`.

### 4. Refresh de token disparando re-render global
Logs confirmam `token_revoked` → `login` a cada renovação. Apesar do fix em `useAuth.ts`, o `TenantContext` ainda re-resolve quando o objeto `session` muda. Travar com `useMemo` no valor do contexto e comparar `user?.id` estritamente.

**Arquivo:** `src/contexts/TenantContext.tsx`

### 5. AI Insights — toast genérico em 402
Edge `ai-insights` retorna 402 "Not enough credits" mas o frontend mostra erro genérico. Vou tratar status 402 no consumidor (`useAiSuggestions.ts`) e exibir toast claro com CTA para a tela de créditos da plataforma, em vez de "Erro ao gerar insights".

### 6. React Router future flags (warnings no console)
Adicionar `future={{ v7_startTransition: true, v7_relativeSplatPath: true }}` no `<BrowserRouter>` em `src/App.tsx` para silenciar warnings e preparar v7.

### 7. Loader "Carregando..." sem timeout
O replay mostra `animate-pulse text-muted-foreground` "Carregando..." persistindo. Em `AppSkeleton.tsx` (ou onde está o fallback), adicionar timeout de 8s com mensagem "Demorando mais que o esperado — verifique sua conexão" + botão recarregar, para o usuário não ficar travado.

## Fora do escopo deste lote
- Filtros globais persistentes (próximo lote).
- Otimização de `useChartData` / `useRelatorioData` (próximo lote).
- Configurações de plano/créditos (questão de plataforma, não bug).

## Validação
- `tsgo` para checagem de tipos.
- Abrir CompromissoDialog, preencher, atualizar a página → toast de rascunho deve aparecer.
- Criar um orçamento pelo calendário → `/orcamentos` atualiza sem refresh manual.
- Console limpo dos warnings do React Router.

Aprovar para implementar.