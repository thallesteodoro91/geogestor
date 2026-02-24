

## Simulacao de Assinatura Expirada e Fluxo de Renovacao

### Objetivo

Criar uma edge function temporaria `simulate-expiry` que permite alternar o estado da assinatura do usuario logado entre "expirada" e "ativa", para testar o fluxo completo de renovacao.

### O que sera criado

**Arquivo:** `supabase/functions/simulate-expiry/index.ts`

Uma edge function com duas acoes:
- `action: "expire"` — Muda a assinatura do usuario para plano Completo com status `expired` e data de expiracao no passado (20/02/2026)
- `action: "restore"` — Restaura a assinatura para plano Owner com status `active`

### Como testar o fluxo

1. **Expirar a assinatura**: Apos deploy, chamar a funcao com `action: "expire"`. Ao recarregar a pagina, o `ProtectedRoute` detecta que o plano nao e Owner, o status nao e `active`, e a data expirou — exibindo a tela `SubscriptionExpiredScreen`.

2. **Visualizar a tela de expiracao**: O usuario vera:
   - Icone de alerta
   - Mensagem "Assinatura Expirada"
   - Botao "Renovar Assinatura" (gradient roxo/rosa) que navega para `/assinatura`
   - Botao "Sair" para logout

3. **Clicar em "Renovar Assinatura"**: Redireciona para a pagina `/assinatura` com os planos disponiveis

4. **Restaurar**: Chamar a funcao com `action: "restore"` para voltar ao estado normal

### Detalhes Tecnicos

A edge function usa o `SUPABASE_SERVICE_ROLE_KEY` (ja configurado) para atualizar `tenant_subscriptions` diretamente, contornando RLS. Identifica o tenant do usuario autenticado via `tenant_members`.

Logica do `ProtectedRoute` que sera acionada (ja implementada):
```text
if (!isOwnerPlan && !isActive && subscription.current_period_end < now)
  → mostra SubscriptionExpiredScreen
```

A funcao e apenas para simulacao/testes e pode ser removida depois.

