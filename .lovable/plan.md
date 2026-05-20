# Google Calendar — Integração Profissional Bidirecional

## Estado atual

Já existe uma base funcional:

- Tabelas `google_calendar_tokens` (OAuth + refresh + sync_token) e `google_calendar_sync` (mapping local↔Google).
- Edge functions: `google-calendar-auth` (OAuth), `google-calendar-sync` (push local→Google), `google-calendar-webhook` (recebe notificações, hoje só ACK).
- `GoogleCalendarCard` em Configurações → Integrações, com conectar / desconectar / sincronizar tudo.
- Push automático em `createServico` / `updateServico` (fire-and-forget).

Lacunas que este plano resolve:
- Sincronização é apenas local→Google (one-way). Eventos criados no Google não voltam.
- Sem watch channels (sem realtime, só sync manual).
- Sem categorias/cores por tipo, sem seleção de calendário, sem preferências por evento.
- Sem dashboard de "próximos compromissos sincronizados / conflitos".
- Sem fila de retry — falhas de sync são silenciosas.
- Orçamentos não chamam push automático (só serviços chamam).

## O que vamos construir

### 1. Modelo de dados (migration)

Estender o schema atual:

- `google_calendar_tokens`: adicionar `selected_calendar_id`, `calendar_label`, `auto_sync_enabled bool default true`, `sync_types jsonb default '{"servico":true,"orcamento":true,"visita":true,"vencimento":true,"reuniao":true,"tarefa":true}'`, `watch_channel_id`, `watch_resource_id`, `watch_expires_at`.
- `google_calendar_sync`: adicionar `event_category text` (servico|orcamento|visita|vencimento|reuniao|tarefa), `color_id text`, `origin text` (local|google), `last_error text`, `retry_count int default 0`, `next_retry_at timestamptz`.
- Nova tabela `calendar_eventos_externos` para guardar eventos vindos do Google que não pertencem a entidades do SkyGeo (reuniões pessoais, etc.), com `tenant_id`, `user_id`, `google_event_id`, `summary`, `start_at`, `end_at`, `description`, `attendees jsonb`, `updated_at`.
- Nova tabela `calendar_sync_queue`: `id`, `tenant_id`, `user_id`, `operation` (create|update|delete|pull), `entity_type`, `entity_id`, `payload jsonb`, `status` (pending|processing|done|failed), `attempts int`, `last_error`, `scheduled_at`, `created_at`. Índice em `(status, scheduled_at)`.
- RLS: todas as tabelas restritas por `tenant_id = get_user_tenant_id(auth.uid())` (segue padrão do projeto). INSERTs exigem `tenant_id` explícito.

### 2. Categorias e cores

Helper único `src/lib/calendar/eventCategories.ts`:

```text
servico     → azul     (Google colorId "9")
visita      → azul     ("7")
orcamento   → roxo     ("3")
vencimento  → vermelho ("11")
financeiro  → verde    ("10")
reuniao     → amarelo  ("5")
tarefa      → cinza    ("8")
```

Usado tanto no builder de eventos do Google quanto no `statusColors.ts` do calendário interno (mantendo classes Tailwind estáticas, conforme memória).

### 3. OAuth — endurecer o que já existe

- Adicionar scope `https://www.googleapis.com/auth/calendar.events` (manter `calendar` para listar calendários).
- Action `list-calendars` em `google-calendar-auth`: lista calendários do usuário para o seletor.
- Action `update-preferences`: salva `selected_calendar_id`, `auto_sync_enabled`, `sync_types`.
- Action `disconnect`: revoga token em `https://oauth2.google.com/revoke` antes de apagar a linha.
- Refresh token já implementado; adicionar tratamento de `invalid_grant` → marcar conexão como expirada e exigir reconexão.

### 4. Sync local → Google (push)

Refatorar `google-calendar-sync`:

- Respeitar `auto_sync_enabled` e `sync_types[category]` antes de enviar.
- Usar `selected_calendar_id` em vez de `primary` fixo.
- Aplicar `colorId` e `extendedProperties.private.skygeo = {entity_type, entity_id, category}` para identificação confiável.
- Em falha: gravar em `calendar_sync_queue` com `next_retry_at = now() + backoff` (1m, 5m, 30m, 2h).
- Adicionar push automático em `createOrcamento`/`updateOrcamento` (hoje só `servico` chama), e em qualquer dialog de "visita técnica" / compromisso.
- Em delete de serviço/orçamento: enviar DELETE para Google via mapping em `google_calendar_sync`.

### 5. Sync Google → local (pull) + watch channels

