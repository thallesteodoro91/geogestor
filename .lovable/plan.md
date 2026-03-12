

## Avaliacao do SaaS -- Problemas e Melhorias Pendentes

Apos analise completa do codigo, aqui esta o diagnostico:

---

### Problemas a Corrigir

| # | Problema | Severidade | Arquivo |
|---|----------|------------|---------|
| 1 | **STRIPE_WEBHOOK_SECRET nao configurado** | CRITICA | Secrets |
| 2 | **FAQ com informacao errada sobre trial** | Media | `Assinatura.tsx` |
| 3 | **simulate-expiry usa status "expired" em vez de "trialing"** | Media | `simulate-expiry/index.ts` |
| 4 | **Resend envia de `notifications@resend.dev`** | Baixa | `trial-expiry-reminder/index.ts` |

---

### Detalhes

**1. STRIPE_WEBHOOK_SECRET ausente**
O webhook do Stripe funciona sem verificacao de assinatura (fallback dev mode). Em producao, qualquer pessoa pode enviar requests forjados para alterar status de assinaturas. E necessario configurar este segredo para seguranca real.

**2. FAQ diz "Oferecemos um plano gratuito com funcionalidades basicas"**
Na verdade o sistema oferece 7 dias de trial com acesso completo, nao um plano gratuito limitado. O texto engana o usuario.

Correcao: Alterar para "Oferecemos 7 dias de avaliacao gratuita com acesso completo a todas as funcionalidades."

**3. simulate-expiry define status="expired"**
O `ProtectedRoute` verifica `!isActive` (status !== 'active'). O status "expired" funciona para bloquear, mas nao e um status real que o Stripe webhook define. Para simular o cenario real de trial expirado, deveria usar status "trialing" com data no passado (que e exatamente o bug que corrigimos). Assim o teste valida o cenario real.

Correcao: Mudar `status: "expired"` para `status: "trialing"` na acao "expire".

**4. Email do remetente usa dominio generico**
O Resend so permite enviar de `@resend.dev` em modo teste. Para producao real, seria necessario verificar um dominio proprio. Isso e uma limitacao do Resend, nao do codigo -- mas vale documentar.

---

### Funcionalidades SaaS ja Implementadas (OK)

- Signup com verificacao de email
- Auto-provisioning de tenant + trial 7 dias
- ProtectedRoute bloqueia trial expirado
- Tela de assinatura expirada com CTA
- Pagina de assinatura com 4 planos
- Checkout Stripe em nova aba
- Webhook Stripe para sincronizacao
- check-subscription para polling
- Retorno pos-checkout com banner de sucesso
- Customer Portal para gerenciamento
- TrialBanner com contagem regressiva
- Email de lembrete 2 dias antes
- Limites de plano (usuarios, propriedades, clientes)
- Isolamento multi-tenant via RLS

---

### Mudancas Tecnicas

**1. `src/pages/Assinatura.tsx`** -- Corrigir texto do FAQ (linha 365):
```
"Oferecemos 7 dias de avaliação gratuita com acesso completo. Após o período, escolha um dos planos pagos."
```

**2. `supabase/functions/simulate-expiry/index.ts`** -- Usar status "trialing" na acao expire (linha 79):
```typescript
status: "trialing",  // simula trial real expirado
```

**3. Configurar `STRIPE_WEBHOOK_SECRET`** -- Solicitar ao usuario que adicione o segredo via ferramenta de secrets.

### Arquivos a Editar

1. `src/pages/Assinatura.tsx` -- Corrigir FAQ
2. `supabase/functions/simulate-expiry/index.ts` -- Corrigir status de teste
3. Adicionar secret `STRIPE_WEBHOOK_SECRET`

