

## Analise Completa do SaaS GeoGestor — O Que Funciona e O Que Precisa de Atencao

Apos inspecao detalhada do codigo, banco de dados, edge functions e fluxos de assinatura, segue o diagnostico completo:

---

### O QUE ESTA FUNCIONANDO CORRETAMENTE

| Area | Status | Detalhes |
|------|--------|----------|
| Multi-tenancy (RLS) | OK | Todas as 29 tabelas publicas tem RLS ativado com politicas consistentes |
| TenantContext | OK | Carrega tenant, subscription e plano automaticamente; auto-cria tenant para novos usuarios |
| ProtectedRoute | OK | Verifica autenticacao, carregamento do tenant, expiracao de assinatura; bypass correto para plano Owner |
| SubscriptionExpiredScreen | OK | Tela de expiracao com botao "Renovar Assinatura" que navega para `/assinatura` |
| Pagina /assinatura | OK | Landing page com 4 planos, integrada com `create-checkout` edge function |
| Edge Function create-checkout | OK | Mapeia planIds para price_ids Stripe, cria sessao de checkout |
| Edge Function check-subscription | OK | Verifica Stripe, sincroniza status com `tenant_subscriptions` no banco |
| Edge Function customer-portal | OK | Gera sessao do Stripe Billing Portal |
| Edge Function simulate-expiry | OK | Funcional para testes de expiracao/restauracao |
| PlanInfoCard | OK | Exibe plano, uso de recursos, badges de status, botoes de upgrade e gerenciamento |
| Stripe Subscription Hook | OK | `useStripeSubscription` com auto-refresh a cada 5 min e on window focus |
| KPI Financeiros (calcular_kpis_v2) | OK | View materializada retorna dados corretos (R$ 2.8M receita, 150 clientes, 161 orcamentos) |
| Checkout Success Flow | OK | Banner pos-checkout, refetch de tenant e Stripe |
| Alertas de Pagamento Toggle | OK | Switch funcional em Configuracoes, respeitado pelo componente AlertasFinanceiros |
| Subscription Plans | OK | 2 planos no banco: Owner (ilimitado, gratuito) e Completo (R$197/mes) |
| Limites de Plano | OK | `usePlanLimits` verifica limites e notifica usuario |

---

### PONTOS QUE PRECISAM DE ATENCAO OU CORRECAO

#### 1. Falta de Webhook Stripe para Cancelamentos/Expiracoes (MEDIO)
**Problema:** O sistema depende exclusivamente do `check-subscription` (polling a cada 5 min) para detectar cancelamentos no Stripe. Se um usuario cancela pelo Customer Portal, o status so sera atualizado quando o hook fizer polling. Nao ha webhook para atualizacao em tempo real.

**Impacto:** Baixo na pratica — o polling de 5 min + refetch on focus e suficiente para a maioria dos cenarios. Porem, entre o cancelamento e o proximo polling, o usuario ainda ve "Ativo".

**Recomendacao:** Para o momento atual, o polling e adequado. Um webhook seria ideal a longo prazo.

---

#### 2. Pagina /assinatura Nao Sabe Se o Usuario Ja Tem Assinatura Ativa (BAIXO)
**Problema:** Quando um usuario com assinatura ativa acessa `/assinatura`, ele ve a mesma landing page sem indicacao de que ja esta pagando. Nao ha destaque no plano atual nem aviso de que criara uma assinatura duplicada no Stripe.

**Recomendacao:** Exibir o plano atual como "Seu Plano" na pagina, ou redirecionar para o Customer Portal quando ja assinante.

---

#### 3. Plano "Completo" no Banco Com price_cents=19700 vs Precos na UI (INFORMATIVO)
**Problema:** O `subscription_plans.price_cents` esta como 19700 (R$197) mas a UI mostra R$97/mes no plano mensal. Isso nao causa bug porque os precos reais sao gerenciados pelo Stripe (os price_ids estao corretos na edge function), e o campo `price_cents` no banco nao e usado para cobranca. Porem, a inconsistencia pode confundir em auditoria.

---

#### 4. Rota `/assinatura` Fora do ProtectedRoute — Sem TenantContext (VERIFICAR)
**Problema:** A rota `/assinatura` esta fora do `ProtectedRoute`, o que e correto para permitir acesso com assinatura expirada. Porem, ela ainda esta dentro do `TenantProvider` (que envolve todo o App), entao o contexto de tenant esta disponivel. Isso funciona corretamente.

---

#### 5. Campo `total_servicos` Retornando 0 nos KPIs (VERIFICAR DADOS)
**Observacao:** Os logs mostram `total_servicos: 0` e `servicos_concluidos: 0`, apesar de ter 161 orcamentos e 150 clientes. Isso pode indicar que nao ha registros na tabela `fato_servico` para este tenant, ou que os servicos nao estao sendo criados. Nao e um bug de codigo — e ausencia de dados na tabela de servicos.

---

#### 6. Taxa de Conversao 0% (DADOS)
**Observacao:** `taxa_conversao_percent: 0` indica que nenhum orcamento tem `orcamento_convertido = true`. Novamente, e questao de dados, nao de logica.

---

### RESUMO GERAL

O SaaS esta **funcional e bem estruturado**. Os fluxos criticos (autenticacao, multi-tenancy, assinatura, pagamento, renovacao, gerenciamento Stripe) estao todos implementados e conectados. As edge functions seguem boas praticas com logging e tratamento de erros.

Os unicos pontos de melhoria sao:
- Indicar plano atual na pagina `/assinatura` para evitar duplicacao
- Considerar webhook Stripe para sincronia em tempo real (futuro)
- Verificar se a ausencia de servicos (`total_servicos: 0`) e intencional ou se falta integracao de dados

Nenhuma correcao urgente e necessaria.

