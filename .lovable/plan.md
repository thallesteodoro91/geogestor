

## Plano: Auditoria e Otimização do Funil de Pagamento

### Diagnóstico do funil atual

**Funil mapeado:**
```
Trial expira → /assinatura → escolhe plano → Stripe Checkout (nova aba)
  → success_url=/configuracoes?checkout=success → toast + banner
  → cancel_url=/assinatura?checkout=canceled → sem feedback
```

**Falhas críticas detectadas:**

| # | Problema | Impacto |
|---|---|---|
| 1 | **Sem página de confirmação dedicada.** Usuário cai em `/configuracoes` com só um banner — falta o "momento UAU" que confirma que a compra deu certo | Reduz percepção de conclusão; gera dúvida "será que pagou?" |
| 2 | **Cancelamento silencioso.** `?checkout=canceled` não é tratado em `/assinatura` — usuário volta sem feedback nem ajuda | Perde oportunidade de recuperar a venda |
| 3 | **Falta de trust signals próximos ao CTA.** "Pagamento seguro", "Cancele quando quiser", "Acesso imediato" só aparecem no FAQ, lá embaixo | Hesitação no momento da decisão |
| 4 | **Sem garantia explícita.** O FAQ diz "pode cancelar", mas não há um selo/promessa visível ("7 dias grátis", "Sem multa", "Cancele em 1 clique") | Risco percebido alto |
| 5 | **CTA do plano selecionado não destaca economia em R$.** "Anual R$70/mês" exige cálculo mental — falta "Você economiza R$324/ano" mais visível | Reduz conversão para anual (maior LTV) |
| 6 | **Botão de checkout abre em nova aba** (`window.open`). Mobile (viewport 393px) — usuário pode achar que nada aconteceu, ou perder a aba | Abandono em mobile |
| 7 | **Sem prova social.** Nenhum depoimento, contagem de clientes, logo de marcas | Falta validação externa |
| 8 | **Pós-checkout não orienta próximo passo.** Cai em Configurações genérico — deveria dizer "agora cadastre seu primeiro cliente" ou "importe sua planilha" | Perde momentum de onboarding |

### O que vou construir

**1. Nova página `/checkout-sucesso` (`src/pages/CheckoutSucesso.tsx`)**
- Animação de confirmação (CheckCircle verde grande, confetti opcional)
- Headline: **"Pagamento confirmado! 🎉"**
- Subtítulo: **"Bem-vindo ao GeoGestor. Vamos configurar sua empresa em 2 minutos."**
- Detalhes do plano comprado (nome, valor, próxima cobrança) — busca via `useStripeSubscription`
- 3 CTAs claros de próximos passos (cards):
  - 📊 **Importar minha planilha** → `/importacao`
  - 👥 **Cadastrar primeiro cliente** → `/clientes`
  - ⚙️ **Personalizar minha empresa** → `/configuracoes`
- Botão principal: **"Começar agora"** → `/` (dashboard)
- Link discreto: "Recibo enviado para seu e-mail"
- Atualiza `useStripeSubscription` ao montar (refetch)

**2. Nova página `/checkout-cancelado` (`src/pages/CheckoutCancelado.tsx`)**
- Tom empático, não culpado: **"Sem problema, sua compra foi cancelada"**
- "Seu trial continua ativo até X" (se aplicável)
- Reforço de valor (3 bullets curtos do que está deixando de ter)
- 2 CTAs:
  - **"Voltar e escolher um plano"** → `/assinatura`
  - "Falar com suporte" → e-mail/WhatsApp
- Reduz fricção: oferece desconto se relevante (futuro)

**3. Atualizar `create-checkout` edge function**
- `success_url` → `${origin}/checkout-sucesso?session_id={CHECKOUT_SESSION_ID}`
- `cancel_url` → `${origin}/checkout-cancelado`
- Adicionar `allow_promotion_codes: true` (cupons)
- Adicionar `billing_address_collection: 'auto'`

**4. Melhorar `Assinatura.tsx` — Trust & Conversão**

Inserir **bloco de trust signals** logo acima da grid de planos:
```
🔒 Pagamento 100% seguro    ✅ Cancele quando quiser    ⚡ Acesso imediato
```

Adicionar abaixo de cada CTA "Assinar Agora":
- Microtexto: *"Sem fidelidade. Cancele em 1 clique."*

**Garantia visível** em uma faixa destacada antes do FAQ:
```
🛡️ Garantia de 7 dias
Não gostou? Cancele em até 7 dias e não cobramos nada.
```

Reescrever microcopy do botão final:
- Atual: "Assinar Agora" 
- Novo: "Assinar Agora — R$ {valor}/mês" (mostra preço no botão = remove dúvida)

**Destacar economia em R$** no card Anual com badge maior:
```
💰 Economia de R$ 324 por ano
```

**5. Pequenas correções de UX**
- Em mobile (393px), substituir `window.open` por `window.location.href` para o checkout (evita perder aba)
- Em desktop, manter `window.open` com `_blank` mas adicionar toast: *"Abrimos o pagamento em uma nova aba"*
- No retorno de cancelamento, em vez de só remover param, mostrar toast âmbar "Compra cancelada — seus dados estão salvos"

**6. Prova social leve** (sem inventar números)
- Bloco discreto: **"Empresas de topografia confiam no GeoGestor"** + logos placeholder ou contagem real (`SELECT count(*) FROM tenants WHERE created_at < ...`) — ex: *"+50 empresas usando hoje"*
- Se não houver dados reais suficientes, pular esta parte (não fingir)

### Arquivos

| Arquivo | Mudança |
|---|---|
| `src/pages/CheckoutSucesso.tsx` | **Novo** — página de confirmação pós-pagamento |
| `src/pages/CheckoutCancelado.tsx` | **Novo** — página de recuperação pós-cancelamento |
| `src/App.tsx` | Adicionar rotas `/checkout-sucesso` e `/checkout-cancelado` (públicas, lazy) |
| `src/pages/Assinatura.tsx` | Trust badges acima dos planos; garantia de 7 dias; microcopy nos CTAs; preço no botão; fix mobile open |
| `src/pages/Configuracoes.tsx` | Remover lógica `?checkout=success` (agora vai para página própria) |
| `supabase/functions/create-checkout/index.ts` | Atualizar success_url/cancel_url; adicionar `allow_promotion_codes` e `billing_address_collection` |

Sem migrações. Sem mudanças de schema. Sem novo provedor de pagamento (Stripe já está integrado).

### Princípio
Cada etapa do funil deve responder UMA pergunta do usuário sem que ele precise pensar:
- **Pricing:** "Qual escolher?" → Anual destacado + economia em R$
- **Antes do CTA:** "Posso confiar?" → Trust badges + garantia
- **No CTA:** "Quanto vou pagar?" → Valor no botão
- **Cancelou:** "E agora?" → Página empática com retomada
- **Pagou:** "Deu certo? E agora?" → Página de boas-vindas + 3 próximos passos claros