- Edge function `google-calendar-watch` (nova): cria/renova watch channel via `POST /calendars/{id}/events/watch` apontando para `google-calendar-webhook`. Salva `watch_channel_id`, `watch_resource_id`, `watch_expires_at`. Renovação via pg_cron diário.
- `google-calendar-webhook` (refatorar): ao receber notificação, localiza o tenant pelo `X-Goog-Channel-ID`, enfileira `operation='pull'` em `calendar_sync_queue`.
- Edge function `google-calendar-worker` (nova): processa a fila. Para `pull`, chama `events.list?syncToken=...` (sync incremental), salva `sync_token` atualizado, e:
  - Se evento tem `extendedProperties.private.skygeo` → atualiza a entidade do SkyGeo (data, título, descrição). Sem loop: comparar `updated` timestamps.
  - Senão → grava em `calendar_eventos_externos`.
- pg_cron job a cada 1 min dispara o worker (pattern já usado no projeto, ex.: `generate-ai-suggestions-cron`). Worker também faz retry de operações `create/update/delete` falhas.

### 6. Calendário do SkyGeo

- `CalendarioMensal/Semanal/Diario/Tabela`: passar a unir eventos locais (orçamentos/serviços) com `calendar_eventos_externos`. Badge "Google" nos eventos externos.
- Detecção de conflitos: hook `useCalendarConflicts` que marca dois eventos sobrepostos no mesmo dia/horário.
- Página `/calendario`: card no topo "Próximos compromissos sincronizados" + "Conflitos detectados (N)".

### 7. UI — Configurações → Integrações

`GoogleCalendarCard` ganha:

- Seletor de calendário (após conectar, busca via `list-calendars`).
- Toggle "Sincronização automática".
- Checkboxes por tipo (serviço, visita, orçamento, vencimento, reunião, tarefa).
- Indicador "Última sincronização há X" + botão "Sincronizar agora".
- Status de saúde da conexão (token válido / precisa reconectar).

Onboarding: banner em `OnboardingChecklist` "Conecte sua agenda Google" com benefícios + CTA → `/configuracoes?tab=integracoes`.

### 8. Mobile & notificações

- O Google Calendar mobile do usuário já dá push notifications nativas dos eventos sincronizados — esse é o ganho principal e zero código extra.
- Garantir que `GoogleCalendarCard` e seletor de calendário são responsivos (já usamos AppLayout/Tabs responsivos).
- Eventos enviados ao Google incluem `reminders.overrides` (1 dia antes para vencimentos, 1 hora antes para serviços/visitas).

### 9. Segurança

- Tokens permanecem em `google_calendar_tokens` (RLS por user_id já existe).
- `client_secret` continua em `GOOGLE_CLIENT_SECRET` (já configurado).
- Revogação real no disconnect (chamada ao endpoint Google `/revoke`).
- Webhook valida `X-Goog-Channel-Token` (segredo gerado ao criar o watch).
- Worker e cron usam `CRON_SECRET` (já configurado).

## Arquivos a criar / alterar

```text
supabase/migrations/<ts>_google_calendar_v2.sql        novo
supabase/functions/google-calendar-auth/index.ts       alterar (list-calendars, update-preferences, revoke)
supabase/functions/google-calendar-sync/index.ts       alterar (color, fila, preferences, deletes)
supabase/functions/google-calendar-webhook/index.ts    alterar (validar token, enfileirar pull)
supabase/functions/google-calendar-watch/index.ts      novo (criar/renovar watch)
supabase/functions/google-calendar-worker/index.ts     novo (processa fila)
src/lib/calendar/eventCategories.ts                    novo (cores + helpers)
src/services/google-calendar.service.ts                alterar (novos endpoints)
src/components/settings/GoogleCalendarCard.tsx         alterar (seletor + toggles)
src/components/onboarding/OnboardingChecklist.tsx      alterar (item Google Calendar)
src/components/calendario/*                            alterar (unir eventos externos, conflitos)
src/hooks/useCalendarConflicts.ts                      novo
src/modules/finance/services/orcamento.service.ts      alterar (push automático)
supabase/config.toml                                   alterar (verify_jwt das novas funções)
```

## Entregáveis por fase

1. **Fase 1 — fundação:** migration + categorias/cores + push de orçamento + UI de preferências.
2. **Fase 2 — pull bidirecional:** watch channel + webhook real + worker + tabela de eventos externos.
3. **Fase 3 — UX:** conflitos no calendário, dashboard de próximos compromissos, onboarding.

Posso começar pela Fase 1 e seguir nas próximas mensagens, ou implementar tudo numa única passada — me diga a preferência.
