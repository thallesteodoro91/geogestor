
# Auditoria do GeoGestor + plano de correção

## O que está acontecendo (achados objetivos)

### 1. Perda de dados ao deixar janela aberta — CONFIRMADO como bug global de auth
- O Supabase JS faz **refresh de token automaticamente** a cada ~50 min (e os logs já mostram `token_revoked` + `Invalid Refresh Token Not Found` recentes).
- Hoje temos **dois listeners separados** de `onAuthStateChange` (`useAuth.ts` e `ProtectedRoute.tsx`). Ambos chamam `setState` no evento `TOKEN_REFRESHED`, gerando re-render em árvore.
- `TenantContext` (consumido pelo `ProtectedRoute`) provavelmente refaz fetch quando o user muda → telas remontam → formulários, filtros, wizards perdem estado local.
- Sintoma do usuário: "deixei aberto, atualizou, perdi tudo".

### 2. Erro 404 no login Google só no preview do Lovable
- Logs de auth mostram login **bem-sucedido** via `geogestor.lovable.app` (publicado).
- Preview `id-preview--…lovable.app` roda em iframe. Hoje o `Auth.tsx` precisa ser revisado para usar o helper Lovable corretamente sem detecção custom de iframe.
- **Não é bug do seu código de negócio**: é comportamento do OAuth em iframe + cookies de terceiros. A correção é (a) garantir uso do helper oficial `lovable.auth.signInWithOAuth` e (b) orientar o teste de login pela URL publicada.

### 3. Performance — KPI sendo chamada absurdamente
Top ofensores do banco (pg_stat_statements):
- `calcular_kpis_v2()` → **11.454 chamadas**, ~252 s totais. É a função mais cara, disparada repetidamente.
- `dim_cliente` listagem → **4.332 chamadas**.
- `tenant_subscriptions` lookup → **6.771 chamadas**.
- `fato_despesas` e `fato_orcamento` com `select` mínimo → ~2.300 cada.

Isso indica polling/refetch em cascata (provável `useKPIs` + invalidações do React Query disparando em mudanças de auth/tenant). Cada refresh de token pode multiplicar essas chamadas.

### 4. Bugs/sintomas menores observados
- Console: vários `Warning: Missing Description or aria-describedby for {DialogContent}` — acessibilidade, fácil de corrigir.
- `ProtectedRoute` tem `redirectCountRef` que conta loops para `/onboarding`, mas essa rota nem existe em `App.tsx` — código morto que pode esconder bugs reais.
- "Menu Propriedade" — **não é bug**: foi consolidado em Cadastros (decisão de produto registrada na memória do projeto). Mantido como está.
- Créditos — é o saldo da plataforma Lovable, não problema do seu app.

## O que vou fazer (4 lotes, do mais crítico ao polimento)

### Lote 1 — Parar a perda de dados (causa raiz)
1. **Refatorar `useAuth.ts` + `ProtectedRoute.tsx`** para:
   - Manter UM único listener `onAuthStateChange` (via contexto `AuthProvider`).
   - Ignorar evento `TOKEN_REFRESHED` quando o `user.id` não mudou (sem `setState`, sem re-render).
   - Expor `user`, `session`, `isReady` para todo o app.
2. **`TenantContext`**: trocar dependência de `user` por `user.id` para não refazer fetch a cada refresh de token.
3. **Smoke test**: deixar a tela aberta, forçar `supabase.auth.refreshSession()` no console e confirmar que filtros/formulários sobrevivem.

### Lote 2 — Performance do banco
1. Achar o hook que dispara `calcular_kpis_v2()` (provavelmente `useKPIs`/`useDashboardMetrics`).
2. Aplicar `staleTime` adequado no React Query (mínimo 60 s) e remover refetch em `onWindowFocus` quando o dado não precisa.
3. Memoizar `queryKey` em filtros para evitar nova key a cada render.
4. Verificar se `tenant_subscriptions` está sendo lido em loop pelo provider — cachear no `TenantContext`.
5. Meta: reduzir as 11k chamadas/dia de KPI em pelo menos 80%.

### Lote 3 — Login Google no preview
1. Confirmar que `Auth.tsx` usa `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })` direto, sem `window.open` custom nem detecção de iframe.
2. Remover qualquer fluxo legado de `supabase.auth.signInWithOAuth` direto, se existir.
3. Documentar no `Auth.tsx` (comentário visível) que testes de OAuth devem usar a URL publicada — preview em iframe pode falhar por bloqueio de cookies, **não é regressão**.

### Lote 4 — Polimento (curto)
1. Adicionar `<DialogDescription>` ou `aria-describedby` nos `Dialog` que estão gerando warning (acessibilidade).
2. Remover o código morto do `redirectCountRef` (rota `/onboarding` inexistente) no `ProtectedRoute`.
3. Rodar o `security--run_security_scan` ao final e te mostrar achados pendentes para você decidir o que tratar.

## Fora de escopo (intencional)
- Não vou re-adicionar "Propriedades" no menu (você pediu para manter).
- Não vou mexer em Stripe/sync (já estabilizado nas rodadas anteriores).
- Não vou refatorar UI de telas sem bug confirmado.

## Detalhes técnicos
- Arquivos esperados: `src/hooks/useAuth.ts`, `src/components/ProtectedRoute.tsx`, `src/contexts/TenantContext.tsx`, `src/pages/Auth.tsx`, `src/hooks/useKPIs.ts` (+ correlatos).
- Nenhuma migration nova prevista; apenas leitura de `pg_stat_statements` para validar antes/depois.
- React Query `staleTime` será calibrado por tipo de dado (KPIs 60 s, listagens 30 s, dados de tenant 5 min).

## Entregável final
Mensagem com:
- Diff resumido por lote.
- Comparativo de chamadas ao banco (antes/depois dos lotes 1 e 2).
- Lista de achados do scanner que sobraram, para você priorizar.
