
# Plano de pré-lançamento SkyGeo — execução faseada

Princípio: dados → segurança → cobrança → KPIs antes de qualquer polimento visual. Cada fase termina com testes verdes e validação manual antes de avançar.

---

## Fase 1 — Importação de planilhas (bloqueante)

**Objetivo:** importar uma planilha real e ver cliente, propriedade, orçamento, serviço e despesa criados corretamente, com associações.

1. Auditoria do pipeline atual (`UniversalImporter` → `rowExploder` → `relationResolver` → `canonicalToDb` → inserts).
2. Validar **canonical schema vs. schema real do Supabase**:
   - Remover/renomear mapeamentos para colunas inexistentes (`valor_desconto`→`desconto`, `status_do_orcamento`→`situacao`, `tipo_propriedade`, etc.).
   - Gerar lista de campos válidos a partir dos tipos gerados e travar em runtime (whitelist).
3. Garantir persistência real em **todas** as 5 tabelas-alvo (`dim_cliente`, `dim_propriedade`, `fato_orcamento`, `fato_servico`, `fato_despesas`), com `tenant_id` obrigatório.
4. Resolver associações em cascata: cliente → propriedade → orçamento → serviço → despesa. Despesa pode anexar `id_servico`/`id_orcamento`/`id_cliente` quando inferível.
5. Substituir parsing de datas por parser BR-first (dd/mm/yyyy → ISO), com flag de ambiguidade. Eliminar `new Date(str)` cego.
6. Reutilizar `financialNumberParser` em todo input monetário; nunca cair para 0 silencioso — registrar warning por linha.
7. Normalizadores reais para status orçamento/pagamento/serviço e forma de pagamento (PIX, Boleto, Cartão, etc.) com dicionário de sinônimos.
8. `SmartImporter` por entidade: ou o botão "Importar despesas" persiste despesas, ou é removido em favor do universal. Sem engano de UI.
9. **Relatório pós-importação**: contagem por entidade, linhas ignoradas, campos não reconhecidos, erros por linha, warnings financeiros. Exportável.
10. Testes (vitest) com fixtures reais cobrindo os 6 casos listados nos critérios.

Saída: importar a planilha do cliente piloto cria todos os registros e o relatório bate com a contagem manual.

---

## Fase 2 — KPIs e Dashboard 360

**Objetivo:** uma única fonte de verdade financeira, semântica honesta.

1. Definir e documentar em `mem://finance/kpi-semantics`:
   - Receita prevista = Σ `receita_esperada`.
   - Pipeline = Σ `receita_esperada` onde situação ∈ {aberto, negociação, pendente}.
   - Receita faturada = Σ `valor_faturado`.
   - Receita realizada = Σ `receita_realizada` onde pagamento ∈ {Pago, Faturado}.
   - **Receita Total no Dashboard 360 = realizada (fallback faturada).** Nunca esperada.
   - Lucro Líquido = realizada − impostos − custo_servico − despesas.
   - Margem = lucro / receita realizada.
2. Reescrever `get_financial_dashboard_metrics`, `vw_kpis_financeiros`, `calcular_kpis_v2` para essa semântica. Uma RPC só, chamada por um hook só.
3. Eliminar cálculos paralelos em `services/kpi.service.ts` vs. `modules/finance/services/kpi.service.ts` — deletar o legado.
4. Estados vazios honestos: "Sem receita realizada", "Sem despesas registradas". Sem mock.
5. Testes de KPI com massa controlada (1 cliente, 1 prop, 1 orçamento, 1 serviço, 1 despesa, 1 pagamento) validando os 5 KPIs.

---

## Fase 3 — Banco e integridade ✅

1. ✅ FK `fato_servico.id_orcamento → fato_orcamento` criada (`fk_servico_orcamento`, ON DELETE SET NULL).
2. ✅ FK duplicada `dim_propriedade_id_cliente_fkey` removida (mantida `fk_propriedade_cliente`).
3. ✅ Índices: `idx_fato_servico_id_orcamento`, `idx_fato_servico_data_inicio`, `idx_fato_servico_tenant_data`, `idx_fato_orcamento_situacao`, `idx_fato_orcamento_situacao_pagamento`.
4. ✅ `tenant_id NOT NULL` aplicado em `servico_anexos`, `servico_equipes`, `servico_eventos`, `servico_tarefas`, `propriedade_geometria`, `notificacao_dismissals`.
5. ✅ Trigger `enforce_same_tenant` em `fato_orcamento`, `fato_servico`, `fato_despesas` bloqueia vínculos cross-tenant (cliente, propriedade, orçamento, serviço).
6. (Mantido) `dim_empresa` segue apenas como metadado — Fase 6 revisará leituras agregadas remanescentes.


---

## Fase 4 — Segurança ✅

1. ✅ **Storage `servico-anexos`**: paths já gravados como `tenant_id/servico_id/arquivo`. Policies de `storage.objects` (SELECT/INSERT/UPDATE/DELETE) já checam `(storage.foldername(name))[1] = get_user_tenant_id(auth.uid())::text`. Mesmo padrão para `empresa-assets`.
2. ✅ **Stripe webhook**: rejeita `500` quando `STRIPE_WEBHOOK_SECRET` ausente e `400` em assinatura inválida. Idempotência por `stripe_webhook_events` mantida; sincroniza `status`, `plan_id`, `stripe_customer_id`, `stripe_subscription_id`, `current_period_end`.
3. ✅ **Debug de limite de plano**: hard guard `import.meta.env.DEV` em `usePlanLimits.ts` — `?debugLimits` e `sessionStorage.debug_plan_limits` ignorados em build de produção.
4. ✅ **Google Calendar OAuth**: `state` agora assinado com HMAC-SHA256 (`CRON_SECRET`) + `iat` + `nonce`, com expiração de 10 min. `origin` validado contra `ALLOWED_ORIGINS` (env) + regex preview `*.lovable.app|.dev`. Open-redirect bloqueado.
5. ✅ **CORS allowlist**: `create-checkout`, `customer-portal`, `manage-subscription`, `invite-user`, `accept-invite`, `apply-ai-suggestions` agora retornam `Access-Control-Allow-Origin` apenas para origin em `ALLOWED_ORIGINS` (env) ou subdomínio `lovable.app/.dev`. `Vary: Origin` adicionado. Sem mais `*`.

