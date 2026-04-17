

## Auditoria Backend Profunda — GeoGestor

Analisei estatísticas reais do Postgres (pg_stat), índices, RLS, FKs, views, funções e linter. O sistema tem fundação sólida (RLS multi-tenant, FKs corretas, audit_logs), mas há **achados concretos de performance, segurança e arquitetura**. Severidade ordenada.

---

### CRÍTICO — Performance

**1. Sequential scans massivos em tabelas-fato** (dado real do `pg_stat_user_tables`):

| Tabela | seq_scan | seq_tup_read | Motivo |
|---|---|---|---|
| `fato_orcamento` | **24.138** | 491k linhas | Falta índice em `tenant_id` |
| `fato_despesas` | **5.334** | 1.677.000 linhas | Falta índice em `tenant_id` + `data_da_despesa` |
| `fato_servico` | 411 | 16 | Sem índice em `tenant_id` |
| `dim_tipodespesa` | **8.481** | 152k | Sem índice em `tenant_id` |
| `notificacoes` | 9.884 | — | Sem índice composto `(tenant_id, lida)` |
| `cliente_tarefas` | 1.442 | — | Sem índice em `tenant_id` (existe mas não usado) |

Com poucos registros o impacto é baixo, mas em produção (10k+ orçamentos) cada query da view `vw_kpis_financeiros` fará full-scan. **Adicionar índices em `tenant_id` para todas as fato_* e índices compostos para queries com filtro temporal.**

**2. Índices criados mas NUNCA usados** (idx_scan = 0):
- `idx_fato_orcamento_id_cliente`, `idx_fato_orcamento_id_servico`, `idx_fato_orcamento_codigo`
- `idx_fato_servico_id_cliente`, `idx_fato_servico_id_empresa`
- `idx_fato_despesas_id_servico`
- `idx_audit_logs_entity`, `idx_dim_tiposervico_categoria`, `idx_dim_tipodespesa_categoria`

Provavelmente porque o planner prefere seq_scan em tabelas pequenas. Manter por ora (úteis em escala), mas validar após popular dados reais.

**3. View `vw_kpis_financeiros` não usa índice por período**
A view agrega TODOS os orçamentos/despesas do tenant sem filtro de data. Com 10k+ linhas isso vira lento. Já existe `get_financial_dashboard_metrics` parametrizada — **migrar Dashboard para usar a RPC parametrizada e descontinuar a view "tudo".**

**4. FKs duplicadas em `fato_servico`, `fato_orcamento`, `fato_despesas`**
Existem pares como `fato_servico_id_cliente_fkey` + `fk_servico_cliente`, ambas apontando para `dim_cliente`. Idem propriedade, empresa, orçamento. **Cada INSERT faz validação dupla = overhead.** Remover as duplicatas (manter só `fk_*` com ON DELETE definido).

---

### CRÍTICO — Segurança

**5. Linter aponta 2 buckets públicos** (`empresa-assets`, `avatars`) que permitem listar todos os arquivos. Já documentado em memória como "risco aceito", mas vale confirmar se ainda é intencional ou se deve restringir SELECT a `auth.role() = 'authenticated'`.

**6. `fato_orcamento.tenant_id` é nullable**
Todas as tabelas multi-tenant têm `tenant_id` como `Nullable: Yes`. Combinado com a RLS `tenant_id IS NOT NULL AND tenant_id = get_user_tenant_id()`, registros com `tenant_id = NULL` ficam **órfãos invisíveis** (ninguém vê, ninguém deleta). **Tornar `tenant_id NOT NULL` em todas as fato_/dim_** com migração que primeiro detecta e corrige órfãos.

**7. `fato_orcamento.id_cliente` agora é NOT NULL** (memória confirma), mas existem 2 FKs conflitantes: `fato_orcamento_id_cliente_fkey` (sem ON DELETE) e `fk_orcamento_cliente` (ON DELETE SET NULL). Conflito lógico — se cliente é deletado, FK1 bloqueia, FK2 tenta SET NULL e falha pelo NOT NULL. **Remover `fk_orcamento_cliente` (manter restrição).**

**8. View `vw_alertas_financeiros` sem `WITH (security_invoker=on)` aparente** — checar e adicionar para herdar RLS do consultante e não do owner.

**9. Função `calcular_kpis()` (legada, sem `_v2`)** ainda existe e mistura JOINs sem filtro de tenant em `dim_empresa`. Risco baixo (RLS protege em runtime) mas é código morto. **Remover.**

