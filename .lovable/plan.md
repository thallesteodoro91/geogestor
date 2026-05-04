
# Batch Apply de Sugestões de IA

Criar um comando interno (`/batch-apply` no GeoBot + botão no `AIInsightsCard`) que coleta todas as sugestões pendentes geradas pela IA, ordena por dependência, aplica em sequência com diff consolidado, valida (build/lint/testes) e faz rollback parcial em caso de falha.

## Antes de prosseguir — preciso confirmar 2 pontos

Esta funcionalidade tem uma ambiguidade importante. As "sugestões da IA" hoje no projeto são **insights textuais consultivos** (campos `titulo`, `descricao`, `acao` em `AIInsightsCard` / `GeoBot`) — elas **não contêm patches de código nem mutações estruturadas** prontas para aplicar. Para que "aplicar em lote" faça sentido, precisamos definir o que é "aplicar".

Vou apresentar duas leituras possíveis e seguir com a que faz mais sentido para um SaaS de gestão (Opção A), mas se for outra coisa (Opção B), reformulo o plano.

- **Opção A — Sugestões de negócio dentro do GeoGestor** (o que o plano abaixo cobre):
  Cada insight vira uma *ação executável* no domínio do app — ex.: "Reduzir despesa X em 10%" → cria tarefa; "Renegociar orçamento Y" → muda status; "Cobrar cliente Z" → gera evento. O batch apply aplica essas mutações de dados (não de código).

- **Opção B — Aplicar patches de código gerados pela IA no repositório**:
  Isso exigiria um pipeline de geração de patches, sandbox e CI próprios — fora do escopo de uma feature de produto e parcialmente sobreposto ao que o próprio Lovable já faz. Não recomendado dentro do app cliente.

O plano abaixo assume **Opção A**. Confirme ou peça troca para B.

## Escopo (Opção A)

### 1. Modelo de dados
Nova tabela `ai_suggestions` (multi-tenant, RLS por `tenant_id`):
- `id`, `tenant_id`, `created_at`, `created_by`
- `source` (`dashboard_insights` | `geobot_chat`)
- `category` (`erro` | `teste` | `fallback` | `ux` | `financeiro` | `operacional`)
- `priority` (int, derivada da categoria)
- `title`, `description`, `rationale`
- `action_type` (enum: `create_task` | `update_status` | `create_event` | `send_notification` | `update_setting` | `noop_informational`)
- `action_payload` (jsonb tipado por `action_type`)
- `depends_on` (uuid[]) — referências a outras sugestões
- `status` (`pending` | `applied` | `skipped` | `failed` | `rolled_back`)
- `applied_at`, `error_message`, `rollback_data` (jsonb com snapshot do estado anterior)

A geração de insights (`supabase/functions/ai-insights/index.ts` e `geobot-chat`) passa a **persistir** cada sugestão estruturada em vez de só devolver texto, retornando também `suggestion_id`.

### 2. Ordenação por dependência
Antes de aplicar, calcular ordem topológica usando:
1. `category` weight: `erro`(0) → `teste`(1) → `fallback`(2) → `ux`(3) → demais(4)
2. `depends_on` (DAG; em ciclo, pular as cíclicas e marcar `skipped` com motivo)
3. `priority` como desempate

Função pura `orderSuggestions(suggestions): OrderedPlan` em `src/lib/aiBatchApply.ts` com testes unitários cobrindo: ordem por categoria, respeito de `depends_on`, detecção de ciclo, agrupamento de independentes.

### 3. Edge function `apply-ai-suggestions`
Nova função em `supabase/functions/apply-ai-suggestions/index.ts`:
- Valida JWT + `tenant_id` do chamador
- Recebe `{ suggestion_ids?: string[], dry_run?: boolean }` (sem ids = todas pendentes)
- Carrega sugestões, ordena, e para cada uma:
  1. Captura snapshot atual em `rollback_data` (linha afetada antes da mutação)
  2. Executa a mutação dentro de transação por sugestão
  3. Em sucesso → `status=applied`
  4. Em erro → `status=failed`, registra `error_message`, **continua** (não derruba o lote inteiro)
- Retorna `{ applied: [...], failed: [...], skipped: [...], diff }` onde `diff` é a lista consolidada de `{table, op, before, after}` para preview.
- `dry_run=true` calcula o diff sem persistir.

