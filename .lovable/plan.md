
# Plano: Integração do Calendário com Google Agenda

## Visão Geral

Implementar sincronização bidirecional entre o calendário do dashboard (orçamentos e serviços) e o Google Calendar, permitindo que:
1. Eventos criados/modificados no dashboard sejam refletidos no Google Calendar
2. Modificações feitas no Google Calendar sejam sincronizadas de volta para o dashboard

## Arquitetura da Solução

```text
┌─────────────────┐       ┌───────────────────┐       ┌─────────────────┐
│   Dashboard     │◄─────►│  Edge Function    │◄─────►│ Google Calendar │
│   (Frontend)    │       │  (Backend)        │       │     API         │
└─────────────────┘       └───────────────────┘       └─────────────────┘
        │                         │
        │                         ▼
        │                 ┌───────────────────┐
        └────────────────►│   Supabase DB     │
                          │ (calendar_sync)   │
                          └───────────────────┘
```

## Etapas de Implementação

### 1. Configurar Conector Google Calendar

Utilizar o conector `google_calendar` disponível no Lovable Cloud para autenticação OAuth com a conta Google do usuário.

### 2. Criar Tabela de Sincronização

Nova tabela `calendar_sync_settings` para armazenar configurações por usuário:

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID | Chave primária |
| user_id | UUID | Referência ao usuário |
| tenant_id | UUID | Referência ao tenant |
| google_calendar_id | TEXT | ID do calendário Google selecionado |
| sync_enabled | BOOLEAN | Sincronização ativa |
| last_sync_at | TIMESTAMPTZ | Última sincronização |
| sync_token | TEXT | Token para sincronização incremental |

Nova tabela `calendar_event_mappings` para mapear eventos locais com Google:

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID | Chave primária |
| tenant_id | UUID | Referência ao tenant |
| local_event_type | TEXT | "orcamento" ou "servico" |
| local_event_id | UUID | ID do evento local |
| google_event_id | TEXT | ID do evento no Google |
| last_synced_at | TIMESTAMPTZ | Última sincronização |

### 3. Criar Edge Functions

**`google-calendar-sync`** - Função principal para sincronização:
- Listar calendários disponíveis do usuário
- Criar/atualizar/excluir eventos no Google Calendar
- Buscar alterações do Google Calendar
- Sincronização incremental usando sync tokens

**`google-calendar-webhook`** - Webhook para receber notificações:
- Receber push notifications do Google Calendar
- Processar alterações e atualizar banco de dados local

### 4. Modificar Página de Configurações

Adicionar nova seção "Integrações" em `Configuracoes.tsx`:
- Botão para conectar Google Calendar
- Seleção do calendário a sincronizar
- Toggle para ativar/desativar sincronização
- Botão para sincronização manual
- Status da última sincronização

### 5. Modificar Componentes do Calendário

**`CalendarioMensal.tsx`**, **`CalendarioSemanal.tsx`**, etc.:
- Exibir badge indicando eventos sincronizados com Google
- Adicionar indicador visual de status de sincronização

**`CompromissoDialog.tsx`**:
- Adicionar checkbox "Sincronizar com Google Agenda"
- Disparar sincronização ao criar/editar evento

### 6. Criar Hook de Sincronização

`useGoogleCalendarSync.ts`:
- Gerenciar estado de conexão
- Disparar sincronização
- Atualizar status de sincronização

### 7. Implementar Sincronização Automática

Quando orçamentos/serviços são criados ou modificados:
1. Serviço detecta mudança
2. Edge function envia para Google Calendar
3. Mapping é atualizado no banco

Quando alterações vêm do Google:
1. Webhook recebe notificação
2. Edge function busca detalhes da alteração
3. Atualiza tabela correspondente (fato_orcamento ou fato_servico)

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| Migração SQL | Criar | Tabelas calendar_sync_settings e calendar_event_mappings |
| `supabase/functions/google-calendar-sync/index.ts` | Criar | Edge function principal de sincronização |
| `supabase/functions/google-calendar-webhook/index.ts` | Criar | Webhook para receber notificações do Google |
| `src/hooks/useGoogleCalendarSync.ts` | Criar | Hook para gerenciar sincronização |
| `src/components/settings/GoogleCalendarSettings.tsx` | Criar | Componente de configuração do Google Calendar |
| `src/pages/Configuracoes.tsx` | Modificar | Adicionar seção de integrações |
| `src/pages/Calendario.tsx` | Modificar | Adicionar indicador de sincronização |
| `src/components/calendario/CompromissoDialog.tsx` | Modificar | Adicionar opção de sincronização |

---

## Fluxo de Usuário

1. Usuário acessa **Configurações** → **Integrações**
2. Clica em **"Conectar Google Agenda"**
3. Autoriza acesso via OAuth do Google
4. Seleciona qual calendário Google deseja sincronizar
5. Ativa sincronização automática
6. A partir desse momento:
   - Novos orçamentos/serviços com data são enviados ao Google
   - Alterações no Google são refletidas no dashboard

---

## Detalhes Técnicos

### Gateway do Google Calendar

Todas as chamadas à API do Google passam pelo gateway do Lovable:

```typescript
const GATEWAY_URL = 'https://gateway.lovable.dev/google_calendar/calendar/v3';

// Exemplo: Listar calendários
const response = await fetch(`${GATEWAY_URL}/users/me/calendarList`, {
  headers: {
    'Authorization': `Bearer ${LOVABLE_API_KEY}`,
    'X-Connection-Api-Key': GOOGLE_CALENDAR_API_KEY,
  }
});
```

### Formato de Evento Google

```typescript
{
  summary: "🛠️ Nome do Serviço - Cliente",
  description: "Serviço de topografia",
  start: { date: "2026-02-10" },  // Evento de dia inteiro
  end: { date: "2026-02-12" },
  extendedProperties: {
    private: {
      geogestor_type: "servico",
      geogestor_id: "uuid-do-servico"
    }
  }
}
```

### RLS Policies

As novas tabelas terão políticas RLS para garantir isolamento por tenant:

```sql
CREATE POLICY "Users can manage own sync settings"
ON calendar_sync_settings
FOR ALL
USING (user_id = auth.uid());
```

---

## Resultado Esperado

- Botão "Conectar Google Agenda" nas configurações
- Sincronização automática de novos orçamentos/serviços
- Alterações no Google refletidas no dashboard (polling ou webhook)
- Indicador visual de eventos sincronizados no calendário
- Suporte a sincronização manual sob demanda
