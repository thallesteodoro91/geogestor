
## Diagnóstico: Tela Branca ao Clicar em "Assinar Agora"

### Causa raiz identificada

O código atual usa `window.location.href = data.url` para redirecionar o usuário ao Stripe Checkout. Isso substitui completamente a página atual pela página de pagamento do Stripe (`checkout.stripe.com`). O resultado visível é uma **tela branca** momentânea enquanto o browser carrega o domínio externo — e se o redirecionamento falhar silenciosamente (por políticas do browser, bloqueadores ou permissões do iframe), a página simplesmente fica em branco.

A solução correta, conforme as boas práticas do próprio Stripe, é abrir o checkout em uma nova aba usando `window.open(data.url, "_blank")`. Isso:
- Mantém o usuário no app durante o pagamento
- Evita a tela branca
- Permite que o usuário feche a aba do Stripe e volte ao app facilmente

### Segundo problema encontrado: erro 500 na edge function

Ao testar a edge function diretamente, ela retorna `{"error":"Usuário não autenticado"}` com status 500. Isso ocorre porque a função usa `supabase.auth.getUser(token)` com um client criado com a `SUPABASE_ANON_KEY` sem passar o token nos headers globais — o padrão correto é passar a Authorization no client ou usar `getClaims`. Isso pode estar causando falha silenciosa no frontend: `error` retorna com mensagem mas o toast não aparece porque a tela já ficou branca.

### O que será alterado

**Arquivo: `src/pages/Assinatura.tsx`**

Linha 110: substituir `window.location.href = data.url` por `window.open(data.url, "_blank")`.

Isso é a única mudança necessária no frontend.

**Arquivo: `supabase/functions/create-checkout/index.ts`**

Corrigir a autenticação do usuário para passar o token corretamente no client do Supabase, seguindo o padrão recomendado — criando o client com o Authorization header global, garantindo que `getUser()` funcione:

```typescript
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_ANON_KEY") ?? "",
  { global: { headers: { Authorization: authHeader } } }
);
const { data: { user }, error: userError } = await supabase.auth.getUser();
```

Além disso, a leitura do body (`req.json()`) deve acontecer **antes** da autenticação para evitar que o stream seja consumido incorretamente — vamos reorganizar a ordem de leitura para ser mais segura.

### Resumo das mudanças

| Arquivo | Mudança |
|---|---|
| `src/pages/Assinatura.tsx` | `window.location.href` → `window.open(..., "_blank")` |
| `supabase/functions/create-checkout/index.ts` | Corrigir autenticação passando token no client Supabase + reorganizar leitura do body |

### Por que apenas isso resolve o problema

A tela branca é causada pelo redirecionamento da aba atual. Ao abrir em nova aba, o usuário continua vendo o app e o Stripe Checkout abre normalmente. A correção da edge function garante que a autenticação funcione corretamente e o checkout seja gerado sem erros.
