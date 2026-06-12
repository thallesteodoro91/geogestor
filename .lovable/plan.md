
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

## Fase 4 — Segurança

1. **Storage `servico-anexos`**: path `tenant_id/servico_id/arquivo`, policy `(storage.foldername(name))[1] = get_user_tenant_id(auth.uid())::text`. Atualizar service de upload/download/delete e migrar paths existentes.
2. **Stripe webhook**: rejeitar 500 se `STRIPE_WEBHOOK_SECRET` ausente; manter `stripe_webhook_events` idempotente; sincronizar `status`, `plan_id`, `stripe_customer_id`, `stripe_subscription_id`, `current_period_end`.
3. **Limites de plano**: remover `?debugLimits` e `sessionStorage.debug_plan_limits` em produção (env guard). Criar RPC `check_plan_limit(resource)` chamada antes de cada insert via Edge Function ou trigger.
4. **Google Calendar OAuth**: assinar `state` com HMAC do `CRON_SECRET`/secret próprio + validar tenant + allowlist de origin. Se não couber agora, desativar a integração em produção via feature flag.
5. **CORS**: allowlist por env (`ALLOWED_ORIGINS`) em todas as edge functions sensíveis (`create-checkout`, `customer-portal`, `manage-subscription`, `invite-user`, `accept-invite`, `apply-ai-suggestions`).

---

## Fase 5 — Pagamentos e assinatura

1. Price IDs em config central (`src/config/plans.ts`) lendo de env / `subscription_plans`. Remover hardcodes espalhados.
2. Idempotência no `create-checkout`: lock por `tenant_id` + 30s, retornar sessão existente.
3. Webhook cobre `customer.subscription.created/updated/deleted`, `invoice.paid`, `invoice.payment_failed` → atualiza `tenant_subscriptions` consistente.
4. `customer-portal` resolve cliente por `tenant_subscriptions.stripe_customer_id` (não por email), suportando múltiplos membros.
5. Página `/assinatura`: plano atual, próximo vencimento, status, CTAs upgrade/downgrade/cancel/portal, branding SkyGeo, copy revisada.

---

## Fase 6 — UX/UI e marca

1. Substituir todas as ocorrências de GeoGestor/Lovable visíveis por **SkyGeo** (manter em mem://core a regra atualizada).
2. Sweep de encoding: arquivos não-UTF8, strings com `Ã§/Ã£` → corrigir.
3. Sidebar com os 11 itens listados, agrupados (Operação / Financeiro / Sistema).
4. Refazer telas fracas: Cadastros, Faturas, Importação, Configurações, Assinatura — usando `PageHeader` + `ContextualKPIs` + `FilterBar` do design system.
5. Estados vazios em todas as listagens principais.
6. Remover mocks (`src/data/financial-mock-data.ts`) de qualquer caminho de produção.

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