---

### ALTO — Arquitetura de Dados

**10. `dim_data` tem 4.018 linhas mas FKs (`id_data`) em `fato_*` estão sempre NULL nos inserts da app**. Tabela inútil hoje — ou popular consistentemente, ou remover FKs e a tabela.

**11. `fato_orcamento_itens` existe mas está vazia** (`n_live_tup: 0`, mas `seq_scan: 1.470`). O dialog `OrcamentoDialog` salva itens, mas algo não está persistindo. **Investigar e remover ou fazer funcionar.**

**12. Trigger `auto_criar_servico_ao_converter_orcamento` está definida como FUNCTION mas o schema reporta "There are no triggers".** A função existe mas o trigger nunca foi criado em `fato_orcamento`. Por isso converter orçamento não cria serviço automaticamente. **Criar o trigger AFTER UPDATE.**

**13. Função `has_role` valida role no tenant correto, mas várias políticas DELETE usam `has_role(auth.uid(), 'admin')` SEM combinar com `tenant_id` na mesma policy** (ex: `dim_empresa`, `fato_orcamento`). Funciona porque há AND com tenant_id na mesma policy, mas convém auditar consistência.

**14. `subscription_plans` tem só policy SELECT — sem INSERT/UPDATE/DELETE policies**. Correto para usuários, mas significa que o app **não consegue criar planos via SQL normal**, depende de service_role. Documentar isso.

**15. Sem CHECK constraints** em campos críticos:
- `fato_orcamento.percentual_imposto` deveria ser `BETWEEN 0 AND 100`
- `fato_orcamento.quantidade > 0`
- `fato_servico.progresso BETWEEN 0 AND 100`
- `subscription_plans.price_cents >= 0`

---

### MÉDIO — Manutenibilidade

**16. `kpi.service.ts` duplicado** em `src/services/` e `src/modules/finance/services/`. Decidir um único.

**17. RPC `calcular_kpis()` (v1) e `calcular_kpis_v2()` ambas existem.** v1 não é usada — remover.

**18. Sem `pg_stat_statements` configurado** — sem isso, não dá pra identificar queries lentas em produção. Habilitar.

**19. RLS policies usam `get_user_tenant_id(auth.uid())` em CADA row.** Função é STABLE+SECURITY DEFINER, então cacheada por query, mas validar que está sendo chamada 1x por query e não 1x por linha (Postgres às vezes inline). Adicionar `(SELECT get_user_tenant_id(auth.uid()))` nas policies força avaliação única — pequeno ganho.

**20. `audit_logs` sem retenção automática**. Vai crescer indefinidamente. Adicionar política de delete >180 dias via cron.

---

### Plano de execução sugerido (em ordem de impacto)

| # | Ação | Tipo |
|---|---|---|
| 1 | Migration: índices `tenant_id` em `fato_orcamento`, `fato_despesas`, `fato_servico`, `dim_tipodespesa`, `notificacoes(tenant_id, lida)`, `cliente_tarefas(tenant_id)` | DDL |
| 2 | Migration: criar trigger `trg_auto_criar_servico` em `fato_orcamento` AFTER UPDATE | DDL |
| 3 | Migration: remover FKs duplicadas em `fato_servico`, `fato_orcamento`, `fato_despesas` | DDL |
| 4 | Migration: tornar `tenant_id NOT NULL` em todas as fato_/dim_ (após cleanup de órfãos) | DDL |
| 5 | Migration: adicionar CHECK constraints (percentual_imposto, progresso, quantidade) | DDL |
| 6 | Migration: dropar `calcular_kpis()` v1 e função/view `vw_alertas_financeiros` revisar `security_invoker` | DDL |
| 7 | Migration: política de retenção em `audit_logs` (cron job >180d) | DDL |
| 8 | Frontend: trocar `useKPIs` para usar `get_financial_dashboard_metrics` parametrizada por período | Code |
| 9 | Frontend: consolidar `kpi.service.ts` duplicado | Code |
| 10 | Investigar por que `fato_orcamento_itens` está vazia mesmo com dialog salvando | Debug |

Sem migrações de schema arriscadas — todas reversíveis. As alterações de NOT NULL em `tenant_id` precisam de cleanup prévio (UPDATE para órfãos), que farei com SELECT de verificação antes.