Próximo passo opcional: definir `ALLOWED_ORIGINS` como secret de produção (`https://geogestor.lovable.app` + custom domains). Por padrão já cai nesse valor.

---

## Fase 5 — Pagamentos e assinatura ✅

1. ✅ Price IDs centralizados em `src/config/plans.ts` (front) e `supabase/functions/_shared/plans.ts` (edge), sobrescrevíveis por env (`VITE_STRIPE_PRICE_*` / `STRIPE_PRICE_*`). Hardcodes removidos de `create-checkout`, `manage-subscription` e `Assinatura.tsx`.
2. ✅ Idempotência por tenant em `create-checkout`: antes de criar sessão nova, busca sessão `open` <30s com mesmo `tenant_id`+`plano` e devolve a URL existente (`reused: true`). `idempotencyKey` por requestId mantida como segunda camada.
3. ✅ Webhook agora cobre `invoice.paid` (alias de `invoice.payment_succeeded`) atualizando `tenant_subscriptions` para `active` + período corrente; `customer.subscription.created/updated/deleted` e `invoice.payment_failed` já cobertos.
4. ✅ `customer-portal` resolve `customerId` primeiro via `tenant_subscriptions.stripe_customer_id` (suporta múltiplos membros do mesmo tenant); email fica como fallback de compatibilidade.
5. ✅ Página `/assinatura` segue com plano atual, vencimento, status e CTAs upgrade/downgrade/cancel/portal via `ManageSubscriptionPanel`; price IDs agora vêm do config central.


---

## Fase 6 — UX/UI e marca

1. ✅ Marca: README reescrito como GeoGestor; `twitter:site=@Lovable` e `og:image` da Lovable removidos do `index.html`; `og:url`/`canonical` apontam para `geogestor.lovable.app`; comentários `SkyGeo Palette` no `PrintableReport` agora rotulados como GeoGestor (constantes mantêm nome técnico para não quebrar 30+ usos internos).
2. ✅ Sweep encoding: nenhuma ocorrência de mojibake (`Ã§/Ã£/â€`) encontrada nos fontes.
3. ✅ Sidebar reorganizada em 3 grupos (Operação / Financeiro / Sistema), 12 itens, sem duplicações.
4. ⏸ Refatoração de telas fracas (Cadastros, Faturas, Importação, Configurações, Assinatura) com `PageHeader + ContextualKPIs + FilterBar` — adiada: requer iteração tela a tela com validação visual.
5. ✅ Estados vazios: `EmptyState` já adotado em Clientes, Orçamentos, Despesas, Serviços, Faturas, GestaoEmpresa, Calendário, Cliente* (timeline/orçamentos/serviços/propriedades/tarefas).
6. ✅ Mocks: `src/data/financial-mock-data.ts` removido. Paletas migradas para `src/data/chart-colors.ts` (sem dados de negócio).


---

## Fase 7 — Performance

1. Trocar `refetchInterval: 30s/60s` por invalidação de cache pós-mutação + botão refresh manual.
2. Eliminar `select('*')` — listar colunas explicitamente.
3. Paginação server-side (range) em Clientes, Orçamentos, Faturas, Despesas, Serviços.
4. Mover qualquer agregação que ainda esteja no front para RPC.

---

## Fase 8 — Qualidade e release

1. `package.json` scripts: `test` (vitest), `lint` (eslint), `build` (vite). Garantir que passam no CI (já existe `build-gate.yml`).
2. Suítes mínimas: importação financeira, KPIs, Stripe webhook, limites de plano, isolamento RLS/storage.
3. README do SkyGeo (substitui boilerplate Lovable).
4. Remover artefatos Lovable visíveis (badge, textos de template).
5. Checklist de produção (markdown em `docs/release-checklist.md`): envs Supabase + Stripe, webhook secret, storage policies, RLS, domínio, mocks removidos, debug flags off.

---

## Critérios de aceitação (gate de release)

Reaproveitados literalmente dos 11 itens do pedido — cada fase só fecha quando o critério correspondente passar manualmente + em teste automatizado.

## Ordem de execução e dependências

```text
Fase 1 ──► Fase 2 ──► Fase 7 (parcial: paginação)
   │           │
   ▼           ▼
Fase 3 ──► Fase 4 ──► Fase 5 ──► Fase 6 ──► Fase 8
```

Fases 1–5 são bloqueantes para venda. Fase 6 é polimento comercial. Fase 7–8 finalizam release.

## Riscos principais

- Dados antigos em `servico-anexos` precisam de migração de path; pode exigir job único.
- Reescrever a RPC de KPIs pode quebrar dashboards atuais — fazer behind feature flag e validar com tenant piloto.
- Remoção do debug de limites quebra os testes manuais atuais — substituir por seeds de teste.

Posso começar pela **Fase 1** assim que aprovar.
