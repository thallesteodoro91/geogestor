

# Refatorar Notificacoes para Supabase Realtime

## Situacao Atual

O hook `useNotifications.ts` ja possui uma subscription Realtime basica para INSERTs (linhas 208-221), mas o `NotificationsMenu.tsx` ainda usa `setInterval` para verificar pagamentos pendentes a cada hora (linhas 54-72). A subscription existente nao dispara Toast e nao filtra por tenant.

## Mudancas Planejadas

### 1. `src/hooks/useNotifications.ts`

**Melhorar a subscription Realtime existente (linhas 204-226):**
- Adicionar filtro por `tenant_id` na subscription usando `filter: 'tenant_id=eq.{tenantId}'`
- Disparar `toast.info("Nova notificacao: {titulo}")` quando uma nova notificacao chegar via Realtime
- Tambem escutar eventos DELETE para manter o estado sincronizado quando notificacoes sao removidas por outros dispositivos/abas
- Buscar o `tenantId` antes de configurar o channel para aplicar o filtro

**Remover `checkPendingPayments` do retorno do hook:**
- A funcao `checkPendingPayments` sera movida para ser chamada apenas uma vez no mount (dentro do proprio hook), sem expor para o componente
- Remover a necessidade do `NotificationsMenu` gerenciar intervalos

**Manter a verificacao inicial de pagamentos pendentes dentro do hook:**
- Chamar `checkPendingPayments` uma unica vez no `useEffect` de inicializacao, usando `sessionStorage` para controlar frequencia (max 1x por hora)
- Sem `setInterval` -- novas notificacoes geradas pela RPC serao capturadas automaticamente pelo Realtime

### 2. `src/components/layout/NotificationsMenu.tsx`

**Remover todo o `useEffect` com `setInterval` (linhas 53-72):**
- O componente nao precisa mais gerenciar polling -- o Realtime cuida de tudo
- Remover `checkPendingPayments` da desestruturacao do hook

## Detalhes Tecnicos

### Subscription Realtime com filtro de tenant

```typescript
const setupRealtime = async () => {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return;

  // Verificar pagamentos 1x por sessao
  const lastCheck = sessionStorage.getItem('lastPaymentCheck');
  const now = Date.now();
  if (!lastCheck || now - parseInt(lastCheck) > 3600000) {
    checkPendingPayments();
    sessionStorage.setItem('lastPaymentCheck', now.toString());
  }

  const channel = supabase
    .channel('notificacoes-realtime')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notificacoes',
        filter: `tenant_id=eq.${tenantId}`
      },
      (payload) => {
        const nova = payload.new as Notification;
        setNotifications(prev => [nova, ...prev].slice(0, 10));
        toast.info(`Nova notificação: ${nova.titulo}`);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'notificacoes',
        filter: `tenant_id=eq.${tenantId}`
      },
      (payload) => {
        const removed = payload.old as any;
        setNotifications(prev =>
          prev.filter(n => n.id_notificacao !== removed.id_notificacao)
        );
      }
    )
    .subscribe();

  return channel;
};
```

### Arquivos Modificados

| Arquivo | Mudanca |
|---------|---------|
| `src/hooks/useNotifications.ts` | Melhorar Realtime com filtro tenant, toast, DELETE; internalizar check de pagamentos; remover `checkPendingPayments` do retorno |
| `src/components/layout/NotificationsMenu.tsx` | Remover useEffect com setInterval e referencia a checkPendingPayments |

## Resultado

- Notificacoes aparecem instantaneamente via Realtime (filtradas por tenant)
- Toast automatico "Nova notificacao: [titulo]" ao receber INSERT
- Sem polling/setInterval -- zero chamadas desnecessarias
- Verificacao de pagamentos pendentes mantida 1x por sessao (dentro do hook)
- Estado sincronizado entre abas via eventos DELETE