### 4. UI — Modo "Batch Apply"
- Botão **"Aplicar todas as sugestões"** no `AIInsightsCard` e na página `GeoBot`.
- Abre `BatchApplyDialog` (novo, em `src/components/dashboard/BatchApplyDialog.tsx`) com:
  - Lista ordenada das sugestões pendentes, agrupadas por categoria
  - Checkboxes para excluir individualmente do lote (limite de escopo)
  - Botão **"Pré-visualizar diff"** → chama edge function com `dry_run=true` e mostra um resumo consolidado (tabela: ação, recurso, antes → depois)
  - Botão **"Aplicar em lote"** → chama com `dry_run=false`, mostra progresso
  - Resultado final com contadores `applied / failed / skipped` e botão **"Reverter aplicadas"** caso haja falhas (chama `rollback-ai-suggestions`)

### 5. Rollback parcial
- Edge function `rollback-ai-suggestions` recebe `suggestion_ids` e, para cada uma com `rollback_data`, restaura o snapshot e marca `status=rolled_back`.
- Disparada automaticamente se o usuário confirmar no diálogo após falhas, ou manualmente da lista de sugestões aplicadas.

### 6. Validação final automática
Como não estamos editando código do app cliente em runtime, "build + lint + testes" não se aplica ao usuário final. A validação equivalente no domínio é:
- **Pós-apply checks** rodados pela edge function:
  - Re-executar os KPIs principais (`useKPIs`) e comparar invariantes (ex.: `receita >= 0`, somas batem, nenhum status inválido)
  - Rodar o `linter` lógico de domínio (`src/core/finance.ts`) sobre os dados resultantes
- Se algum invariante quebrar → rollback automático das sugestões da rodada e retorna erro estruturado para a UI.

Para o **código** (build/lint/vitest), adicionar uma suíte de testes nova:
- `src/lib/aiBatchApply.test.ts` (ordenação, ciclos, agrupamento)
- `supabase/functions/apply-ai-suggestions/index_test.ts` (Deno test: dry_run, falha parcial, rollback automático em invariante quebrada)
Esses são executados pelo CI normal do projeto (vitest + `supabase test_edge_functions`).

### 7. Tracking
Reusar `trackEvent` existente:
- `ai_batch_apply_previewed` (com contagem por categoria)
- `ai_batch_apply_executed` (com `applied/failed/skipped`)
- `ai_batch_apply_rolled_back`

## Detalhes técnicos

- Migração SQL: criar `ai_suggestions` + enum `ai_suggestion_status` + RLS (`tenant_id = current_tenant_id()`).
- `action_type` whitelist no servidor; payload validado com Zod por tipo.
- Cada handler de `action_type` mora em um arquivo separado em `supabase/functions/apply-ai-suggestions/handlers/` (ex.: `createTask.ts`) com assinatura `(payload, ctx) => { before, after }` para uniformizar o snapshot.
- Snapshots usam `select` explícito das colunas tocadas (sem `select('*')`, conforme padrão do projeto).
- Concorrência: lock otimista — ao aplicar, comparar `updated_at` da linha alvo com o capturado no snapshot; mismatch → marca `skipped` com motivo `"recurso modificado externamente"`.
- Limite de lote: máx. 50 sugestões por execução (configurável); acima disso a UI sugere dividir.

## O que **não** será feito (fora de escopo)
- Aplicar patches de código no repositório (Opção B acima).
- Auto-merge de sugestões duplicadas — apenas detecção e marcação como `skipped:duplicate`.
- Agendamento/cron — apenas execução sob demanda.

## Arquivos previstos

Novos:
- `supabase/migrations/<timestamp>_ai_suggestions.sql`
- `supabase/functions/apply-ai-suggestions/index.ts` (+ `handlers/*`, `index_test.ts`)
- `supabase/functions/rollback-ai-suggestions/index.ts`
- `src/lib/aiBatchApply.ts` + `.test.ts`
- `src/components/dashboard/BatchApplyDialog.tsx`
- `src/hooks/useAiSuggestions.ts`

Editados:
- `supabase/functions/ai-insights/index.ts` — persistir sugestões estruturadas
- `supabase/functions/geobot-chat/index.ts` — idem
- `src/components/dashboard/AIInsightsCard.tsx` — botão "Aplicar todas"
- `src/components/dashboard/GeoBot.tsx` — botão "Aplicar todas"

---

**Para refinar antes de eu começar, responda:**
1. Confirmar **Opção A** (mutações de domínio) ou pedir **Opção B** (patches de código)?
2. Quer **preview de diff obrigatório** antes de qualquer aplicação, ou permitir "aplicar direto" para usuários com role admin?
3. Limite de escopo: manter o teto de **50 sugestões/lote** ou outro número?
