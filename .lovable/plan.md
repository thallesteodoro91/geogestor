

## Adicionar Botao "Renovar Assinatura" na Tela de Expiracao

### O que sera feito

Quando o usuario entra na conta e a assinatura esta expirada, a tela `SubscriptionExpiredScreen` atualmente mostra apenas a opcao de "Sair" e pede para contatar o administrador. A alteracao adiciona um botao "Renovar Assinatura" que redireciona para `/assinatura`, permitindo que o proprio usuario escolha um plano e pague.

### Alteracoes

**Arquivo:** `src/components/plan/SubscriptionExpiredScreen.tsx`

1. Importar `useNavigate` do react-router-dom e o icone `Sparkles`
2. Substituir o texto "Entre em contato com o administrador" por uma mensagem que incentive a renovacao direta
3. Adicionar um botao principal "Renovar Assinatura" ao lado do botao "Sair", com estilo gradient (mesmo padrao da pagina `/assinatura`) que navega para `/assinatura`
4. O botao "Renovar Assinatura" fica como acao primaria (destaque visual), e o "Sair" como secundario

**Resultado visual:**
```text
+----------------------------------+
|     ⚠ Assinatura Expirada        |
|                                  |
|  Seu periodo do plano Completo   |
|  expirou em 23 de fevereiro...   |
|                                  |
|  👑 Renove para continuar        |
|  Escolha um plano e recupere     |
|  o acesso completo ao GeoGestor. |
|                                  |
|  [✨ Renovar Assinatura] [Sair]  |
+----------------------------------+
```

Nenhuma outra alteracao necessaria -- a rota `/assinatura` ja existe e funciona de forma independente (nao requer `ProtectedRoute`).

