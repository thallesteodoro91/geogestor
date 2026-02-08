

## Rate Limiting nas Edge Functions

### Objetivo
Adicionar proteção contra ataques de forca bruta em todas as 3 edge functions do sistema: `geobot-chat`, `invite-user` e `accept-invite`.

### Abordagem
Implementar um rate limiter **in-memory** usando um `Map` que armazena contadores por IP. Essa abordagem funciona bem para edge functions do Supabase, pois cada instancia mantem seu proprio estado durante o tempo de vida do container.

### Limites por Funcao

| Funcao | Limite | Janela | Justificativa |
|--------|--------|--------|---------------|
| `geobot-chat` | 20 requisicoes | 60 segundos | Previne abuso da API de IA |
| `invite-user` | 5 requisicoes | 60 segundos | Previne spam de convites |
| `accept-invite` | 10 requisicoes | 60 segundos | Previne tentativas de brute-force em tokens |

### Implementacao

Cada edge function recebera um bloco de rate limiting no inicio do seu handler, antes de qualquer logica de negocio:

```text
  Requisicao recebida
        |
  [CORS preflight?] -- Sim --> Responde 200
        |
       Nao
        |
  [Extrair IP do header]
        |
  [Verificar contador no Map]
        |
  [Limite excedido?] -- Sim --> Responde 429 + Retry-After
        |
       Nao
        |
  [Incrementar contador]
        |
  [Logica normal da funcao]
```

### Detalhes Tecnicos

1. **Classe `RateLimiter`** -- Sera definida inline em cada funcao (edge functions nao permitem imports entre pastas):
   - `Map<string, { count: number, resetAt: number }>` para armazenar estado
   - Metodo `isRateLimited(ip: string): boolean`
   - Limpeza automatica de entradas expiradas a cada verificacao
   - Limite configuravel de `maxRequests` e `windowMs`

2. **Extracao do IP** -- Usa o header `x-forwarded-for` (padrao em proxies/CDN) com fallback para `"unknown"`

3. **Resposta 429** -- Retorna status HTTP 429 com:
   - Header `Retry-After` indicando segundos ate reset
   - Corpo JSON com mensagem amigavel em portugues
   - Headers CORS mantidos

4. **Logging** -- Cada bloqueio gera um log estruturado para monitoramento

### Arquivos Modificados

- `supabase/functions/geobot-chat/index.ts` -- Adicionar rate limiter (20 req/min)
- `supabase/functions/invite-user/index.ts` -- Adicionar rate limiter (5 req/min)
- `supabase/functions/accept-invite/index.ts` -- Adicionar rate limiter (10 req/min)

