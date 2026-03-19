

## Plano: Sincronização Google Calendar com Calendário GeoGestor

### Visão geral

Implementar sincronização bidirecional entre o calendário do GeoGestor (orçamentos e serviços) e o Google Calendar do usuário. Eventos criados/editados no GeoGestor aparecem no Google Calendar e vice-versa.

### Pré-requisitos

O Google Calendar API requer credenciais OAuth. O GeoGestor precisa:
1. Permissão do usuário para acessar seu Google Calendar
2. Edge Functions para comunicar com a API do Google

Como o Lovable Cloud não suporta Google Calendar como conector nativo, será necessário configurar OAuth manualmente via Google Cloud Console.

### Etapas

**1. Tabela de mapeamento no banco de dados**
- Criar tabela `google_calendar_sync` com colunas: `user_id`, `tenant_id`, `google_event_id`, `local_event_id`, `local_event_type` (orcamento/servico), `sync_token`, `last_synced_at`
- Criar tabela `google_calendar_tokens` para armazenar refresh tokens por usuário
- RLS: cada usuário só vê seus próprios tokens e mapeamentos

**2. Configurar Google OAuth (manual pelo usuário)**
- O usuário precisa criar credenciais OAuth no Google Cloud Console
- Escopos necessários: `calendar.events`, `calendar.readonly`
- Armazenar `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` como secrets do projeto

**3. Edge Function: `google-calendar-auth`**
- Gera URL de autorização OAuth
- Recebe callback com código de autorização
- Troca código por access/refresh token
- Armazena tokens na tabela `google_calendar_tokens`

**4. Edge Function: `google-calendar-sync`**
- Push: quando orçamento/serviço é criado/editado no GeoGestor, cria/atualiza evento no Google Calendar
- Pull: usa sync tokens para buscar mudanças incrementais do Google
- Mapeia campos: título, datas, descrição (cliente + propriedade + município)
- Persiste `geogestor_id` nas `extendedProperties` do evento Google

**5. Edge Function: `google-calendar-webhook`**
- Recebe notificações push do Google quando eventos mudam
- Atualiza dados locais correspondentes

**6. UI na página de Configurações**
- Botão "Conectar Google Calendar" na seção de integrações
- Status de conexão (conectado/desconectado)
- Botão para forçar sincronização manual
- Opção para desconectar

**7. Sync automático via triggers**
- Após insert/update em `fato_orcamento` ou `fato_servico`, disparar sync para Google Calendar
- Pode ser feito via chamada da Edge Function no frontend após mutations

### Limitações e considerações

- O usuário precisará criar credenciais no Google Cloud Console (processo manual)
- Refresh tokens expiram se o usuário revogar acesso
- Sync bidirecional requer cuidado com conflitos (last-write-wins)
- Webhooks do Google requerem URL pública (as Edge Functions já são públicas)

### Alternativa simplificada

Se a complexidade do OAuth completo for um bloqueio, uma alternativa é exportar eventos como arquivo `.ics` que o usuário importa manualmente no Google Calendar. Isso é mais simples mas não é automático.

