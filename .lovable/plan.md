
# Auditoria Técnica — GeoGestor (mencionado como "SkyGeo")

> Observação de branding: o produto consta como **GeoGestor** no código e memória do projeto. O nome "SkyGeo" no pedido sugere divergência de marca — confirmar antes de materiais comerciais.

Este plano descreve **o que será auditado, como e em que ordem**. Nenhuma alteração será aplicada nesta fase. Cada item gera um relatório com evidências (arquivo:linha, query, screenshot ou log).

---

## Fase 1 — Diagnóstico (read-only, ~estimado em blocos)

### 1.1 Fluxos críticos (end-to-end)
Para cada fluxo: reproduzir no preview, inspecionar console/network, validar persistência no banco e checar RLS.

- **Auth**: `Auth.tsx`, Google OAuth, redirect, criação de profile via trigger `handle_user_profile`.
- **Onboarding/Tenant**: `create_tenant_for_user`, trial 7 dias, `tenant_subscriptions`.
- **Aceitar convite**: `AceitarConvite.tsx` + edge `accept-invite` + `check_user_limit`.
- **Importação de planilha**: `ImportacaoDados.tsx`, `EsquemasImportacao.tsx` — pipeline composto (Cliente→Propriedade→Projeto).
- **Clientes / Propriedades**: `Clientes.tsx`, `ClienteDetalhes.tsx`, timeline.
- **Projetos/Serviços**: `Operacional.tsx`, `Servicos.tsx`, kanban, progresso.
- **Orçamentos**: wizard unificado, código imutável, marco, impostos, conversão→serviço (trigger `auto_criar_servico_ao_converter_orcamento`), exportação PDF (template vs. padrão).
- **Despesas**: pendentes vs. confirmadas, categorias, vínculo a orçamento/serviço.
- **Dashboard 360 / Financeiro**: `Dashboard.tsx`, `DashboardFinanceiro.tsx`, RPCs `get_financial_dashboard_metrics`, `get_monthly_financial_data`, `calcular_kpis_v2`, view `vw_kpis_financeiros`.
- **Relatório Executivo**: captura seccional do PDF.
- **Pagamentos**: `Assinatura.tsx`, `create-checkout`, `customer-portal`, `stripe-webhook`, `check-subscription`, `simulate-expiry`, bloqueio por trial expirado.
- **Configurações**: `Configuracoes.tsx` (4 abas), `GestaoEmpresa.tsx`, integrações (Google Calendar, Stripe).
- **Calendário**: sync bidirecional (`google-calendar-*` functions, fila, retry).

### 1.2 Caça a bugs
Para cada fluxo, instrumentar checagens:
- **Dados não salvos**: inspecionar `onSubmit`/mutations sem `await`, `toast` de sucesso sem confirmação da resposta.
- **Duplicação**: uniqueness em `dim_cliente`, `dim_propriedade`, `fato_orcamento.codigo_orcamento`; duplo-clique em botões; idempotência do `stripe-webhook`.
- **Campos "não definido"/null**: varrer renderização (`{obj.x}` sem fallback) em listagens e cards.
- **Dashboards incorretos / gráficos vazios**: validar filtros de data, `tenant_id`, agregações zeradas vs. ausência de dados.
- **Erros silenciosos**: `try/catch` engolindo erro sem `console.error` / `toast`.
- **Validação**: zod schemas client-side, validação server-side em edge functions e triggers.

### 1.3 Performance front-end
- Build size, code-splitting por rota (lazy import).
- Re-renders desnecessários (React DevTools profiler em Dashboard, listas grandes).
- Tabelas: virtualização (clientes/orçamentos/despesas com N>200).
- Gráficos Recharts: memoização, payloads server-aggregated (já existem em `get_financial_dashboard_metrics`).
- Imagens/assets, fontes, LCP da rota inicial.
- Responsividade mobile (sidebar, modais, kanban).
- Dark mode: checar contraste e tokens (memória: usar `statusColors.ts` estático).

