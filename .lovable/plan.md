

## Plano: Corrigir fluxo OAuth do Google Calendar (popup bloqueado)

### Problema

O fluxo atual usa `window.open` (popup) para abrir a tela de autorização do Google. Isso é bloqueado pelo ambiente de preview do Lovable (iframe sandbox) e também por muitos navegadores com bloqueio de popups. O erro "ERR_BLOCKED_BY_RESPONSE" confirma isso.

### Solução

Trocar de **popup** para **redirect flow**: redirecionar a página inteira para o Google OAuth, e após autorização, o callback redireciona de volta para a página de Configurações do app com um parâmetro de sucesso na URL.

### Mudanças

**1. Edge Function `google-calendar-auth` — callback redirect**
- Em vez de retornar HTML com `window.opener.postMessage`, redirecionar (HTTP 302) para `{origin}/configuracoes?google-calendar=success` ou `?google-calendar=error`.
- Usar o campo `origin` do state para montar a URL de retorno.

**2. Frontend `google-calendar.service.ts` — usar redirect**
- `connectGoogleCalendar()` passa a fazer `window.location.href = data.url` em vez de `window.open`.
- Remover toda a lógica de popup, `postMessage`, e timeout.

**3. Frontend `GoogleCalendarCard.tsx` — detectar retorno**
- Ao montar, verificar se a URL contém `?google-calendar=success` ou `error`.
- Se sim, exibir toast de sucesso/erro, limpar o parâmetro da URL, e invalidar a query de status.

**4. Página `Configuracoes.tsx`**
- Nenhuma mudança necessária (o card já está renderizado lá).

### Detalhes técnicos

Edge function callback (substituir as respostas HTML):
```typescript
// Success → redirect back to app
const redirectUrl = `${stateData.origin}/configuracoes?google-calendar=success`;
return new Response(null, {
  status: 302,
  headers: { ...corsHeaders, Location: redirectUrl },
});
```

Frontend connect (simplificado):
```typescript
export async function connectGoogleCalendar(): Promise<void> {
  // ... get auth URL ...
  window.location.href = data.url; // full page redirect
}
```

GoogleCalendarCard — useEffect para detectar retorno:
```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const gcResult = params.get('google-calendar');
  if (gcResult === 'success') {
    toast.success('Google Calendar conectado!');
    queryClient.invalidateQueries({ queryKey: ['google-calendar-status'] });
    // Clean URL
    window.history.replaceState({}, '', '/configuracoes');
  } else if (gcResult === 'error') {
    toast.error('Erro ao conectar Google Calendar');
    window.history.replaceState({}, '', '/configuracoes');
  }
}, []);
```

