

## Analise Completa: Fluxo do Novo Usuario e Problemas Encontrados

### Simulacao do Fluxo

| Etapa | Acao | Resultado Esperado | Status |
|-------|------|--------------------|--------|
| 1 | Acessa `/auth` e cria conta | Formulario de cadastro | OK |
| 2 | Confirma email e faz login | Redireciona para `/` | OK |
| 3 | TenantContext cria empresa automaticamente | Tenant + trial 7 dias | OK |
| 4 | Navega pelos menus da sidebar | Todas as paginas carregam | OK |
| 5 | Trial de 7 dias expira | Tela de assinatura expirada | **BUG** |
| 6 | Clica "Renovar Assinatura" | Vai para `/assinatura` | OK |
| 7 | Seleciona plano e clica "Assinar" | Abre Stripe checkout nova aba | OK |
| 8 | Completa pagamento e retorna | `/configuracoes?checkout=success` | OK |

---

### BUG CRITICO: Trial expirado nunca bloqueia o usuario

**Arquivo**: `src/components/ProtectedRoute.tsx`, linha 93

```typescript
// Codigo atual:
if (!isOwnerPlan && !isActive && subscription && subscription.current_period_end)
```

O `isActive` retorna `true` quando `status === 'trialing'`. Quando o trial de 7 dias expira, o status permanece `'trialing'` no banco (nao existe cron/trigger que mude). Como `!isActive` e `false`, o bloco de expiracao **nunca executa** para usuarios em trial expirado.

**Resultado**: Usuarios com trial vencido continuam tendo acesso completo ao sistema indefinidamente.

**Correcao**: Alterar a logica para considerar que `trialing` com `current_period_end` no passado e uma assinatura expirada.

### Problema Secundario: Mensagem de signup enganosa

**Arquivo**: `src/pages/Auth.tsx`, linha 161

O toast diz "Conta criada com sucesso! Voce sera redirecionado." mas sem auto-confirm habilitado, o usuario precisa verificar o email primeiro. A mensagem deveria instruir o usuario a verificar o email.

---

### Mudancas Tecnicas

**1. `src/components/ProtectedRoute.tsx`** -- Corrigir logica de expiracao do trial:

Substituir a verificacao na linha 88-106 para:
- Se status for `'trialing'` E `current_period_end` ja passou, considerar expirado
- Se status for `'active'`, permitir sempre (Stripe garante)
- Se status for `'owner'`, permitir sempre

```typescript
const isOwnerPlan = subscription?.plan?.slug === 'owner';
const isActive = subscription?.status === 'active';
const isTrialing = subscription?.status === 'trialing';

if (!isOwnerPlan && subscription && subscription.current_period_end) {
  const now = new Date();
  const periodEnd = new Date(subscription.current_period_end);
  const isExpired = periodEnd < now;

  // Active (paid via Stripe) never blocked here; trialing with expired period = blocked
  if (isExpired && !isActive) {
    return <SubscriptionExpiredScreen ... />;
  }
}
```

**2. `src/pages/Auth.tsx`** -- Corrigir mensagem de signup:

Alterar o toast de sucesso para instruir verificacao de email:
```typescript
toast.success("Conta criada! Verifique seu email para ativar sua conta.");
```

---

### Menus e Navegacao

Todos os itens da sidebar foram verificados e mapeiam para rotas validas:
- Gestao da Empresa (`/`) -- OK
- Dashboard Financeiro (`/dashboard-financeiro`) -- OK
- Operacional (`/operacional`) -- OK
- GeoBot (`/geobot`) -- OK
- Calendario (`/calendario`) -- OK
- Relatorio Executivo (`/relatorio-executivo`) -- OK
- Servicos (`/servicos`) -- OK
- Orcamento (`/servicos-orcamentos`) -- OK
- Despesas (`/despesas`) -- OK
- Clientes e Projetos (`/clientes`) -- OK
- Cadastros (`/cadastros`) -- OK
- Logs de Auditoria (`/audit-logs`) -- OK
- Configuracoes (via UserMenu) -- OK
- Assinatura (`/assinatura`) -- OK, nao protegido (correto para usuarios expirados)

### Arquivos a Editar

1. `src/components/ProtectedRoute.tsx` -- Corrigir logica de trial expirado
2. `src/pages/Auth.tsx` -- Corrigir mensagem de signup