### 1.4 Performance back-end
- `supabase--linter` + EXPLAIN das RPCs principais.
- Índices em colunas filtradas (`tenant_id`, `data_orcamento`, `data_da_despesa`, FKs lógicas).
- N+1 nas telas de detalhes (forçar joins/RPC).
- Recalcular `tenant_id` em loops vs. cache em `TenantContext`.
- Edge functions: cold start, payload, autorização global header.

### 1.5 Segurança
- RLS por tabela: confirmar `tenant_id = get_user_tenant_id(auth.uid())` em todas (auditoria cruzada com schema).
- Privilege escalation via `tenant_members.role` (usar `has_role`).
- `audit_logs`, `analytics_events`, `calendar_*`, `propriedade_geometria` — testar acesso cross-tenant.
- Storage buckets públicos (`empresa-assets`, `avatars`): confirmar que nenhum dado sensível é gravado.
- Edge functions: verificação JWT e rate limits.
- Segredos no client: garantir só anon/publishable.
- HIBP password check, autoconfirm email, signup aberto.
- Rodar `security--run_security_scan` + `supabase--linter`.

### 1.6 Pagamentos (Stripe)
- Fluxo plano → checkout → webhook → ativação → liberação.
- Idempotência do webhook (`event.id` registrado?).
- Estados: `trialing`, `active`, `past_due`, `canceled` → comportamento de bloqueio.
- `simulate-expiry` cobre todos os cenários?
- Customer Portal: cancelamento reflete em `tenant_subscriptions`.
- Limites por plano (`check_user_limit`) aplicados em **todos** os pontos de criação.
- Página de sucesso/cancelado, retorno seguro, race condition entre webhook e `check-subscription`.

---

## Fase 2 — Entregáveis do relatório

Para cada achado:
- **ID**, **severidade**, **arquivo:linha** ou **objeto SQL**, **passo para reproduzir**, **impacto**, **correção sugerida**, **esforço estimado**.

Seções do relatório final:

1. **Bugs críticos** (bloqueiam venda): perda de dados, vazamento cross-tenant, falha de pagamento/ativação, crash em fluxo principal.
2. **Bugs médios**: UX quebrada, validações fracas, inconsistências de cálculo não-financeiras, erros silenciosos.
3. **Melhorias de performance**: índices, code-split, virtualização, memoização, RPCs agregadas.
4. **Melhorias de UX**: estados vazios, loading skeletons, mensagens de erro, mobile, dark mode.
5. **Riscos antes de vender**: legais (LGPD/política), branding (SkyGeo vs GeoGestor), suporte, observabilidade, backup.
6. **Ordem recomendada de correção**:
   1. Segurança (RLS cross-tenant, webhook idempotente, segredos).
   2. Pagamentos e bloqueio/ativação.
   3. Bugs críticos em fluxos de receita (orçamento, conversão→serviço, despesa).
   4. Perda/duplicação de dados em importação e cadastros.
   5. Performance crítica (dashboard, listas grandes).
   6. UX e polimento (mobile, dark mode, vazios).
   7. Observabilidade e legais.

---

## Detalhes técnicos do método

- **Ferramentas**: `code--view`/`rg` para varredura, `supabase--read_query` e `supabase--linter` para banco, `supabase--edge_function_logs` para edges, `browser--view_preview` + `browser--performance_profile` para front, `security--run_security_scan` para segurança.
- **Cobertura RLS**: script que lista todas as tabelas `public.*` e confirma policy com `get_user_tenant_id`.
- **Cobertura de webhooks**: simular eventos Stripe (checkout.session.completed, invoice.paid, customer.subscription.updated/deleted) em ambiente de teste.
- **Critérios de "pronto para vender"**: 0 críticos, 0 vazamentos cross-tenant, pagamento end-to-end estável em test mode, dashboard sem NaN/undefined, mobile usável nas 5 telas mais usadas.

---

## Perguntas antes de começar

1. Confirmar o nome comercial: **GeoGestor** ou **SkyGeo**? (afeta varredura de strings e materiais).
2. Posso rodar `security--run_security_scan` e `supabase--linter` agora (read-only) para já incluir no diagnóstico?
3. Quer que o relatório final seja entregue como markdown no chat ou como PDF em `/mnt/documents/`?
4. Há ambiente Stripe **test** com produtos/preços já configurados para eu validar checkout end-to-end?
