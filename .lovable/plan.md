## Validação E2E do Checkout Stripe (test mode)

Objetivo: confirmar que o fluxo completo — `create-checkout` → Stripe Checkout → `stripe-webhook` → `tenant_subscriptions` → `check-subscription` — funciona ponta a ponta antes de abrir o Sprint 2.

### Pré-requisitos a verificar
- `STRIPE_SECRET_KEY` em modo test (`sk_test_...`) configurada nos secrets
- `STRIPE_WEBHOOK_SECRET` correspondente ao endpoint do projeto
- Plano(s) em `subscription_plans` com `stripe_price_id` apontando para preços test do Stripe
- Endpoint do webhook registrado no Dashboard Stripe escutando: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`

### Roteiro de testes

**1. Checkout básico (trial → paid)**
- Logar com um tenant em `trialing`
- Acionar `create-checkout` a partir de `/assinatura`
- Pagar com cartão `4242 4242 4242 4242` (qualquer CVC/data futura)
- Validar:
  - Redirect para `/checkout/sucesso`
  - `stripe_webhook_events` registra `checkout.session.completed`
  - `tenant_subscriptions.status` muda para `active`
  - `stripe_customer_id` e `stripe_subscription_id` populados
  - `check-subscription` retorna `subscribed: true` com tier correto

**2. Falha de pagamento**
- Repetir checkout com cartão `4000 0000 0000 0002` (recusado)
- Validar:
  - Redirect para `/checkout/cancelado`
  - `tenant_subscriptions` permanece inalterado
  - Nenhum estado inconsistente

**3. Cancelamento via Customer Portal**
- Acessar `customer-portal` e cancelar assinatura
- Validar:
  - Webhook `customer.subscription.updated` (cancel_at_period_end=true) processado
  - Após fim do período, `customer.subscription.deleted` muda status para `canceled`
  - Acesso bloqueado pelo `SubscriptionExpiredScreen` quando expira

**4. Upgrade/downgrade**
- Trocar de plano via portal
- Validar:
  - `tenant_subscriptions.plan_id` atualizado conforme novo `stripe_price_id`
  - Limites do plano (`check_user_limit` etc.) refletem o novo tier

**5. Trial expirado real**
- Usar `simulate-expiry` para forçar `current_period_end < now()` em trial
- Validar bloqueio de acesso e CTA para checkout

### Detalhes técnicos / ferramentas
- Stripe CLI local não é necessário: o webhook é público (`verify_jwt = false`) — basta ter o endpoint registrado no Dashboard
- Para inspecionar entrega: Dashboard Stripe → Developers → Webhooks → ver tentativas/payloads
- Logs no lado do app:
  - `supabase--edge_function_logs` para `stripe-webhook`, `create-checkout`, `check-subscription`
  - `supabase--read_query` em `stripe_webhook_events`, `tenant_subscriptions`, `audit_logs`
- Caso o webhook não chegue (problema histórico do projeto): conferir URL exata no Dashboard, signing secret, e status code retornado pela edge function

### Critérios de "pronto para Sprint 2"
- Os 5 cenários acima passam sem ajuste manual no banco
- `stripe_webhook_events` tem pelo menos um evento de cada tipo listado e nenhum com `error`
- `check-subscription` e a UI de `/assinatura` refletem o estado real em <30s após cada ação

### O que NÃO está no escopo deste plano
- Mudanças de código de produto (Sprint 2)
- Migração para Lovable Payments
- Faturamento por uso/metered billing
